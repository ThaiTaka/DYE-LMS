/**
 * Student account lifecycle.
 *
 * ── Why this is a separate module from accounts.ts ───────────────────────────
 * `accounts.ts` guards every destructive path with `requireAdminActingOnOther`,
 * which refuses outright for a STUDENT target ("use-student-flow-for-students").
 * That refusal is deliberate: the two flows are not the same shape.
 *
 * A teacher account is blocked from deletion by five ON DELETE RESTRICT foreign
 * keys, because it AUTHORED decisions about children, and those decisions must
 * keep their author. A student account is the opposite: everything pointing at
 * it is theirs and CASCADEs — enrolments, progress, submissions, drafts,
 * snapshots, quiz attempts, XP, badges, projects. Nothing blocks the delete, so
 * nothing stops it from being quiet.
 *
 * That is exactly the risk. Deleting a student is one statement that silently
 * destroys a term of their work, and a mistyped click is indistinguishable from
 * an intended one. So the first call REFUSES and reports what would be lost;
 * only a second call carrying `xacNhan` goes through.
 *
 * ── Deactivate first ─────────────────────────────────────────────────────────
 * `voHieuHoaHocSinh` is the right answer in almost every real case: access stops
 * on the very next request (`validateSession` re-reads `isActive`), every
 * submission and every piece of feedback stays intact, and it is reversible.
 * Deletion exists for accounts created in error, duplicates, and data-protection
 * requests — and it is ADMIN-only, while deactivation is available to the
 * teacher who actually teaches the child.
 */
import { authorize } from './authz';
import { ForbiddenError } from './errors';
import { revokeAllSessions } from './session';

import type { PrismaClient } from '@prisma/client';
import type { Actor, SessionContext } from './session';

export const STUDENT_AUDIT = {
  DEACTIVATED: 'student.deactivated',
  REACTIVATED: 'student.reactivated',
  DELETED: 'student.deleted',
  UNENROLLED: 'student.unenrolled',
  ENROLLED: 'student.enrolled',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Impact analysis
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What deleting this account would destroy.
 *
 * Everything here CASCADEs, so none of it blocks. It is reported precisely
 * because it does not block: the counts are the only thing standing between an
 * admin and a term of a child's work.
 */
export interface AnhHuongXoaHocSinh {
  studentId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  /** Classes the child is currently in. */
  lop: number;
  tenLop: string[];
  baiNop: number;
  tienDoBaiHoc: number;
  banNhapCode: number;
  lamTracNghiem: number;
  duAn: number;
  huyHieu: number;
  /** Everything above, added up. Zero means the account was never used. */
  tongBanGhi: number;
}

export async function anhHuongXoaHocSinh(
  db: PrismaClient,
  studentId: string,
): Promise<AnhHuongXoaHocSinh> {
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { id: true, username: true, displayName: true, role: true, isActive: true },
  });
  if (!student) throw new ForbiddenError('account-not-found');
  if (student.role !== 'STUDENT') throw new ForbiddenError('use-staff-flow-for-staff');

  const [enrollments, baiNop, tienDoBaiHoc, banNhapCode, lamTracNghiem, duAn, huyHieu] =
    await Promise.all([
      db.enrollment.findMany({
        where: { studentId, isActive: true },
        select: { class: { select: { name: true } } },
        orderBy: { enrolledAt: 'asc' },
      }),
      db.submission.count({ where: { studentId } }),
      db.lessonProgress.count({ where: { studentId } }),
      db.codeDraft.count({ where: { studentId } }),
      db.quizAttempt.count({ where: { studentId } }),
      db.gameProject.count({ where: { studentId } }),
      db.studentBadge.count({ where: { studentId } }),
    ]);

  return {
    studentId: student.id,
    username: student.username,
    displayName: student.displayName,
    isActive: student.isActive,
    lop: enrollments.length,
    tenLop: enrollments.map((e) => e.class.name),
    baiNop,
    tienDoBaiHoc,
    banNhapCode,
    lamTracNghiem,
    duAn,
    huyHieu,
    tongBanGhi: baiNop + tienDoBaiHoc + banNhapCode + lamTracNghiem + duAn + huyHieu,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Deactivate — the default
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Stop a student signing in, without touching anything they made.
 *
 * Open to the teacher who teaches them, through the usual relational check —
 * a child who has to be locked out mid-lesson should not require finding an
 * admin first. Their sessions are revoked in the same transaction, so
 * "deactivated but still logged in" cannot happen.
 */
export async function voHieuHoaHocSinh(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  context: SessionContext = {},
): Promise<{ sessionsRevoked: number; displayName: string }> {
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId });

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { username: true, displayName: true, role: true },
  });
  if (!student) throw new ForbiddenError('account-not-found');
  if (student.role !== 'STUDENT') throw new ForbiddenError('use-staff-flow-for-staff');

  const [, revoked] = await db.$transaction([
    db.user.update({ where: { id: studentId }, data: { isActive: false } }),
    db.session.deleteMany({ where: { userId: studentId } }),
  ]);

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: STUDENT_AUDIT.DEACTIVATED,
      entityType: 'User',
      entityId: studentId,
      meta: { username: student.username, sessionsRevoked: revoked.count },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { sessionsRevoked: revoked.count, displayName: student.displayName };
}

/** Put a student account back into service. */
export async function khoiPhucHocSinh(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  context: SessionContext = {},
): Promise<{ displayName: string }> {
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId });

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { username: true, displayName: true, role: true },
  });
  if (!student) throw new ForbiddenError('account-not-found');
  if (student.role !== 'STUDENT') throw new ForbiddenError('use-staff-flow-for-staff');

  await db.user.update({ where: { id: studentId }, data: { isActive: true } });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: STUDENT_AUDIT.REACTIVATED,
      entityType: 'User',
      entityId: studentId,
      meta: { username: student.username },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { displayName: student.displayName };
}

// ═══════════════════════════════════════════════════════════════════════════
// Delete
// ═══════════════════════════════════════════════════════════════════════════

export type KetQuaXoaHocSinh =
  | { trangThai: 'da-xoa'; username: string; displayName: string; daXoaBanGhi: number }
  | { trangThai: 'can-xac-nhan'; anhHuong: AnhHuongXoaHocSinh };

/**
 * Permanently delete a student account and everything it owns.
 *
 * ADMIN-only, and refused on the first call whenever the account has any work
 * attached. The caller renders the returned impact as a confirmation; a second
 * call with `xacNhan: true` goes through.
 *
 * An account that was never used deletes on the first call — there is nothing
 * to confirm about destroying zero rows, and making an admin click twice to
 * remove a typo'd username teaches them to click twice without reading.
 */
export async function xoaTaiKhoanHocSinh(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  options: { xacNhan?: boolean | undefined } = {},
  context: SessionContext = {},
): Promise<KetQuaXoaHocSinh> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role !== 'ADMIN') throw new ForbiddenError('only-admin-deletes-student');
  if (actor.id === studentId) throw new ForbiddenError('cannot-remove-own-account');

  const anhHuong = await anhHuongXoaHocSinh(db, studentId);

  if (anhHuong.tongBanGhi > 0 && options.xacNhan !== true) {
    return { trangThai: 'can-xac-nhan', anhHuong };
  }

  await revokeAllSessions(db, studentId);

  // Before the delete: AuditLog.actorId is SET NULL on user delete, but
  // entityId is a plain string, so this row outlives its subject.
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: STUDENT_AUDIT.DELETED,
      entityType: 'User',
      entityId: studentId,
      meta: {
        username: anhHuong.username,
        displayName: anhHuong.displayName,
        lop: anhHuong.tenLop,
        baiNop: anhHuong.baiNop,
        tienDoBaiHoc: anhHuong.tienDoBaiHoc,
        tongBanGhi: anhHuong.tongBanGhi,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  await db.user.delete({ where: { id: studentId } });

  return {
    trangThai: 'da-xoa',
    username: anhHuong.username,
    displayName: anhHuong.displayName,
    daXoaBanGhi: anhHuong.tongBanGhi,
  };
}

/**
 * Take a student out of one class without touching their account.
 *
 * The middle option between "leave it" and "delete it", and the one that
 * actually matches most requests: a child moved to another class. The
 * enrolment is marked inactive rather than removed, so their work in that
 * class's courses stays attributable to the time they were in it.
 */
export async function goHocSinhKhoiLop(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  classId: string,
  context: SessionContext = {},
): Promise<{ daGo: boolean; tenLop: string }> {
  await authorize(db, actor, { resource: 'class', action: 'manage', classId });

  const enrollment = await db.enrollment.findUnique({
    where: { classId_studentId: { classId, studentId } },
    select: { id: true, isActive: true, class: { select: { name: true } } },
  });
  if (!enrollment) throw new ForbiddenError('enrollment-not-found');

  if (!enrollment.isActive) return { daGo: false, tenLop: enrollment.class.name };

  await db.enrollment.update({ where: { id: enrollment.id }, data: { isActive: false } });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: STUDENT_AUDIT.UNENROLLED,
      entityType: 'User',
      entityId: studentId,
      meta: { classId, tenLop: enrollment.class.name },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { daGo: true, tenLop: enrollment.class.name };
}

/**
 * Put a student into a class.
 *
 * The missing half of `goHocSinhKhoiLop`. Until this existed, an `Enrollment`
 * row could only be created as part of `taoTaiKhoan`, so a child created
 * without a class — or removed from their last one — could never be put back.
 * Their detail page had no course to build a path from, and the only way out
 * was to delete the account and make a new one, which destroys every submission
 * they had ever made.
 *
 * ── Additive on purpose ──────────────────────────────────────────────────────
 * `Enrollment` is many-to-many and `taoTaiKhoan` already takes a list, so a
 * child may sit in several classes at once. This function therefore ADDS one
 * and never removes another. A transfer is "add the new, then
 * `goHocSinhKhoiLop` the old" — two explicit steps, because a function that
 * silently emptied a child out of every other class would be a destructive act
 * hiding inside an additive-sounding name.
 *
 * ── Re-enrolment reuses the row ──────────────────────────────────────────────
 * `@@unique([classId, studentId])` means a child who left and came back cannot
 * get a second row. Flipping `isActive` back is also the honest record: their
 * work in that class's courses was always theirs, and a fresh row would reset
 * `enrolledAt` and imply they had never been there before.
 *
 * ── Who may do this ──────────────────────────────────────────────────────────
 * `class:manage` — an admin, or the teacher who owns THIS class. Note that this
 * is permission over the class, not over the child: a teacher who owns a class
 * can enrol a student they did not previously teach, and by doing so gains
 * sight of that child. That is why the audit row below names the actor.
 */
export type KetQuaXepLop =
  | { trangThai: 'da-xep'; tenLop: string }
  | { trangThai: 'da-khoi-phuc'; tenLop: string }
  | { trangThai: 'da-o-trong-lop'; tenLop: string };

export async function xepHocSinhVaoLop(
  db: PrismaClient,
  actor: Actor,
  studentId: string,
  classId: string,
  context: SessionContext = {},
): Promise<KetQuaXepLop> {
  await authorize(db, actor, { resource: 'class', action: 'manage', classId });

  const lop = await db.class.findUnique({
    where: { id: classId },
    select: { name: true, isArchived: true },
  });
  // Unknown id reads as forbidden rather than "not found", matching the rest of
  // this layer: which ids exist is not something a caller gets to enumerate.
  if (!lop) throw new ForbiddenError('class-not-found');
  if (lop.isArchived) throw new ForbiddenError('class-archived');

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { role: true },
  });
  if (!student) throw new ForbiddenError('student-not-found');
  // A teacher id in the student field would otherwise create an enrolment that
  // every roster query then has to know to ignore.
  if (student.role !== 'STUDENT') throw new ForbiddenError('not-a-student');

  const dangCo = await db.enrollment.findUnique({
    where: { classId_studentId: { classId, studentId } },
    select: { id: true, isActive: true },
  });

  // Already there. Reported rather than thrown: clicking twice is not an error,
  // and no audit row is written for a change that did not happen.
  if (dangCo?.isActive) return { trangThai: 'da-o-trong-lop', tenLop: lop.name };

  if (dangCo) {
    await db.enrollment.update({ where: { id: dangCo.id }, data: { isActive: true } });
  } else {
    await db.enrollment.create({ data: { classId, studentId } });
  }

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: STUDENT_AUDIT.ENROLLED,
      entityType: 'User',
      entityId: studentId,
      meta: { classId, tenLop: lop.name, khoiPhuc: dangCo !== null },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { trangThai: dangCo ? 'da-khoi-phuc' : 'da-xep', tenLop: lop.name };
}
