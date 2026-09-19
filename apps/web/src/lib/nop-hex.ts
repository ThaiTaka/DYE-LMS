import 'server-only';

/**
 * Hand in an exported .hex — the fallback when the embedded editor will not.
 *
 * ── Why this is not a server action any more ─────────────────────────────────
 * It used to be. A server action's request body is capped at 1 MB by Next.js
 * (`serverActions.bodySizeLimit`), and a universal micro:bit .hex is ~1.8 MB.
 * The action never ran: the framework refused the body, the client's promise
 * rejected, and every student with a real file saw "Chưa gửi được. Em kiểm tra
 * mạng" — a network error for a network that was fine. This module is the
 * action's logic, unchanged in what it checks and stores, called from a route
 * handler (`/api/khoi/[blockId]/hex`) that has no such cap.
 *
 * ── The file is checked before anything is stored ────────────────────────────
 * `kiemTraIntelHex` reads the whole file as text and verifies every record's
 * checksum. A renamed photo, a truncated download, a corrupted copy — each is
 * refused with a sentence that says what to do, rather than accepted and
 * discovered by a teacher a week later.
 *
 * ── Content-addressed storage ────────────────────────────────────────────────
 * The key is the SHA-256 of the bytes (`khoaLuuTru`), so the same .hex handed
 * in twice is stored once, and the submission row points at exactly the bytes
 * the student sent. The teacher's download serves those bytes back.
 *
 * ── Progress ─────────────────────────────────────────────────────────────────
 * `nopBaiMicrobitHex` in @dye/core records effort on the block (`ghiNhanNoLuc`)
 * and re-derives lesson completion, exactly as a Python submission does. What
 * this module adds is the cache bust, so the page the student is looking at can
 * show the ✓ and the new percentage on its next refresh rather than after a
 * hard reload.
 */
import { createHash } from 'node:crypto';

import {
  ForbiddenError,
  GIOI_HAN_HEX_BYTE,
  khoaLuuTru,
  kiemTraIntelHex,
  nopBaiMicrobitHex,
  UnauthorizedError,
  type LoiHex,
} from '@dye/core';

import { db } from '@/lib/db';
import { lamMoiTrangTienDo } from '@/lib/lam-moi-tien-do';
import { khoDuAn } from '@/lib/project-storage';

import type { KetQuaNop } from '@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions';

/** What each refusal means to a ten-year-old holding the wrong file. */
export const LOI_HEX_CHU: Record<LoiHex, string> = {
  rong: 'Tệp này trống. Em xuất lại từ MakeCode rồi chọn đúng tệp .hex nhé.',
  'qua-lon': `Tệp lớn hơn ${Math.round(GIOI_HAN_HEX_BYTE / 1024 / 1024)} MB — không phải tệp .hex của micro:bit.`,
  'khong-phai-intel-hex':
    'Đây không phải tệp .hex của micro:bit. Trong MakeCode, em bấm "Tải xuống" (Download) và chọn tệp vừa tải.',
  'dong-hong': 'Tệp .hex bị hỏng. Em tải lại từ MakeCode rồi nộp lần nữa nhé.',
  'sai-checksum': 'Tệp .hex bị lỗi khi tải về (sai mã kiểm tra). Em tải lại từ MakeCode nhé.',
  'thieu-ket-thuc': 'Tệp .hex chưa tải xong (thiếu phần cuối). Em đợi tải hết rồi nộp lại nhé.',
};

function tuChoi(thongDiep: string): KetQuaNop {
  return { trangThai: 'tu-choi', submissionId: null, attemptNo: null, thongDiep };
}

/**
 * Validate, store and record one .hex for `studentId` on `blockId`.
 *
 * Returns a result object rather than throwing, for the same reason the code
 * actions do: the caller is answering a student's click, and every reason for
 * refusing is a sentence they can act on. Only a genuine fault reaches the log.
 */
export async function nhanTepHex(
  studentId: string,
  blockId: string,
  tep: File,
): Promise<KetQuaNop> {
  if (tep.size === 0) return tuChoi(LOI_HEX_CHU.rong);
  if (tep.size > GIOI_HAN_HEX_BYTE) return tuChoi(LOI_HEX_CHU['qua-lon']);

  try {
    const bytes = new Uint8Array(await tep.arrayBuffer());
    const kq = kiemTraIntelHex(
      new TextDecoder('utf-8', { fatal: false }).decode(bytes),
      bytes.length,
    );
    if (!kq.ok) return tuChoi(LOI_HEX_CHU[kq.loi]);

    const sha = createHash('sha256').update(bytes).digest('hex');
    const hexKey = khoaLuuTru(sha);
    await khoDuAn.ghi(hexKey, bytes);

    const tenTep = tep.name.replace(/[^\w.\-() ]+/g, '').slice(0, 80) || 'microbit.hex';
    const nop = await nopBaiMicrobitHex(db, studentId, blockId, {
      hexKey,
      tenTep,
      kichThuoc: bytes.length,
    });

    lamMoiTrangTienDo();

    return {
      trangThai: 'da-nhan',
      submissionId: nop.submissionId,
      attemptNo: nop.attemptNo,
      thongDiep:
        `Đã nhận tệp ${tenTep} — lần nộp thứ ${nop.attemptNo}. Thầy cô sẽ nạp thử lên micro:bit và nhận xét. ` +
        'Phần này đã được tính là hoàn thành.',
    };
  } catch (error) {
    if (error instanceof ForbiddenError) return tuChoi(error.message);
    if (error instanceof UnauthorizedError) {
      return tuChoi('Phiên đăng nhập đã hết hạn. Em đăng nhập lại nhé.');
    }
    console.error('[nop-hex] thất bại', error);
    return {
      trangThai: 'loi',
      submissionId: null,
      attemptNo: null,
      thongDiep: 'Chưa lưu được tệp. Em thử lại sau một lát nhé.',
    };
  }
}
