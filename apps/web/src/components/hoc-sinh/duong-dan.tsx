import Link from 'next/link';

export interface MucDuongDan {
  nhan: string;
  href?: string;
}

/**
 * Breadcrumbs — the "Where am I?" answer the brief demands above the fold.
 *
 * A real `<nav aria-label>` wrapping an ordered list, with the current page
 * marked `aria-current="page"`. The separators are `aria-hidden` so a screen
 * reader hears "Python Cơ Bản, Vòng lặp, Buổi 12" and not a stream of slashes.
 */
export function DuongDan({ muc }: { muc: MucDuongDan[] }) {
  return (
    <nav aria-label="Đường dẫn trang" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-chu-phu">
        {muc.map((m, i) => {
          const cuoi = i === muc.length - 1;
          return (
            <li key={`${m.nhan}-${i}`} className="flex items-center gap-2">
              {i > 0 ? (
                <span aria-hidden="true" className="text-vien-dam">
                  ›
                </span>
              ) : null}

              {m.href && !cuoi ? (
                <Link href={m.href} className="rounded hover:text-chinh hover:underline">
                  {m.nhan}
                </Link>
              ) : (
                <span {...(cuoi ? { 'aria-current': 'page' as const } : {})} className="font-medium text-chu">
                  {m.nhan}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
