import { logout } from '@dye/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentActor, signOut } from '@/auth';
import { db } from '@/lib/db';

import { KIEU_NHANH } from '../ui/nhanh';

import { KhungChuyenDong } from './chuyen-dong';
import { KhungVo, type KhoaHocThanhBen } from './khung-vo';
import { TroLyAo } from './tro-ly-ao';

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
 * Mounted once by `app/(hoc-sinh)/layout.tsx`, so every student page shares
 * one sidebar, one top bar and one content column and never draws its own
 * chrome. The exam room (`/kiem-tra`) lives outside that route group on
 * purpose and never gets this: the nav, the mascot and the search box are
 * distractions at best and, in fullscreen, a way out of the room.
 *
 * This file is the server half — the sign-out action and the tier lookup.
 * The frame itself is `KhungVo`, a client component, because the drawer and
 * the active nav item need the browser.
 */
export function VoHocSinh({
  tenHienThi,
  anhDaiDien = null,
  nhanh,
  khoaHoc,
  children,
}: {
  tenHienThi: string;
  /** `session.user.image`. Null — the usual case — draws initials instead. */
  anhDaiDien?: string | null | undefined;
  nhanh?: Tier | undefined;
  khoaHoc: KhoaHocThanhBen[];
  children: ReactNode;
}) {
  const kieu = nhanh ? KIEU_NHANH[nhanh] : null;

  return (
    <KhungChuyenDong>
      <a href="#noi-dung-chinh" className="bo-qua">
        Bỏ qua, tới nội dung chính
      </a>

      <KhungVo
        tenHienThi={tenHienThi}
        anhDaiDien={anhDaiDien}
        nhanh={kieu}
        khoaHoc={khoaHoc}
        dangXuat={dangXuat}
      >
        {children}
      </KhungVo>

      {/*
        Bí lives in the shell, which is what keeps it out of the exam room:
        `/kiem-tra/[slug]` is outside the `(hoc-sinh)` route group and never
        mounts this component, so a bobbing robot cannot turn up beside an
        exam question.
      */}
      <TroLyAo />
    </KhungChuyenDong>
  );
}
