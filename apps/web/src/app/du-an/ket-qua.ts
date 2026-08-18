/**
 * Result shapes for the project workspace actions.
 *
 * Kept out of `actions.ts` because a `'use server'` file may only export async
 * functions; a plain object there makes Next.js throw at runtime and disables
 * every action in the file. See app/giao-vien/ket-qua.ts for the full note.
 */
export interface KetQuaDuAn {
  trangThai: 'chua-lam' | 'thanh-cong' | 'tu-choi' | 'loi';
  thongDiep: string;
}

export interface KetQuaTaiLen extends KetQuaDuAn {
  /** Per-file outcome, so partial success is reported honestly. */
  chiTiet: Array<{ ten: string; ok: boolean; lyDo: string }>;
}

export const CHUA_LAM: KetQuaDuAn = { trangThai: 'chua-lam', thongDiep: '' };
