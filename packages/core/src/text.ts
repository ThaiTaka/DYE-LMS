/**
 * Plain-text rendering of Markdown fragments.
 *
 * Lesson titles are authored as Markdown because they legitimately contain code
 * spans — "Buổi 19 · `calendar` & Luyện tập". That reads correctly inside prose,
 * where the backticks become a styled <code> element. It reads as noise
 * everywhere else: page titles, breadcrumbs, lock reasons, <option> labels,
 * aria-label attributes, and anything a screen reader speaks aloud, where a
 * literal backtick is pronounced or displayed as a stray character.
 *
 * This module produces the plain-text form. It is NOT a sanitiser and must never
 * be used as one: markup that survives here is still markup. Rendering untrusted
 * content safely is `renderMarkdown()`'s job in the web app, which builds React
 * nodes and therefore cannot emit HTML at all.
 *
 * It lives in @dye/core rather than the web app because the gating engine builds
 * student-facing lock reasons out of lesson titles, and those must be clean at
 * the point they are written — not patched up by whichever component happens to
 * display them.
 */

/**
 * A code span, extracted before emphasis rules run.
 *
 * Markdown treats the inside of a code span as literal, so `a * b` must not have
 * its asterisk read as emphasis. Extracting first, restoring last, is what keeps
 * that promise.
 *
 * The sentinel uses control characters that cannot appear in lesson content
 * authored through any normal editor, so a title can never forge one.
 */
const PLACEHOLDER_OPEN = '';
const PLACEHOLDER_CLOSE = '';

/** Matches a fenced-off code span: one or more backticks, content, same count. */
const CODE_SPAN = /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g;

/**
 * Emphasis delimiters.
 *
 * Two deliberate departures from CommonMark, both because this text is titles in
 * a Python curriculum rather than prose:
 *
 *   • `__` is NEVER read as bold. CommonMark would turn "__init__" into a bold
 *     "init", which is wrong in every place that string appears here — it is a
 *     dunder method, and mangling it teaches the wrong name.
 *   • Single `_` only counts at word boundaries, so "so_sanh_hai_list" and
 *     "snake_case" survive intact. (CommonMark agrees on this one.)
 *
 * Bold is written with `**` throughout the seeded content, so nothing is lost.
 */
const RULES: Array<[RegExp, string]> = [
  // Images first: ![alt](src) keeps the alt text, which is the readable part.
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  // Links: [text](href) keeps the text.
  [/\[([^\]]*)\]\([^)]*\)/g, '$1'],
  // Reference-style links: [text][ref] and bare [text].
  [/\[([^\]]*)\]\[[^\]]*\]/g, '$1'],
  // Strikethrough.
  [/~~([\s\S]+?)~~/g, '$1'],
  // Bold, then italic — longest delimiter first so ** is not read as two *.
  [/\*\*([\s\S]+?)\*\*/g, '$1'],
  [/\*([^*\n]+?)\*/g, '$1'],
  [/(^|[^\w])_([^_\n]+?)_(?![\w])/g, '$1$2'],
];

/** Leading block markers: heading hashes, blockquote arrows, list bullets. */
const BLOCK_PREFIX = /^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/;

/**
 * Strip Markdown syntax, keeping the words.
 *
 *     bocMarkdown('Buổi 19 · `calendar` & Luyện tập')
 *     // → 'Buổi 19 · calendar & Luyện tập'
 *
 * Total function: any string in, a string out. Unbalanced or malformed markup is
 * left as-is rather than throwing, because a title with a stray asterisk is a
 * cosmetic problem and must never take a page down.
 */
export function bocMarkdown(text: string): string {
  if (!text) return '';

  // 1. Lift code spans out so their contents are never treated as syntax.
  const spans: string[] = [];
  let working = text.replace(CODE_SPAN, (_match, _ticks: string, body: string) => {
    spans.push(body.trim());
    return `${PLACEHOLDER_OPEN}${spans.length - 1}${PLACEHOLDER_CLOSE}`;
  });

  // 2. Block-level markers, then inline emphasis.
  working = working.replace(BLOCK_PREFIX, '');
  for (const [pattern, replacement] of RULES) {
    working = working.replace(pattern, replacement);
  }

  // 3. Backslash escapes: \* becomes a literal asterisk.
  working = working.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, '$1');

  // 4. Restore code spans as plain words.
  working = working.replace(
    new RegExp(`${PLACEHOLDER_OPEN}(\\d+)${PLACEHOLDER_CLOSE}`, 'g'),
    (_match, index: string) => spans[Number(index)] ?? '',
  );

  // 5. Newlines and runs of spaces collapse: the output is for one-line contexts.
  return working.replace(/\s+/g, ' ').trim();
}

/**
 * Plain text, shortened for a tight slot with a real ellipsis.
 *
 * Cuts on a word boundary when one is reasonably close, because a Vietnamese
 * word cut mid-syllable ("Luyện tậ…") is harder to read than a slightly shorter
 * label.
 */
export function rutGon(text: string, maxLength = 80): string {
  const plain = bocMarkdown(text);
  if (plain.length <= maxLength) return plain;

  const cut = plain.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  // Only honour the word boundary if it does not throw away most of the budget.
  const body = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut.trimEnd();
  return `${body}…`;
}

/** "Buổi 19 · calendar & Luyện tập" — the standard way a session is named. */
export function tenBuoi(order: number, title: string): string {
  return `Buổi ${order} · ${bocMarkdown(title)}`;
}
