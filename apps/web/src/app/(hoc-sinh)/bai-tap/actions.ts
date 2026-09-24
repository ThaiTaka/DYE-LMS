'use server';

/**
 * Student actions for teacher-set homework.
 *
 * One action: hand in. The rules — enrolled in the class, not yet graded, not
 * empty, not oversized — live in `nopBaiTapVeNha` in @dye/core, and the
 * student id comes from the session, never from the request.
 */
import { ForbiddenError, nopBaiTapVeNha } from '@dye/core';
import { revalidatePath } from 'next/cache';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

export interface KetQuaNopBaiTapUI {
  trangThai: 'da-nop' | 'da-cham-roi' | 'rong' | 'qua-dai' | 'tu-choi' | 'loi';
  thongDiep: string;
  /** ISO. Set only on `da-nop`, so the page can say when without a reload. */
  nopLuc: string | null;
  nopMuon: boolean;
}

/**
 * Hand in (or hand in again) one homework.
 *
 * Returned, never thrown: this is called from the editor, and a crash page
 * there would hide the code the child just wrote. The editor keeps its text
 * whatever comes back, so every refusal is recoverable by editing and
 * pressing the button again.
 */
export async function nopBaiTap(homeworkId: string, code: string): Promise<KetQuaNopBaiTapUI> {
  const khong = { nopLuc: null, nopMuon: false };
  try {
    const actor = await currentActor();
    if (!actor || actor.role !== 'STUDENT') {
      return { trangThai: 'tu-choi', thongDiep: 'Chỉ học sinh mới nộp được bài tập.', ...khong };
    }

    const kq = await nopBaiTapVeNha(db, actor, homeworkId, code);

    switch (kq.trangThai) {
      case 'rong':
        return { trangThai: 'rong', thongDiep: 'Em viết code rồi hãy nộp nhé.', ...khong };
      case 'qua-dai':
        return {
          trangThai: 'qua-dai',
          thongDiep: 'Bài dài quá, hệ thống không nhận. Em xoá bớt phần thừa rồi nộp lại nhé.',
          ...khong,
        };
      case 'da-cham-roi':
        return {
          trangThai: 'da-cham-roi',
          thongDiep:
            'Thầy cô đã chấm bài này rồi nên không nộp lại được nữa. Em tải lại trang để xem nhận xét nhé.',
          ...khong,
        };
      case 'da-nop': {
        revalidatePath('/bai-tap');
        revalidatePath('/bai-tap/[id]', 'page');
        revalidatePath('/bang-dieu-khien');
        const dau = kq.lanDau
          ? 'Đã nộp bài! Thầy cô sẽ xem và nhận xét cho em.'
          : 'Đã nộp lại — thầy cô sẽ xem bản mới nhất này.';
        return {
          trangThai: 'da-nop',
          thongDiep: kq.nopMuon ? `${dau} Bài được ghi nhận là nộp sau hạn.` : dau,
          nopLuc: kq.nopLuc.toISOString(),
          nopMuon: kq.nopMuon,
        };
      }
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { trangThai: 'tu-choi', thongDiep: error.message, ...khong };
    }
    console.error('[bai-tap] nop that bai', error);
    return {
      trangThai: 'loi',
      thongDiep: 'Có lỗi kỹ thuật. Em thử lại giúp nhé — code của em vẫn còn trong ô.',
      ...khong,
    };
  }
}
