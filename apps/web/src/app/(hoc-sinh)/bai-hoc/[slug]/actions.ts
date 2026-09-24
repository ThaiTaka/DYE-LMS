'use server';

import {
  authorize,
  biKhoaViPham,
  chamCauOnTap,
  ForbiddenError,
  ghiNhanNoLuc,
  moKhoiCode,
  moTaLoiThuyetTrinh,
  nopThuyetTrinh,
  nopTuLuan,
  nopTuLuanHocTap,
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

export interface KetQuaTuLuanHocTapUI {
  trangThai: 'da-nhan' | 'chua-du-chu' | 'qua-dai' | 'da-nop-roi' | 'tu-choi' | 'loi';
  thongDiep: string;
}

/**
 * Hand in the post-lesson reflection.
 *
 * The 150-word floor, the one-per-lesson rule, the gating check and the
 * integrity lock all live in `nopTuLuanHocTap`; this only turns its answer into
 * a sentence. Returned, never thrown, for the reason `nopBaiTuLuan` gives: a
 * thrown error would swap the lesson for a crash page with a child's 150 words
 * still in the box.
 */
export async function nopBaiTuLuanHocTap(
  lessonId: string,
  noiDung: string,
): Promise<KetQuaTuLuanHocTapUI> {
  try {
    const actor = await currentActor();
    if (!actor || actor.role !== 'STUDENT') {
      return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới nộp được bài tự luận này.' };
    }

    const kq = await nopTuLuanHocTap(db, actor, lessonId, noiDung);

    switch (kq.trangThai) {
      case 'chua-du-chu':
        return {
          trangThai: 'chua-du-chu',
          thongDiep: `Em mới viết ${kq.soChu}/${kq.toiThieu} chữ. Viết thêm một chút nữa rồi gửi nhé.`,
        };
      case 'qua-dai':
        return {
          trangThai: 'qua-dai',
          thongDiep: `Bài dài quá — tối đa ${kq.toiDa.toLocaleString('vi-VN')} ký tự. Em rút gọn giúp nhé.`,
        };
      case 'da-nop-roi':
        // A second tab, or a double-click that lost the race. Re-render so the
        // box shows the reflection that IS on record instead of an empty form.
        revalidatePath('/bai-hoc/[slug]', 'page');
        return {
          trangThai: 'da-nop-roi',
          thongDiep: 'Em đã gửi bài tự luận cho buổi này rồi.',
        };
      case 'bi-khoa':
        return {
          trangThai: 'tu-choi',
          thongDiep:
            'Bài này đang bị khoá vì hệ thống ghi nhận em rời khỏi tab quá nhiều lần. ' +
            'Em nói với thầy cô để được mở lại nhé — bài viết của em vẫn còn trong ô.',
        };
      case 'da-nhan':
        // The page reads the reflection from the server, so the box closes on
        // the re-render rather than only in this tab's state.
        revalidatePath('/bai-hoc/[slug]', 'page');
        return {
          trangThai: 'da-nhan',
          thongDiep: `Đã gửi bài tự luận của em (${kq.soChu} chữ). Thầy cô sẽ đọc nhé!`,
        };
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { trangThai: 'tu-choi', thongDiep: error.message };
    }
    console.error('[tu-luan-hoc-tap] nop that bai', error);
    return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé — bài vẫn còn trong ô.' };
  }
}

export type KetQuaDanhBossUI =
  | { trangThai: 'da-cham'; dung: boolean; dapAnDung: string | null; giaiThich: string | null }
  | { trangThai: 'tu-choi'; thongDiep: string };

/**
 * One answer in the review boss fight.
 *
 * Marked on the server by `chamCauOnTap`, which re-derives everything the
 * browser sent: the lesson must be open (`moKhoiCode`), the block must be a
 * boss, and the question must be one this student has ALREADY answered in the
 * boss's window. So the fight — replayable as often as a child likes — can
 * never be used to find out the answer to a question that is still open.
 *
 * Nothing is recorded per answer; the block completes through
 * `danhDauKhoiXong` when a fight ends, win or lose.
 */
export async function danhBoss(
  blockId: string,
  questionId: string,
  traLoi: string,
): Promise<KetQuaDanhBossUI> {
  const actor = await currentActor();
  if (!actor || actor.role !== 'STUDENT') {
    return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới đấu boss được nhé.' };
  }

  try {
    const kq = await chamCauOnTap(db, actor.id, blockId, questionId, traLoi.slice(0, 500));
    return { trangThai: 'da-cham', ...kq };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      // A question outside the pool means a stale page (a teacher reset the
      // lesson's quiz since it loaded); everything else — a locked lesson, the
      // integrity lock — already carries a sentence written for the child.
      const thongDiep =
        error.reason === 'question-not-in-review'
          ? 'Câu này không còn trong trận ôn tập. Em tải lại trang rồi đấu tiếp nhé.'
          : error.message;
      return { trangThai: 'tu-choi', thongDiep };
    }
    console.error('[on-tap] cham that bai', error);
    return { trangThai: 'tu-choi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé.' };
  }
}

export interface KetQuaThuyetTrinhUI {
  trangThai: 'da-nhan' | 'khong-hop-le' | 'da-nop-roi' | 'tu-choi' | 'loi';
  thongDiep: string;
}

/**
 * Hand in the eight-slide presentation.
 *
 * The slide count, the empty-slide check, the gating check, the integrity lock
 * and the once-only rule all live in `nopThuyetTrinh`. Returned, never thrown:
 * a crash page here would sit on top of eight slides of a child's writing.
 */
export async function nopBaiThuyetTrinh(
  blockId: string,
  slides: Array<{ tieuDe: string; noiDung: string }>,
): Promise<KetQuaThuyetTrinhUI> {
  try {
    const actor = await currentActor();
    if (!actor || actor.role !== 'STUDENT') {
      return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới nộp được bài thuyết trình.' };
    }

    const kq = await nopThuyetTrinh(db, actor, blockId, slides);

    switch (kq.trangThai) {
      case 'khong-hop-le':
        return { trangThai: 'khong-hop-le', thongDiep: moTaLoiThuyetTrinh(kq.loi) };
      case 'da-nop-roi':
        revalidatePath('/bai-hoc/[slug]', 'page');
        return { trangThai: 'da-nop-roi', thongDiep: 'Em đã nộp bài thuyết trình này rồi.' };
      case 'da-nhan':
        revalidatePath('/bai-hoc/[slug]', 'page');
        revalidatePath('/khoa-hoc/[slug]', 'page');
        revalidatePath('/bang-dieu-khien');
        return {
          trangThai: 'da-nhan',
          thongDiep: 'Đã nộp bài thuyết trình! Thầy cô sẽ xem và hẹn em trình bày trước lớp.',
        };
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { trangThai: 'tu-choi', thongDiep: error.message };
    }
    console.error('[thuyet-trinh] nop that bai', error);
    return { trangThai: 'loi', thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé — bài vẫn còn nguyên.' };
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
