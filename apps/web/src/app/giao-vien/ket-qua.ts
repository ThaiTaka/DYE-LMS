/**
 * Result shape for the teacher actions.
 *
 * ── Why this is not in `actions.ts` ──────────────────────────────────────────
 * A `'use server'` file may only export async functions. Exporting a plain
 * object from one makes Next.js throw at runtime — "A 'use server' file can only
 * export async functions, found object" — and it takes down every action in the
 * file, not just the constant.
 *
 * That failure only appears when an action is actually invoked from a browser in
 * a production build, which is why it survived a page-level smoke test and was
 * found by the end-to-end suite instead.
 */
export interface KetQuaHanhDong {
  trangThai: 'chua-lam' | 'thanh-cong' | 'tu-choi' | 'loi';
  thongDiep: string;
}

/** The "nothing has happened yet" state every teacher form starts in. */
export const CHUA_LAM: KetQuaHanhDong = { trangThai: 'chua-lam', thongDiep: '' };
