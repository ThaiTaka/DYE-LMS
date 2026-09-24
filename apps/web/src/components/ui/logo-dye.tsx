import { useId } from 'react';

/**
 * The DYE LMS logo — a robot helmet, drawn in code.
 *
 * ── What it is ───────────────────────────────────────────────────────────────
 * A flat-topped hexagon in the brand violet → pink: a hex nut for the
 * "Engineers", and the shape of a helmet once it has a face. Inside, a dark
 * visor with two mint eyes; on top, an antenna ending in a mint signal node.
 * Robotics from the face, STEM from the hex, and the glowing node is the
 * circuit. It carries its own colour, so every placement shows the same mark —
 * no gradient tile behind it, no `text-*` on it.
 *
 * ── Why an inline SVG and not an image or an icon library ───────────────────
 * Inline costs nothing at runtime, cannot go missing behind a school firewall,
 * and adds no request to the first paint of the login page. Every colour is a
 * theme token applied as a class (`text-*` on a gradient stop, `fill-*` on a
 * shape), so a change in globals.css repaints the logo with the rest of the app.
 *
 * ── Drawn for 28px, not for the hero ─────────────────────────────────────────
 * The teacher header shows this at 28px, and that size decided the shape.
 * Everything that has to read — antenna node, visor, eyes — is at least 5
 * units of the 48-unit grid (about 3px at 28px). The gloss and the mouth are
 * the only fine details, and both are allowed to fade out when small without
 * leaving a smudge behind.
 *
 * ── Why the gradient ids come from `useId` ───────────────────────────────────
 * `url(#id)` resolves to the FIRST element in the document with that id. The
 * student shell and the dashboard banner both render this logo, and with a
 * fixed id the second would borrow the first one's gradient — and the moment
 * the first sits in a `display: none` subtree, Chrome paints both unfilled.
 * `useId` also works in server components, so the logo stays one component
 * for both kinds of parent.
 *
 * Size it with `className` (`size-9`, `size-16`, …); add `drop-shadow-neon`
 * for the glow, which follows the hexagon instead of drawing a lit square.
 */
export function LogoDYE({ className = '' }: { className?: string }) {
  const id = useId();
  const son = `${id}son`;
  const bong = `${id}bong`;

  return (
    <svg
      viewBox="0 0 48 48"
      // Always sits beside the words "DYE LMS" or the full name, so naming it
      // here would make a screen reader announce the brand twice.
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        {/*
          Stops take their colour from `currentColor`, and each stop's `color`
          comes from a token class. `userSpaceOnUse` makes the helmet and the
          antenna share one gradient field — and an object-bounding-box
          gradient on a straight vertical line (the antenna) has a zero-width
          box and paints nothing at all.
        */}
        <linearGradient id={son} gradientUnits="userSpaceOnUse" x1="6" y1="6" x2="42" y2="46">
          <stop offset="0" stopColor="currentColor" className="text-chinh" />
          <stop offset="1" stopColor="currentColor" className="text-hong" />
        </linearGradient>
        <linearGradient id={bong} gradientUnits="userSpaceOnUse" x1="0" y1="9" x2="0" y2="29">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.24" className="text-white" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" className="text-white" />
        </linearGradient>
      </defs>

      {/* Antenna and its signal node. */}
      <path d="M24 9.5V6" stroke={`url(#${son})`} strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="24" cy="3.6" r="3" className="fill-ngoc" />

      {/* Helmet, then a gloss over its top half. */}
      <path d={LUC_GIAC} fill={`url(#${son})`} />
      <path d={LUC_GIAC} fill={`url(#${bong})`} />

      {/* Visor and eyes. */}
      <rect x="9.5" y="20" width="29" height="12" rx="6" className="fill-nen-sau" />
      <circle cx="17.75" cy="26" r="3.25" className="fill-ngoc" />
      <circle cx="30.25" cy="26" r="3.25" className="fill-ngoc" />

      {/* Mouth — a speaker grille at large sizes, gone into the fill when small. */}
      <rect x="20" y="36.5" width="8" height="3" rx="1.5" className="fill-nen-sau/50" />
    </svg>
  );
}

/** Flat-topped hexagon, circumradius 21 centred on (24, 27), 5-unit rounded corners. */
const LUC_GIAC =
  'M43.56 24.5A5 5 0 0 1 43.56 29.5L35.94 42.69A5 5 0 0 1 31.61 45.19L16.39 45.19A5 5 0 0 1 12.06 42.69L4.44 29.5A5 5 0 0 1 4.44 24.5L12.06 11.31A5 5 0 0 1 16.39 8.81L31.61 8.81A5 5 0 0 1 35.94 11.31Z';
