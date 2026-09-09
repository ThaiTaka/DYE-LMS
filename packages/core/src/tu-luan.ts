/**
 * Free-text (tự luận) answers: submit once, wait for a teacher, maybe reopen.
 *
 * ── The bug this module exists to fix ────────────────────────────────────────
 * `kiemTraCauTraLoi` used to answer every question type from the question row
 * alone and return the verdict straight to the browser. For MULTIPLE_CHOICE,
 * TRUE_FALSE and FILL_BLANK that is right — the correct answer is known and
 * checking it is a string comparison.
 *
 * For SHORT_ANSWER there is no correct answer to compare against, and the code
 * returned `dung: true` regardless. So a child could type a single character
 * into an essay question and be told they were right, nothing was stored, and
 * no teacher ever saw it. `Answer.gradedAt` was already documented as "null
 * until reviewed" — the column was there, waiting; nothing wrote to it.
 *
 * ── Why gradedAt is the pending marker, and not a new enum ───────────────────
 * A `PENDING_REVIEW` value would have to live on `Verdict`, which belongs to
 * `Submission` — code sent to the judge — and would then be a value the judge
 * can never produce and every switch over verdicts has to ignore. The state
 * being modelled is "a human has not looked at this yet", and a nullable
 * `gradedAt` says exactly that, in the place the schema already put it.
 *
 * ── One answer per question, not per attempt ─────────────────────────────────
 * `Answer` is unique on (attemptId, questionId) and this module keeps exactly
 * one open attempt per student per quiz, so a student has at most one answer to
 * a given essay question. That is what makes the lock enforceable on the server
 * rather than in the browser: resubmitting is refused because the row exists,
 * not because a button was disabled.
 *
 * Reopening DELETES the answer rather than flagging it. A kept-but-ignored row
 * would have to be excluded from every later query — the pending queue, the
 * student's own view, the grade — and one missed exclusion silently resurrects
 * it. The audit row written alongside is what preserves the history.
 */
import { authorize } from './authz';
import { assertLessonUnlocked } from './curriculum/gating';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';
import type { Actor, SessionContext } from './session';

export const TU_LUAN_AUDIT = {
  GRADED: 'essay.graded',
  REOPENED: 'essay.reopened',
} as const;

/** Longest essay accepted, in characters. Generous, but not a paste target. */
export const TU_LUAN_TOI_DA_KY_TU = 5000;

export type TrangThaiTuLuan =
  | { trangThai: 'chua-nop' }
  | { trangThai: 'cho-cham'; answerId: string; noiDung: string; nopLuc: Date }
  | {
      trangThai: 'da-cham';
      answerId: string;
      noiDung: string;
      dung: boolean;
      diem: number;
      chamLuc: Date;
    };

function docNoiDung(response: unknown): string {
  return typeof response === 'string' ? response : '';
}

/**
 * The student's current state on one essay question.
 *
 * Read on every render of the quiz block, so the lock survives a reload — the
 * previous implementation kept "already answered" in React state alone, and a
 * refresh handed the student a blank box again.
 */
export async function trangThaiTuLuan(
  db: PrismaClient,
  studentId: string,
  questionId: string,
): Promise<TrangThaiTuLuan> {
  const answer = await db.answer.findFirst({
    where: { questionId, attempt: { studentId } },
    select: {
      id: true,
      response: true,
      isCorrect: true,
      pointsAwarded: true,
      gradedAt: true,
      attempt: { select: { submittedAt: true, startedAt: true } },
    },
  });

  if (!answer) return { trangThai: 'chua-nop' };

  if (answer.gradedAt === null) {
    return {
      trangThai: 'cho-cham',
      answerId: answer.id,
      noiDung: docNoiDung(answer.response),
      nopLuc: answer.attempt.submittedAt ?? answer.attempt.startedAt,
    };
  }

  return {
    trangThai: 'da-cham',
    answerId: answer.id,
    noiDung: docNoiDung(answer.response),
    dung: answer.isCorrect,
    diem: answer.pointsAwarded,
    chamLuc: answer.gradedAt,
  };
}

/**
 * Essay state for many questions at once, keyed by question id.
 *
 * The lesson page needs this for every free-text question it renders, and one
 * query beats one per question on a ten-question practice bank.
 *
 * It lives here rather than in the web app's view-model layer for a second
 * reason: `bao-mat.test.ts` forbids the string `isCorrect` anywhere in a
 * `*-data.ts` file, because that is how `Choice.isCorrect` — the answer key —
 * would leak into a payload the browser receives. The field read here is
 * `Answer.isCorrect`, the student's own mark on their own work, which they are
 * meant to see. Keeping the read on this side means the guard stays blunt and
 * intact instead of growing an exception that a real leak could hide behind.
 */
export async function tuLuanCuaHocSinh(
  db: PrismaClient,
  studentId: string,
  questionIds: string[],
): Promise<Map<string, TrangThaiTuLuan>> {
  if (questionIds.length === 0) return new Map();

  const rows = await db.answer.findMany({
    where: { questionId: { in: questionIds }, attempt: { studentId } },
    select: {
      id: true,
      questionId: true,
      response: true,
      isCorrect: true,
      pointsAwarded: true,
      gradedAt: true,
      attempt: { select: { submittedAt: true, startedAt: true } },
    },
  });

  return new Map(
    rows.map((a) => [
      a.questionId,
      a.gradedAt === null
        ? {
            trangThai: 'cho-cham' as const,
            answerId: a.id,
            noiDung: docNoiDung(a.response),
            nopLuc: a.attempt.submittedAt ?? a.attempt.startedAt,
          }
        : {
            trangThai: 'da-cham' as const,
            answerId: a.id,
            noiDung: docNoiDung(a.response),
            dung: a.isCorrect,
            diem: a.pointsAwarded,
            chamLuc: a.gradedAt,
          },
    ]),
  );
}

export type KetQuaNopTuLuan =
  | { trangThai: 'da-nhan'; answerId: string }
  | { trangThai: 'da-nop-roi' }
  | { trangThai: 'rong' };

/**
 * Store one essay answer, awaiting a teacher.
 *
 * Refuses when an answer already exists — graded or not. The student is told
 * which, so "I already handed this in" and "the teacher marked this" do not
 * read as the same thing.
 */
export async function nopTuLuan(
  db: PrismaClient,
  actor: Actor,
  questionId: string,
  noiDung: string,
): Promise<KetQuaNopTuLuan> {
  const studentId = actor.id;
  const cat = noiDung.trim().slice(0, TU_LUAN_TOI_DA_KY_TU);
  if (cat === '') return { trangThai: 'rong' };

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      quizId: true,
      type: true,
      points: true,
      quiz: { select: { blocks: { select: { lessonId: true }, take: 1 } } },
    },
  });
  if (!question) throw new ForbiddenError('question-not-found');
  if (question.type !== 'SHORT_ANSWER') throw new ForbiddenError('not-an-essay-question');

  /*
   * Gate on the LESSON, not merely on the session.
   *
   * A question id is a value the browser sends, so without this a student could
   * post an essay into a lesson the gating engine has locked — and now that
   * lessons unlock in sequence, that is a way to record work in a lesson they
   * have not reached. `assertLessonUnlocked` is the same guard the code actions
   * use, and it refuses with the reason the student should read.
   */
  const lessonId = question.quiz.blocks[0]?.lessonId;
  if (lessonId) await assertLessonUnlocked(db, studentId, lessonId);

  await authorize(db, actor, { resource: 'progress', action: 'read', studentId });

  const dangCo = await db.answer.findFirst({
    where: { questionId, attempt: { studentId } },
    select: { id: true },
  });
  if (dangCo) return { trangThai: 'da-nop-roi' };

  // One open attempt per student per quiz. `attemptNo` stays 1 because reopening
  // deletes the answer rather than starting a new attempt — the unique key is
  // (quizId, studentId, attemptNo), so a second attempt row would need a number
  // nothing here has a reason to advance.
  const attempt = await db.quizAttempt.upsert({
    where: {
      quizId_studentId_attemptNo: { quizId: question.quizId, studentId, attemptNo: 1 },
    },
    create: { quizId: question.quizId, studentId, attemptNo: 1, submittedAt: new Date() },
    update: { submittedAt: new Date() },
    select: { id: true },
  });

  const answer = await db.answer.create({
    data: {
      attemptId: attempt.id,
      questionId,
      response: cat,
      // Explicit: not right, not wrong, not scored. `gradedAt` null is what says
      // "waiting"; these two only become meaningful once a teacher has looked.
      isCorrect: false,
      pointsAwarded: 0,
      gradedAt: null,
    },
    select: { id: true },
  });

  return { trangThai: 'da-nhan', answerId: answer.id };
}

export interface TuLuanChoCham {
  answerId: string;
  studentId: string;
  tenHocSinh: string;
  questionId: string;
  prompt: string;
  noiDung: string;
  diemToiDa: number;
  nopLuc: Date;
  lessonTitle: string;
  lessonOrder: number;
}

/**
 * Essays waiting for this actor, newest first.
 *
 * Scoped by `visibleStudentIds` like every other teacher view: a results queue
 * is the easiest place in an LMS to leak, because a missing WHERE reads as a
 * working page rather than an error.
 */
export async function tuLuanChoCham(
  db: PrismaClient,
  studentIds: string[],
  gioiHan = 100,
): Promise<TuLuanChoCham[]> {
  if (studentIds.length === 0) return [];

  const rows = await db.answer.findMany({
    where: {
      gradedAt: null,
      question: { type: 'SHORT_ANSWER' },
      attempt: { studentId: { in: studentIds } },
    },
    orderBy: { attempt: { submittedAt: 'desc' } },
    take: gioiHan,
    select: {
      id: true,
      response: true,
      question: {
        select: {
          id: true,
          prompt: true,
          points: true,
          quiz: {
            select: {
              blocks: {
                select: { lesson: { select: { title: true, order: true } } },
                take: 1,
              },
            },
          },
        },
      },
      attempt: {
        select: {
          studentId: true,
          submittedAt: true,
          startedAt: true,
          student: { select: { displayName: true } },
        },
      },
    },
  });

  return rows.map((r) => {
    const bai = r.question.quiz.blocks[0]?.lesson;
    return {
      answerId: r.id,
      studentId: r.attempt.studentId,
      tenHocSinh: r.attempt.student.displayName,
      questionId: r.question.id,
      prompt: r.question.prompt,
      noiDung: docNoiDung(r.response),
      diemToiDa: r.question.points,
      nopLuc: r.attempt.submittedAt ?? r.attempt.startedAt,
      lessonTitle: bai?.title ?? '',
      lessonOrder: bai?.order ?? 0,
    };
  });
}

/** Load the answer with the student it belongs to, or refuse. */
async function moTuLuan(
  db: PrismaClient,
  actor: Actor,
  answerId: string,
): Promise<{ id: string; studentId: string; diemToiDa: number; tenHocSinh: string }> {
  const answer = await db.answer.findUnique({
    where: { id: answerId },
    select: {
      id: true,
      question: { select: { type: true, points: true } },
      attempt: {
        select: { studentId: true, student: { select: { displayName: true } } },
      },
    },
  });
  // Unknown id reads as forbidden rather than "not found": which ids exist is
  // not something a caller gets to enumerate.
  if (!answer) throw new ForbiddenError('answer-not-found');
  if (answer.question.type !== 'SHORT_ANSWER') throw new ForbiddenError('not-an-essay-question');

  await authorize(db, actor, {
    resource: 'student',
    action: 'manage',
    studentId: answer.attempt.studentId,
  });

  return {
    id: answer.id,
    studentId: answer.attempt.studentId,
    diemToiDa: answer.question.points,
    tenHocSinh: answer.attempt.student.displayName,
  };
}

/**
 * Mark one essay right or wrong.
 *
 * Setting `gradedAt` is what takes it out of the pending queue, so it is set in
 * the same write as the verdict — a grade recorded without it would leave the
 * answer looking unreviewed forever.
 */
export async function chamTuLuan(
  db: PrismaClient,
  actor: Actor,
  answerId: string,
  dung: boolean,
  context: SessionContext = {},
): Promise<{ tenHocSinh: string; dung: boolean }> {
  const answer = await moTuLuan(db, actor, answerId);

  await db.answer.update({
    where: { id: answer.id },
    data: {
      isCorrect: dung,
      pointsAwarded: dung ? answer.diemToiDa : 0,
      gradedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: TU_LUAN_AUDIT.GRADED,
      entityType: 'Answer',
      entityId: answer.id,
      meta: { studentId: answer.studentId, dung },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  return { tenHocSinh: answer.tenHocSinh, dung };
}

/**
 * Reopen an essay so the student may answer it again.
 *
 * Deletes the row. See the module header for why a "reopened" flag would be
 * worse: every later query would have to remember to exclude it, and one that
 * forgot would quietly show a withdrawn answer as current.
 */
export async function moLaiTuLuan(
  db: PrismaClient,
  actor: Actor,
  answerId: string,
  context: SessionContext = {},
): Promise<{ tenHocSinh: string }> {
  const answer = await moTuLuan(db, actor, answerId);

  // Written BEFORE the delete: the row is about to stop existing, and an audit
  // entry that depends on it still being there would be lost on failure.
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: TU_LUAN_AUDIT.REOPENED,
      entityType: 'Answer',
      entityId: answer.id,
      meta: { studentId: answer.studentId },
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    },
  });

  await db.answer.delete({ where: { id: answer.id } });

  return { tenHocSinh: answer.tenHocSinh };
}
