/**
 * Line icons for the student shell.
 *
 * The app has no icon library on purpose (see `logo-dye.tsx`): every glyph is
 * either an emoji or drawn here, so nothing can go missing behind a school
 * firewall and nothing adds to the first-paint bundle. These are 24-unit,
 * 1.75-stroke outlines — the "line-style" the shell asks for — and inherit
 * `currentColor`, so a nav item recolours its icon by recolouring its text.
 *
 * Every icon is `aria-hidden`: each one sits next to a word that says the
 * same thing, and a screen reader should hear the word once.
 */
import type { SVGProps } from 'react';

const DUONG = {
  /** Home. */
  nha: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5h13V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  /** Game controller. */
  tayCam: (
    <>
      <path d="M6.5 8h11a4.5 4.5 0 0 1 4.4 5.4l-.9 4.2a2.3 2.3 0 0 1-4.1.9L15.5 16h-7l-1.4 2.5a2.3 2.3 0 0 1-4.1-.9l-.9-4.2A4.5 4.5 0 0 1 6.5 8Z" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="15.5" cy="11.5" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="13.5" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  /** Open book — a course. */
  sach: (
    <>
      <path d="M12 6.5c-1.8-1.4-4.3-1.9-8-1.5v13c3.7-.4 6.2.1 8 1.5 1.8-1.4 4.3-1.9 8-1.5V5c-3.7-.4-6.2.1-8 1.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  /** Map with a pin — the course roadmap. */
  banDo: (
    <>
      <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  /** Magnifier. */
  timKiem: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  /** Hamburger. */
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  /** Close. */
  dong: <path d="m6 6 12 12M18 6 6 18" />,
  /** Sign out — a door with an arrow. */
  dangXuat: (
    <>
      <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
      <path d="M14.5 8.5 18 12l-3.5 3.5M18 12H9.5" />
    </>
  ),
  /** Arrow right. */
  muiTen: <path d="M5 12h14m-6-6 6 6-6 6" />,
  /** Sparkles — "next up", badges. */
  lapLanh: (
    <>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9 12 3.5Z" />
      <path d="M19 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  /** Flame — the streak. */
  lua: (
    <path d="M12 3.5c.6 3.2 3.1 4.6 4.2 7 1.3 2.7.7 5.8-1.7 7.7A6.5 6.5 0 0 1 6 15c-.6-2.9 1-4.5 1.8-6 .3 1.3.9 2.2 1.9 2.7C9.4 8.6 10.4 5.7 12 3.5Z" />
  ),
  /** Check in a circle — completed. */
  xong: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.8-5" />
    </>
  ),
  /** Clipboard with code brackets — homework. */
  baiTap: (
    <>
      <path d="M9 4.5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="3" rx="1" />
      <path d="m10 11-2 2 2 2M14 11l2 2-2 2" />
    </>
  ),
  /** Two speech bubbles — the class chat. */
  troChuyen: (
    <>
      <path d="M4.5 5.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-3.5 3v-3h-1a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
      <path d="M16.5 9.5h3a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-1v2.5l-3-2.5h-2.5a2 2 0 0 1-1.6-.8" />
    </>
  ),
  /** Clock — a deadline. */
  dongHo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
} as const;

export type TenBieuTuong = keyof typeof DUONG;

export function BieuTuong({
  ten,
  className = 'size-5',
  ...rest
}: { ten: TenBieuTuong } & Omit<SVGProps<SVGSVGElement>, 'children'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {DUONG[ten]}
    </svg>
  );
}
