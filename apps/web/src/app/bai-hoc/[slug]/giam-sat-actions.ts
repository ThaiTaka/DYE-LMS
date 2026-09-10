'use server';

import {
  authorize,
  khoaBaiViPham as khoaTrongCore,
  khoaHienTai,
  NGUONG_CANH_BAO_NANG,
  NGUONG_KHOA,
  ghiNhanSuKienTapTrung,
} from '@dye/core';

import { currentActor } from '@/auth';
import { db } from '@/lib/db';

import type { FocusEventType } from '@prisma/client';

/**
 * The endpoint the lesson-page focus tracker posts to.
 *
 * ── What this deliberately does not do ───────────────────────────────────────
 * It does not take a student id. `currentActor()` is the only source, so the
 * worst a tampered client can do is log noise against its own account — it can
 * never manufacture an alert about a classmate, which is the failure mode that
 * would actually hurt someone.
 *
 * It does not take a URL, a window title, or anything about where the student
 * went. The browser could supply none of that anyway across an origin boundary,
 * and asking for what little it could supply would be collecting surveillance
 * data on children to answer a question a teacher is better placed to ask them
 * directly.
 *
 * ── Why it never throws ──────────────────────────────────────────────────────
 * This is called from a `visibilitychange` handler. An exception there surfaces
 * as an unhandled rejection in the console of a 12-year-old's browser, or worse
 * as a crashed page, over a background signal that does not matter to the lesson
 * they are doing. Every failure path answers `{ ok: false }` and the tracker
 * moves on.
 */

/** Only these reach the enum column. A form value is never trusted into one. */
const LOAI_HOP_LE: readonly FocusEventType[] = [
  'TAB_HIDDEN',
  'WINDOW_BLUR',
  'RETURNED',
  'PASTE_BURST',
];

export interface KetQuaGhiNhanRoiTab {
  ok: boolean;
  /** Tab-outs recorded for this student in this lesson so far. */
  soLanRoi: number;
  /**
   * The count has reached NGUONG_CANH_BAO_NANG: show the student the modal.
   *
   * Decided HERE rather than by comparing numbers in the browser, so the two
   * thresholds live in exactly one place. A client that drifted out of step with
   * the server would either warn a student who was nowhere near the limit, or —
   * far worse — lock one who never saw a warning at all.
   */
  canhBaoNang: boolean;
  /** The count has reached NGUONG_KHOA. The client should now ask for the lock. */
  phaiKhoa: boolean;
  /** A lock is already in force, e.g. this tab reloaded after one landed. */
  dangKhoa: boolean;
}

/**
 * The refusal every failure path answers with.
 *
 * A `false` here is read by the tracker as "nothing happened", which is the only
 * safe reading: a network blip must never be what warns a child, and it must
 * certainly never be what locks one.
 */
const TU_CHOI: KetQuaGhiNhanRoiTab = {
  ok: false,
  soLanRoi: 0,
  canhBaoNang: false,
  phaiKhoa: false,
  dangKhoa: false,
};

export async function ghiNhanRoiTab(input: {
  lessonId: string;
  blockId?: string | undefined;
  loai: string;
  awaySeconds?: number | undefined;
}): Promise<KetQuaGhiNhanRoiTab> {
  try {
    const actor = await currentActor();

    /*
     * Students only.
     *
     * A teacher previewing a lesson alt-tabs constantly — to the register, to
     * the projector, to the next student's screen. Logging that would fill the
     * feed with alerts about the person the feed is for.
     */
    if (!actor || actor.role !== 'STUDENT' || !actor.isActive) {
      return { ...TU_CHOI };
    }

    const loai = LOAI_HOP_LE.find((t) => t === input.loai);
    if (!loai) return { ...TU_CHOI };

    const lessonId = String(input.lessonId ?? '');
    if (!lessonId) return { ...TU_CHOI };

    /*
     * Being signed in is not the same as being allowed.
     *
     * The only id this action ever writes is `actor.id`, so there is no other
     * child it could reach — but routing even that through `authorize()` keeps
     * every write path in the app behind the same single gate, and picks up the
     * disabled-account refusal for free rather than re-implementing it here.
     * The quiz action does exactly this, for exactly this reason.
     */
    await authorize(db, actor, { resource: 'progress', action: 'read', studentId: actor.id });

    const kq = await ghiNhanSuKienTapTrung(db, actor.id, {
      lessonId,
      blockId: input.blockId,
      type: loai,
      awaySeconds: input.awaySeconds,
    });

    const khoa = await khoaHienTai(db, actor.id, lessonId);
    const dangKhoa = khoa?.state === 'LOCKED';

    return {
      ok: kq.daGhi,
      soLanRoi: kq.soLanRoi,
      canhBaoNang: !dangKhoa && kq.soLanRoi >= NGUONG_CANH_BAO_NANG,
      phaiKhoa: !dangKhoa && kq.soLanRoi >= NGUONG_KHOA,
      dangKhoa,
    };
  } catch (error) {
    // Logged server-side; the student's page never learns that anything failed.
    console.error('[giam-sat] không ghi được sự kiện tập trung', error);
    return { ...TU_CHOI };
  }
}

export interface KetQuaKhoaUI {
  /** True when a lock is in force after this call, however it got there. */
  dangKhoa: boolean;
  /** The server's own count. Never the number the browser was holding. */
  soLan: number;
  nguong: number;
  soBaiKhongDiem: number;
  soCauKhongDiem: number;
}

/**
 * Ask the server to lock this lesson at zero.
 *
 * ── The browser asks; it does not decide ─────────────────────────────────────
 * There is no count parameter, and there never may be one. `khoaBaiViPham` in
 * @dye/core re-counts `FocusEvent` rows for this student and refuses when the
 * real total is under the threshold, so the worst a tampered client can do by
 * hammering this action is spend a query — it cannot zero a lesson early, and it
 * cannot reach a classmate at all, because the student id comes from the session
 * exactly as it does in `ghiNhanRoiTab`.
 *
 * ── Why it answers instead of throwing ───────────────────────────────────────
 * Same reason as the tracker above: this is called from a visibility handler in
 * a 12-year-old's browser, and an unhandled rejection there is a crashed lesson.
 */
export async function khoaBaiViPham(input: {
  lessonId: string;
  blockId?: string | undefined;
}): Promise<KetQuaKhoaUI> {
  const trong: KetQuaKhoaUI = {
    dangKhoa: false,
    soLan: 0,
    nguong: NGUONG_KHOA,
    soBaiKhongDiem: 0,
    soCauKhongDiem: 0,
  };

  try {
    const actor = await currentActor();
    if (!actor || actor.role !== 'STUDENT' || !actor.isActive) return trong;

    const lessonId = String(input.lessonId ?? '');
    if (!lessonId) return trong;

    await authorize(db, actor, { resource: 'progress', action: 'read', studentId: actor.id });

    const kq = await khoaTrongCore(db, actor.id, lessonId, { blockId: input.blockId });

    return {
      dangKhoa: kq.dangKhoa,
      soLan: kq.soLan,
      nguong: NGUONG_KHOA,
      soBaiKhongDiem: kq.soBaiKhongDiem,
      soCauKhongDiem: kq.soCauKhongDiem,
    };
  } catch (error) {
    console.error('[giam-sat] không khoá được bài', error);
    return trong;
  }
}
