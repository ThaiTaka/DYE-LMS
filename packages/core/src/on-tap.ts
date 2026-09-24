/**
 * The review boss fight — where its questions come from, and how they are marked.
 *
 * ── The pool is questions the student has ALREADY answered ───────────────────
 * A MINIGAME_BOSS block carries no quiz of its own. Its questions are drawn from
 * the quizzes of the sessions in its window (`content.tuBuoi..denBuoi`, the five
 * sessions it closes), and only from questions this student has an `Answer` for.
 *
 * That second condition is not a nicety. Lesson questions are one attempt each
 * (`tra-loi.ts`), and the fight is replayable by design. A replayable surface
 * that marked OPEN questions would be an oracle: fight the boss until question
 * 7 comes up, learn which choice is right, go back to the lesson and answer it.
 * Restricted to answered questions, the fight can reveal nothing the lesson has
 * not already shown — `traLoiCuaHocSinh` returns the right answer for every
 * closed question anyway. It is also simply what "review" means.
 *
 * Exam banks are never in the pool: an exam's quiz is attached to an `Exam`, not
 * to a lesson block, and the pool is found through blocks.
 *
 * ── Marked on the server, never recorded ─────────────────────────────────────
 * Same marking rules as every other question (`chamMotCau`), same absence of
 * the answer key from the browser. But nothing is stored: a review answer is
 * not a grade, and writing an `Answer` here would collide with the one the
 * lesson already holds. Completion goes through the ordinary effort rule when
 * a fight ends — see `tran-boss.ts`.
 */
import { chamMotCau } from './cham-cau-hoi';
import { moKhoiCode } from './code';
import { ForbiddenError } from './errors';
import { SO_CAU_MOI_TRAN } from './tran-boss';
import { dapAnCua } from './tra-loi';

import type { Prisma, PrismaClient, QuestionType } from '@prisma/client';

/** Sessions one review closes. The seed puts a boss at every multiple of this. */
export const SO_BUOI_MOI_CHANG_ON_TAP = 5;

/** Only what a machine can mark. An essay cannot hit a boss. */
const LOAI_CAU_ON_TAP: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'];

/** Rows read before shuffling. A window of five sessions holds far fewer. */
const TRAN_DOC = 200;

export interface KhoangOnTap {
  tuBuoi: number;
  denBuoi: number;
}

/**
 * The sessions a boss block reviews.
 *
 * Read from the block's JSON and CLAMPED to its own lesson: a hand-authored
 * block that says `denBuoi: 30` in session 5 still reviews nothing past
 * session 5. The pool is answered questions only, so a wider window could not
 * leak anything — but a review that quizzes a child on a session they have not
 * reached is wrong regardless.
 */
export function khoangOnTap(content: unknown, buoiCuaKhoi: number): KhoangOnTap {
  const nd =
    typeof content === 'object' && content !== null ? (content as Record<string, unknown>) : {};
  const so = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) ? v : null;

  const denBuoi = Math.min(so(nd['denBuoi']) ?? buoiCuaKhoi, buoiCuaKhoi);
  const tuMacDinh = denBuoi - SO_BUOI_MOI_CHANG_ON_TAP + 1;
  const tuBuoi = Math.min(Math.max(1, so(nd['tuBuoi']) ?? tuMacDinh), denBuoi);

  return { tuBuoi, denBuoi };
}

/** "A question this student may meet in this fight", as a where clause. */
function cauTrongKhoang(
  studentId: string,
  courseId: string,
  khoang: KhoangOnTap,
): Prisma.QuestionWhereInput {
  return {
    type: { in: LOAI_CAU_ON_TAP },
    quiz: {
      blocks: {
        some: { lesson: { courseId, order: { gte: khoang.tuBuoi, lte: khoang.denBuoi } } },
      },
    },
    answers: { some: { attempt: { studentId } } },
  };
}

/** Fisher–Yates. `Math.random` is fine: this orders a game, it guards nothing. */
function tron<T>(ds: readonly T[]): T[] {
  const kq = [...ds];
  for (let i = kq.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [kq[i], kq[j]] = [kq[j] as T, kq[i] as T];
  }
  return kq;
}

/** One question as the fight shows it. No key, no explanation until answered. */
export interface CauHoiOnTap {
  id: string;
  type: QuestionType;
  prompt: string;
  /** FILL_BLANK: the sentence with its `___` gap. */
  template: string | null;
  mediaUrl: string | null;
  /** Shuffled per load, WITHOUT `isCorrect`. */
  choices: Array<{ id: string; text: string }>;
  /** The session it came from, for "Buổi 7" on the card. */
  buoi: number | null;
}

export interface DeOnTap extends KhoangOnTap {
  cauHoi: CauHoiOnTap[];
}

/**
 * The questions for one fight, freshly shuffled.
 *
 * Takes the student id from the caller, which is always the session: this is
 * read by the lesson page after `resolveLessonAccess` has opened the lesson.
 * Returns null for a block that is not a boss, and an empty list for a boss
 * with nothing to review yet — the page says so and lets the student move on.
 *
 * Choices are shuffled here as well as questions. Seeded multiple-choice lists
 * the correct choice first (`mcq()` in the seed builders), and a boss whose
 * right answer is always the top button is not a review of anything.
 */
export async function deOnTap(
  db: PrismaClient,
  studentId: string,
  blockId: string,
): Promise<DeOnTap | null> {
  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    select: { type: true, content: true, lesson: { select: { courseId: true, order: true } } },
  });
  if (!block || block.type !== 'MINIGAME_BOSS') return null;

  const khoang = khoangOnTap(block.content, block.lesson.order);
  const { courseId } = block.lesson;

  const rows = await db.question.findMany({
    where: cauTrongKhoang(studentId, courseId, khoang),
    take: TRAN_DOC,
    select: {
      id: true,
      type: true,
      prompt: true,
      template: true,
      mediaUrl: true,
      choices: { orderBy: { order: 'asc' }, select: { id: true, text: true } },
      quiz: {
        select: {
          blocks: {
            where: {
              lesson: { courseId, order: { gte: khoang.tuBuoi, lte: khoang.denBuoi } },
            },
            select: { lesson: { select: { order: true } } },
            take: 1,
          },
        },
      },
    },
  });

  return {
    ...khoang,
    cauHoi: tron(rows)
      .slice(0, SO_CAU_MOI_TRAN)
      .map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        template: q.template,
        mediaUrl: q.mediaUrl,
        choices: tron(q.choices),
        buoi: q.quiz.blocks[0]?.lesson.order ?? null,
      })),
  };
}

export interface KetQuaDanhBoss {
  dung: boolean;
  /** Only on a wrong answer — the whole point of review is seeing it. */
  dapAnDung: string | null;
  giaiThich: string | null;
}

/**
 * Mark one answer in a fight.
 *
 * ── Every id here came from the browser ──────────────────────────────────────
 * So each is re-derived rather than trusted:
 *
 *   1. `moKhoiCode` — the block's lesson must be open to this student, and not
 *      under an integrity lock. The same door every hand-in walks through.
 *   2. The block must BE a boss; any other block id is refused.
 *   3. The question must be in that boss's pool FOR THIS STUDENT — in the
 *      window, machine-markable, already answered by them. A question id from
 *      anywhere else (an open lesson question, an exam bank) is refused with
 *      the same error as an unknown one, so the response says nothing about
 *      which ids exist.
 */
export async function chamCauOnTap(
  db: PrismaClient,
  studentId: string,
  blockId: string,
  questionId: string,
  traLoi: string,
): Promise<KetQuaDanhBoss> {
  const khoi = await moKhoiCode(db, studentId, blockId);

  const block = await db.lessonBlock.findUnique({
    where: { id: khoi.blockId },
    select: { type: true, content: true, lesson: { select: { courseId: true, order: true } } },
  });
  if (!block || block.type !== 'MINIGAME_BOSS') throw new ForbiddenError('not-a-review-block');

  const khoang = khoangOnTap(block.content, block.lesson.order);

  const cau = await db.question.findFirst({
    where: { id: questionId, ...cauTrongKhoang(studentId, block.lesson.courseId, khoang) },
    select: {
      type: true,
      points: true,
      explanation: true,
      acceptedAnswers: true,
      matchMode: true,
      choices: { select: { id: true, text: true, isCorrect: true } },
    },
  });
  if (!cau) throw new ForbiddenError('question-not-in-review');

  const dung = chamMotCau(cau, traLoi);
  return {
    dung,
    dapAnDung: dung ? null : dapAnCua(cau),
    giaiThich: cau.explanation,
  };
}
