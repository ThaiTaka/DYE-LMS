'use server';

import {
  authorize,
  biKhoaViPham,
  ForbiddenError,
  ghiNhanNoLuc,
  moKhoiCode,
  nopTuLuan,
  traLoiCauHoi,
} from '@dye/core';

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
  /**
   * The question already had an answer on record, so this one was not taken.
   * One attempt per question; the page freezes it and says who can lift that.
   */
  hetLuot: boolean;
}


export async function kiemTraCauTraLoi(
  questionId: string,
  traLoi: string,
): Promise<KetQuaTraLoi> {
  const khong: KetQuaTraLoi = { dung: false, giaiThich: null, dapAnDung: null, hetLuot: false };
  const actor = await currentActor();
  if (!actor) return khong;

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      type: true,
      quiz: {
        select: {
          blocks: { select: { lesson: { select: { id: true, courseId: true } } }, take: 1 },
        },
      },
    },
  });
  if (!question) return khong;

  // The student must be allowed to see their own progress on this course before
  // they can probe its questions. Cheap, and keeps every path behind one guard.
  await authorize(db, actor, { resource: 'progress', action: 'read', studentId: actor.id });

  /*
   * The integrity lock.
   *
   * Quiz answering does NOT pass through `moKhoiCode` — it is keyed on a
   * question, not a block — so the gate has to be repeated here rather than
   * inherited. Answered as "wrong, no explanation" instead of thrown: this
   * returns into a client component mid-lesson, and the page already shows
   * the lock panel explaining what happened.
   */
  const baiCuaCauHoi = question.quiz.blocks[0]?.lesson.id ?? null;
  if (baiCuaCauHoi && (await biKhoaViPham(db, actor.id, baiCuaCauHoi))) return khong;

  /*
   * SHORT_ANSWER never lands here.
   *
   * It used to, and returned `dung: true` unconditionally — a child could type
   * one character into an essay question and be told they were right, with
   * nothing stored and no teacher ever seeing it. Free-text answers go through
   * `nopBaiTuLuan`, which persists them and leaves them for a person.
   */
  if (question.type === 'SHORT_ANSWER') {
    throw new Error('SHORT_ANSWER phai di qua nopBaiTuLuan, khong tu cham o day');
  }

  /*
   * Marked AND recorded, once.
   *
   * `traLoiCauHoi` in @dye/core stores the answer as an `Answer` row — the
   * same table essays use — and refuses a second one. The marking itself is
   * the shared `chamMotCau`, so this action, the exam, and the lock's
   * re-marking cannot disagree about what "correct" means.
   */
  const kq = await traLoiCauHoi(db, actor.id, questionId, traLoi);
  if (kq.trangThai === 'da-tra-loi-roi') return { ...khong, hetLuot: true };
  if (kq.trangThai !== 'da-cham') return khong;

  revalidatePath('/bai-hoc/[slug]', 'page');

  return { dung: kq.dung, giaiThich: kq.giaiThich, dapAnDung: kq.dapAnDung, hetLuot: false };
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

    /*
     * The integrity lock, again — see `kiemTraCauTraLoi`.
     *
     * This one DOES get a message, because unlike a multiple-choice click an
     * essay is minutes of a child's writing: silently dropping it would look
     * like the system had eaten their work.
     */
    const cauHoi = await db.question.findUnique({
      where: { id: questionId },
      select: { quiz: { select: { blocks: { select: { lessonId: true }, take: 1 } } } },
    });
    const baiCuaCauHoi = cauHoi?.quiz.blocks[0]?.lessonId ?? null;
    if (baiCuaCauHoi && (await biKhoaViPham(db, actor.id, baiCuaCauHoi))) {
      return {
        trangThai: 'tu-choi',
        thongDiep:
          'Bài này đang bị khoá vì hệ thống ghi nhận em rời khỏi tab quá nhiều lần. ' +
          'Em nói với thầy cô để được mở lại nhé — bài viết của em vẫn còn trong ô.',
      };
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
export async function danhDauKhoiXong(
  blockId: string,
): Promise<{ baiXong: boolean; daGhi: boolean }> {
  const actor = await currentActor();
  if (!actor || actor.role !== 'STUDENT') return { baiXong: false, daGhi: false };

  try {
    await moKhoiCode(db, actor.id, blockId);
  } catch {
    // Locked, unknown, or not theirs. Returning false rather than throwing keeps
    // this callable from a client component without producing a crash page.
    return { baiXong: false, daGhi: false };
  }

  // The one completion rule, shared with every hand-in path: effort counts.
  const { baiXong } = await ghiNhanNoLuc(db, actor.id, blockId);

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

  return { baiXong, daGhi: true };
}
