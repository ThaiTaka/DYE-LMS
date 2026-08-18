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
import { ForbiddenError } from './errors';
import { revokeAllSessions } from './session';

import type { PrismaClient, Role } from '@prisma/client';
import type { Actor, SessionContext } from './session';

/** Audit actions for the account lifecycle. */
export const ACCOUNT_AUDIT = {
  DEACTIVATED: 'account.deactivated',
  REACTIVATED: 'account.reactivated',
  RECORD_TRANSFERRED: 'account.record_transferred',
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
