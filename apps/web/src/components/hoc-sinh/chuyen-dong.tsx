'use client';

import { domAnimation, LazyMotion, m, MotionConfig, useReducedMotion } from 'framer-motion';

import type { ReactNode } from 'react';

/**
 * Movement, for the student side of the app.
 *
 * ── What motion is for here ──────────────────────────────────────────────────
 * The audience is ten to twelve. Movement is not decoration for them — it is
 * feedback. A card that gives a little under the cursor says "this is a thing
 * you can press" more clearly than any border colour, and a page whose cards
 * arrive in sequence reads as a page that is ready rather than one that
 * flashed into being.
 *
 * ── What it is NOT for ───────────────────────────────────────────────────────
 * Nothing here moves while a student is reading it, and nothing bounces to get
 * attention. A lesson page is a page a child is trying to concentrate on; an
 * animation that keeps playing is an animation that keeps interrupting. Every
 * transition below runs once, on arrival, and then stops.
 *
 * ── Reduced motion is honoured twice ─────────────────────────────────────────
 * `globals.css` already flattens CSS animations for anyone who asked their OS
 * to reduce motion — but framer-motion animates through the Web Animations
 * API and inline styles, which that rule never sees. So:
 *
 *   1. `KhungChuyenDong` sets `reducedMotion="user"`, which makes
 *      framer-motion drop transform and layout animation globally.
 *   2. Anything that loops — the mascot's bob — ALSO checks
 *      `useReducedMotion()` and does not start at all. (1) alone would leave
 *      an opacity pulse running forever, which is exactly the thing the
 *      setting exists to stop.
 *
 * Vestibular disorders are not rare and a school does not get to ask.
 *
 * ── Why `m` and `LazyMotion`, not `motion` ───────────────────────────────────
 * `motion.div` pulls framer-motion's whole feature set into the first load of
 * every student page — about 40 kB gzipped, for hover states and a fade. These
 * pages open on school laptops over school wi-fi, and the app already refuses
 * to hotlink lesson images for the same reason.
 *
 * `LazyMotion features={domAnimation}` loads roughly a third of that and
 * covers everything used here: variants, gestures, and exit animations. It
 * does NOT cover layout animation or drag — `strict` makes that a loud error
 * (any `motion.*` component throws) rather than a silently dead animation
 * somebody debugs a week later.
 */

/** Soft, slightly overshooting. The "gives a little" feel, not a bounce. */
export const LO_XO = { type: 'spring', stiffness: 260, damping: 24, mass: 0.7 } as const;

/**
 * Wraps the student shell so every `motion` element beneath it obeys the OS
 * reduced-motion setting without each one remembering to ask.
 */
export function KhungChuyenDong({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/**
 * A page-load container: children arrive one after another.
 *
 * The stagger is 60ms — enough to read as a sequence, short enough that a page
 * of six cards is settled in under half a second. Anything slower becomes a
 * thing a student waits through every single visit.
 */
export function VaoTrang({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <m.div
      className={className}
      initial="an"
      animate="hien"
      variants={{ an: {}, hien: { transition: { staggerChildren: 0.06, delayChildren: 0.03 } } }}
    >
      {children}
    </m.div>
  );
}

const MUC = {
  an: { opacity: 0, y: 12 },
  hien: { opacity: 1, y: 0, transition: LO_XO },
};

/** One member of a `VaoTrang` sequence. Fades up, once. */
export function MucVao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <m.div variants={MUC} className={className}>
      {children}
    </m.div>
  );
}

/**
 * A card that responds to being pointed at.
 *
 * `scale: 1.03` and a 4px lift: small on purpose. A card that jumps under the
 * cursor moves the thing the child was aiming at, and on a school trackpad
 * that means a missed click on the only control that matters.
 *
 * `whileTap` matters more than `whileHover` in this room — most of these
 * machines are touchscreens, where hover does not exist and the press is the
 * only moment feedback is possible.
 *
 * The soft-UI depth lives here rather than on each card: `shadow-mem` at rest,
 * `shadow-noi` raised. Both are brand-tinted and wide (see `globals.css`), so
 * lifting a card reads as it catching more light rather than as a box sliding
 * over a grey smudge.
 */
export function TheNoi({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  const it = useReducedMotion();

  return (
    <m.div
      variants={MUC}
      className={`rounded-the shadow-mem transition-shadow hover:shadow-noi ${className ?? ''}`}
      whileHover={it ? undefined : { scale: 1.03, y: -4 }}
      whileTap={it ? undefined : { scale: 0.985 }}
      transition={LO_XO}
    >
      {children}
    </m.div>
  );
}
