/**
 * Staff account lifecycle — retiring a teacher without losing the record.
 *
 * ── Why this module exists ───────────────────────────────────────────────────
 * Five foreign keys point at a teacher with ON DELETE RESTRICT:
 *
 *     Class.teacherId              who runs the class
 *     TrackAssignment.assignedBy   who decided this child works on Nâng cao
 *     LessonOverride.createdBy     who unlocked this lesson, and why
 *     Announcement.authorId        what the class was told
 *     Feedback.authorId            what a student was told about their work
 *
 * Those are not an oversight to be worked around with CASCADE. Every one of them
 * records a decision a named adult made about a specific child, and the reason
 * they survive their author is that "who decided this, and when?" must stay
 * answerable after that adult leaves the school. A CASCADE here would delete a
 * student's feedback history because a teacher changed jobs.
 *
 * The consequence is that `DELETE FROM "User"` fails for any teacher who has
 * ever done their job. This module makes the intended paths explicit:
 *
 *   1. DEACTIVATE (the default, and almost always the right answer) — access
 *      ends immediately, the record stays whole, the account can be restored.
 *   2. TRANSFER then DELETE — a named successor inherits the record, so every
 *      row still points at a real accountable person, and only then is the row
 *      removed.
 *
 * ── Authorization ────────────────────────────────────────────────────────────
 * Every function here takes an already-authorized `actor`. Deleting staff is an
 * ADMIN action and is checked here rather than only at the route, because this
 * is the module that can actually destroy data.
 */
import { authorize } from './authz';
import { ForbiddenError } from './errors';
import { hashPassword, MIN_PASSWORD_LENGTH } from './password';
import { revokeAllSessions } from './session';

import type { PrismaClient, Role } from '@prisma/client';
import type { Actor, SessionContext } from './session';

/** Audit actions for the account lifecycle. */
export const ACCOUNT_AUDIT = {
  CREATED: 'account.created',
  DEACTIVATED: 'account.deactivated',
  REACTIVATED: 'account.reactivated',
  RECORD_TRANSFERRED: 'account.record_transferred',
  CLASS_REASSIGNED: 'account.class_reassigned',
  DELETED: 'account.deleted',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Impact analysis
// ═══════════════════════════════════════════════════════════════════════════

/** What a hard delete would collide with, in the words an admin needs. */
export interface RangBuocXoa {
  /** Classes this teacher runs. Blocking, and the heaviest: it moves students. */
  lop: number;
  /** Students currently reachable through those classes. */
  hocSinh: number;
  /** Differentiation decisions ("this child is on Nâng cao"). */
  nhanhDaGiao: number;
  /** Lesson unlocks / locks / prerequisite waivers. */
  canThiepBaiHoc: number;
  /** Class announcements. */
  thongBao: number;
  /** Written feedback on student work. */
  nhanXet: number;
}

export interface AnhHuongXoaTaiKhoan {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  rangBuoc: RangBuocXoa;
  /** Total blocking rows. Zero means a plain delete would succeed. */
  tongRangBuoc: number;
  /** True when nothing references this account. */
  xoaTrucTiepDuoc: boolean;
}

/**
 * Count everything that would block deleting this account.
 *
 * Deliberately reports counts rather than ids: the caller is deciding "is this
 * safe and what does it cost?", and pulling every override row to answer that
 * would be wasteful on a teacher with years of history.
 */
export async function anhHuongXoaTaiKhoan(
  db: PrismaClient,
  userId: string,
): Promise<AnhHuongXoaTaiKhoan> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, role: true, isActive: true },
  });
  if (!user) throw new ForbiddenError('account-not-found');

  const [lop, hocSinh, nhanhDaGiao, canThiepBaiHoc, thongBao, nhanXet] = await Promise.all([
    db.class.count({ where: { teacherId: userId } }),
    db.enrollment.count({
      where: { isActive: true, class: { teacherId: userId } },
    }),
    db.trackAssignment.count({ where: { assignedBy: userId } }),
    db.lessonOverride.count({ where: { createdBy: userId } }),
    db.announcement.count({ where: { authorId: userId } }),
    db.feedback.count({ where: { authorId: userId } }),
  ]);

  const rangBuoc: RangBuocXoa = {
    lop,
    hocSinh,
    nhanhDaGiao,
    canThiepBaiHoc,
    thongBao,
    nhanXet,
  };

  // `hocSinh` is a consequence of `lop`, not an independent foreign key — it is
  // reported so an admin sees the human cost, but counting it as a blocker would
  // double-count the classes that already block.
  const tongRangBuoc = lop + nhanhDaGiao + canThiepBaiHoc + thongBao + nhanXet;

  return {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    rangBuoc,
    tongRangBuoc,
    xoaTrucTiepDuoc: tongRangBuoc === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Guards shared by every destructive path
// ═══════════════════════════════════════════════════════════════════════════

/** Refuse unless the actor is an active admin acting on someone else. */
async function requireAdminActingOnOther(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
): Promise<{ id: string; username: string; displayName: string; role: Role }> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role !== 'ADMIN') throw new ForbiddenError('only-admin-manages-staff');

  // An admin removing their own account can lock everyone out of the system.
  if (actor.id === targetId) throw new ForbiddenError('cannot-remove-own-account');

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, username: true, displayName: true, role: true },
  });
  if (!target) throw new ForbiddenError('account-not-found');
  if (target.role === 'STUDENT') throw new ForbiddenError('use-student-flow-for-students');

  return target;
}

/** Refuse to remove the last route into the system. */
async function requireAnotherActiveAdmin(db: PrismaClient, excludingId: string): Promise<void> {
  const others = await db.user.count({
    where: { role: 'ADMIN', isActive: true, id: { not: excludingId } },
  });
  if (others === 0) throw new ForbiddenError('last-active-admin');
}

// ═══════════════════════════════════════════════════════════════════════════
// Path 1 — deactivate (the default)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retire a staff account without deleting anything.
 *
 * This is the answer in nearly every real case. Access stops on the next
 * request — `validateSession` re-reads `isActive` every time — and every
 * pedagogical decision keeps its author.
 */
export async function voHieuHoaNhanVien(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
  context: SessionContext = {},
): Promise<{ sessionsRevoked: number }> {
  const target = await requireAdminActingOnOther(db, actor, targetId);
  if (target.role === 'ADMIN') await requireAnotherActiveAdmin(db, targetId);

  // Both halves or neither: an account flagged inactive while its sessions
  // survive is the exact gap this is meant to close.
  const [, revoked] = await db.$transaction([
    db.user.update({ where: { id: targetId }, data: { isActive: false } }),
    db.session.deleteMany({ where: { userId: targetId } }),
  ]);

  const sessionsRevoked = revoked.count;
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: ACCOUNT_AUDIT.DEACTIVATED,
      entityType: 'User',
      entityId: targetId,
      meta: { username: target.username, role: target.role, sessionsRevoked },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { sessionsRevoked };
}

/** Put a retired account back into service. */
export async function khoiPhucNhanVien(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
  context: SessionContext = {},
): Promise<void> {
  const target = await requireAdminActingOnOther(db, actor, targetId);

  await db.user.update({ where: { id: targetId }, data: { isActive: true } });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: ACCOUNT_AUDIT.REACTIVATED,
      entityType: 'User',
      entityId: targetId,
      meta: { username: target.username },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Path 2 — transfer, then delete
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaChuyenGiao {
  lop: number;
  nhanhDaGiao: number;
  canThiepBaiHoc: number;
  thongBao: number;
  nhanXet: number;
  baiTap: number;
}

/**
 * Move every teaching record from one member of staff to another.
 *
 * Runs as ONE transaction. A partial transfer would leave a teacher owning the
 * class but not the differentiation decisions inside it — a state in which the
 * authorization layer says the successor may see the students while the audit
 * trail still credits someone who has left.
 *
 * Transferring a class is a real grant of access: the successor can, from that
 * moment, read those students' work. The caller must present this as such and
 * not as a filing detail.
 */
export async function chuyenGiaoHoSoGiangDay(
  db: PrismaClient,
  actor: Actor,
  fromTeacherId: string,
  toTeacherId: string,
  context: SessionContext = {},
): Promise<KetQuaChuyenGiao> {
  const from = await requireAdminActingOnOther(db, actor, fromTeacherId);

  if (fromTeacherId === toTeacherId) throw new ForbiddenError('transfer-to-self');

  const to = await db.user.findUnique({
    where: { id: toTeacherId },
    select: { id: true, username: true, role: true, isActive: true },
  });
  if (!to) throw new ForbiddenError('successor-not-found');
  // An inactive successor would leave the classes unreachable by anyone.
  if (!to.isActive) throw new ForbiddenError('successor-disabled');
  if (to.role === 'STUDENT') throw new ForbiddenError('successor-not-staff');

  const result = await db.$transaction(async (tx) => {
    const lop = await tx.class.updateMany({
      where: { teacherId: fromTeacherId },
      data: { teacherId: toTeacherId },
    });
    const nhanhDaGiao = await tx.trackAssignment.updateMany({
      where: { assignedBy: fromTeacherId },
      data: { assignedBy: toTeacherId },
    });
    const canThiepBaiHoc = await tx.lessonOverride.updateMany({
      where: { createdBy: fromTeacherId },
      data: { createdBy: toTeacherId },
    });
    const thongBao = await tx.announcement.updateMany({
      where: { authorId: fromTeacherId },
      data: { authorId: toTeacherId },
    });
    const nhanXet = await tx.feedback.updateMany({
      where: { authorId: fromTeacherId },
      data: { authorId: toTeacherId },
    });
    // Problem.authorId is nullable and set-null on delete, so it never blocks —
    // but leaving it pointing at a deleted teacher would orphan the edit rights
    // on those problems, so it moves with the rest.
    const baiTap = await tx.problem.updateMany({
      where: { authorId: fromTeacherId },
      data: { authorId: toTeacherId },
    });

    return {
      lop: lop.count,
      nhanhDaGiao: nhanhDaGiao.count,
      canThiepBaiHoc: canThiepBaiHoc.count,
      thongBao: thongBao.count,
      nhanXet: nhanXet.count,
      baiTap: baiTap.count,
    };
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: ACCOUNT_AUDIT.RECORD_TRANSFERRED,
      entityType: 'User',
      entityId: fromTeacherId,
      meta: { from: from.username, to: to.username, ...result },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return result;
}

/**
 * The outcome of asking to delete a staff account.
 *
 * "Still has records" is an EXPECTED answer, not an exception, so it comes back
 * as data with the impact attached — the caller renders a transfer form rather
 * than an error page. Genuine refusals (not an admin, last admin, self) still
 * throw, because those are never a step in a normal workflow.
 */
export type KetQuaXoaTaiKhoan =
  | { trangThai: 'da-xoa'; username: string }
  | { trangThai: 'con-rang-buoc'; anhHuong: AnhHuongXoaTaiKhoan };

/**
 * Permanently delete a staff account.
 *
 * Refuses unless the account owns nothing. Pass `chuyenGiaoCho` to move the
 * record to a named successor first; both steps then run in sequence and the
 * delete is attempted only against a clean account.
 *
 * Deactivation remains the better answer in almost every real case, and the UI
 * says so — this exists for genuine removals (an account created in error, a
 * duplicate, a data-protection request).
 */
export async function xoaTaiKhoanNhanVien(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
  options: { chuyenGiaoCho?: string | undefined } = {},
  context: SessionContext = {},
): Promise<KetQuaXoaTaiKhoan> {
  const target = await requireAdminActingOnOther(db, actor, targetId);
  if (target.role === 'ADMIN') await requireAnotherActiveAdmin(db, targetId);

  if (options.chuyenGiaoCho) {
    await chuyenGiaoHoSoGiangDay(db, actor, targetId, options.chuyenGiaoCho, context);
  }

  // Re-count AFTER any transfer: the transfer is what makes deletion legal, so
  // the check has to see the post-transfer state.
  const anhHuong = await anhHuongXoaTaiKhoan(db, targetId);
  if (!anhHuong.xoaTrucTiepDuoc) {
    return { trangThai: 'con-rang-buoc', anhHuong };
  }

  await revokeAllSessions(db, targetId);

  // The audit row is written BEFORE the delete: AuditLog.actorId is SET NULL on
  // user delete, but entityId is a plain string, so the record of what happened
  // survives the disappearance of its subject.
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: ACCOUNT_AUDIT.DELETED,
      entityType: 'User',
      entityId: targetId,
      meta: {
        username: target.username,
        role: target.role,
        transferredTo: options.chuyenGiaoCho ?? null,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  await db.user.delete({ where: { id: targetId } });

  return { trangThai: 'da-xoa', username: target.username };
}

/** Staff who could inherit another teacher's record. */
export async function nguoiCoTheNhanBanGiao(
  db: PrismaClient,
  excludingId: string,
): Promise<Array<{ id: string; username: string; displayName: string; role: Role }>> {
  return db.user.findMany({
    where: {
      isActive: true,
      role: { in: ['TEACHER', 'ADMIN'] },
      id: { not: excludingId },
    },
    select: { id: true, username: true, displayName: true, role: true },
    orderBy: { displayName: 'asc' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Provisioning — creating an account
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Roles an admin may mint from the web UI.
 *
 * Narrower than `Role` on purpose: a role arriving as a string from a form must
 * not be able to name something the UI never offered.
 */
export type VaiTroTaoDuoc = Extract<Role, 'ADMIN' | 'TEACHER' | 'STUDENT'>;

const VAI_TRO_TAO_DUOC: VaiTroTaoDuoc[] = ['ADMIN', 'TEACHER', 'STUDENT'];

/** Is this a role the provisioning form is allowed to create? */
export function laVaiTroTaoDuoc(gia: string): gia is VaiTroTaoDuoc {
  return (VAI_TRO_TAO_DUOC as string[]).includes(gia);
}

/**
 * Usernames are stored lowercase, and that is not cosmetic.
 *
 * `xacThucDangNhap` normalises the typed username with `.trim().toLowerCase()`
 * before the lookup, so a row stored with capitals could never be matched: the
 * account would be created successfully and be permanently impossible to log
 * into. Everything here lowercases before it validates.
 *
 * The character set matches the seeded accounts (`hs.dung`, `co.lan`) and
 * excludes whitespace and `@`, so a username cannot be mistaken for an email or
 * carry a look-alike space.
 */
const MAU_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/**
 * Admin passwords are held to 12 characters, everyone else to
 * MIN_PASSWORD_LENGTH.
 *
 * The same split as `prisma/scripts/tao-quan-tri.ts`: the student minimum stays
 * modest because twelve-year-olds have to type it, while an admin account can
 * read every child's record.
 */
const DO_DAI_MAT_KHAU_QUAN_TRI = 12;

export interface TaoTaiKhoanInput {
  username: string;
  password: string;
  displayName: string;
  role: VaiTroTaoDuoc;
  avatarUrl?: string | null;
  /** Classes to enrol a STUDENT into. Ignored for staff. */
  classIds?: string[];
  /**
   * Make the account choose its own password at first login. Defaults to true.
   *
   * `requireSession` in the web layer redirects on this flag, so the password an
   * admin types into the form never becomes the password a child keeps using.
   */
  mustChangePassword?: boolean;
}

export type KetQuaTaoTaiKhoan =
  | {
      trangThai: 'thanh-cong';
      id: string;
      username: string;
      displayName: string;
      role: Role;
      soLop: number;
    }
  /** Username already taken. Its own case, so the form can point at one field. */
  | { trangThai: 'trung-ten'; username: string }
  | { trangThai: 'khong-hop-le'; thongDiep: string };

/**
 * Refuse unless this actor may create THIS account.
 *
 * ── Why the guard takes the request, not just the actor ──────────────────────
 * "May you create accounts?" is not answerable on its own. An admin may create
 * anyone; a teacher may create a student in a class they actually run, and
 * nothing else. The role being minted and the classes being assigned are part of
 * the question, so they are arguments here rather than something the caller is
 * trusted to have checked.
 */
async function requireCoQuyenTaoTaiKhoan(
  db: PrismaClient,
  actor: Actor,
  role: VaiTroTaoDuoc,
  classIds: string[],
): Promise<void> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');

  // An admin provisions anyone, into any class, or into none.
  if (actor.role === 'ADMIN') return;

  if (actor.role !== 'TEACHER') throw new ForbiddenError('only-staff-creates-accounts');

  /*
   * A teacher may mint students, and only students.
   *
   * This is the privilege-escalation boundary. Without it the cheapest attack on
   * the entire system is a teacher creating a second account with role ADMIN and
   * logging into it — no exploit required, just a different value in a form
   * field the UI never renders for them.
   */
  if (role !== 'STUDENT') throw new ForbiddenError('teacher-cannot-create-staff');

  /*
   * And only into their own classes — at least one of them.
   *
   * Requiring a class is not bureaucracy. A student created with no enrolment is
   * invisible to the teacher who created them and absent from every roster, so
   * an unbounded number could be created with nothing tying them to anyone. An
   * admin may do that because an admin can see every account; a teacher sees
   * only their own classes, so their creations have to land where they can see
   * them.
   */
  if (classIds.length === 0) throw new ForbiddenError('teacher-must-assign-own-class');

  /*
   * `authorize()` rather than a query written here.
   *
   * It is the one place that decides "may this actor manage this class?", and it
   * answers from `Class.teacherId`. Reusing it means this path cannot drift from
   * the rest of the teacher surface: if class ownership ever changes shape, this
   * changes with it. A hand-rolled `findFirst` here would be a second opinion,
   * and second opinions about authorization are how gaps open.
   */
  await Promise.all(
    classIds.map((classId) =>
      authorize(db, actor, { resource: 'class', action: 'manage', classId }),
    ),
  );
}

/**
 * Accept an avatar URL only if a browser will treat it as a plain image source.
 *
 * The string is written straight into an `img` src. A `javascript:` URL there is
 * a script-execution sink, and CSP cannot help on a page already allowed to run
 * its own scripts. Absolute URLs must be http(s); anything else has to be a
 * site-relative path, and `//host` is excluded because it is protocol-relative
 * and leaves this origin.
 */
function anhHopLe(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Prisma's unique-constraint violation, without importing the error class. */
function laTrungKhoa(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Create a teacher, admin or student account.
 *
 * ── Who may call this ────────────────────────────────────────────────────────
 *   ADMIN    — anyone, into any class, or into none.
 *   TEACHER  — students only, and only into classes they run (see
 *              `requireCoQuyenTaoTaiKhoan`).
 *
 * ── Why this lives in core rather than in the server action ──────────────────
 * This function can mint an ADMIN, which is the most powerful thing the system
 * can do. Like the deletion paths above, it authorizes itself rather than
 * trusting its caller to have done so, which means the check cannot be lost by a
 * later refactor that adds a second call site — and the teacher path has exactly
 * that shape, since the UI now offers this to two different roles.
 *
 * Refusals a form should explain — a taken username, a password too short — come
 * back as values. Only "you may not do this at all" throws, because that is not
 * something the person filling in the form can fix by editing a field.
 */
export async function taoTaiKhoan(
  db: PrismaClient,
  actor: Actor,
  input: TaoTaiKhoanInput,
  context: SessionContext = {},
): Promise<KetQuaTaoTaiKhoan> {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const avatarUrl = input.avatarUrl?.trim() ?? '';
  const classIds = input.role === 'STUDENT' ? (input.classIds ?? []) : [];

  // After the role and classes are resolved, because they ARE the question —
  // and before any validation, so a refusal never depends on field order.
  await requireCoQuyenTaoTaiKhoan(db, actor, input.role, classIds);

  if (!MAU_USERNAME.test(username)) {
    return {
      trangThai: 'khong-hop-le',
      thongDiep:
        'Tên đăng nhập cần 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm, ' +
        'gạch ngang hoặc gạch dưới, và bắt đầu bằng chữ hoặc số.',
    };
  }

  if (!displayName) {
    return { trangThai: 'khong-hop-le', thongDiep: 'Họ và tên không được để trống.' };
  }

  const toiThieu = input.role === 'ADMIN' ? DO_DAI_MAT_KHAU_QUAN_TRI : MIN_PASSWORD_LENGTH;
  if (input.password.length < toiThieu) {
    return {
      trangThai: 'khong-hop-le',
      thongDiep:
        `Mật khẩu phải có ít nhất ${toiThieu} ký tự` +
        (input.role === 'ADMIN' ? ' với tài khoản quản trị.' : '.'),
    };
  }

  if (avatarUrl && !anhHopLe(avatarUrl)) {
    return {
      trangThai: 'khong-hop-le',
      thongDiep: 'Hình đại diện phải là địa chỉ http(s) hoặc đường dẫn bắt đầu bằng dấu gạch chéo.',
    };
  }

  // Checked before the insert so a stale class id reads as a sentence rather
  // than as a foreign-key violation.
  if (classIds.length > 0) {
    const co = await db.class.count({ where: { id: { in: classIds }, isArchived: false } });
    if (co !== classIds.length) {
      return {
        trangThai: 'khong-hop-le',
        thongDiep: 'Có lớp không tồn tại hoặc đã lưu trữ. Thầy cô chọn lại giúp em nhé.',
      };
    }
  }

  const dangCo = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (dangCo) return { trangThai: 'trung-ten', username };

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    // Enrollments are nested so the account and its class rows land in one
    // statement. A student created but silently enrolled nowhere would look
    // correct on this page and be missing from every roster.
    user = await db.user.create({
      data: {
        username,
        passwordHash,
        displayName,
        role: input.role,
        avatarUrl: avatarUrl || null,
        isActive: true,
        mustChangePassword: input.mustChangePassword ?? true,
        ...(classIds.length > 0
          ? { enrollments: { create: classIds.map((classId) => ({ classId })) } }
          : {}),
      },
      select: { id: true, username: true, displayName: true, role: true },
    });
  } catch (error) {
    // Two admins submitting the same username between the check above and this
    // insert. The unique index is the real arbiter; this turns its error into
    // the message the pre-check would have given.
    if (laTrungKhoa(error)) return { trangThai: 'trung-ten', username };
    throw error;
  }

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: ACCOUNT_AUDIT.CREATED,
      entityType: 'User',
      entityId: user.id,
      meta: { username: user.username, role: user.role, soLop: classIds.length },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return {
    trangThai: 'thanh-cong',
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    soLop: classIds.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Assigning classes to a teacher
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaPhanCongLop {
  /** Classes that actually changed hands. */
  daChuyen: Array<{ ten: string; tuAi: string }>;
  /** Classes already held by this person, left alone. */
  giuNguyen: number;
}

/** Refuse unless the actor is an active admin, and the target can hold a class. */
async function requireQuanTriPhanCongLop(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
): Promise<{ id: string; displayName: string }> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');

  /*
   * ADMIN only, and deliberately not relational.
   *
   * Everywhere else a teacher's reach is bounded by `Class.teacherId`, so it is
   * tempting to let a teacher hand their own class to a colleague. That would be
   * the one relational rule that grants rather than limits: whoever holds a class
   * holds access to those children's records, so a teacher able to reassign could
   * pass that access around without anyone with oversight involved. Moving
   * children between adults is an administrative act.
   */
  if (actor.role !== 'ADMIN') throw new ForbiddenError('only-admin-assigns-classes');

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, displayName: true, role: true, isActive: true },
  });
  if (!target) throw new ForbiddenError('target-not-found');

  // A class whose teacher cannot log in is a class nobody is running.
  if (!target.isActive) throw new ForbiddenError('target-inactive');
  if (target.role === 'STUDENT') throw new ForbiddenError('student-cannot-hold-class');

  return { id: target.id, displayName: target.displayName };
}

/**
 * Hand classes to a member of staff.
 *
 * ── Every assignment is a REASSIGNMENT ───────────────────────────────────────
 * `Class.teacherId` is not nullable, so no class is ever unheld and there is no
 * "unassigned" pool to draw from. Giving a class to someone always takes it from
 * someone else, which is why the result names who each class came from and why
 * the caller shows that before the admin confirms. It is also why the UI can only
 * add: "unticking" a class would have to mean assigning it to nobody, and the
 * column forbids that.
 *
 * ── What moves, and what deliberately does not ───────────────────────────────
 * Only `Class.teacherId`. `TrackAssignment.assignedBy`, `LessonOverride.createdBy`,
 * `Announcement.authorId` and `Feedback.authorId` keep pointing at whoever made
 * those decisions — see the note at the top of this file. The new teacher runs
 * the class from now on; they did not retroactively decide that a child belongs on
 * Nâng cao. `chuyenGiaoHoSoGiangDay` is the flow for moving authorship, and it
 * exists because someone is leaving.
 *
 * ── No session work ──────────────────────────────────────────────────────────
 * The teacher losing a class keeps their session, and loses sight of those
 * children on their very next request: `authorize()` and `visibleStudentIds()`
 * both read `Class.teacherId` every time rather than caching a scope at login.
 * Revoking sessions here would log someone out of their other classes for no
 * reason.
 */
export async function phanCongLopHoc(
  db: PrismaClient,
  actor: Actor,
  targetId: string,
  classIds: string[],
  context: SessionContext = {},
): Promise<KetQuaPhanCongLop> {
  const target = await requireQuanTriPhanCongLop(db, actor, targetId);

  if (classIds.length === 0) throw new ForbiddenError('no-class-selected');

  const lop = await db.class.findMany({
    where: { id: { in: classIds }, isArchived: false },
    select: { id: true, name: true, teacherId: true, teacher: { select: { displayName: true } } },
  });

  // An id that names nothing, or names an archived class, is not a partial
  // success. Refusing the whole batch means the admin sees a stale form for what
  // it is instead of half a reassignment.
  if (lop.length !== classIds.length) throw new ForbiddenError('class-not-found-or-archived');

  const canChuyen = lop.filter((l) => l.teacherId !== target.id);

  await db.$transaction([
    db.class.updateMany({
      where: { id: { in: canChuyen.map((l) => l.id) } },
      data: { teacherId: target.id },
    }),
    // One row per class: each is a separate group of children changing hands, and
    // "who was running this class in March?" has to stay answerable per class.
    ...canChuyen.map((l) =>
      db.auditLog.create({
        data: {
          actorId: actor.id,
          action: ACCOUNT_AUDIT.CLASS_REASSIGNED,
          entityType: 'Class',
          entityId: l.id,
          meta: {
            lop: l.name,
            tuAi: l.teacher.displayName,
            tuId: l.teacherId,
            choAi: target.displayName,
            choId: target.id,
          },
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent ?? null,
        },
      }),
    ),
  ]);

  return {
    daChuyen: canChuyen.map((l) => ({ ten: l.name, tuAi: l.teacher.displayName })),
    giuNguyen: lop.length - canChuyen.length,
  };
}
