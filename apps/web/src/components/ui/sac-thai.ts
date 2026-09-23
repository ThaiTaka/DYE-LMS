/**
 * Status badge tones — glass, not paint.
 *
 * ── Why a badge may not be a solid fill ──────────────────────────────────────
 * A badge answers "what state is this in?" — Đạt, Chờ chấm, Cơ bản. It is
 * read after the page has been understood, never before. The one thing on a
 * screen that should be read first is the gradient button (`nut-neon`), and a
 * saturated green pill with dark text next to it is the same visual weight,
 * so the eye is pulled two ways and the student is not sure which one to press.
 *
 * So every status pill is the same recipe at low weight: the tone at 10% as a
 * tint, the tone at 25% as a hairline, the tone itself as the text. That keeps
 * the colour meaning (green = done, amber = try again) while handing the
 * loudest voice back to the call to action.
 *
 * ── Contrast ─────────────────────────────────────────────────────────────────
 * The text colour is the full-strength token on its own 10% tint, which is
 * DARKER than the old `*-nen` fills it replaces, so every pair is at least as
 * readable as before (the weakest, `chinh-sang`, is 5.4:1 on a card). The
 * hairline is decoration — the words carry the meaning, not the edge.
 * `hien-thi.test.tsx` reads these strings and checks each pair.
 *
 * Each value is complete (border width included) so a call site only adds
 * shape: `rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.dung}`.
 */
export const SAC_THAI = {
  dung: 'border border-dung/25 bg-dung/10 text-dung',
  thuLai: 'border border-thu-lai/25 bg-thu-lai/10 text-thu-lai',
  loi: 'border border-loi/25 bg-loi/10 text-loi',
  chinh: 'border border-chinh-sang/25 bg-chinh-sang/10 text-chinh-sang',
  thuThach: 'border border-thu-thach/25 bg-thu-thach/10 text-thu-thach',
  nangCao: 'border border-nang-cao/25 bg-nang-cao/10 text-nang-cao',
  moRong: 'border border-mo-rong/25 bg-mo-rong/10 text-mo-rong',
  /** Neutral: drafts, pending, "optional" — present, but asking for nothing. */
  trung: 'border border-vien-dam bg-white/5 text-chu-phu',
} as const;

export type SacThai = keyof typeof SAC_THAI;
