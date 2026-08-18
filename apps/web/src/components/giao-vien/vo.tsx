import { logout } from '@dye/core';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentActor, signOut } from '@/auth';
import { db } from '@/lib/db';

async function dangXuat(): Promise<void> {
  'use server';

  const actor = await currentActor();
  const store = await cookies();
  const token =
    store.get('authjs.session-token')?.value ?? store.get('__Secure-authjs.session-token')?.value;

  if (token) await logout(db, token, actor?.id ?? null);

  await signOut({ redirect: false });
  redirect('/dang-nhap');
}

/**
 * The teacher shell.
 *
 * Denser than the student shell on purpose. A teacher is a competent adult
 * navigating between classes, students and the lesson plan all day; the
 * restraint that serves a 12-year-old would just cost them clicks here.
 *
 * What does NOT change between the two shells is the accessibility floor:
 * same skip link, same 44px targets, same focus ring, same 18px base type.
 */
export function VoGiaoVien({
  tenHienThi,
  vaiTro,
  children,
}: {
  tenHienThi: string;
  vaiTro: 'TEACHER' | 'ADMIN';
  children: ReactNode;
}) {
  return (
    <>
      <a href="#noi-dung-chinh" className="bo-qua">
        Bỏ qua, tới nội dung chính
      </a>

      <header className="sticky top-0 z-20 border-b border-vien bg-the/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link
            href="/giao-vien"
            className="flex items-center gap-2 rounded text-lg font-bold text-chu"
          >
            <span aria-hidden="true">🐍</span>
            <span>DYE LMS</span>
            <span className="rounded-full bg-chinh-nhat px-2.5 py-0.5 text-xs font-semibold text-chinh">
              {vaiTro === 'ADMIN' ? 'Quản trị' : 'Giáo viên'}
            </span>
          </Link>

          <nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-1">
            <MucDieuHuong href="/giao-vien">Tổng quan</MucDieuHuong>
            <MucDieuHuong href="/giao-vien/du-an">Dự án game</MucDieuHuong>
            <MucDieuHuong href="/giao-vien/microbit">Micro:bit</MucDieuHuong>
            <MucDieuHuong href="/giao-vien/giao-trinh">Giáo trình</MucDieuHuong>
            {vaiTro === 'ADMIN' ? (
              <MucDieuHuong href="/giao-vien/nhan-su">Nhân sự</MucDieuHuong>
            ) : null}
          </nav>

          <div className="ms-auto flex items-center gap-3">
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

      <main id="noi-dung-chinh" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-chu-nhat sm:px-6">
        DYE LMS · Khu vực dành cho thầy cô
      </footer>
    </>
  );
}

function MucDieuHuong({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-cham items-center rounded-nut px-3 py-2 text-sm font-medium text-chu-phu hover:bg-the-mo hover:text-chu"
    >
      {children}
    </Link>
  );
}
