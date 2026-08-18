'use client';

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

/**
 * Python syntax colours.
 *
 * Hand-picked rather than inherited from CodeMirror's default light theme,
 * because the default is tuned for adult developers on a white page and several
 * of its tokens fall under 4.5:1 on ours. Every colour here is checked against
 * `--color-the` (#ffffff) in `hien-thi.test.tsx`, which computes the ratios from
 * this file rather than trusting the eye.
 *
 * Comments are the one that matters most for beginners: they are the thing a
 * teacher asks a 12-year-old to read, so they are not the usual washed-out grey.
 */
const MAU_CU_PHAP = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c2d92', fontWeight: '600' },
  { tag: tags.controlKeyword, color: '#7c2d92', fontWeight: '600' },
  { tag: [tags.string, tags.special(tags.string)], color: '#0f766e' },
  { tag: tags.number, color: '#b45309' },
  { tag: [tags.bool, tags.null], color: '#b45309', fontWeight: '600' },
  { tag: tags.comment, color: '#5b6b7f', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: '#1d4ed8' },
  { tag: tags.definition(tags.variableName), color: '#0f172a' },
  { tag: [tags.className, tags.typeName], color: '#9a3412', fontWeight: '600' },
  { tag: tags.operator, color: '#475569' },
  { tag: tags.punctuation, color: '#475569' },
  { tag: tags.invalid, color: '#b91c1c' },
]);

/**
 * Editor chrome.
 *
 * 16px inside the editor is the floor, matching the app's "no tiny text" rule.
 * Monospace at 14px is where beginners start mistaking `l` for `1`, and this is
 * exactly the audience that cannot yet tell a typo from a language rule.
 */
const GIAO_DIEN = EditorView.theme({
  '&': {
    fontSize: '1rem',
    backgroundColor: 'var(--color-the)',
    color: 'var(--color-chu)',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    padding: '0.75rem 0',
    caretColor: 'var(--color-chinh)',
  },
  '.cm-line': { padding: '0 0.75rem', lineHeight: '1.6' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-the-mo)',
    color: 'var(--color-chu-nhat)',
    border: 'none',
    borderInlineEnd: '1px solid var(--color-vien)',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(79, 70, 229, 0.06)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(79, 70, 229, 0.10)',
    color: 'var(--color-chu)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(79, 70, 229, 0.22)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'rgba(4, 120, 87, 0.18)',
    outline: '1px solid rgba(4, 120, 87, 0.5)',
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-foldGutter span': { color: 'var(--color-chu-phu)' },
});

export interface SoanThaoProps {
  giaTri: string;
  onDoi: (code: string) => void;
  /** Read-only mode, used when previewing an old version. */
  chiDoc?: boolean;
  /** Accessible name for the editor region. */
  nhan: string;
  /** Ids of elements describing this editor, e.g. the keyboard help text. */
  moTaBoi?: string;
  soDongToiThieu?: number;
}

/**
 * CodeMirror 6, wired for Python and for a keyboard-only student.
 *
 * ── The keyboard trap, and why it gets special handling ──────────────────────
 * A code editor that binds Tab to indentation is a focus trap: a student using
 * only a keyboard presses Tab to leave and gets four more spaces instead, with
 * no way out and no message saying so. That is a WCAG 2.1.2 failure and, for a
 * child on a school laptop, it is indistinguishable from the page being broken.
 *
 * Removing the Tab binding fixes the trap and breaks the editor — Tab is how
 * every 12-year-old indents Python.
 *
 * So both work, in the order a student would discover them:
 *   • Tab / Shift-Tab indent, which is what they expect.
 *   • Escape ARMS the exit; the next Tab moves focus out of the editor.
 *   • Escape twice in a row simply leaves the editor, for anyone who does not
 *     wait to find out what the first one did.
 *
 * The rule is stated in visible text next to the editor, not only in an
 * `aria-describedby` — a sighted keyboard user needs it just as much.
 */
export function SoanThao({
  giaTri,
  onDoi,
  chiDoc = false,
  nhan,
  moTaBoi,
  soDongToiThieu = 8,
}: SoanThaoProps) {
  const oChua = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  /** Set by Escape, consumed by the next Tab. */
  const choPhepThoat = useRef(false);
  /** Kept in a ref so the CodeMirror extension never closes over a stale prop. */
  const doiRef = useRef(onDoi);
  doiRef.current = onDoi;

  const chiDocRef = useRef(new Compartment());

  useEffect(() => {
    if (!oChua.current) return;

    const thoatBangBanPhim = keymap.of([
      {
        key: 'Escape',
        run: () => {
          if (choPhepThoat.current) {
            // Pressed twice: leave immediately rather than waiting for a Tab
            // the student may not know to press.
            view.current?.contentDOM.blur();
            choPhepThoat.current = false;
            return true;
          }
          choPhepThoat.current = true;
          return true;
        },
      },
      {
        key: 'Tab',
        run: (v) => {
          if (choPhepThoat.current) {
            choPhepThoat.current = false;
            // Returning false hands Tab back to the browser, which moves focus.
            return false;
          }
          return indentMore(v);
        },
        shift: (v) => {
          if (choPhepThoat.current) {
            choPhepThoat.current = false;
            return false;
          }
          return indentLess(v);
        },
      },
    ]);

    // Any ordinary edit re-arms the trap: a student who pressed Escape, changed
    // their mind and kept typing should not have their next Tab jump away.
    const huyThoatKhiGo = EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        choPhepThoat.current = false;
        doiRef.current(u.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: giaTri,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter({ openText: '▾', closedText: '▸' }),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        // PEP 8: four spaces, never a tab character.
        indentUnit.of('    '),
        syntaxHighlighting(MAU_CU_PHAP, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        EditorView.lineWrapping,
        python(),
        GIAO_DIEN,
        // Ordered so our Tab/Escape handling wins over the defaults.
        thoatBangBanPhim,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
        ]),
        huyThoatKhiGo,
        chiDocRef.current.of(EditorState.readOnly.of(chiDoc)),
        EditorView.contentAttributes.of({
          'aria-label': nhan,
          ...(moTaBoi ? { 'aria-describedby': moTaBoi } : {}),
          // Announced by screen readers as a multi-line editable region.
          role: 'textbox',
          'aria-multiline': 'true',
        }),
      ],
    });

    const v = new EditorView({ state, parent: oChua.current });
    view.current = v;

    return () => {
      v.destroy();
      view.current = null;
    };
    // Built once. Value and read-only changes are pushed in below rather than
    // rebuilding, which would destroy undo history and the cursor position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push an externally-driven value change (a rollback, a reset) into the editor
  // WITHOUT clobbering what the student is typing.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const hienTai = v.state.doc.toString();
    if (hienTai === giaTri) return;

    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: giaTri },
      selection: { anchor: Math.min(v.state.selection.main.anchor, giaTri.length) },
    });
  }, [giaTri]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({
      effects: chiDocRef.current.reconfigure(EditorState.readOnly.of(chiDoc)),
    });
  }, [chiDoc]);

  return (
    <div
      ref={oChua}
      data-testid="soan-thao"
      style={{ minHeight: `${soDongToiThieu * 1.6}rem` }}
      className="overflow-hidden rounded-nut border border-vien bg-the focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-chinh"
    />
  );
}
