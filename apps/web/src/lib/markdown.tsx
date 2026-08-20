/**
 * Markdown → React elements.
 *
 * ── Why not a library + dangerouslySetInnerHTML ──────────────────────────────
 * Lesson content is authored by teachers from Phase 6 onward. Any pipeline that
 * ends in `dangerouslySetInnerHTML` is one sanitiser bug away from stored XSS on
 * a page that children log into.
 *
 * This renderer never produces an HTML string. It produces React nodes, so
 * injected markup cannot become markup — it can only ever become text. That is
 * a structural guarantee rather than a filtering one.
 *
 * It supports exactly the constructs the DYE curriculum uses: headings, lists,
 * tables, fenced code, blockquotes, images, and inline bold / italic / code /
 * links. Anything else degrades to plain text rather than disappearing.
 *
 * ── One rule that is not cosmetic: images and `<p>` ──────────────────────────
 * A `<figure>` is FLOW content and a `<p>` may only contain PHRASING content, so
 * `<p><figure>…</figure></p>` is invalid HTML. The browser does not complain — it
 * silently closes the paragraph before the figure and reparents it. That gives
 * the client a different DOM from the one the server serialised, and React
 * reports a hydration mismatch on a page a child is trying to read.
 *
 * So images are handled at TWO levels, deliberately:
 *
 *   • A paragraph whose entire content is images becomes `<figure>` siblings,
 *     emitted OUTSIDE any `<p>` — the common case, and how every illustration in
 *     the curriculum is authored.
 *   • An image mixed into a sentence stays inline and renders as a bare `<img>`,
 *     which is phrasing content and therefore legal exactly where it sits.
 */
import type { ReactNode } from 'react';

import { HinhBaiHoc, HinhTrongDong } from '@/components/hoc-sinh/hinh-bai-hoc';

/** Only these link schemes are rendered as links. `javascript:` is not one. */
const SAFE_SCHEME = /^(https?:\/\/|mailto:|\/|#)/i;

// ═══════════════════════════════════════════════════════════════════════════
// Inline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split inline markdown into React nodes.
 *
 * Order matters: code spans are matched first so `**` inside backticks stays
 * literal, which the curriculum relies on when showing operators.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  /*
   * The image alternative comes FIRST, and its `!` is what distinguishes it
   * from a link. Put it after the link branch and `![alt](src)` matches as a
   * literal `!` followed by a link, which renders the illustration as a
   * clickable "alt" — silently, on every lesson that has one.
   */
  const pattern =
    /(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let n = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-i${n}`;
    n += 1;

    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('![')) {
      const anh = docAnh(token);

      /*
       * Inline position — this node can land inside a <p>, an <li> or a table
       * cell, so it must be PHRASING content. `HinhTrongDong` renders an <img>
       * and falls back to a <span>; it never emits a <figure> or a <div>.
       *
       * Plain <img>, not next/image: these are lesson illustrations of unknown
       * intrinsic size authored as markdown, and next/image needs dimensions or
       * a fill container it cannot have inside flowing prose.
       */
      if (anh) {
        nodes.push(<HinhTrongDong key={key} src={anh.src} alt={anh.alt} />);
      } else {
        // Unsafe or malformed target: keep the description, drop the image.
        nodes.push(altCuaAnh(token));
      }
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const label = linkMatch?.[1] ?? token;
      const href = linkMatch?.[2] ?? '';

      if (SAFE_SCHEME.test(href)) {
        const external = /^https?:\/\//i.test(href);
        nodes.push(
          <a
            key={key}
            href={href}
            className="text-[--color-chinh] underline underline-offset-2"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {label}
          </a>,
        );
      } else {
        // Unsafe scheme: keep the words, drop the link.
        nodes.push(label);
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// ═══════════════════════════════════════════════════════════════════════════
// Block
// ═══════════════════════════════════════════════════════════════════════════

/** `![alt](src)` → its parts, or null when the target is unsafe/malformed. */
function docAnh(token: string): { alt: string; src: string } | null {
  const m = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(token.trim());
  if (!m) return null;

  const src = m[2] ?? '';
  if (!SAFE_SCHEME.test(src)) return null;

  return { alt: m[1] ?? '', src };
}

/** The description, for when the image itself cannot be rendered. */
function altCuaAnh(token: string): string {
  return /^!\[([^\]]*)\]/.exec(token.trim())?.[1] ?? token;
}

/**
 * Is this line nothing but images?
 *
 * The test is deliberately strict — remove every image token and require what
 * is left to be blank. A line reading "Xem hình: ![…](…)" is NOT image-only and
 * must stay a paragraph, or the words disappear from the lesson.
 */
function laDongChiCoAnh(line: string): { alt: string; src: string }[] | null {
  const t = line.trim();
  if (!t.startsWith('!')) return null;

  const tokens = t.match(/!\[[^\]]*\]\([^)\s]+\)/g);
  if (!tokens || tokens.length === 0) return null;

  let conLai = t;
  for (const tk of tokens) conLai = conLai.replace(tk, '');
  if (conLai.trim() !== '') return null;

  const anh = tokens.map(docAnh).filter((a): a is { alt: string; src: string } => a !== null);
  return anh.length === tokens.length ? anh : null;
}

function isTableRow(line: string): boolean {
  return line.trimStart().startsWith('|') && line.trimEnd().endsWith('|');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** A separator row like `|---|:--:|`. */
function isTableDivider(line: string): boolean {
  return isTableRow(line) && /^[\s|:-]+$/.test(line);
}

export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const nextKey = (): string => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Blank
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').trimStart().startsWith('```')) {
        body.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // closing fence
      out.push(
        <pre key={nextKey()} {...(lang ? { 'data-ngon-ngu': lang } : {})}>
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Table
    if (isTableRow(line) && isTableDivider(lines[i + 1] ?? '')) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? '')) {
        rows.push(splitRow(lines[i] ?? ''));
        i += 1;
      }
      const k = nextKey();
      out.push(
        // Wide tables scroll inside their own box; the page never scrolls sideways.
        <div className="bang-cuon" key={k}>
          <table>
            <thead>
              <tr>
                {header.map((cell, c) => (
                  <th key={`${k}-h${c}`} scope="col">
                    {renderInline(cell, `${k}-h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={`${k}-r${r}`}>
                  {row.map((cell, c) => (
                    <td key={`${k}-r${r}c${c}`}>{renderInline(cell, `${k}-r${r}c${c}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const depth = heading[1]?.length ?? 2;
      const text = heading[2] ?? '';
      const k = nextKey();
      // Lesson content sits under an <h2> page title, so markdown "#" starts at h3.
      const Tag = (depth <= 1 ? 'h3' : depth === 2 ? 'h3' : 'h4') as 'h3' | 'h4';
      out.push(
        <Tag key={k} className="font-semibold">
          {renderInline(text, k)}
        </Tag>,
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && (lines[i] ?? '').trimStart().startsWith('>')) {
        body.push((lines[i] ?? '').trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      const k = nextKey();
      out.push(<blockquote key={k}>{renderInline(body.join(' '), k)}</blockquote>);
      continue;
    }

    // Lists
    const bullet = /^\s*[-*]\s+(.*)$/;
    const numbered = /^\s*\d+\.\s+(.*)$/;

    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const m = ordered ? numbered.exec(cur) : bullet.exec(cur);
        if (!m) break;
        items.push(m[1] ?? '');
        i += 1;
      }
      const k = nextKey();
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={k}>
          {items.map((item, n) => (
            <li key={`${k}-l${n}`}>{renderInline(item, `${k}-l${n}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    /*
     * Image-only line → figures at BLOCK level, never inside the <p> below.
     *
     * This branch is what actually prevents the hydration mismatch. Every
     * illustration in the curriculum is authored on its own line, so this is
     * the path they all take.
     */
    const chiAnh = laDongChiCoAnh(line);
    if (chiAnh) {
      for (const a of chiAnh) {
        out.push(<HinhBaiHoc key={nextKey()} src={a.src} alt={a.alt} />);
      }
      i += 1;
      continue;
    }

    // Paragraph — consume until a blank line or a construct that starts a block.
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? '';
      if (
        cur.trim() === '' ||
        cur.trimStart().startsWith('```') ||
        cur.trimStart().startsWith('>') ||
        /^(#{1,4})\s+/.test(cur) ||
        bullet.test(cur) ||
        numbered.test(cur) ||
        isTableRow(cur) ||
        // An illustration on its own line ENDS the paragraph rather than being
        // swallowed into it — otherwise it would be rendered inline and the
        // block-level branch above would never see it.
        laDongChiCoAnh(cur) !== null
      ) {
        break;
      }
      para.push(cur);
      i += 1;
    }
    const k = nextKey();
    out.push(<p key={k}>{renderInline(para.join(' '), k)}</p>);
  }

  return out;
}

/** Rendered lesson prose. The wrapper class carries the typographic rules. */
export function VanBan({ children }: { children: string }) {
  return <div className="van-ban">{renderMarkdown(children)}</div>;
}
