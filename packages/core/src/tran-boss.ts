/**
 * The review fight's rules — pure, and shared by the server and the browser.
 *
 * ── Why the numbers live here and not in the component ───────────────────────
 * The fight is played in the browser, but "how many hits does the boss take"
 * is a curriculum decision, not a styling one, and it has a property worth a
 * test: whatever the pool size, the fight ENDS before the questions run out.
 * Kept free of Prisma so the lesson player can import it through
 * `@dye/core/tran-boss` without dragging server code into a child's browser —
 * the same arrangement as `@dye/core/dem-chu`.
 *
 * ── What winning and losing cost ─────────────────────────────────────────────
 * Nothing. The block completes when a fight ENDS, either way — the effort rule
 * every other block follows (`ghiNhanNoLuc`). A ten-year-old who loses to the
 * boss three times has still reviewed thirty questions, and holding the next
 * session hostage to a game would turn review into a gate. Winning is for the
 * feeling; a rematch is always one click away.
 *
 * ── Why the student's bar is short ───────────────────────────────────────────
 * Three hearts at most. Enough that one slip is not the end, few enough that
 * the fight has some tension — and the boss's bar is sized so that the two
 * together always fit inside the pool: `mauBoss + mauHocSinh - 1 <= soCau`.
 */

/** Questions drawn for one fight. A few minutes of review, not a second quiz. */
export const SO_CAU_MOI_TRAN = 10;

/** Most hearts a student can have. */
export const MAU_HOC_SINH_TOI_DA = 3;

/** Share of the pool the student must get right to win. */
const TI_LE_THANG = 0.6;

export type KetQuaTran = 'dang-danh' | 'thang' | 'thua';

export interface TranBoss {
  /** Hits left before the boss falls. */
  mauBoss: number;
  mauBossToiDa: number;
  /** Misses left before the fight ends. */
  mauHocSinh: number;
  mauHocSinhToiDa: number;
  /** Questions answered so far — also the index of the next one. */
  daHoi: number;
  ketQua: KetQuaTran;
}

/**
 * A fresh fight for a pool of `soCau` questions.
 *
 * An empty pool has no fight at all: both bars are zero and the result is
 * already decided, which the UI reads as "nothing to review yet" rather than
 * as a loss.
 */
export function batDauTran(soCau: number): TranBoss {
  const n = Math.max(0, Math.floor(soCau));
  if (n === 0) {
    return {
      mauBoss: 0,
      mauBossToiDa: 0,
      mauHocSinh: 0,
      mauHocSinhToiDa: 0,
      daHoi: 0,
      ketQua: 'thang',
    };
  }

  const mauBoss = Math.ceil(n * TI_LE_THANG);
  // Never more hearts than the pool leaves room for — see the invariant above.
  const mauHocSinh = Math.min(MAU_HOC_SINH_TOI_DA, n - mauBoss + 1);

  return {
    mauBoss,
    mauBossToiDa: mauBoss,
    mauHocSinh,
    mauHocSinhToiDa: mauHocSinh,
    daHoi: 0,
    ketQua: 'dang-danh',
  };
}

/**
 * One answered question.
 *
 * Right: the boss loses a hit. Wrong: the student loses a heart. A finished
 * fight is returned unchanged, so a double-click on the last answer cannot
 * push a bar below zero or flip a win into a loss.
 */
export function danhMotLuot(tran: TranBoss, dung: boolean): TranBoss {
  if (tran.ketQua !== 'dang-danh') return tran;

  const mauBoss = dung ? tran.mauBoss - 1 : tran.mauBoss;
  const mauHocSinh = dung ? tran.mauHocSinh : tran.mauHocSinh - 1;

  return {
    ...tran,
    mauBoss,
    mauHocSinh,
    daHoi: tran.daHoi + 1,
    ketQua: mauBoss <= 0 ? 'thang' : mauHocSinh <= 0 ? 'thua' : 'dang-danh',
  };
}

/** A bar's fill, 0–100, for a value out of its maximum. */
export function phanTramMau(con: number, toiDa: number): number {
  if (toiDa <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((con / toiDa) * 100)));
}
