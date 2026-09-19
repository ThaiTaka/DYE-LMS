'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { DauHieu } from '@/components/dau-hieu';
import { Avatar } from '@/components/ui/avatar';
import { BieuTuong, type TenBieuTuong } from '@/components/ui/bieu-tuong';

import { TimKiem, type DichDen } from './tim-kiem';

import type { KieuNhanh } from '../ui/nhanh';

export interface KhoaHocThanhBen {
  slug: string;
  title: string;
  iconEmoji: string;
}

/** Fixed destinations, before the student's own courses. */
const MUC_CO_DINH: Array<{ href: string; nhan: string; icon: TenBieuTuong; chinhXac?: boolean }> = [
  { href: '/bang-dieu-khien', nhan: 'Trang chính', icon: 'nha', chinhXac: true },
  { href: '/du-an', nhan: 'Dự án game', icon: 'tayCam' },
];

/**
 * The student shell's frame: sidebar, top bar, content column.
 *
 * ── Geometry ─────────────────────────────────────────────────────────────────
 * From `lg` up the sidebar is fixed to the left edge at `--spacing-thanh-ben`
 * (17rem — about 17% of a 1600px classroom display, 20% of a 1366px school
 * laptop) and the content column is padded past it. Below `lg` the same
 * sidebar becomes a drawer: off-canvas, opened by the button in the top bar,
 * closed by the ✕, the scrim, Escape, or navigating anywhere.
 *
 * ── Why this is a client component ──────────────────────────────────────────
 * Two things need the browser: the drawer's open state and `usePathname` for
 * the active nav item. Everything else — the page itself — arrives as
 * `children`, already rendered on the server. The logout form's `action` is a
 * server action handed down as a prop, so signing out never touches this file.
 *
 * ── The one primary navigation ───────────────────────────────────────────────
 * Still deliberately short. Two fixed targets and the student's own courses;
 * no settings, no notifications, no "more". For a 12-year-old every extra
 * control is one more thing to be unsure about, and the brief forbids
 * cluttered dashboards.
 */
export function KhungVo({
  tenHienThi,
  nhanh,
  khoaHoc,
  dangXuat,
  children,
}: {
  tenHienThi: string;
  nhanh: KieuNhanh | null;
  khoaHoc: KhoaHocThanhBen[];
  dangXuat: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mo, setMo] = useState(false);
  const nutMo = useRef<HTMLButtonElement>(null);
  const nutDong = useRef<HTMLButtonElement>(null);

  // Navigating closes the drawer — the student picked something, the menu is done.
  useEffect(() => {
    setMo(false);
  }, [pathname]);

  // Escape closes; the page behind the drawer does not scroll while it is open;
  // focus goes to the ✕ on open and back to the ☰ on close.
  useEffect(() => {
    if (!mo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMo(false);
    };
    document.addEventListener('keydown', onKey);
    const truoc = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nutDong.current?.focus();
    // Captured now: the ☰ is `lg:hidden`, but it is the same element for the
    // life of this effect, and reading the ref in the cleanup is what the lint
    // rule (rightly) objects to.
    const nutQuayLai = nutMo.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = truoc;
      nutQuayLai?.focus();
    };
  }, [mo]);

  const dichDen: DichDen[] = [
    ...MUC_CO_DINH.map((m) => ({ nhan: m.nhan, href: m.href })),
    ...khoaHoc.map((k) => ({ nhan: k.title, href: `/khoa-hoc/${k.slug}`, icon: k.iconEmoji })),
  ];

  const dangO = (href: string, chinhXac = false) =>
    chinhXac ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh">
      {/* Scrim behind the drawer, phones and tablets only. */}
      {mo ? (
        <div
          aria-hidden="true"
          onClick={() => setMo(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      ) : null}

      {/* ── Sidebar / drawer ──────────────────────────────────────────────── */}
      <aside
        id="thanh-ben"
        aria-label="Thanh bên"
        className={`fixed inset-y-0 left-0 z-50 flex w-thanh-ben max-w-[85vw] flex-col border-r border-vien bg-be-mat shadow-noi transition-transform duration-200 ease-out lg:translate-x-0 lg:shadow-none ${
          mo ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-thanh-tren shrink-0 items-center gap-3 px-5">
          <Link
            href="/bang-dieu-khien"
            className="flex min-h-cham items-center gap-2.5 rounded-nut text-lg font-bold text-chu"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-chinh to-hong shadow-neon">
              <DauHieu className="size-5 text-white" />
            </span>
            <span>
              DYE <span className="chu-neon">LMS</span>
            </span>
          </Link>

          <button
            ref={nutDong}
            type="button"
            onClick={() => setMo(false)}
            aria-label="Đóng thanh bên"
            className="ms-auto grid size-cham place-items-center rounded-nut text-chu-phu hover:bg-white/[0.06] hover:text-chu lg:hidden"
          >
            <BieuTuong ten="dong" />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="m-0 list-none space-y-1 p-0">
            {MUC_CO_DINH.map((m) => (
              <li key={m.href}>
                <MucDieuHuong href={m.href} dangO={dangO(m.href, m.chinhXac)}>
                  <BieuTuong ten={m.icon} className="size-5 shrink-0" />
                  {m.nhan}
                </MucDieuHuong>
              </li>
            ))}
          </ul>

          {khoaHoc.length > 0 ? (
            <>
              <p className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-chu-nhat uppercase">
                Khoá học của em
              </p>
              <ul className="m-0 list-none space-y-1 p-0">
                {khoaHoc.map((k) => (
                  <li key={k.slug}>
                    <MucDieuHuong href={`/khoa-hoc/${k.slug}`} dangO={dangO(`/khoa-hoc/${k.slug}`)}>
                      <span
                        aria-hidden="true"
                        className="w-5 shrink-0 text-center text-lg leading-none"
                      >
                        {k.iconEmoji}
                      </span>
                      <span className="truncate">{k.title}</span>
                    </MucDieuHuong>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </nav>

        {/* Who is signed in, and the way out. */}
        <div className="shrink-0 border-t border-vien p-3">
          <div className="flex items-center gap-3 rounded-the-nho border border-vien bg-white/[0.03] p-3">
            <Avatar name={tenHienThi} trangTri />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-chu">{tenHienThi}</span>
              {nhanh ? (
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-px text-xs font-semibold ${nhanh.nen} ${nhanh.chu} ${nhanh.vien}`}
                >
                  <span aria-hidden="true">{nhanh.icon}</span>
                  {nhanh.nhan}
                </span>
              ) : null}
            </span>
            <form action={dangXuat}>
              <button
                type="submit"
                aria-label="Đăng xuất"
                title="Đăng xuất"
                className="grid size-cham place-items-center rounded-nut text-chu-phu hover:bg-white/[0.06] hover:text-chu"
              >
                <BieuTuong ten="dangXuat" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Content column ────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-col lg:ps-thanh-ben">
        <header className="sticky top-0 z-30 h-thanh-tren border-b border-vien kinh-mong">
          <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              ref={nutMo}
              type="button"
              onClick={() => setMo(true)}
              aria-label="Mở thanh bên"
              aria-controls="thanh-ben"
              aria-expanded={mo}
              className="grid size-cham shrink-0 place-items-center rounded-nut text-chu-phu hover:bg-white/[0.06] hover:text-chu lg:hidden"
            >
              <BieuTuong ten="menu" />
            </button>

            <TimKiem dichDen={dichDen} className="w-full max-w-md" />

            <div className="ms-auto flex shrink-0 items-center gap-3">
              {nhanh ? (
                <span
                  className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:inline-flex ${nhanh.nen} ${nhanh.chu} ${nhanh.vien}`}
                >
                  <span aria-hidden="true">{nhanh.icon}</span>
                  Nhánh {nhanh.nhan}
                </span>
              ) : null}
              <span className="hidden text-sm font-medium text-chu-phu md:inline">
                {tenHienThi}
              </span>
              <Avatar name={tenHienThi} co="nho" />
            </div>
          </div>
        </header>

        <main
          id="noi-dung-chinh"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-8 text-sm text-chu-nhat sm:px-6 lg:px-8">
          DYE LMS · Nền tảng học lập trình và STEM Robotics
        </footer>
      </div>
    </div>
  );
}

/** One row in the sidebar. The active row carries a gradient bar on its left edge. */
function MucDieuHuong({
  href,
  dangO,
  children,
}: {
  href: string;
  dangO: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={dangO ? 'page' : undefined}
      className={`relative flex min-h-cham items-center gap-3 rounded-nut px-3 py-2 text-sm font-medium transition-colors ${
        dangO
          ? 'bg-chinh-nhat text-chu [&>svg]:text-chinh-sang'
          : 'text-chu-phu hover:bg-white/[0.05] hover:text-chu'
      }`}
    >
      {dangO ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 -left-3 w-1 rounded-r-full bg-linear-to-b from-chinh to-hong"
        />
      ) : null}
      {children}
    </Link>
  );
}
