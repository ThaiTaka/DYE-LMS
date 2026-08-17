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
 *   • Content above a student's tier is never hidden. It surfaces as
 *     EXPLORATION — visible and encouraged, but never counted against them.
 */
import type { Tier } from '@prisma/client';

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
 */
export type BlockAccess = 'REQUIRED' | 'OPTIONAL' | 'EXPLORATION';

export function resolveBlockAccess(
  blockTier: Tier,
  isOptional: boolean,
  studentTier: Tier,
): BlockAccess {
  if (!tierWithinScope(blockTier, studentTier)) return 'EXPLORATION';
  return isOptional ? 'OPTIONAL' : 'REQUIRED';
}

/** Everything a student may see. Nothing is hidden; EXPLORATION is just uncounted. */
export function isBlockVisible(_access: BlockAccess): boolean {
  return true;
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
