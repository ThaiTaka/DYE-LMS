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
 * tables, fenced code, blockquotes, and inline bold / italic / code / links.
 * Anything else degrades to plain text rather than disappearing.
 */
import type { ReactNode } from 'react';

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
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;

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
        isTableRow(cur)
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
