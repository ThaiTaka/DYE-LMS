/**
 * Milestone exams — "Bài kiểm tra lớn" — and the soft lockdown around them.
 *
 * ── The one rule that matters ────────────────────────────────────────────────
 * THE SERVER COUNTS. The browser reports that a departure happened; it never
 * asserts how many there have been, and there is no parameter through which
 * it could. `ghiNhanViPham` dedupes on its own clock, increments with a
 * compare-and-set so two concurrent reports cannot both count, and applies
 * the lock itself. A client that lied about its strike count could neither
 * lock itself early nor talk its way out of a lock.
 *
 * ── Why the dedupe window exists, in one sentence ────────────────────────────
 * One alt-tab in fullscreen fires `blur`, `visibilitychange` AND
 * `fullscreenchange` — three events for one action — and with a two-strike
 * rule a naive counter would zero the exam on the first alt-tab. The client
 * collapses those into one report (see `useGiamSatPhongThi`), and this module
 * collapses again inside `DEDUP_VI_PHAM_MS`, because the client's collapse is
 * the one that can be edited in devtools.
 *
 * ── Why the lock is reversible ───────────────────────────────────────────────
 * Two strikes is a very short fuse, and the signal is noisy: a Vietnamese IME
 * grabbing focus, a Windows notification, a laptop deciding to sleep — every
 * one of these looks to a browser exactly like a student leaving to look up
 * the answer. A wrong lock is therefore a normal outcome, not an edge case,
 * and `huyLuotThi` lets the adult in the room undo one and let the student
 * sit again. The attempt is VOIDED, not deleted: what was counted and when
 * stays on record.
 */
import { authorize } from './authz';
import { chamMotCau, tuChamDuoc } from './cham-cau-hoi';
import { loadCourseGating, resolveGating } from './curriculum/gating';
import { ForbiddenError } from './errors';

import type { ExamAttemptState, ExamStrikeKind, Prisma, PrismaClient } from '@prisma/client';
import type { Actor } from './session';

/**
 * Reports closer together than this are the same departure.
 *
 * Generous on purpose: a fullscreen exit followed by the OS taking focus can
 * arrive a second apart, and the cost of merging two genuine departures that
 * fell inside 2.5 s is one strike the student got away with — while the cost
 * of NOT merging is a zero for pressing Alt-Tab once.
 */
export const DEDUP_VI_PHAM_MS = 2500;

/**
 * How long past the deadline a submit is still accepted.
 *
 * The client auto-submits when its own countdown hits zero, and its clock is
 * not the server's. A student whose laptop runs twenty seconds slow must not
 * lose the whole exam to that; one who is a full minute late has stopped
 * being a clock-skew case.
 */
export const TRE_NOP_MS = 30_000;

// ═══════════════════════════════════════════════════════════════════════════
// Reading
// ═══════════════════════════════════════════════════════════════════════════

export interface BaiThiHienThi {
  examId: string;
  slug: string;
  title: string;
  description: string | null;
  afterLessonOrder: number;
  durationMinutes: number;
  passingScore: number;
  maxStrikes: number;
  soCauHoi: number;
  /** What the student may do with it right now. */
  trangThai: 'chua-mo' | 'san-sang' | 'dang-lam' | 'da-nop' | 'bi-khoa';
  /** Lessons still to finish before it opens. Empty when unlocked. */
  conThieu: Array<{ order: number; title: string; slug: string }>;
  luot: LuotThiTomTat | null;
}

export interface LuotThiTomTat {
  attemptId: string;
  attemptNo: number;
  state: ExamAttemptState;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  score: number;
  maxScore: number;
  isPassed: boolean;
  cheatStrikes: number;
}

function tomTat(a: {
  id: string;
  attemptNo: number;
  state: ExamAttemptState;
  startedAt: Date;
  deadlineAt: Date;
  submittedAt: Date | null;
  score: number;
  maxScore: number;
  isPassed: boolean;
  cheatStrikes: number;
}): LuotThiTomTat {
  return {
    attemptId: a.id,
    attemptNo: a.attemptNo,
    state: a.state,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    submittedAt: a.submittedAt,
    score: a.score,
    maxScore: a.maxScore,
    isPassed: a.isPassed,
    cheatStrikes: a.cheatStrikes,
  };
}

/**
 * Lessons the student still has to finish before this exam opens.
 *
 * Runs the same gating engine the course map uses, so "the exam is locked"
 * and "these lessons are not done" can never disagree — and a teacher's
 * override that unlocks a lesson unlocks the exam behind it too.
 */
async function baiConThieu(
  db: PrismaClient,
  studentId: string,
  courseId: string,
  afterLessonOrder: number,
): Promise<Array<{ order: number; title: string; slug: string }>> {
  const input = await loadCourseGating(db, studentId, courseId);
  const access = resolveGating(input);
  return access
    .filter((a) => a.order <= afterLessonOrder && a.isRequired && !a.completed)
    .map((a) => ({ order: a.order, title: a.title, slug: a.slug }))
    .sort((a, b) => a.order - b.order);
}

/**
 * The attempt that decides the exam's status for this student, if any.
 *
 * VOIDED attempts are ignored: they are the record of a lock a teacher has
 * already undone, and they must not keep the exam closed.
 */
async function luotQuyetDinh(db: PrismaClient, studentId: string, examId: string) {
  return db.examAttempt.findFirst({
    where: { studentId, examId, state: { not: 'VOIDED' } },
    orderBy: { attemptNo: 'desc' },
  });
}

function trangThaiTu(
  luot: { state: ExamAttemptState } | null,
  conThieu: number,
): BaiThiHienThi['trangThai'] {
  if (luot?.state === 'LOCKED_CHEATING') return 'bi-khoa';
  if (luot?.state === 'SUBMITTED') return 'da-nop';
  if (luot?.state === 'IN_PROGRESS') return 'dang-lam';
  return conThieu > 0 ? 'chua-mo' : 'san-sang';
}

/** Every published exam in a course, with this student's standing on each. */
export async function danhSachKiemTra(
  db: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<BaiThiHienThi[]> {
  const exams = await db.exam.findMany({
    where: { courseId, isPublished: true },
    orderBy: { afterLessonOrder: 'asc' },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      afterLessonOrder: true,
      durationMinutes: true,
      passingScore: true,
      maxStrikes: true,
      quiz: { select: { _count: { select: { questions: true } } } },
    },
  });
  if (exams.length === 0) return [];

  // One gating pass for the whole course rather than one per exam.
  const access = resolveGating(await loadCourseGating(db, studentId, courseId));

  const ketQua: BaiThiHienThi[] = [];
  for (const e of exams) {
    const luot = await luotQuyetDinh(db, studentId, e.id);
    if (luot) await hetGioNeuQuaHan(db, luot);
    const sau = luot ? await db.examAttempt.findUnique({ where: { id: luot.id } }) : null;

    const conThieu = access
      .filter((a) => a.order <= e.afterLessonOrder && a.isRequired && !a.completed)
      .map((a) => ({ order: a.order, title: a.title, slug: a.slug }));

    ketQua.push({
      examId: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      afterLessonOrder: e.afterLessonOrder,
      durationMinutes: e.durationMinutes,
      passingScore: e.passingScore,
      maxStrikes: e.maxStrikes,
      soCauHoi: e.quiz._count.questions,
      trangThai: trangThaiTu(sau, conThieu.length),
      conThieu,
      luot: sau ? tomTat(sau) : null,
    });
  }
  return ketQua;
}

/** One exam, for its own page. Null when the slug is unknown or unpublished. */
export async function moBaiThi(
  db: PrismaClient,
  studentId: string,
  slug: string,
): Promise<(BaiThiHienThi & { courseSlug: string; courseTitle: string }) | null> {
  const exam = await db.exam.findUnique({
    where: { slug },
    select: { id: true, courseId: true, isPublished: true, course: { select: { slug: true, title: true } } },
  });
  if (!exam || !exam.isPublished) return null;

  const ds = await danhSachKiemTra(db, studentId, exam.courseId);
  const bai = ds.find((b) => b.examId === exam.id);
  if (!bai) return null;
  return { ...bai, courseSlug: exam.course.slug, courseTitle: exam.course.title };
}

export interface CauHoiThi {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER';
  prompt: string;
  points: number;
  template: string | null;
  mediaUrl: string | null;
  /** No `isCorrect`. The key never reaches a browser. */
  choices: Array<{ id: string; text: string }>;
}

/**
 * The questions, WITHOUT their answers.
 *
 * `isCorrect` and `acceptedAnswers` are absent by construction of the select,
 * not by deletion afterwards — a shape that cannot leak beats one that must
 * remember to.
 */
export async function cauHoiChoBaiThi(db: PrismaClient, examId: string): Promise<CauHoiThi[]> {
  const exam = await db.exam.findUniqueOrThrow({
    where: { id: examId },
    select: {
      quiz: {
        select: {
          questions: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              type: true,
              prompt: true,
              points: true,
              template: true,
              mediaUrl: true,
              choices: { orderBy: { order: 'asc' }, select: { id: true, text: true } },
            },
          },
        },
      },
    },
  });
  return exam.quiz.questions;
}

// ═══════════════════════════════════════════════════════════════════════════
// The sitting
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaBatDau {
  attemptId: string;
  attemptNo: number;
  deadlineAt: Date;
  maxStrikes: number;
}

/**
 * Start a sitting.
 *
 * One sitting per exam. A second attempt exists only if a teacher VOIDED the
 * first; otherwise a student who has submitted, or been locked, is refused
 * here rather than quietly given another go. Re-entering an IN_PROGRESS
 * attempt (a reload, a crashed tab) returns the same attempt.
 */
export async function batDauLamBai(
  db: PrismaClient,
  studentId: string,
  examId: string,
): Promise<KetQuaBatDau> {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      isPublished: true,
      afterLessonOrder: true,
      durationMinutes: true,
      maxStrikes: true,
    },
  });
  if (!exam || !exam.isPublished) throw new ForbiddenError('exam-not-found');

  const dangLam = await luotQuyetDinh(db, studentId, exam.id);
  if (dangLam) {
    await hetGioNeuQuaHan(db, dangLam);
    const sau = await db.examAttempt.findUniqueOrThrow({ where: { id: dangLam.id } });
    if (sau.state === 'IN_PROGRESS') {
      return {
        attemptId: sau.id,
        attemptNo: sau.attemptNo,
        deadlineAt: sau.deadlineAt,
        maxStrikes: exam.maxStrikes,
      };
    }
    throw new ForbiddenError(`exam-already-${sau.state.toLowerCase()}`);
  }

  const thieu = await baiConThieu(db, studentId, exam.courseId, exam.afterLessonOrder);
  if (thieu.length > 0) throw new ForbiddenError('exam-locked-by-lessons');

  const daCo = await db.examAttempt.count({ where: { studentId, examId: exam.id } });
  const now = new Date();
  const attempt = await db.examAttempt.create({
    data: {
      examId: exam.id,
      studentId,
      attemptNo: daCo + 1,
      startedAt: now,
      deadlineAt: new Date(now.getTime() + exam.durationMinutes * 60_000),
    },
    select: { id: true, attemptNo: true, deadlineAt: true },
  });

  await db.auditLog.create({
    data: {
      actorId: studentId,
      action: 'exam.started',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      meta: { examId: exam.id, attemptNo: attempt.attemptNo },
    },
  });

  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    deadlineAt: attempt.deadlineAt,
    maxStrikes: exam.maxStrikes,
  };
}

/** The attempt, if it is this student's and still open. */
async function luotDangMo(db: PrismaClient, studentId: string, attemptId: string) {
  const a = await db.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: { select: { maxStrikes: true, passingScore: true, title: true, courseId: true } } },
  });
  if (!a || a.studentId !== studentId) throw new ForbiddenError('attempt-not-yours');
  return a;
}

/**
 * Hand in when the clock has run out and nobody pressed the button.
 *
 * Called lazily wherever an attempt is read. The alternative — a scheduler —
 * would be a moving part whose failure mode is exams that never close.
 */
export async function hetGioNeuQuaHan(
  db: PrismaClient,
  attempt: { id: string; state: ExamAttemptState; deadlineAt: Date },
): Promise<boolean> {
  if (attempt.state !== 'IN_PROGRESS') return false;
  if (Date.now() <= attempt.deadlineAt.getTime() + TRE_NOP_MS) return false;
  await chamVaDong(db, attempt.id, 'SUBMITTED', 'het-gio');
  return true;
}

/**
 * Record one answer.
 *
 * Written on every change rather than at submit, so a crashed tab, a dead
 * battery or a lock mid-exam loses nothing already chosen. Refused once the
 * attempt is closed or the clock (plus grace) has run out.
 */
export async function luuTraLoi(
  db: PrismaClient,
  studentId: string,
  attemptId: string,
  questionId: string,
  response: unknown,
): Promise<{ daLuu: boolean }> {
  const a = await luotDangMo(db, studentId, attemptId);
  if (a.state !== 'IN_PROGRESS') return { daLuu: false };
  if (Date.now() > a.deadlineAt.getTime() + TRE_NOP_MS) {
    await hetGioNeuQuaHan(db, a);
    return { daLuu: false };
  }

  // Only responses of the shapes the marker understands are stored.
  const hopLe =
    typeof response === 'string' ||
    typeof response === 'boolean' ||
    (Array.isArray(response) && response.every((x) => typeof x === 'string'));
  if (!hopLe) return { daLuu: false };

  const cu = (a.answers ?? {}) as Record<string, Prisma.InputJsonValue>;
  const moi: Record<string, Prisma.InputJsonValue> = {
    ...cu,
    [questionId]: response as Prisma.InputJsonValue,
  };
  await db.examAttempt.update({
    where: { id: attemptId },
    data: { answers: moi },
  });
  return { daLuu: true };
}

export interface KetQuaViPham {
  /** Strikes on record after this call, as the server counts them. */
  cheatStrikes: number;
  maxStrikes: number;
  /** True when this call (or an earlier one) closed the attempt. */
  biKhoa: boolean;
  /** True when this report was folded into the previous departure. */
  trungLap: boolean;
}

/**
 * Record a departure.
 *
 * ── Dedupe, then compare-and-set ─────────────────────────────────────────────
 * A report inside `DEDUP_VI_PHAM_MS` of the last strike is the same departure
 * arriving through a second event, and is answered with the current count.
 * Otherwise the increment is a conditional update on the count the caller
 * read: two reports that both pass the dedupe check and race to increment
 * cannot both succeed, because the second one's `where` no longer matches.
 *
 * ── The lock ─────────────────────────────────────────────────────────────────
 * At `maxStrikes` the attempt is closed at ZERO — not marked from what was
 * answered. This is the rule the student was shown before the exam began,
 * and it is what makes the warning at strike one mean something.
 */
export async function ghiNhanViPham(
  db: PrismaClient,
  studentId: string,
  attemptId: string,
  kind: ExamStrikeKind,
): Promise<KetQuaViPham> {
  const a = await luotDangMo(db, studentId, attemptId);
  const maxStrikes = a.exam.maxStrikes;

  if (a.state !== 'IN_PROGRESS') {
    return {
      cheatStrikes: a.cheatStrikes,
      maxStrikes,
      biKhoa: a.state === 'LOCKED_CHEATING',
      trungLap: false,
    };
  }

  const ganNhat = await db.examStrike.findFirst({
    where: { attemptId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (ganNhat && Date.now() - ganNhat.createdAt.getTime() < DEDUP_VI_PHAM_MS) {
    return { cheatStrikes: a.cheatStrikes, maxStrikes, biKhoa: false, trungLap: true };
  }

  const moi = a.cheatStrikes + 1;
  const cas = await db.examAttempt.updateMany({
    where: { id: attemptId, state: 'IN_PROGRESS', cheatStrikes: a.cheatStrikes },
    data: { cheatStrikes: moi },
  });
  if (cas.count === 0) {
    // Lost the race to a concurrent report. Its count is the truth now.
    const lai = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    return {
      cheatStrikes: lai.cheatStrikes,
      maxStrikes,
      biKhoa: lai.state === 'LOCKED_CHEATING',
      trungLap: true,
    };
  }

  await db.examStrike.create({ data: { attemptId, kind, strikeNo: moi } });

  if (moi < maxStrikes) {
    return { cheatStrikes: moi, maxStrikes, biKhoa: false, trungLap: false };
  }

  await chamVaDong(db, attemptId, 'LOCKED_CHEATING', `strike-${moi}-${kind}`);
  await baoKhoaChoNguoiLon(db, a.studentId, a.exam.title, a.exam.courseId, attemptId, moi);

  return { cheatStrikes: moi, maxStrikes, biKhoa: true, trungLap: false };
}

/** Hand in. Marks what was answered; refuses nothing that is still open. */
export async function nopBaiThi(
  db: PrismaClient,
  studentId: string,
  attemptId: string,
): Promise<LuotThiTomTat> {
  const a = await luotDangMo(db, studentId, attemptId);
  if (a.state === 'IN_PROGRESS') {
    await chamVaDong(db, attemptId, 'SUBMITTED', 'hoc-sinh-nop');
  }
  const sau = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  return tomTat(sau);
}

/**
 * Mark and close, in one transaction.
 *
 * The state guard inside the `updateMany` is what makes every caller safe to
 * call twice: a late auto-submit landing after the lock, or the lock landing
 * after a submit, finds the row already closed and does nothing.
 */
async function chamVaDong(
  db: PrismaClient,
  attemptId: string,
  state: 'SUBMITTED' | 'LOCKED_CHEATING',
  lyDo: string,
): Promise<void> {
  const a = await db.examAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      answers: true,
      studentId: true,
      exam: {
        select: {
          passingScore: true,
          quiz: {
            select: {
              questions: {
                select: {
                  id: true,
                  type: true,
                  points: true,
                  acceptedAnswers: true,
                  matchMode: true,
                  choices: { select: { id: true, isCorrect: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const traLoi = (a.answers ?? {}) as Record<string, unknown>;
  const cauHoi = a.exam.quiz.questions;

  // maxScore counts only what a machine can mark; a SHORT_ANSWER in an exam
  // bank is a seed error (assertions refuse it), and defending here keeps a
  // student from being marked out of points nobody could award.
  const maxScore = cauHoi.filter((q) => tuChamDuoc(q.type)).reduce((n, q) => n + q.points, 0);
  const diem =
    state === 'LOCKED_CHEATING'
      ? 0
      : cauHoi.reduce(
          (n, q) => n + (tuChamDuoc(q.type) && chamMotCau(q, traLoi[q.id]) ? q.points : 0),
          0,
        );
  const phanTram = maxScore > 0 ? Math.round((diem / maxScore) * 100) : 0;
  const now = new Date();

  const cas = await db.examAttempt.updateMany({
    where: { id: attemptId, state: 'IN_PROGRESS' },
    data: {
      state,
      submittedAt: now,
      score: diem,
      maxScore,
      isPassed: state === 'SUBMITTED' && phanTram >= a.exam.passingScore,
      ...(state === 'LOCKED_CHEATING' ? { lockedAt: now, lockReason: lyDo } : {}),
    },
  });
  if (cas.count === 0) return; // Already closed by the other path.

  await db.auditLog.create({
    data: {
      actorId: a.studentId,
      action: state === 'LOCKED_CHEATING' ? 'exam.locked' : 'exam.submitted',
      entityType: 'ExamAttempt',
      entityId: attemptId,
      meta: { lyDo, score: diem, maxScore, tuDong: lyDo !== 'hoc-sinh-nop' },
    },
  });
}

async function baoKhoaChoNguoiLon(
  db: PrismaClient,
  studentId: string,
  tenBaiThi: string,
  courseId: string,
  attemptId: string,
  soLan: number,
): Promise<void> {
  const [student, lop, admins] = await Promise.all([
    db.user.findUnique({ where: { id: studentId }, select: { displayName: true } }),
    db.enrollment.findFirst({
      where: { studentId, isActive: true, class: { classCourses: { some: { courseId } } } },
      select: { class: { select: { teacherId: true, teacher: { select: { isActive: true } } } } },
      orderBy: { enrolledAt: 'desc' },
    }),
    db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ]);

  const nguoiNhan = new Set<string>();
  if (lop?.class.teacher.isActive) nguoiNhan.add(lop.class.teacherId);
  for (const ad of admins) nguoiNhan.add(ad.id);
  if (nguoiNhan.size === 0) return;

  await db.notification.createMany({
    data: [...nguoiNhan].map((userId) => ({
      userId,
      type: 'EXAM_LOCKED' as const,
      title: `${student?.displayName ?? 'Một học sinh'} bị khoá bài thi "${tenBaiThi}"`,
      body:
        `Rời khỏi màn hình thi ${soLan} lần nên bài bị tính 0 điểm. ` +
        'Máy chỉ đếm lần rời đi — không biết em đã mở gì. ' +
        'Nếu là nhầm (bật gõ tiếng Việt, thông báo hệ thống), thầy cô huỷ lượt thi này để em thi lại.',
      linkUrl: `/giao-vien/hoc-sinh/${studentId}#bai-thi-${attemptId}`,
    })),
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// The teacher's side
// ═══════════════════════════════════════════════════════════════════════════

export interface LuotThiCuaHocSinh extends LuotThiTomTat {
  examTitle: string;
  examSlug: string;
  strikes: Array<{ kind: ExamStrikeKind; strikeNo: number; luc: Date }>;
  nguoiHuy: string | null;
  voidNote: string | null;
}

/** Every sitting by one student, newest first, with the strike log. */
export async function luotThiCuaHocSinh(
  db: PrismaClient,
  studentId: string,
): Promise<LuotThiCuaHocSinh[]> {
  const rows = await db.examAttempt.findMany({
    where: { studentId },
    orderBy: { startedAt: 'desc' },
    include: {
      exam: { select: { title: true, slug: true } },
      strikes: { orderBy: { strikeNo: 'asc' }, select: { kind: true, strikeNo: true, createdAt: true } },
      voidedBy: { select: { displayName: true } },
    },
  });
  return rows.map((r) => ({
    ...tomTat(r),
    examTitle: r.exam.title,
    examSlug: r.exam.slug,
    strikes: r.strikes.map((s) => ({ kind: s.kind, strikeNo: s.strikeNo, luc: s.createdAt })),
    nguoiHuy: r.voidedBy?.displayName ?? null,
    voidNote: r.voidNote,
  }));
}

/**
 * Set a sitting aside so the student may sit again.
 *
 * The remedy for a wrong lock — and also for a genuine one the teacher has
 * decided to forgive, which is their call to make. Nothing is deleted: the
 * strikes, the zero and the time stay on the VOIDED row, with the teacher's
 * name and reason next to them.
 */
export async function huyLuotThi(
  db: PrismaClient,
  actor: Actor,
  attemptId: string,
  ghiChu: string,
): Promise<{ tenHocSinh: string; examTitle: string }> {
  if (!actor.isActive) throw new ForbiddenError('actor-disabled');
  if (actor.role === 'STUDENT') throw new ForbiddenError('student-cannot-void');

  const a = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      state: true,
      studentId: true,
      exam: { select: { title: true } },
      student: { select: { displayName: true } },
    },
  });
  if (!a) throw new ForbiddenError('attempt-not-found');
  if (a.state === 'VOIDED') throw new ForbiddenError('attempt-already-voided');

  // The same relationship every teacher write goes through: they must teach
  // this child.
  await authorize(db, actor, { resource: 'student', action: 'manage', studentId: a.studentId });

  const cas = await db.examAttempt.updateMany({
    where: { id: attemptId, state: { not: 'VOIDED' } },
    data: {
      state: 'VOIDED',
      voidedById: actor.id,
      voidedAt: new Date(),
      voidNote: ghiChu.trim().slice(0, 500) || null,
    },
  });
  if (cas.count === 0) throw new ForbiddenError('attempt-already-voided');

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: 'exam.voided',
      entityType: 'ExamAttempt',
      entityId: attemptId,
      meta: { studentId: a.studentId, truocDo: a.state, ghiChu: ghiChu.trim().slice(0, 500) },
    },
  });

  return { tenHocSinh: a.student.displayName, examTitle: a.exam.title };
}
