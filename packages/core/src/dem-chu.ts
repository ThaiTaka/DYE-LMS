/**
 * Counting a student's words — the one rule both sides of the wire share.
 *
 * ── Client-safe on purpose ───────────────────────────────────────────────────
 * No Prisma, no Node built-ins. The reflection box imports this through
 * `@dye/core/dem-chu` to drive its live counter, and `nopTuLuanHocTap` imports
 * it to enforce the floor. One function is what makes the number a child
 * watches climb to 150 the number the server checks: a counter that disagreed
 * with the server by even one word would enable a button that then refuses.
 *
 * ── What counts as a "chữ" ──────────────────────────────────────────────────
 * Vietnamese is written one syllable per space-separated token, and "150 chữ"
 * in a Vietnamese classroom means 150 of those — the unit a teacher counts by
 * eye, and the one Word's counter reports. So this splits on whitespace, not
 * on a dictionary of words.
 *
 * A token counts only if it holds at least one letter or digit, in any script.
 * "- - - -" and a line of dots are not writing, and a counter that accepted
 * them would teach the shortcut on the first day.
 */

/** The floor for a post-lesson reflection, in words as `demSoChu` counts them. */
export const SO_CHU_TOI_THIEU_SUY_NGAM = 150;

/**
 * Longest reflection accepted, in characters.
 *
 * Roughly 1 500 Vietnamese words — ten times the floor, so no keen writer
 * meets it, while a pasted wall of text does. Refused rather than truncated:
 * silently keeping half of what a child wrote is worse than saying no.
 */
export const SUY_NGAM_TOI_DA_KY_TU = 8000;

const CO_CHU_HOAC_SO = /[\p{L}\p{N}]/u;

/**
 * Words in `vanBan`.
 *
 *     demSoChu('Hôm nay em học vòng lặp for.')  // → 7
 *     demSoChu('  - - -  ')                     // → 0
 */
export function demSoChu(vanBan: string): number {
  let dem = 0;
  for (const manh of vanBan.split(/\s+/)) {
    if (CO_CHU_HOAC_SO.test(manh)) dem += 1;
  }
  return dem;
}
