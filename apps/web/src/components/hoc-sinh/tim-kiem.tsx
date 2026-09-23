'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { BieuTuong } from '@/components/ui/bieu-tuong';

export interface DichDen {
  nhan: string;
  href: string;
  /** Emoji or short mark shown in the suggestion list. */
  icon?: string;
}

/**
 * Fold Vietnamese for matching: strip tone marks, map đ → d, lower-case.
 * "vong lap" must find "Vòng lặp" — a child on a school keyboard often types
 * without the tones, and a search that punishes that is a search nobody uses.
 */
export function khongDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/** Best destination for a query, or null. Exact label first, then substring. */
export function timDichDen(dichDen: DichDen[], truyVan: string): DichDen | null {
  const q = khongDau(truyVan);
  if (!q) return null;
  return (
    dichDen.find((d) => khongDau(d.nhan) === q) ??
    dichDen.find((d) => khongDau(d.nhan).includes(q)) ??
    null
  );
}

/**
 * The top-bar search: "Đi tới…".
 *
 * ── What it searches ─────────────────────────────────────────────────────────
 * The places this student can go: their courses and the fixed pages. It is a
 * jump box, not a full-text search of the curriculum — that would need an
 * index the platform does not have, and a search box that returns nothing for
 * "vòng lặp" would teach the student to ignore it. The list it does have is
 * short, so every query resolves to a page or to nothing, instantly.
 *
 * ── Why a native <datalist> ──────────────────────────────────────────────────
 * It is a combobox the browser already knows how to announce, drive from the
 * keyboard and render on a touchscreen, for zero JavaScript. A custom dropdown
 * would look sharper and cost a week of ARIA to get to the same place.
 * Matching is tone-insensitive (see `khongDau`), so the datalist's own
 * filtering is a convenience; the submit handler does the real match.
 */
export function TimKiem({ dichDen, className = '' }: { dichDen: DichDen[]; className?: string }) {
  const router = useRouter();
  const id = useId();
  const [truyVan, setTruyVan] = useState('');
  const [khongThay, setKhongThay] = useState(false);

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const dich = timDichDen(dichDen, truyVan);
        if (!dich) {
          setKhongThay(true);
          return;
        }
        setKhongThay(false);
        setTruyVan('');
        router.push(dich.href);
      }}
    >
      <label htmlFor={`${id}-o`} className="sr-only">
        Đi tới khoá học hoặc trang
      </label>

      <BieuTuong
        ten="timKiem"
        className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-chu-nhat"
      />

      <input
        id={`${id}-o`}
        type="search"
        list={`${id}-ds`}
        value={truyVan}
        onChange={(e) => {
          setTruyVan(e.target.value);
          if (khongThay) setKhongThay(false);
        }}
        placeholder="Đi tới khoá học…"
        autoComplete="off"
        aria-describedby={khongThay ? `${id}-loi` : undefined}
        aria-invalid={khongThay || undefined}
        // `outline-hidden`, not `outline-none`: in Tailwind v4 the latter is a
        // real `outline-style: none`, and Windows High Contrast strips the
        // ring (a box-shadow) — so the field had no focus indicator at all there.
        className={`h-10 w-full rounded-full border bg-white/[0.04] ps-11 pe-4 text-sm text-chu placeholder:text-chu-nhat focus:bg-white/[0.07] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-chinh-sang ${
          khongThay ? 'border-thu-lai' : 'border-vien hover:border-vien-dam focus:border-chinh-sang'
        }`}
      />

      <datalist id={`${id}-ds`}>
        {dichDen.map((d) => (
          <option key={d.href} value={d.nhan}>
            {d.icon ? `${d.icon} ${d.nhan}` : d.nhan}
          </option>
        ))}
      </datalist>

      {khongThay ? (
        <p
          id={`${id}-loi`}
          role="status"
          // Sized to its text, not to the form: the box is compact at rest and
          // a message squeezed into 12rem wrapped to five lines.
          className="absolute top-full left-0 z-10 mt-2 w-max max-w-[min(20rem,80vw)] rounded-nut border border-thu-lai/50 bg-the px-3 py-2 text-sm text-thu-lai shadow-noi"
        >
          Không có trang nào tên vậy. Thử gõ tên khoá học của em nhé.
        </p>
      ) : null}
    </form>
  );
}
