'use server';

import { authorize, moKhoiCode, syncLessonCompletion } from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

/**
 * Quiz answer checking.
 *
 * Runs entirely on the server. The browser never receives `Choice.isCorrect`,
 * so the answers cannot be read out of the DOM or the network payload — it only
 * ever learns whether the answer it submitted was right.
 */

export interface KetQuaTraLoi {
  dung: boolean;
  giaiThich: string | null;
  /** Only revealed once the student has answered, so it cannot be pre-read. */
  dapAnDung: string | null;
}

/**
 * Normalise a free-text answer.
 *
 * Vietnamese students type with and without diacritics depending on the machine
 * they are on — a school computer often has no Vietnamese IME. Marking
 * "hoc sinh" wrong when the expected answer is "học sinh" would be punishing a
 * student for their keyboard, so `normalised` mode strips diacritics.
 */
function chuanHoa(text: string, mode: string): string {
  const base = text.trim();
  if (mode === 'exact') return base;

  const lower = base.toLowerCase().replace(/\s+/g, ' ');
  if (mode === 'insensitive') return lower;

  return lower
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

export async function kiemTraCauTraLoi(
  questionId: string,
  traLoi: string,
): Promise<KetQuaTraLoi> {
  const actor = await currentActor();
  if (!actor) return { dung: false, giaiThich: null, dapAnDung: null };

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      type: true,
      explanation: true,
      acceptedAnswers: true,
      matchMode: true,
      choices: { select: { id: true, text: true, isCorrect: true } },
      quiz: {
        select: {
          blocks: { select: { lesson: { select: { id: true, courseId: true } } }, take: 1 },
        },
      },
    },
  });

  if (!question) return { dung: false, giaiThich: null, dapAnDung: null };

  // The student must be allowed to see their own progress on this course before
  // they can probe its questions. Cheap, and keeps every path behind one guard.
  await authorize(db, actor, { resource: 'progress', action: 'read', studentId: actor.id });

  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'TRUE_FALSE') {
    const chon = question.choices.find((c) => c.id === traLoi);
    const dung = Boolean(chon?.isCorrect);
    return {
      dung,
      giaiThich: question.explanation,
      dapAnDung: dung ? null : (question.choices.find((c) => c.isCorrect)?.text ?? null),
    };
  }

  if (question.type === 'FILL_BLANK') {
    const daNhap = chuanHoa(traLoi, question.matchMode);
    const dung = question.acceptedAnswers.some((a) => chuanHoa(a, question.matchMode) === daNhap);
    return {
      dung,
      giaiThich: question.explanation,
      dapAnDung: dung ? null : (question.acceptedAnswers[0] ?? null),
    };
  }

  // SHORT_ANSWER is graded by a teacher; there is nothing to check here.
  return { dung: true, giaiThich: question.explanation, dapAnDung: null };
}

/**
 * Record that a student finished a block, then re-derive lesson completion.
 *
 * Completion is recomputed by the Phase 4 engine rather than set directly, so a
 * lesson is only ever marked done when every block REQUIRED for that particular
 * student is done — a Cơ bản student never has to touch the Nâng cao blocks.
 *
 * ── Why `moKhoiCode` and not a bare lookup ───────────────────────────────────
 * This action takes a block id from the client. Without resolving lesson access
 * first, a student could POST any block id and mark work complete inside a
 * LOCKED lesson — walking straight past the gating engine and unlocking the rest
 * of the course. The `studentId` always comes from the session, so no other
 * child was ever reachable, but the student's own gating was bypassable.
 *
 * `moKhoiCode` is the same guard every other code action uses: it re-resolves
 * access through Phase 4 and throws for a locked lesson.
 */
export async function danhDauKhoiXong(blockId: string): Promise<{ baiXong: boolean }> {
  const actor = await currentActor();
  if (!actor || actor.role !== 'STUDENT') return { baiXong: false };

  let block: { lessonId: string };
  try {
    block = await moKhoiCode(db, actor.id, blockId);
  } catch {
    // Locked, unknown, or not theirs. Returning false rather than throwing keeps
    // this callable from a client component without producing a crash page.
    return { baiXong: false };
  }

  await db.blockProgress.upsert({
    where: { studentId_blockId: { studentId: actor.id, blockId } },
    create: { studentId: actor.id, blockId, state: 'COMPLETED', completedAt: new Date() },
    update: { state: 'COMPLETED', completedAt: new Date() },
  });

  const baiXong = await syncLessonCompletion(db, actor.id, block.lessonId);

  return { baiXong };
}
