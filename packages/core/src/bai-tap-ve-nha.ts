/**
 * Teacher-set homework ("bài tập về nhà"): set for a class, handed in by each
 * student, read and answered by the teacher.
 *
 * ── Who reaches what ─────────────────────────────────────────────────────────
 * Creating one is `class: manage` on the chosen class. Everything after that
 * goes through `authorize({ resource: 'homework' })`, which resolves the
 * homework to its CLASS and applies the one relationship this codebase trusts:
 * the teacher who runs the class manages it, a student actively enrolled in it
 * reads it and hands in. `Homework.teacherId` records who wrote it and is never
 * consulted for access — a class reassigned to another teacher takes its
 * homework, and its children's work, with it.
 *
 * ── The hand-in lifecycle ────────────────────────────────────────────────────
 *
 *     chưa nộp ──nộp──▶ đã nộp ──nộp lại──▶ đã nộp ──chấm──▶ đã chấm (frozen)
 *
 * One row per (homework, student). Re-submitting overwrites the code until a
 * teacher grades it; after that the student can no longer change it, so the
 * feedback always describes the code printed beside it. A hand-in after the
 * deadline is accepted and marked late rather than refused.
 *
 * ── Not judged ───────────────────────────────────────────────────────────────
 * Homework never reaches the judge worker. It is free-form practice a teacher
 * reads, which is why there are no test cases here and no verdict — only
 * feedback in the teacher's own words.
 */
import { authorize, requireActor } from './authz';
import { GIOI_HAN_KY_TU } from './code';
import { ForbiddenError } from './errors';

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Actor, SessionContext } from './session';

export const BAI_TAP_AUDIT = {
  CREATED: 'homework.created',
  GRADED: 'homework.graded',
} as const;

export const BAI_TAP_TIEU_DE_TOI_DA = 160;
export const BAI_TAP_MO_TA_TOI_DA = 10_000;
export const BAI_TAP_NHAN_XET_TOI_DA = 4000;

/** How far ahead a deadline may be set. Further than this is a typo in the year. */
const HAN_NOP_XA_NHAT_MS = 366 * 24 * 60 * 60 * 1000;

/**
 * Where a homework stands for one student.
 *
 * `qua-han` is "not handed in, and the deadline has passed". It is a state the
 * student can still leave by handing in — late work is accepted — so the page
 * presents it as "still to do", in amber, never as a closed door.
 */
export type TrangThaiBaiTap = 'chua-nop' | 'qua-han' | 'da-nop' | 'da-cham';

/** The lesson a homework was set after, when the teacher linked one. */
export interface BaiHocGanBaiTap {
  slug: string;
  buoi: number;
  tenBai: string;
}

function trangThaiCua(
  hanNop: Date,
  baiNop: { isGraded: boolean } | null | undefined,
  bayGio: Date,
): TrangThaiBaiTap {
  if (baiNop?.isGraded) return 'da-cham';
  if (baiNop) return 'da-nop';
  return hanNop.getTime() < bayGio.getTime() ? 'qua-han' : 'chua-nop';
}

function baiHocCua(
  lesson: { slug: string; order: number; title: string } | null,
): BaiHocGanBaiTap | null {
  return lesson ? { slug: lesson.slug, buoi: lesson.order, tenBai: lesson.title } : null;
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
 * The classes whose homework this member of staff sees in a list.
 *
 * The list-view twin of the `homework` rule in `authorize`: the same
 * `Class.teacherId` relationship, so a list and the detail page it links to can
 * never disagree about what is visible.
 */
function phamViLop(actor: Actor): Prisma.ClassWhereInput {
  const me = requireActor(actor);
  if (me.role === 'ADMIN') return {};
  if (me.role === 'TEACHER') return { teacherId: me.id };
  throw new ForbiddenError('student-cannot-list-homework');
}

// ═══════════════════════════════════════════════════════════════════════════
// Teacher: set a homework
// ═══════════════════════════════════════════════════════════════════════════

export interface TaoBaiTapInput {
  classId: string;
  /** Optional context. Must belong to a course attached to the class. */
  lessonId?: string | null | undefined;
  tieuDe: string;
  /** Markdown. */
  moTa: string;
  /** What the student's editor opens with. May be empty. */
  maMau: string;
  hanNop: Date;
}

export type KetQuaTaoBaiTap =
  | { trangThai: 'da-tao'; homeworkId: string; tenLop: string; soHocSinh: number }
  | { trangThai: 'khong-hop-le'; lyDo: string };

/**
 * Set a homework for one class.
 *
 * A form mistake — an empty title, a deadline in the past, a lesson from a
 * course the class does not study — comes back as `khong-hop-le` with the
 * sentence to show next to the form. Only a refusal the form cannot cause, a
 * class this teacher does not run, throws.
 */
export async function taoBaiTapVeNha(
  db: PrismaClient,
  actor: Actor,
  input: TaoBaiTapInput,
  context: SessionContext = {},
  bayGio: Date = new Date(),
): Promise<KetQuaTaoBaiTap> {
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-create-homework');
  await authorize(db, actor, { resource: 'class', action: 'manage', classId: input.classId });

  const khongHopLe = (lyDo: string): KetQuaTaoBaiTap => ({ trangThai: 'khong-hop-le', lyDo });

  const tieuDe = input.tieuDe.trim();
  const moTa = input.moTa.trim();
  // The template is code: its indentation and trailing newline are content, so
  // only the line endings a Windows browser adds are normalised.
  const maMau = input.maMau.replace(/\r\n?/g, '\n');

  if (!tieuDe) return khongHopLe('Bài tập cần có tên.');
  if (tieuDe.length > BAI_TAP_TIEU_DE_TOI_DA) {
    return khongHopLe(`Tên bài tập dài quá — tối đa ${BAI_TAP_TIEU_DE_TOI_DA} ký tự.`);
  }
  if (!moTa) return khongHopLe('Thầy cô viết vài dòng đề bài để các em biết cần làm gì nhé.');
  if (moTa.length > BAI_TAP_MO_TA_TOI_DA) {
    return khongHopLe(
      `Đề bài dài quá — tối đa ${BAI_TAP_MO_TA_TOI_DA.toLocaleString('vi-VN')} ký tự.`,
    );
  }
  if (maMau.length > GIOI_HAN_KY_TU) return khongHopLe('Mã mẫu dài quá (tối đa 64 KB).');

  const han = input.hanNop.getTime();
  if (Number.isNaN(han)) return khongHopLe('Hạn nộp không hợp lệ.');
  if (han <= bayGio.getTime()) return khongHopLe('Hạn nộp phải ở sau thời điểm hiện tại.');
  if (han - bayGio.getTime() > HAN_NOP_XA_NHAT_MS) {
    return khongHopLe('Hạn nộp xa quá — thầy cô kiểm tra lại năm giúp nhé.');
  }

  const lop = await db.class.findUnique({
    where: { id: input.classId },
    select: {
      name: true,
      isArchived: true,
      _count: { select: { enrollments: { where: { isActive: true } } } },
    },
  });
  // `authorize` already refused a teacher for an unknown id; an admin passes it
  // for any id, so the row can still be missing here.
  if (!lop) throw new ForbiddenError('class-not-found');
  if (lop.isArchived) {
    return khongHopLe('Lớp này đã được lưu trữ. Thầy cô bỏ lưu trữ lớp trước rồi hãy giao bài.');
  }

  let lessonId: string | null = null;
  if (input.lessonId) {
    // A lesson id is a form value. Accept it only if the class actually
    // studies its course — otherwise the card would send a child to a lesson
    // they cannot open.
    const bai = await db.lesson.findFirst({
      where: {
        id: input.lessonId,
        course: { classCourses: { some: { classId: input.classId } } },
      },
      select: { id: true },
    });
    if (!bai) return khongHopLe('Buổi học đã chọn không thuộc khoá học nào của lớp này.');
    lessonId = bai.id;
  }

  const homework = await db.homework.create({
    data: {
      teacherId: actor.id,
      classId: input.classId,
      lessonId,
      title: tieuDe,
      description: moTa,
      templateCode: maMau,
      deadline: input.hanNop,
    },
    select: { id: true },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: BAI_TAP_AUDIT.CREATED,
      entityType: 'Homework',
      entityId: homework.id,
      meta: { classId: input.classId, lessonId, hanNop: input.hanNop.toISOString() },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return {
    trangThai: 'da-tao',
    homeworkId: homework.id,
    tenLop: lop.name,
    soHocSinh: lop._count.enrollments,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Student: the list, one homework, handing in
// ═══════════════════════════════════════════════════════════════════════════

export interface BaiTapCuaHocSinh {
  id: string;
  tieuDe: string;
  tenLop: string;
  baiHoc: BaiHocGanBaiTap | null;
  hanNop: Date;
  trangThai: TrangThaiBaiTap;
  nopLuc: Date | null;
  nopMuon: boolean;
  chamLuc: Date | null;
}

/** Work to do first, then work waiting on the teacher, then feedback to read. */
const NHOM: Record<TrangThaiBaiTap, number> = {
  'qua-han': 0,
  'chua-nop': 0,
  'da-nop': 1,
  'da-cham': 2,
};

/**
 * Every homework set for this student's current classes, most urgent first.
 *
 * Takes the student id from the caller, which is always the session — the
 * same contract as the rest of the student view models. Scoped by ACTIVE
 * enrolment, the relationship `authorize` checks when a card is opened, so no
 * card here ever leads to a refusal. Archived classes are left out: last
 * term's homework is not today's to-do list.
 */
export async function baiTapCuaHocSinh(
  db: PrismaClient,
  studentId: string,
  bayGio: Date = new Date(),
): Promise<BaiTapCuaHocSinh[]> {
  const rows = await db.homework.findMany({
    where: {
      class: { isArchived: false, enrollments: { some: { studentId, isActive: true } } },
    },
    orderBy: { deadline: 'asc' },
    take: 200,
    select: {
      id: true,
      title: true,
      deadline: true,
      class: { select: { name: true } },
      lesson: { select: { slug: true, order: true, title: true } },
      submissions: {
        where: { studentId },
        select: { submittedAt: true, isGraded: true, gradedAt: true },
        take: 1,
      },
    },
  });

  const ds = rows.map((r): BaiTapCuaHocSinh => {
    const baiNop = r.submissions[0];
    return {
      id: r.id,
      tieuDe: r.title,
      tenLop: r.class.name,
      baiHoc: baiHocCua(r.lesson),
      hanNop: r.deadline,
      trangThai: trangThaiCua(r.deadline, baiNop, bayGio),
      nopLuc: baiNop?.submittedAt ?? null,
      nopMuon: baiNop ? baiNop.submittedAt.getTime() > r.deadline.getTime() : false,
      chamLuc: baiNop?.gradedAt ?? null,
    };
  });

  return ds.sort((a, b) => {
    const nhom = NHOM[a.trangThai] - NHOM[b.trangThai];
    if (nhom !== 0) return nhom;
    // Feedback: newest first. Everything else: soonest deadline first, which
    // puts overdue work at the very top of "to do".
    if (a.trangThai === 'da-cham') {
      return (b.chamLuc?.getTime() ?? 0) - (a.chamLuc?.getTime() ?? 0);
    }
    return a.hanNop.getTime() - b.hanNop.getTime();
  });
}

export interface BaiNopBaiTap {
  id: string;
  code: string;
  nopLuc: Date;
  nopMuon: boolean;
  daCham: boolean;
  nhanXet: string | null;
  chamLuc: Date | null;
}

export interface BaiTapChoHocSinh {
  id: string;
  tieuDe: string;
  moTa: string;
  maMau: string;
  hanNop: Date;
  tenLop: string;
  baiHoc: BaiHocGanBaiTap | null;
  trangThai: TrangThaiBaiTap;
  baiNop: BaiNopBaiTap | null;
}

/** One homework, with this student's hand-in, for the page they work on it in. */
export async function moBaiTapChoHocSinh(
  db: PrismaClient,
  actor: Actor,
  homeworkId: string,
  bayGio: Date = new Date(),
): Promise<BaiTapChoHocSinh> {
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-open-homework');
  await authorize(db, actor, { resource: 'homework', action: 'read', homeworkId });

  const hw = await db.homework.findUnique({
    where: { id: homeworkId },
    select: {
      id: true,
      title: true,
      description: true,
      templateCode: true,
      deadline: true,
      class: { select: { name: true } },
      lesson: { select: { slug: true, order: true, title: true } },
      submissions: {
        where: { studentId: actor.id },
        select: {
          id: true,
          submittedCode: true,
          submittedAt: true,
          isGraded: true,
          teacherFeedback: true,
          gradedAt: true,
        },
        take: 1,
      },
    },
  });
  if (!hw) throw new ForbiddenError('homework-not-found');

  const s = hw.submissions[0];
  return {
    id: hw.id,
    tieuDe: hw.title,
    moTa: hw.description,
    maMau: hw.templateCode,
    hanNop: hw.deadline,
    tenLop: hw.class.name,
    baiHoc: baiHocCua(hw.lesson),
    trangThai: trangThaiCua(hw.deadline, s, bayGio),
    baiNop: s
      ? {
          id: s.id,
          code: s.submittedCode,
          nopLuc: s.submittedAt,
          nopMuon: s.submittedAt.getTime() > hw.deadline.getTime(),
          daCham: s.isGraded,
          // Feedback is only shown once it is final: a half-written comment on
          // an ungraded row is not the teacher's word yet.
          nhanXet: s.isGraded ? s.teacherFeedback : null,
          chamLuc: s.gradedAt,
        }
      : null,
  };
}

export type KetQuaNopBaiTap =
  | { trangThai: 'da-nop'; nopLuc: Date; nopMuon: boolean; lanDau: boolean }
  | { trangThai: 'da-cham-roi' }
  | { trangThai: 'rong' }
  | { trangThai: 'qua-dai'; toiDa: number };

/**
 * Hand in (or hand in again) one homework.
 *
 * ── The freeze is a WHERE clause, not a read ─────────────────────────────────
 * "Overwrite unless graded" is a single `updateMany … where isGraded = false`,
 * so a teacher grading in the same instant cannot have the code they just
 * commented on replaced underneath them. When nothing matched, the row is
 * either missing (first hand-in: create it) or graded (refuse).
 */
export async function nopBaiTapVeNha(
  db: PrismaClient,
  actor: Actor,
  homeworkId: string,
  code: string,
  bayGio: Date = new Date(),
): Promise<KetQuaNopBaiTap> {
  if (actor.role !== 'STUDENT') throw new ForbiddenError('only-students-submit-homework');
  await authorize(db, actor, { resource: 'homework', action: 'read', homeworkId });

  const ma = code.replace(/\r\n?/g, '\n');
  if (ma.trim() === '') return { trangThai: 'rong' };
  // Rejected rather than truncated, like every other code path: keeping half
  // of a child's program and calling it handed in is worse than saying no.
  if (ma.length > GIOI_HAN_KY_TU) return { trangThai: 'qua-dai', toiDa: GIOI_HAN_KY_TU };

  const hw = await db.homework.findUnique({
    where: { id: homeworkId },
    select: { deadline: true },
  });
  if (!hw) throw new ForbiddenError('homework-not-found');

  const ketQua = (lanDau: boolean): KetQuaNopBaiTap => ({
    trangThai: 'da-nop',
    nopLuc: bayGio,
    nopMuon: bayGio.getTime() > hw.deadline.getTime(),
    lanDau,
  });

  const ghiDe = () =>
    db.homeworkSubmission.updateMany({
      where: { homeworkId, studentId: actor.id, isGraded: false },
      data: { submittedCode: ma, submittedAt: bayGio },
    });

  if ((await ghiDe()).count > 0) return ketQua(false);

  try {
    await db.homeworkSubmission.create({
      data: { homeworkId, studentId: actor.id, submittedCode: ma, submittedAt: bayGio },
      select: { id: true },
    });
    return ketQua(true);
  } catch (error) {
    if (!laTrungKhoa(error)) throw error;
    // The row appeared between the update and the insert: a double-click, or
    // two tabs. Try the overwrite once more — if it still matches nothing, the
    // row that exists is a graded one.
    if ((await ghiDe()).count > 0) return ketQua(false);
    return { trangThai: 'da-cham-roi' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Teacher: the list, one homework, grading
// ═══════════════════════════════════════════════════════════════════════════

export interface BaiTapCuaGiaoVien {
  id: string;
  tieuDe: string;
  classId: string;
  tenLop: string;
  baiHoc: BaiHocGanBaiTap | null;
  hanNop: Date;
  taoLuc: Date;
  tacGia: string;
  soHocSinh: number;
  soDaNop: number;
  soChoCham: number;
}

/**
 * Homework in the classes this actor runs, newest first, with hand-in counts.
 *
 * Counts only children still ACTIVELY in the class — the same set the detail
 * page lists — so "8/25 đã nộp" and the rows beneath it always add up.
 */
export async function baiTapCuaGiaoVien(
  db: PrismaClient,
  actor: Actor,
  gioiHan = 100,
): Promise<BaiTapCuaGiaoVien[]> {
  const rows = await db.homework.findMany({
    where: { class: phamViLop(actor) },
    orderBy: { createdAt: 'desc' },
    take: gioiHan,
    select: {
      id: true,
      title: true,
      deadline: true,
      createdAt: true,
      teacher: { select: { displayName: true } },
      lesson: { select: { slug: true, order: true, title: true } },
      class: {
        select: {
          id: true,
          name: true,
          enrollments: { where: { isActive: true }, select: { studentId: true } },
        },
      },
      submissions: { select: { studentId: true, isGraded: true } },
    },
  });

  return rows.map((r) => {
    const dangHoc = new Set(r.class.enrollments.map((e) => e.studentId));
    const baiNop = r.submissions.filter((s) => dangHoc.has(s.studentId));
    return {
      id: r.id,
      tieuDe: r.title,
      classId: r.class.id,
      tenLop: r.class.name,
      baiHoc: baiHocCua(r.lesson),
      hanNop: r.deadline,
      taoLuc: r.createdAt,
      tacGia: r.teacher.displayName,
      soHocSinh: dangHoc.size,
      soDaNop: baiNop.length,
      soChoCham: baiNop.filter((s) => !s.isGraded).length,
    };
  });
}

/**
 * Ungraded hand-ins waiting for this actor. Powers the nav badge.
 *
 * Counted over children who still have an active enrolment in one of the
 * actor's classes — the `visibleStudentIds` rule — so a child who has left
 * does not keep a badge lit that no page will let the teacher clear.
 */
export async function soBaiTapChoCham(db: PrismaClient, actor: Actor): Promise<number> {
  if (actor.role === 'STUDENT') return 0;
  const lop = phamViLop(actor);
  return db.homeworkSubmission.count({
    where: {
      isGraded: false,
      homework: { class: lop },
      student: { enrollments: { some: { isActive: true, class: lop } } },
    },
  });
}

export interface HangNopBaiTap {
  studentId: string;
  tenHocSinh: string;
  baiNop: BaiNopBaiTap | null;
}

export interface BaiTapChoGiaoVien {
  id: string;
  tieuDe: string;
  moTa: string;
  maMau: string;
  hanNop: Date;
  taoLuc: Date;
  classId: string;
  tenLop: string;
  baiHoc: BaiHocGanBaiTap | null;
  tacGia: string;
  /** Every child in the class, whether or not they have handed in. */
  hocSinh: HangNopBaiTap[];
}

/**
 * One homework as its teacher reviews it: the brief, and the whole roster.
 *
 * The roster rather than only the hand-ins, because "who has NOT handed in?"
 * is the question a teacher asks first. Rows are ordered as a queue — waiting
 * to be graded, then graded, then not yet handed in — so the work is at the top.
 */
export async function baiTapChoGiaoVien(
  db: PrismaClient,
  actor: Actor,
  homeworkId: string,
): Promise<BaiTapChoGiaoVien> {
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-review-homework');
  await authorize(db, actor, { resource: 'homework', action: 'manage', homeworkId });

  const hw = await db.homework.findUnique({
    where: { id: homeworkId },
    select: {
      id: true,
      title: true,
      description: true,
      templateCode: true,
      deadline: true,
      createdAt: true,
      teacher: { select: { displayName: true } },
      lesson: { select: { slug: true, order: true, title: true } },
      class: {
        select: {
          id: true,
          name: true,
          enrollments: {
            where: { isActive: true },
            select: { student: { select: { id: true, displayName: true } } },
          },
        },
      },
      submissions: {
        select: {
          id: true,
          studentId: true,
          submittedCode: true,
          submittedAt: true,
          isGraded: true,
          teacherFeedback: true,
          gradedAt: true,
        },
      },
    },
  });
  if (!hw) throw new ForbiddenError('homework-not-found');

  const nopCua = new Map(hw.submissions.map((s) => [s.studentId, s]));
  const hang: HangNopBaiTap[] = hw.class.enrollments.map(({ student }) => {
    const s = nopCua.get(student.id);
    return {
      studentId: student.id,
      tenHocSinh: student.displayName,
      baiNop: s
        ? {
            id: s.id,
            code: s.submittedCode,
            nopLuc: s.submittedAt,
            nopMuon: s.submittedAt.getTime() > hw.deadline.getTime(),
            daCham: s.isGraded,
            nhanXet: s.teacherFeedback,
            chamLuc: s.gradedAt,
          }
        : null,
    };
  });

  const nhom = (h: HangNopBaiTap) => (h.baiNop === null ? 2 : h.baiNop.daCham ? 1 : 0);
  hang.sort((a, b) => nhom(a) - nhom(b) || a.tenHocSinh.localeCompare(b.tenHocSinh, 'vi'));

  return {
    id: hw.id,
    tieuDe: hw.title,
    moTa: hw.description,
    maMau: hw.templateCode,
    hanNop: hw.deadline,
    taoLuc: hw.createdAt,
    classId: hw.class.id,
    tenLop: hw.class.name,
    baiHoc: baiHocCua(hw.lesson),
    tacGia: hw.teacher.displayName,
    hocSinh: hang,
  };
}

export type KetQuaChamBaiTap =
  | { trangThai: 'da-cham'; tenHocSinh: string; capNhat: boolean }
  | { trangThai: 'da-doi'; tenHocSinh: string }
  | { trangThai: 'khong-hop-le'; lyDo: string };

/**
 * Grade one hand-in: write the feedback and freeze the code.
 *
 * ── `banDaXem` — grading what was actually read ──────────────────────────────
 * The student may hand in again while the teacher is reading. The form carries
 * the `submittedAt` of the version on the teacher's screen, and the write only
 * lands if that is still the current one; otherwise the teacher is told a newer
 * version arrived. Without it, feedback written about one program would be
 * attached — and frozen — to another the teacher never saw.
 *
 * Re-grading an already graded hand-in edits the feedback (`capNhat: true`).
 */
export async function chamBaiTapVeNha(
  db: PrismaClient,
  actor: Actor,
  submissionId: string,
  nhanXet: string,
  banDaXem: Date,
  context: SessionContext = {},
): Promise<KetQuaChamBaiTap> {
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-grade-homework');

  const sub = await db.homeworkSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      homeworkId: true,
      studentId: true,
      isGraded: true,
      student: { select: { displayName: true } },
    },
  });
  // Unknown id reads as forbidden: which ids exist is not the caller's to learn.
  if (!sub) throw new ForbiddenError('homework-submission-not-found');

  // Both relationships: the class is this teacher's, and the child is still
  // one they teach. A student who has left keeps their work, and the teacher
  // loses the ability to act on it — the same line `teachesStudent` draws.
  await authorize(db, actor, {
    resource: 'homework',
    action: 'manage',
    homeworkId: sub.homeworkId,
  });
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId: sub.studentId });

  const loiNhan = nhanXet.trim();
  if (!loiNhan) {
    return { trangThai: 'khong-hop-le', lyDo: 'Thầy cô viết vài dòng nhận xét cho em nhé.' };
  }
  if (loiNhan.length > BAI_TAP_NHAN_XET_TOI_DA) {
    return {
      trangThai: 'khong-hop-le',
      lyDo: `Nhận xét dài quá — tối đa ${BAI_TAP_NHAN_XET_TOI_DA.toLocaleString('vi-VN')} ký tự.`,
    };
  }

  const r = await db.homeworkSubmission.updateMany({
    where: { id: sub.id, submittedAt: banDaXem },
    data: { isGraded: true, teacherFeedback: loiNhan, gradedAt: new Date() },
  });
  if (r.count === 0) return { trangThai: 'da-doi', tenHocSinh: sub.student.displayName };

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: BAI_TAP_AUDIT.GRADED,
      entityType: 'HomeworkSubmission',
      entityId: sub.id,
      meta: { studentId: sub.studentId, homeworkId: sub.homeworkId, capNhat: sub.isGraded },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { trangThai: 'da-cham', tenHocSinh: sub.student.displayName, capNhat: sub.isGraded };
}
