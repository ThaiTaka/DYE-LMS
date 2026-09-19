import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { currentActor } from '@/auth';
import { VoHocSinh } from '@/components/hoc-sinh/vo';
import { duLieuVoHocSinh } from '@/lib/student-data';

/**
 * Layout for every student page: `/bang-dieu-khien`, `/khoa-hoc/*`,
 * `/bai-hoc/*`, `/du-an/*`.
 *
 * ── What is in the group, and what is not ────────────────────────────────────
 * The route group `(hoc-sinh)` adds nothing to the URL; it exists so these
 * pages share ONE shell instead of each wrapping itself. Two student-facing
 * routes are deliberately outside it:
 *
 *   • `/kiem-tra/[slug]` — the exam room renders bare. No sidebar, no mascot,
 *     no search box: nothing to click out to while a timer is running.
 *   • `/doi-mat-khau` — reached before the session is "real" (a provisioned
 *     account must set its own password first); a sidebar full of courses the
 *     student cannot open yet would be a lie.
 *
 * ── Who gets it ──────────────────────────────────────────────────────────────
 * Anyone signed in. Teachers preview lessons through the same URLs (`bai-hoc`
 * checks `actor.role` itself to switch the focus tracker off), so the layout
 * does not gate on role — each page keeps its own `requireSession` /
 * `requireRole`, which is also where the must-change-password redirect lives.
 * The only thing enforced here is "signed in at all", because the shell needs
 * a name to draw.
 */
export default async function LayoutHocSinh({ children }: { children: ReactNode }) {
  const actor = await currentActor();
  if (!actor) redirect('/dang-nhap');

  const { khoaHoc, nhanh } = await duLieuVoHocSinh(actor.id);

  return (
    <VoHocSinh tenHienThi={actor.displayName} nhanh={nhanh} khoaHoc={khoaHoc}>
      {children}
    </VoHocSinh>
  );
}
