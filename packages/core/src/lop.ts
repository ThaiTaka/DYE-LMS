/**
 * Class lifecycle — deleting a class, and attaching curriculum to one.
 *
 * ── Why deleting a class is not just `DELETE FROM "Class"` ───────────────────
 * Four things hang off a class with ON DELETE CASCADE:
 *
 *     ClassCourse       which curriculum the class is working through
 *     Enrollment        who is in it
 *     LessonOverride    class-wide unlocks and prerequisite waivers
 *     Announcement      what the class was told
 *
 * CASCADE is right for all four — none of them means anything without the class
 * — but it makes the delete quiet in exactly the place it should be loud. An
 * admin clearing out a mistyped class and an admin clearing out the class thirty
 * children are sitting in issue the identical statement.
 *
 * So `xoaLopHoc` refuses on the first attempt whenever the class still holds
 * active students, and comes back with the counts instead. The second call,
 * carrying `xacNhan`, goes through. The student ACCOUNTS are never touched:
 * an Enrollment is a membership row, and removing it un-enrols a child rather
 * than deleting them. Their submissions, drafts and progress all survive,
 * because those hang off the student, not off the class.
 *
 * ── Authorization ────────────────────────────────────────────────────────────
 * Deleting is ADMIN-only, matching `taoLopHoc`: deciding a class exists and
 * deciding it stops existing are the same kind of decision, and both change who
 * can see which children.
 *
 * Attaching a course is different. It is ordinary teaching work — "we are
 * starting Python Cơ Bản this term" — so it goes through `authorize()` with
 * `{ resource: 'class', action: 'manage' }`, which admits an admin OR the
 * teacher who actually runs that class, through the same relationship every
 * other teacher action uses.
 */
import { authorize } from './authz';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { Actor, SessionContext } from './session';

/** Audit actions for the class lifecycle. */
export const CLASS_AUDIT = {
  DELETED: 'class.deleted',
  ARCHIVED: 'class.archived',
  RESTORED: 'class.restored',
  COURSE_ATTACHED: 'class.course_attached',
  COURSE_DETACHED: 'class.course_detached',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Impact analysis
// ═══════════════════════════════════════════════════════════════════════════

/** What deleting this class would take with it, in the words an admin needs. */
export interface AnhHuongXoaLop {
  classId: string;
  ma: string;
  ten: string;
  giaoVien: string;
  /** Children currently in the class. The number that makes this a real decision. */
  hocSinhDangHoc: number;
  /** Including those who already left. */
  hocSinhTungHoc: number;
  khoaHoc: number;
  canThiepBaiHoc: number;
  thongBao: number;
  canhBaoTapTrung: number;
  /** True when nothing is attached and the delete is a formality. */
  trong: boolean;
}

export async function anhHuongXoaLop(
  db: PrismaClient,
  classId: string,
): Promise<AnhHuongXoaLop> {
  const klass = await db.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      code: true,
      name: true,
      teacher: { select: { displayName: true } },
    },
  });
  if (!klass) throw new ForbiddenError('class-not-found');

  const [hocSinhDangHoc, hocSinhTungHoc, khoaHoc, canThiepBaiHoc, thongBao, canhBaoTapTrung] =
    await Promise.all([
      db.enrollment.count({ where: { classId, isActive: true } }),
      db.enrollment.count({ where: { classId } }),
      db.classCourse.count({ where: { classId } }),
      db.lessonOverride.count({ where: { classId } }),
      db.announcement.count({ where: { classId } }),
      db.focusAlert.count({ where: { classId } }),
    ]);

  return {
    classId: klass.id,
    ma: klass.code,
    ten: klass.name,
    giaoVien: klass.teacher.displayName,
    hocSinhDangHoc,
    hocSinhTungHoc,
    khoaHoc,
    canThiepBaiHoc,
    thongBao,
    canhBaoTapTrung,
    trong:
      hocSinhTungHoc === 0 && khoaHoc === 0 && canThiepBaiHoc === 0 && thongBao === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Delete
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "This class still has children in it" is an EXPECTED answer, not an
 * exception, so it comes back as data with the impact attached — the caller
 * renders a confirmation rather than an error page. A genuine refusal (not an
 * admin) still throws, because that is never a step in a normal workflow.
 */
export type KetQuaXoaLop =
  | { trangThai: 'da-xoa'; ten: string; ma: string; hocSinhGoRa: number }
  | { trangThai: 'can-xac-nhan'; anhHuong: AnhHuongXoaLop };

async function requireQuanTriXoaLop(actor: Actor): Promise<void> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role !== 'ADMIN') throw new ForbiddenError('only-admin-deletes-class');
}

/**
 * Permanently delete a class.
 *
 * Pass `xacNhan: true` to go through with a class that still holds students.
 * Without it, a class with any active enrolment comes back as `can-xac-nhan`
 * and nothing is written — the counts are the answer, and the admin decides.
 *
 * Archiving (`luuTruLopHoc`) is the better answer for a class that has simply
 * finished: it keeps the roster, the history and the announcements, and it is
 * reversible.
 */
export async function xoaLopHoc(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  options: { xacNhan?: boolean | undefined } = {},
  context: SessionContext = {},
): Promise<KetQuaXoaLop> {
  await requireQuanTriXoaLop(actor);

  const anhHuong = await anhHuongXoaLop(db, classId);

  if (anhHuong.hocSinhDangHoc > 0 && options.xacNhan !== true) {
    return { trangThai: 'can-xac-nhan', anhHuong };
  }

  // Written BEFORE the delete: AuditLog.entityId is a plain string, so the
  // record of what happened survives the disappearance of its subject.
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: CLASS_AUDIT.DELETED,
      entityType: 'Class',
      entityId: classId,
      meta: {
        ma: anhHuong.ma,
        ten: anhHuong.ten,
        giaoVien: anhHuong.giaoVien,
        hocSinhDangHoc: anhHuong.hocSinhDangHoc,
        khoaHoc: anhHuong.khoaHoc,
      },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  await db.class.delete({ where: { id: classId } });

  return {
    trangThai: 'da-xoa',
    ten: anhHuong.ten,
    ma: anhHuong.ma,
    hocSinhGoRa: anhHuong.hocSinhDangHoc,
  };
}

/**
 * Archive a class instead of deleting it.
 *
 * The right answer for a class that has finished the term: the roster, the
 * history and every announcement stay exactly where they are, and it flips back
 * with one call.
 */
export async function luuTruLopHoc(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  luuTru: boolean,
  context: SessionContext = {},
): Promise<{ ten: string; daLuuTru: boolean }> {
  await requireQuanTriXoaLop(actor);

  const klass = await db.class.update({
    where: { id: classId },
    data: { isArchived: luuTru },
    select: { name: true, isArchived: true },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: luuTru ? CLASS_AUDIT.ARCHIVED : CLASS_AUDIT.RESTORED,
      entityType: 'Class',
      entityId: classId,
      meta: { ten: klass.name },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { ten: klass.name, daLuuTru: klass.isArchived };
}

// ═══════════════════════════════════════════════════════════════════════════
// Curriculum assignment
// ═══════════════════════════════════════════════════════════════════════════

export interface KhoaHocChonDuoc {
  courseId: string;
  slug: string;
  title: string;
  iconEmoji: string;
  totalSessions: number;
  /** Already attached to this class. */
  daGan: boolean;
}

/**
 * Every published course, flagged with whether this class already has it.
 *
 * Returns the attached ones too rather than filtering them out, so the UI can
 * render one list that both offers and detaches — a dropdown that silently
 * omits what is already there leaves a teacher wondering where the course went.
 */
export async function khoaHocChoLop(
  db: PrismaClient,
  classId: string,
): Promise<KhoaHocChonDuoc[]> {
  const [courses, attached] = await Promise.all([
    db.course.findMany({
      where: { isPublished: true },
      select: { id: true, slug: true, title: true, iconEmoji: true, totalSessions: true },
      orderBy: { order: 'asc' },
    }),
    db.classCourse.findMany({ where: { classId }, select: { courseId: true } }),
  ]);

  const daCo = new Set(attached.map((a) => a.courseId));

  return courses.map((c) => ({
    courseId: c.id,
    slug: c.slug,
    title: c.title,
    iconEmoji: c.iconEmoji,
    totalSessions: c.totalSessions,
    daGan: daCo.has(c.id),
  }));
}

export type KetQuaGanKhoaHoc =
  | { trangThai: 'da-gan'; tenKhoa: string; soBuoi: number }
  | { trangThai: 'da-co'; tenKhoa: string }
  | { trangThai: 'khong-thay-khoa' };

/**
 * Attach a course to a class.
 *
 * This is what populates a class with curriculum: until a `ClassCourse` row
 * exists, every student in the class opens their dashboard to nothing. It is
 * also the moment lesson gating starts applying to them, which is why the
 * result reports the session count — "30 buổi" is the thing the teacher is
 * actually committing the class to.
 *
 * Admin OR the class's own teacher, decided by `authorize()` rather than by a
 * role check here.
 */
export async function ganKhoaHocVaoLop(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  courseId: string,
  context: SessionContext = {},
): Promise<KetQuaGanKhoaHoc> {
  await authorize(db, actor, { resource: 'class', action: 'manage', classId });

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, totalSessions: true, isPublished: true },
  });
  if (!course || !course.isPublished) return { trangThai: 'khong-thay-khoa' };

  const daCo = await db.classCourse.findUnique({
    where: { classId_courseId: { classId, courseId } },
    select: { id: true },
  });
  if (daCo) return { trangThai: 'da-co', tenKhoa: course.title };

  await db.classCourse.create({ data: { classId, courseId } });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: CLASS_AUDIT.COURSE_ATTACHED,
      entityType: 'Class',
      entityId: classId,
      meta: { courseId, tenKhoa: course.title },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { trangThai: 'da-gan', tenKhoa: course.title, soBuoi: course.totalSessions };
}

/**
 * Detach a course from a class.
 *
 * Deletes ONE join row. Every student's `LessonProgress`, `Submission` and
 * `CodeDraft` is keyed on the lesson or block, not on the class, so re-attaching
 * the course later brings all of their work back exactly as they left it.
 */
export async function goKhoaHocKhoiLop(
  db: PrismaClient,
  actor: Actor,
  classId: string,
  courseId: string,
  context: SessionContext = {},
): Promise<{ tenKhoa: string } | null> {
  await authorize(db, actor, { resource: 'class', action: 'manage', classId });

  const link = await db.classCourse.findUnique({
    where: { classId_courseId: { classId, courseId } },
    select: { id: true, course: { select: { title: true } } },
  });
  if (!link) return null;

  await db.classCourse.delete({ where: { id: link.id } });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: CLASS_AUDIT.COURSE_DETACHED,
      entityType: 'Class',
      entityId: classId,
      meta: { courseId, tenKhoa: link.course.title },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { tenKhoa: link.course.title };
}
