/**
 * Differentiation tiers.
 *
 * The scale is positive by construction: Cơ bản → Thử thách → Nâng cao → Mở rộng.
 * There is no value below "Cơ bản" and no way to express deficiency, because a
 * tier describes the WORK a student is currently assigned — never the student.
 *
* Two rules follow from that, and both are encoded here rather than left to the UI:
 *
 *   • Tiers are CUMULATIVE. A student on Nâng cao still needs the Cơ bản theory;
 *     they get the base material *plus* the harder challenges.
 *   • What happens to content ABOVE a student's tier is a per-course choice
 *     (`Course.branching`). INTERLEAVED keeps the original rule: visible as
 *     EXPLORATION, never counted. STRICT — the default, for the Grade-5
 *     audience — hides it: a Cơ bản student sees the core and nothing else,
 *     and a student on a higher track sees the core followed by their extra
 *     work, in that order. See `sapXepTheoNhanh`.
 */
import type { Branching, Tier } from '@prisma/client';

/** Ascending order. Index is the comparable rank. */
export const TIER_ORDER: readonly Tier[] = ['CO_BAN', 'THU_THACH', 'NANG_CAO', 'MO_RONG'] as const;

/** The tier a student sits on until a teacher assigns otherwise. */
export const DEFAULT_TIER: Tier = 'CO_BAN';

export const TIER_LABEL: Record<Tier, string> = {
  CO_BAN: 'Cơ bản',
  THU_THACH: 'Thử thách',
  NANG_CAO: 'Nâng cao',
  MO_RONG: 'Mở rộng',
};

export function tierRank(tier: Tier): number {
  const index = TIER_ORDER.indexOf(tier);
  // An unknown tier must not silently outrank everything.
  return index === -1 ? 0 : index;
}

/** True when `tier` is at or below `studentTier` — i.e. inside the student's scope. */
export function tierWithinScope(tier: Tier, studentTier: Tier): boolean {
  return tierRank(tier) <= tierRank(studentTier);
}

/**
 * How a content block relates to one student.
 *
 * REQUIRED     — inside their tier and not flagged optional; counts toward progress.
 * OPTIONAL     — inside their tier but explicitly optional; visible, never counted.
 * EXPLORATION  — above their tier; visible and encouraged, never counted.
 *                (INTERLEAVED courses only.)
 * HIDDEN       — above their tier and not rendered. (STRICT courses.)
 */
export type BlockAccess = 'REQUIRED' | 'OPTIONAL' | 'EXPLORATION' | 'HIDDEN';

export function resolveBlockAccess(
  blockTier: Tier,
  isOptional: boolean,
  studentTier: Tier,
  branching: Branching = 'STRICT',
): BlockAccess {
  if (!tierWithinScope(blockTier, studentTier)) {
    return branching === 'STRICT' ? 'HIDDEN' : 'EXPLORATION';
  }
  return isOptional ? 'OPTIONAL' : 'REQUIRED';
}

/** HIDDEN is the one access a student is not shown. Everything else renders. */
export function isBlockVisible(access: BlockAccess): boolean {
  return access !== 'HIDDEN';
}

/** Is this the base material every track gets, or something added on top? */
export function laKhoiCotLoi(blockTier: Tier): boolean {
  return blockTier === 'CO_BAN';
}

/**
 * The order a STRICT course shows blocks in: the core in authored order,
 * then everything above it — by tier, then authored order.
 *
 * "Advanced exercises clearly appended at the end" is the whole point. In the
 * seeded curriculum 33 of 120 lessons have a Thử thách or Nâng cao block sat
 * BETWEEN two Cơ bản ones; under this order a student on Nâng cao reads the
 * lesson as one unbroken core followed by a clearly separate harder part.
 *
 * Pure and exported so the ordering can be asserted without a database.
 */
export function sapXepTheoNhanh<T extends { tier: Tier; order: number }>(
  blocks: readonly T[],
  branching: Branching,
): T[] {
  const sorted = [...blocks];
  if (branching !== 'STRICT') return sorted.sort((a, b) => a.order - b.order);
  return sorted.sort((a, b) => {
    const ca = laKhoiCotLoi(a.tier) ? 0 : 1;
    const cb = laKhoiCotLoi(b.tier) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    if (ca === 1 && a.tier !== b.tier) return tierRank(a.tier) - tierRank(b.tier);
    return a.order - b.order;
  });
}

/** Only REQUIRED work forms the denominator of a progress bar. */
export function countsTowardProgress(access: BlockAccess): boolean {
  return access === 'REQUIRED';
}

/** The next tier up, or null at the top. Used to suggest a promotion. */
export function nextTier(tier: Tier): Tier | null {
  const next = TIER_ORDER[tierRank(tier) + 1];
  return next ?? null;
}
