/**
 * Marking one quiz question — the single copy.
 *
 * These rules used to live twice: once in the web app's quiz action and once
 * in `khoa-vi-pham.ts` (which re-marks answers when a lock is lifted). A third
 * caller — the milestone exam — is the point at which two copies that must
 * agree become three, so the rules move here and the others call in.
 *
 * ── What "normalised" means, and why ─────────────────────────────────────────
 * Vietnamese students type with and without diacritics depending on the
 * machine they are on: a school computer often has no Vietnamese IME. Marking
 * "hoc sinh" wrong when the expected answer is "học sinh" would be punishing a
 * child for their keyboard, so `normalised` mode strips the marks before
 * comparing. `insensitive` only folds case and whitespace; `exact` is exact.
 *
 * ── Nothing here reads the database ──────────────────────────────────────────
 * The caller hands in the question WITH its answer key. That keeps this a pure
 * function — testable with a literal, usable inside a transaction — and keeps
 * the decision about which key to load, and who may see it, where it belongs.
 */
import type { QuestionType } from '@prisma/client';

export interface CauHoiDeCham {
  type: QuestionType;
  points: number;
  acceptedAnswers: string[];
  matchMode: string;
  choices: Array<{ id: string; isCorrect: boolean }>;
}

export function chuanHoaTraLoi(text: string, mode: string): string {
  const base = text.trim();
  if (mode === 'exact') return base;

  const lower = base.toLowerCase().replace(/\s+/g, ' ');
  if (mode === 'insensitive') return lower;

  return lower
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Can a machine mark this question type at all? */
export function tuChamDuoc(type: QuestionType): boolean {
  return type !== 'SHORT_ANSWER';
}

/**
 * Is this response correct?
 *
 * SHORT_ANSWER is always false here: it is teacher-marked, and "false" is the
 * honest machine answer for "I cannot tell". Callers that need to know the
 * difference check `tuChamDuoc` first.
 */
export function chamMotCau(cauHoi: CauHoiDeCham, response: unknown): boolean {
  if (cauHoi.type === 'MULTIPLE_CHOICE' || cauHoi.type === 'TRUE_FALSE') {
    const chon = typeof response === 'string' ? response : String(response ?? '');
    return cauHoi.choices.some((c) => c.id === chon && c.isCorrect);
  }

  if (cauHoi.type === 'FILL_BLANK') {
    const daNhap = chuanHoaTraLoi(typeof response === 'string' ? response : '', cauHoi.matchMode);
    if (daNhap === '') return false;
    return cauHoi.acceptedAnswers.some((a) => chuanHoaTraLoi(a, cauHoi.matchMode) === daNhap);
  }

  return false;
}

/** Points for one response: full marks or none. Partial credit is a teacher's call. */
export function diemMotCau(cauHoi: CauHoiDeCham, response: unknown): number {
  return chamMotCau(cauHoi, response) ? cauHoi.points : 0;
}
