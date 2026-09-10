import { syntaxTree } from '@codemirror/language';

import type { Diagnostic } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import type { SyntaxNode } from '@lezer/common';

/**
 * Real-time Python syntax diagnostics, from the parse tree already in memory.
 *
 * ── Why not a real Python process ────────────────────────────────────────────
 * The sandbox already runs CPython and returns a real traceback, and that is the
 * authority on whether a program is valid. But it is a round trip into a
 * container: fine when a student presses "Chạy thử", far too slow to fire on
 * every keystroke, and it would turn an editor into a load generator for the
 * judge queue.
 *
 * Shipping Pyodide or a Python LSP to the browser instead would cost several
 * megabytes of WebAssembly on a school laptop over a school connection, to catch
 * the same missing colon this catches for free.
 *
 * Free, because `@codemirror/lang-python` is ALREADY parsing the document with
 * `@lezer/python` on every edit, to do the syntax highlighting. That parser is
 * error-tolerant: where the grammar cannot proceed it inserts an error node and
 * carries on. Those error nodes are exactly the positions CPython would refuse,
 * and reading them costs one tree walk over a document that is at most a few
 * hundred lines.
 *
 * ── What this deliberately does not do ───────────────────────────────────────
 * It is a SYNTAX checker, not a type checker and not a linter in the pylint
 * sense. It does not know that `prnt("xin chào")` is a typo, that a variable is
 * unused, or that a name is undefined — all of those need a symbol table this
 * has no way to build, and half of them are not errors at all. A beginner's
 * editor that underlined working code would teach them to ignore underlines,
 * which would cost more than the missing feature.
 *
 * ── The messages are the feature ─────────────────────────────────────────────
 * `⚠` at offset 41 is not a message. What a 12-year-old needs is which character
 * is missing and where, in their own language, so `chuanDoan` looks at the text
 * around each error node and names the specific thing — a colon at the end of an
 * `if`, a quote that was never closed, a bracket left open — and only falls back
 * to a generic sentence when it genuinely cannot tell.
 *
 * ── One error at a time ──────────────────────────────────────────────────────
 * A missing colon on line 3 makes the rest of the file unparseable, so lezer
 * emits error nodes all the way down. Showing twelve red underlines for one typo
 * is how a beginner concludes the editor is broken, so only the FIRST error in a
 * run of adjacent ones is reported: fix it, and the next one appears.
 */

/** Python statements whose header line must end in a colon. */
const TU_KHOA_CAN_HAI_CHAM = [
  'if',
  'elif',
  'else',
  'for',
  'while',
  'def',
  'class',
  'try',
  'except',
  'finally',
  'with',
] as const;

/**
 * Errors closer together than this are treated as one.
 *
 * Tuned to a line rather than a character count: lezer's recovery after a broken
 * statement typically produces its next error on the following line, and those
 * are consequences of the first one rather than separate mistakes.
 */
const GOP_TRONG_KHOANG = 80;

export interface ChuanDoanPython {
  from: number;
  to: number;
  severity: 'error';
  message: string;
}

/**
 * Which line is this offset on, and what does that line say?
 *
 * Both are needed to say anything specific: the line's text is what reveals a
 * missing colon or an unclosed quote, and the line number is what makes the
 * message navigable.
 */
function dongTai(state: EditorState, pos: number): { so: number; chu: string; from: number } {
  const line = state.doc.lineAt(Math.min(pos, state.doc.length));
  return { so: line.number, chu: line.text, from: line.from };
}

/**
 * Does this line open a block without closing the header?
 *
 * Deliberately crude — a regex, not a parse. By the time this runs the real
 * parser has ALREADY failed, so all this has to do is recognise the shape a
 * beginner most often produces. A false negative just falls through to the
 * generic message; a false positive is impossible to produce from a line that
 * parsed, because a line that parsed never reaches here.
 */
function thieuHaiCham(chu: string): string | null {
  const cat = chu.trim();
  if (cat.endsWith(':')) return null;
  // A trailing comment hides the colon from a naive endsWith.
  if (/:\s*#/.test(cat)) return null;

  for (const tu of TU_KHOA_CAN_HAI_CHAM) {
    // `else` and `try` take no expression; the rest do. Both shapes end in `:`.
    const co = new RegExp(`^${tu}\\b`).test(cat);
    if (!co) continue;
    return (
      `Dòng bắt đầu bằng \`${tu}\` thì phải kết thúc bằng dấu hai chấm \`:\`. ` +
      'Em thêm dấu `:` vào cuối dòng này nhé.'
    );
  }
  return null;
}

/**
 * An odd number of quotes on the line means one is still open.
 *
 * Counted with escapes removed first, so `print("anh \\"Nam\\"")` is not read as
 * five quotes. Triple-quoted strings are skipped entirely: they legitimately
 * span lines, and a line-local count cannot tell an unfinished one from a
 * correct one.
 */
function chuoiChuaDong(chu: string): string | null {
  if (chu.includes('"""') || chu.includes("'''")) return null;

  const sach = chu.replace(/\\./g, '');
  const nhay2 = (sach.match(/"/g) ?? []).length;
  const nhay1 = (sach.match(/'/g) ?? []).length;

  if (nhay2 % 2 === 1 || nhay1 % 2 === 1) {
    const dau = nhay2 % 2 === 1 ? '"' : "'";
    return (
      `Có một dấu nháy \`${dau}\` mở ra mà chưa đóng lại trên dòng này. ` +
      `Mỗi chuỗi chữ phải có \`${dau}\` ở cả hai đầu.`
    );
  }
  return null;
}

/** Brackets opened and never closed, counted across the whole document. */
function ngoacChuaDong(chu: string): string | null {
  const sach = chu.replace(/\\./g, '').replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

  for (const [mo, dong, ten] of [
    ['(', ')', 'tròn'],
    ['[', ']', 'vuông'],
    ['{', '}', 'nhọn'],
  ] as const) {
    const soMo = sach.split(mo).length - 1;
    const soDong = sach.split(dong).length - 1;
    if (soMo > soDong) {
      return `Có dấu ngoặc ${ten} \`${mo}\` mở ra mà chưa đóng lại bằng \`${dong}\`.`;
    }
    if (soDong > soMo) {
      return `Có dấu ngoặc ${ten} \`${dong}\` thừa — không thấy \`${mo}\` nào mở ra trước đó.`;
    }
  }
  return null;
}

/**
 * A mixed tab/space indent, which Python rejects and no editor shows.
 *
 * Worth its own message because it is genuinely invisible: the line looks
 * correctly indented and CPython still refuses it. A beginner cannot debug what
 * they cannot see, and this is the single most common way a student loses half
 * an hour to a file they copied out of a website.
 */
function thutLonXon(chu: string): string | null {
  const dau = /^[ \t]*/.exec(chu)?.[0] ?? '';
  if (dau.includes('\t') && dau.includes(' ')) {
    return (
      'Dòng này thụt đầu dòng bằng cả dấu Tab lẫn dấu cách. ' +
      'Python không chấp nhận trộn hai loại — em dùng 4 dấu cách thôi nhé.'
    );
  }
  return null;
}

/**
 * Turn one error node into a sentence a beginner can act on.
 *
 * Checked in the order a mistake is most likely: the colon first, because it is
 * by far the commonest, then the quote, then the bracket, then the indent. The
 * PREVIOUS line is examined as well as the current one — an unterminated `if`
 * usually surfaces its error on the line after, where the parser finally gives
 * up.
 */
function moTaLoi(state: EditorState, pos: number): string {
  const day = dongTai(state, pos);
  const truoc = day.so > 1 ? state.doc.line(day.so - 1).text : '';

  for (const chu of [day.chu, truoc]) {
    if (chu.trim() === '') continue;
    const ly = thieuHaiCham(chu) ?? chuoiChuaDong(chu) ?? ngoacChuaDong(chu) ?? thutLonXon(chu);
    if (ly) return ly;
  }

  return (
    'Python chưa hiểu được đoạn này. Em xem lại dấu câu quanh đây — ' +
    'thiếu dấu hai chấm `:`, thiếu ngoặc, hay thiếu dấu nháy là những lỗi hay gặp nhất.'
  );
}

/**
 * Where to actually draw the underline.
 *
 * ── The zero-width problem ───────────────────────────────────────────────────
 * lezer reports "something is missing HERE" as an EMPTY node, and for the
 * commonest mistake of all — a missing `:` — "here" is the position just past
 * the last character of the line. A diagnostic whose `from` equals its `to`
 * renders as no underline whatsoever, so the student gets a gutter marker
 * pointing at nothing, which is a worse outcome than not checking at all.
 *
 * So an empty error range is redrawn over the CONTENT of the line it sits at the
 * end of: `if diem > 5` gets underlined, which is both visible and the thing
 * that needs changing. Trailing whitespace is trimmed off first — underlining
 * three invisible spaces past the end of a line is the same bug wearing a hat.
 *
 * ── Blank lines walk backwards ───────────────────────────────────────────────
 * `def f(` followed by a newline puts the error on the empty line after it.
 * There is nothing there to mark, and the mistake is on the line above, so the
 * search moves up to the nearest line with content.
 */
function vungGach(
  state: EditorState,
  from: number,
  to: number,
): { from: number; to: number } | null {
  const day = state.doc.lineAt(Math.min(from, state.doc.length));

  // A real, non-empty range from the parser: use it as given, clamped to the
  // line so one error cannot paint half the file red.
  if (to > from) {
    const batDau = Math.min(from, day.to);
    const ketThuc = Math.min(to, day.to);
    if (ketThuc > batDau) return { from: batDau, to: ketThuc };
  }

  for (let so = day.number; so >= 1; so -= 1) {
    const d = state.doc.line(so);
    const traiSo = d.text.length - d.text.trimStart().length;
    const phaiSo = d.text.trimEnd().length;
    if (phaiSo > traiSo) return { from: d.from + traiSo, to: d.from + phaiSo };
  }

  return null;
}

/**
 * Every syntax error in the document, as CodeMirror diagnostics.
 *
 * Pure and exported so `kiem-loi-python.test.ts` can assert on real snippets
 * without mounting an editor: the messages here are the whole feature, and a
 * feature whose only test is "the underline appeared" is one where the wording
 * can rot silently.
 */
export function chuanDoanPython(state: EditorState): ChuanDoanPython[] {
  const cay = syntaxTree(state);

  /*
   * An unparsed tail is not an error.
   *
   * CodeMirror parses on a time budget and leaves the rest of a long document
   * for the next idle slice. Everything past `cay.length` simply has not been
   * looked at yet, and marking it would paint a student's file red for a moment
   * every time they pasted something long.
   */
  const daPhanTich = cay.length;

  const loi: ChuanDoanPython[] = [];
  let cuoiCung = -Infinity;

  cay.cursor().iterate((node) => {
    if (!node.type.isError) return;
    if (node.from >= daPhanTich) return;
    // Consequences of the error already reported. Fix the first, see the next.
    if (node.from - cuoiCung < GOP_TRONG_KHOANG) return;
    cuoiCung = node.from;

    const vung = vungGach(state, node.from, node.to);
    // Nothing visible to attach it to — a stray error in an empty document.
    if (vung === null) return;

    loi.push({
      from: vung.from,
      to: vung.to,
      severity: 'error',
      message: moTaLoi(state, node.from),
    });
  });

  return loi;
}

/**
 * The `@codemirror/lint` source.
 *
 * Separated from `chuanDoanPython` only by its type: the linter contract wants
 * `Diagnostic[]` from an `EditorView`, and keeping the logic on `EditorState`
 * is what lets the tests run without a DOM.
 */
export function nguonKiemLoiPython(state: EditorState): Diagnostic[] {
  return chuanDoanPython(state).map((d) => ({
    from: d.from,
    to: d.to,
    severity: d.severity,
    message: d.message,
    source: 'Cú pháp Python',
  }));
}

/**
 * A node's own error-ness, for tests that walk a tree by hand.
 *
 * Exported rather than inlined because `isError` is the single assumption this
 * whole module rests on, and a lezer upgrade that changed it should break one
 * obvious test rather than silently stop reporting anything.
 */
export function laNodeLoi(node: SyntaxNode): boolean {
  return node.type.isError;
}
