/**
 * Machine-marked quiz answers, persisted — one per question per student.
 *
 * ── What changed ─────────────────────────────────────────────────────────────
 * Multiple-choice and fill-in answers used to be checked and forgotten: the
 * action returned right/wrong, React kept it in state, and a reload gave the
 * student a fresh question. Practice, by design. The one-attempt policy makes
 * every answer a record, so this module does for MCQ and FILL_BLANK exactly
 * what `tu-luan.ts` already did for essays: one `Answer` row per question,
 * refused if one exists, seeded back to the page on load so the lock survives
 * a reload, and lifted only by a teacher (`moLaiKhoi`).
 *
 * ── The key still never leaves ───────────────────────────────────────────────
 * `dapAnDung` — the correct answer's text — is returned ONLY for a question
 * the student has already answered and can no longer answer. For a question
 * still open, the browser gets nothing it could not get by guessing.
 */
import { chamMotCau } from './cham-cau-hoi';
import { ForbiddenError } from './errors';

import type { PrismaClient } from '@prisma/client';

export interface TraLoiDaLuu {
  dung: boolean;
  /** What the student chose or typed. */
  chon: string;
  diem: number;
  /** The right answer, revealed because this question is closed. */
  dapAnDung: string | null;
  giaiThich: string | null;
}

export type KetQuaTraLoi =
  | ({ trangThai: 'da-cham' } & TraLoiDaLuu)
  | { trangThai: 'da-tra-loi-roi' }
  | { trangThai: 'khong-tu-cham-duoc' };

/** The correct answer as a student would read it, for a closed question. */
export function dapAnCua(question: {
  type: string;
  acceptedAnswers: string[];
  choices: Array<{ text: string; isCorrect: boolean }>;
}): string | null {
  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
    return question.choices.find((c) => c.isCorrect)?.text ?? null;
  }
  return question.acceptedAnswers[0] ?? null;
}

/**
 * Answer one machine-markable question — once.
 *
 * Marked with the shared rules in `cham-cau-hoi.ts`, then stored graded:
 * `gradedAt` is set immediately because there is no person in this loop.
 */
export async function traLoiCauHoi(
  db: PrismaClient,
  studentId: string,
  questionId: string,
  response: string,
): Promise<KetQuaTraLoi> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      quizId: true,
      type: true,
      points: true,
      explanation: true,
      acceptedAnswers: true,
      matchMode: true,
      choices: { select: { id: true, text: true, isCorrect: true } },
    },
  });
  if (!question) throw new ForbiddenError('question-not-found');
  if (question.type === 'SHORT_ANSWER') return { trangThai: 'khong-tu-cham-duoc' };

  const dangCo = await db.answer.findFirst({
    where: { questionId, attempt: { studentId } },
    select: { id: true },
  });
  if (dangCo) return { trangThai: 'da-tra-loi-roi' };

  const dung = chamMotCau(question, response);
  const diem = dung ? question.points : 0;

  // Same attempt row the essay path uses; `attemptNo` stays 1 for the same
  // reason (see nopTuLuan): a reset deletes answers rather than numbering
  // a new attempt.
  const attempt = await db.quizAttempt.upsert({
    where: { quizId_studentId_attemptNo: { quizId: question.quizId, studentId, attemptNo: 1 } },
    create: { quizId: question.quizId, studentId, attemptNo: 1, submittedAt: new Date() },
    update: { submittedAt: new Date() },
    select: { id: true },
  });

  await db.answer.create({
    data: {
      attemptId: attempt.id,
      questionId,
      response,
      isCorrect: dung,
      pointsAwarded: diem,
      gradedAt: new Date(),
    },
  });

  return {
    trangThai: 'da-cham',
    dung,
    chon: response,
    diem,
    dapAnDung: dung ? null : dapAnCua(question),
    giaiThich: question.explanation,
  };
}

/**
 * Every machine-marked answer this student has on record for these questions.
 *
 * Loaded by the lesson page so an answered question renders answered — and
 * locked — after a reload, exactly as essays already do.
 */
export async function traLoiCuaHocSinh(
  db: PrismaClient,
  studentId: string,
  questionIds: string[],
): Promise<Map<string, TraLoiDaLuu>> {
  if (questionIds.length === 0) return new Map();

  const rows = await db.answer.findMany({
    where: {
      questionId: { in: questionIds },
      attempt: { studentId },
      question: { type: { not: 'SHORT_ANSWER' } },
    },
    select: {
      questionId: true,
      response: true,
      isCorrect: true,
      pointsAwarded: true,
      question: {
        select: {
          type: true,
          explanation: true,
          acceptedAnswers: true,
          choices: { select: { text: true, isCorrect: true } },
        },
      },
    },
  });

  return new Map(
    rows.map((a) => [
      a.questionId,
      {
        dung: a.isCorrect,
        chon: typeof a.response === 'string' ? a.response : String(a.response ?? ''),
        diem: a.pointsAwarded,
        dapAnDung: a.isCorrect ? null : dapAnCua(a.question),
        giaiThich: a.question.explanation,
      },
    ]),
  );
}
