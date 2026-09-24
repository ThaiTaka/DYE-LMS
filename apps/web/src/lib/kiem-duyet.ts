/**
 * The tutor's first line of moderation: a short list of words that mean one
 * thing only.
 *
 * ── Why a word list at all, when a model reads every message anyway ──────────
 * It runs in microseconds, costs nothing, and still works when the model is
 * unreachable or not configured — so "guardrail first" does not quietly become
 * "no guardrail" on the day the API key expires. The model classifier behind it
 * (`lib/tro-ly-claude.ts`) handles everything that needs judgement.
 *
 * ── Precision over recall, because a hit locks a child out ───────────────────
 * A match here locks the student's tutor with no model and no person in the
 * loop, so a word earns a place on this list only if it has NO innocent reading
 * a 10–15-year-old could plausibly type in a programming lesson. That rules out
 * a lot, deliberately:
 *
 *   • Anything without diacritics. Unaccented Vietnamese collides constantly:
 *     "lon" is also "lớn", "cac" is "các", "buoi" is "buổi", "dm" is đề-xi-mét.
 *   • One-key Telex typos of everyday words. "buồi" is "buổi" with f for r —
 *     adjacent keys — so a student asking about "buổi 5" could trip it.
 *   • Words with a literal meaning in the curriculum: "con chó" is an icon on
 *     the micro:bit LED grid, "óc chó" is a walnut, "sex" can be a variable in
 *     a form exercise, "18+" is an age check.
 *   • Self-directed frustration ("em ngu quá"). That is a child who is stuck.
 *
 * Everything cut from the list is still seen by the model classifier.
 *
 * Matched against the student's QUESTION only. The code and the lesson title
 * travel with it as context, and a string literal in a student's program is not
 * something they said to anyone.
 */

export type LoaiViPham = 'PROFANITY' | 'INSULT' | 'NSFW';

/** Terms as regex source. `\p{L}*` marks a stem that takes suffixes (fucking). */
const DANH_SACH: ReadonlyArray<readonly [LoaiViPham, readonly string[]]> = [
  [
    'PROFANITY',
    [
      'địt',
      'đụ',
      'đéo',
      'lồn',
      'cặc',
      'đm',
      'đmm',
      'đcm',
      'vcl',
      'vkl',
      'clgt',
      'fuck\\p{L}*',
      'motherfuck\\p{L}*',
      'shit\\p{L}*',
      'bitch\\p{L}*',
      'cunt\\p{L}*',
    ],
  ],
  [
    'INSULT',
    [
      'đồ ngu',
      'thằng ngu',
      'con ngu',
      'mày ngu',
      'ngu như (?:chó|bò|lợn|heo)',
      'đồ khốn',
      'thằng khốn',
      'khốn nạn',
      'đồ chó',
      'thằng chó',
    ],
  ],
  [
    'NSFW',
    [
      'khiêu dâm',
      'phim sex',
      'phim người lớn',
      'làm tình',
      'kh(?:oả|ỏa) thân',
      'porn\\p{L}*',
      'hentai',
      'xvideos',
    ],
  ],
];

/*
 * Whole words only. `\b` is ASCII-only in JavaScript — it treats "đ" as a
 * non-word character — so the boundary is spelled out with Unicode classes.
 */
const TRUOC = '(?<![\\p{L}\\p{N}_])';
const SAU = '(?![\\p{L}\\p{N}_])';

const MAU: ReadonlyArray<readonly [LoaiViPham, RegExp]> = DANH_SACH.map(([loai, tu]) => [
  loai,
  new RegExp(`${TRUOC}(?:${tu.join('|')})${SAU}`, 'u'),
]);

/**
 * The text as it is compared.
 *
 * NFC first: the same "đéo" arrives precomposed from one keyboard and as base
 * letter + combining marks from another, and they must compare equal. Then
 * zero-width characters out (a cheap way to split a word invisibly), runs of
 * three or more of one letter squeezed to one ("đéoooo"), and whitespace
 * collapsed so a two-word phrase survives a double space.
 */
export function chuanHoaDeKiem(vanBan: string): string {
  return vanBan
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u200b|\u200c|\u200d|\u2060|\ufeff|\u00ad/g, '')
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/\s+/g, ' ');
}

/** The first category the message falls into, or null when the list sees nothing. */
export function kiemDuyetTuKhoa(vanBan: string): LoaiViPham | null {
  const t = chuanHoaDeKiem(vanBan);
  for (const [loai, mau] of MAU) {
    if (mau.test(t)) return loai;
  }
  return null;
}
