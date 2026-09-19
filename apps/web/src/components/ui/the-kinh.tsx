import type { ElementType, ReactNode } from 'react';

/**
 * Glass card — the surface every hero-level panel in the student UI sits on.
 *
 * ── What it is ───────────────────────────────────────────────────────────────
 * `kinh` (see globals.css): 6% white over the page glow, an 18px backdrop
 * blur, a 1px hairline and a wide soft shadow. Corners are 20px (`rounded-the`)
 * or 16px with `nho`. That is the whole recipe; the card adds no colour of its
 * own, so whatever glows behind it shows through.
 *
 * ── When to use it, and when not ─────────────────────────────────────────────
 * The blur is the most expensive paint a school laptop does. Use this for the
 * handful of panels a screen is built around — the hero, a stats tile, a
 * course card — and use plain `bg-the border-vien` for the rest (lesson
 * blocks, list rows, form panels). A page with thirty blurred cards is a page
 * that stutters on scroll, and stutter reads as "broken" to a ten-year-old.
 *
 * `noiBat` draws a gradient hairline instead of the grey one. One per screen:
 * it is the "look here" and it stops meaning that the moment there are two.
 */
export function TheKinh({
  as: Tag = 'div',
  nho = false,
  noiBat = false,
  className = '',
  children,
  ...rest
}: {
  as?: ElementType;
  /** 16px corners instead of 20px, for tiles and compact cards. */
  nho?: boolean;
  /** Gradient hairline — the one highlighted card on a screen. */
  noiBat?: boolean;
  className?: string;
  children: ReactNode;
  [prop: string]: unknown;
}) {
  return (
    <Tag
      className={`kinh ${nho ? 'rounded-the-nho' : 'rounded-the'} ${noiBat ? 'vien-neon border-transparent' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Gradient text — violet to pink.
 *
 * Inline on purpose: `background-clip: text` clips to the text box, so this
 * wraps the words, never the block around them. Headings and big numbers only
 * — the pink end is a heading colour, not a paragraph colour (see globals.css).
 */
export function ChuNeon({ className = '', children }: { className?: string; children: ReactNode }) {
  return <span className={`chu-neon ${className}`}>{children}</span>;
}
