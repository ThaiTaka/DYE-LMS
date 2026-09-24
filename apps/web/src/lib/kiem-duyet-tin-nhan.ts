import 'server-only';

import { kiemDuyetTuKhoa, type LoaiViPham } from './kiem-duyet';
import { coMoHinh, kiemDuyetBangMoHinh } from './tro-ly-claude';

import type { NguonPhatHien } from '@dye/core';

/**
 * The moderation filter, once — for every surface a child can type into.
 *
 * ── Why this is its own function ─────────────────────────────────────────────
 * Bí (`api/tro-ly`) and the class chat (`api/chat`) must judge a message the
 * same way. Two routes each calling the word list and then the classifier is
 * two copies of an ordering that has to stay identical, and the day one of
 * them gains a step the other does not is the day a message that is refused
 * in one box is posted in the other. So the ordering lives here and both
 * routes call it.
 *
 * ── The order, and what each outcome means ───────────────────────────────────
 *   1. The word list (`kiem-duyet.ts`). Free, instant, works with no model.
 *   2. The model classifier, only when a model is configured. Sees only the
 *      message text, and can only answer with a label.
 *
 *   `sach`     — nothing found. With no model configured this means "the word
 *                list found nothing", which is the most the server can check.
 *   `vi-pham`  — a positive. The caller refuses the message AND locks a
 *                student (`khoaTroLyViPham`).
 *   `chua-ro`  — the classifier could not answer (network, refusal, bad
 *                output). The caller refuses the message and punishes no one:
 *                an unmoderated message is not safe to deliver to children,
 *                and a lock needs a positive, not a shrug.
 */
export type KetQuaKiemDuyet =
  | { trangThai: 'sach' }
  | { trangThai: 'vi-pham'; loai: LoaiViPham; nguon: NguonPhatHien }
  | { trangThai: 'chua-ro'; loi: string };

export async function kiemDuyetTinNhan(vanBan: string): Promise<KetQuaKiemDuyet> {
  const tuKhoa = kiemDuyetTuKhoa(vanBan);
  if (tuKhoa) return { trangThai: 'vi-pham', loai: tuKhoa, nguon: 'tu-khoa' };

  if (!coMoHinh()) return { trangThai: 'sach' };

  const kq = await kiemDuyetBangMoHinh(vanBan);
  if (!kq.ok) return { trangThai: 'chua-ro', loi: kq.loi };
  if (kq.viPham) return { trangThai: 'vi-pham', loai: kq.viPham, nguon: 'mo-hinh' };
  return { trangThai: 'sach' };
}
