'use client';

import { useState } from 'react';

/**
 * The person's picture, with initials behind it.
 *
 * ── Why initials are still the floor ─────────────────────────────────────────
 * Most accounts here are provisioned by a teacher and never get a photo, and a
 * roster of thirty identical grey circles gives the eye nothing to land on.
 * Two letters on the brand gradient is enough to tell rows apart at a glance
 * and to make the corner of the nav read as "you". So the initials are not a
 * placeholder waiting to be replaced — they are the design, and `anh` is the
 * better version of it when one exists.
 *
 * ── Which letters ────────────────────────────────────────────────────────────
 * Vietnamese names run family → middle → given, so "Từ Minh Nguyên" is "TN":
 * the first letter of the first word and of the last. One word gives one
 * letter; an empty name gives "?" rather than an empty circle, which would
 * look like a rendering failure.
 *
 * ── A picture that does not arrive is not a broken avatar ────────────────────
 * The CSP in next.config.mjs allows `img-src 'self' data: blob:`, so an avatar
 * hosted anywhere but this origin is blocked by the browser before a byte is
 * fetched — and accounts CAN be created with an external URL (`anhHopLe` in
 * @dye/core accepts http(s)). A file can also simply be deleted. Every one of
 * those ends in `onError`, and every one of them falls back to the initials
 * rather than leaving a torn-page icon in the sidebar. That is why this is a
 * client component: the fallback needs the load event.
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * By default it is an image named after the person, so a screen reader in the
 * nav (where the name is visually hidden below `md`) still says who is signed
 * in. Where the name is already printed beside it, pass `trangTri` and the
 * circle becomes decoration, so the name is not read twice. Both branches
 * carry the same name, so which one is on screen never changes what is read.
 */
export function chuCaiTen(ten: string): string {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length === 0) return '?';

  const dau = tu[0]?.[0] ?? '';
  const cuoi = tu.length > 1 ? (tu[tu.length - 1]?.[0] ?? '') : '';

  return `${dau}${cuoi}`.toLocaleUpperCase('vi') || '?';
}

const CO = {
  nho: 'size-8 text-xs',
  vua: 'size-10 text-sm',
  lon: 'size-14 text-lg',
} as const;

/** The rendered pixel size of each step, for the `<img>` intrinsic hint. */
const CANH = { nho: 32, vua: 40, lon: 56 } as const;

/** Shared between the photo and the initials, so the two are interchangeable. */
const VONG = 'shrink-0 rounded-full ring-2 ring-white/10 shadow-[0_0_14px_rgba(124,58,237,0.45)]';

export function Avatar({
  name,
  anh = null,
  co = 'vua',
  trangTri = false,
  className = '',
}: {
  name: string;
  /**
   * The picture URL — `session.user.image`, which is the `avatarUrl` column.
   * Null or empty means "this person has no photo", which is the common case.
   */
  anh?: string | null | undefined;
  co?: keyof typeof CO;
  /** True when the name is printed right next to it — hides it from readers. */
  trangTri?: boolean;
  className?: string;
}) {
  const [hong, setHong] = useState(false);

  /*
   * An empty string is treated as no picture, not as a picture at ''.
   *
   * `src=""` makes the browser re-request the current PAGE as an image, which
   * on a student page means a second render of the whole route just to throw
   * the HTML away. Cheap to rule out here, invisible and expensive if not.
   */
  const coAnh = typeof anh === 'string' && anh.trim() !== '' && !hong;

  if (coAnh) {
    return (
      /*
       * Plain <img>, not next/image: these URLs are arbitrary — a teacher types
       * one in when creating the account — so there is no intrinsic size to
       * declare and no host to whitelist in next.config.mjs. The element is
       * already constrained to a fixed circle, so there is nothing for the
       * optimiser to win here either.
       *
       * `object-cover` matters: a portrait or a banner dropped in as an avatar
       * must fill the circle rather than letterbox inside it.
       */
      <img
        src={anh}
        /*
         * Empty alt for the decorative case is what actually removes it from
         * the accessibility tree — `aria-hidden` on top of that would be
         * belt-and-braces on an element that is already gone.
         */
        alt={trangTri ? '' : name}
        {...(trangTri ? {} : { title: name })}
        width={CANH[co]}
        height={CANH[co]}
        loading="lazy"
        decoding="async"
        onError={() => setHong(true)}
        className={`${VONG} bg-the object-cover ${CO[co]} ${className}`}
      />
    );
  }

  const chuCai = chuCaiTen(name);
  const lop = `grid select-none place-items-center bg-linear-to-br from-chinh to-hong font-bold text-white ${VONG} ${CO[co]} ${className}`;

  if (trangTri) {
    return (
      <span aria-hidden="true" className={lop}>
        {chuCai}
      </span>
    );
  }

  return (
    <span role="img" aria-label={name} title={name} className={lop}>
      {chuCai}
    </span>
  );
}
