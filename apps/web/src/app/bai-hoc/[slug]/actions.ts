'use server';

import { authorize, ForbiddenError, moKhoiCode, nopTuLuan, syncLessonCompletion } from '@dye/core';

import { revalidatePath } from 'next/cache';

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

  /*
   * SHORT_ANSWER never lands here.
   *
   * It used to, and returned `dung: true` unconditionally — a child could type
   * one character into an essay question and be told they were right, with
   * nothing stored and no teacher ever seeing it. Free-text answers go through
   * `nopBaiTuLuan`, which persists them and leaves them for a person.
   */
  throw new Error('SHORT_ANSWER phai di qua nopBaiTuLuan, khong tu cham o day');
}

export interface KetQuaNopTuLuanUI {
  trangThai: 'da-nhan' | 'da-nop-roi' | 'rong' | 'tu-choi' | 'loi';
  thongDiep: string;
}

/**
 * Hand in one free-text answer.
 *
 * Returns a result object rather than throwing: this is called from a client
 * component, and a thrown error would replace the lesson with a crash page
 * while the student was mid-sentence.
 *
 * The lock is enforced in `nopTuLuan` by the existence of the row, not by the
 * disabled button that usually prevents reaching here — so a second submit from
 * a stale tab is refused rather than recorded.
 */
export async function nopBaiTuLuan(
  questionId: string,
  noiDung: string,
): Promise<KetQuaNopTuLuanUI> {
  try {
    const actor = await currentActor();
    if (!actor || actor.role !== 'STUDENT') {
      return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới nộp được bài này.' };
    }

    const kq = await nopTuLuan(db, actor, questionId, noiDung);

    if (kq.trangThai === 'rong') {
      return { trangThai: 'rong', thongDiep: 'Em viết vài dòng rồi hãy nộp nhé.' };
    }
    if (kq.trangThai === 'da-nop-roi') {
      return {
        trangThai: 'da-nop-roi',
        thongDiep: 'Câu này em đã nộp rồi. Muốn sửa thì nhờ thầy cô mở lại giúp em.',
      };
    }

    // The lesson page reads the lock from the server, so it has to be re-read
    // for the box to stay closed after this returns.
    revalidatePath('/bai-hoc/[slug]', 'page');

    return {
      trangThai: 'da-nhan',
      thongDiep: 'Đã nộp bài của em. Thầy cô sẽ chấm và phản hồi sau nhé.',
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { trangThai: 'tu-choi', thongDiep: error.message };
    }
    console.error('[tu-luan] nop that bai', error);
    return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé.' };
  }
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

  /*
   * Re-read the lesson so the progress bar moves now rather than on the next
   * navigation.
   *
   * `syncLessonCompletion` writes the new percentage, but the page that shows it
   * is a server component — without this the student finishes a block, watches
   * the bar stay where it was, and reasonably concludes it did not count. It
   * also matters for the lesson map: finishing the last required block is what
   * opens the next session, and that list is rendered on the server too.
   */
  revalidatePath('/bai-hoc/[slug]', 'page');
  revalidatePath('/khoa-hoc/[slug]', 'page');
  revalidatePath('/bang-dieu-khien');

  return { baiXong };
}
