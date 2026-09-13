/**
 * The DYE LMS brand mark.
 *
 * ── Why it is not a snake any more ───────────────────────────────────────────
 * The mark was 🐍 in three places — the login page and both app shells — from
 * when the platform was a Python course. It now carries Micro:bit and STEM
 * robotics as well, and a student arriving at a robotics lesson under a Python
 * snake is being told, in the most visible spot on the page, that their subject
 * is an afterthought.
 *
 * (The snake still belongs in one place, and stays there: `cay-tep.tsx` uses it
 * as the file-type icon for `.py`, where it means exactly what it says.)
 *
 * ── Why an inline SVG and not an icon library ────────────────────────────────
 * There is no icon library in this app — every icon is an emoji or drawn here —
 * and pulling one in for a single glyph on the first-paint route is a poor
 * trade. Inline costs nothing at runtime, cannot go missing behind a school
 * firewall, and inherits `currentColor`, which is what lets the login page
 * render it as dark ink on a bright cyan tile while the in-app header draws it
 * in the theme's own accent.
 *
 * ── Drawn for 20px, not for the hero ─────────────────────────────────────────
 * The header renders this at 20px, and that is the size that decides the shape.
 * A first pass carried four chip pins and two legs; they looked deliberate at
 * 160px and turned into a smudge at 20. What survives is a bot head, an antenna
 * and one stub per side — enough to read as robotics at a glance, with nothing
 * that collapses when it gets small.
 */
export function DauHieu({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Always sits beside the words "DYE LMS", so naming it here would make a
      // screen reader announce the brand twice.
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Antenna */}
      <path d="M12 3.9V6" />
      <circle cx="12" cy="2.6" r="1.35" fill="currentColor" stroke="none" />

      {/* Head */}
      <rect x="3.5" y="6" width="17" height="12.5" rx="4" />

      {/* Eyes */}
      <circle cx="9" cy="11.4" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.4" r="1.35" fill="currentColor" stroke="none" />

      {/* One stub each side — the only nod to a chip that holds up at 20px. */}
      <path d="M3.5 12.25H1.4M20.5 12.25h2.1" />
    </svg>
  );
}
