'use server';

import { authorize } from '@dye/core';

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
 */
export async function danhDauKhoiXong(blockId: string): Promise<{ baiXong: boolean }> {
  const actor = await currentActor();
  if (!actor || actor.role !== 'STUDENT') return { baiXong: false };

  const block = await db.lessonBlock.findUnique({
    where: { id: blockId },
    select: { lessonId: true },
  });
  if (!block) return { baiXong: false };

  await db.blockProgress.upsert({
    where: { studentId_blockId: { studentId: actor.id, blockId } },
    create: { studentId: actor.id, blockId, state: 'COMPLETED', completedAt: new Date() },
    update: { state: 'COMPLETED', completedAt: new Date() },
  });

  const { syncLessonCompletion } = await import('@dye/core');
  const baiXong = await syncLessonCompletion(db, actor.id, block.lessonId);

  return { baiXong };
}
