import { logout } from '@dye/core';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentActor, signOut } from '@/auth';
import { db } from '@/lib/db';

import { KIEU_NHANH } from '../ui/nhanh';

import type { Tier } from '@prisma/client';

async function dangXuat(): Promise<void> {
  'use server';

  const actor = await currentActor();
  const store = await cookies();
  const token =
    store.get('authjs.session-token')?.value ?? store.get('__Secure-authjs.session-token')?.value;

  // Kill the session row before clearing the cookie, so a token captured in
  // transit is already dead by the time the browser forgets it.
  if (token) await logout(db, token, actor?.id ?? null);

  await signOut({ redirect: false });
  redirect('/dang-nhap');
}

/**
 * The student shell.
 *
 * Deliberately sparse: one row of navigation, never more than three targets.
 * The brief forbids cluttered dashboards, and for a 12-year-old every extra
 * control is one more thing to be unsure about.
 */
export function VoHocSinh({
  tenHienThi,
  nhanh,
  children,
}: {
  tenHienThi: string;
  nhanh?: Tier | undefined;
  children: ReactNode;
}) {
  const kieu = nhanh ? KIEU_NHANH[nhanh] : null;

  return (
    <>
      <a href="#noi-dung-chinh" className="bo-qua">
        Bỏ qua, tới nội dung chính
      </a>

      <header className="sticky top-0 z-20 border-b border-vien bg-the/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            href="/bang-dieu-khien"
            className="flex items-center gap-2 rounded text-lg font-bold text-chu"
          >
            <span aria-hidden="true">🐍</span>
            <span>DYE LMS</span>
          </Link>

          <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
            <Link
              href="/bang-dieu-khien"
              className="flex min-h-cham items-center rounded-nut px-3 py-2 text-sm font-medium text-chu-phu hover:bg-the-mo hover:text-chu"
            >
              Trang chính
            </Link>
            <Link
              href="/du-an"
              className="flex min-h-cham items-center rounded-nut px-3 py-2 text-sm font-medium text-chu-phu hover:bg-the-mo hover:text-chu"
            >
              Dự án game
            </Link>
          </nav>

          <div className="ms-auto flex items-center gap-3">
            {kieu ? (
              <span
                className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold sm:inline-flex ${kieu.nen} ${kieu.chu} ${kieu.vien}`}
              >
                <span aria-hidden="true">{kieu.icon}</span>
                Nhánh {kieu.nhan}
              </span>
            ) : null}

            <span className="hidden text-sm text-chu-phu md:inline">{tenHienThi}</span>

            <form action={dangXuat}>
              <button
                type="submit"
                className="min-h-cham rounded-nut border border-vien px-3 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="noi-dung-chinh" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-chu-nhat sm:px-6">
        DYE LMS · Học lập trình Python cùng nhau
      </footer>
    </>
  );
}
