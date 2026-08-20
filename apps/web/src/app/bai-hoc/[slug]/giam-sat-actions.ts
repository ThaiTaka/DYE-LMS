'use server';

import { authorize, ghiNhanSuKienTapTrung } from '@dye/core';

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
}

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
      return { ok: false, soLanRoi: 0 };
    }

    const loai = LOAI_HOP_LE.find((t) => t === input.loai);
    if (!loai) return { ok: false, soLanRoi: 0 };

    const lessonId = String(input.lessonId ?? '');
    if (!lessonId) return { ok: false, soLanRoi: 0 };

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

    return { ok: kq.daGhi, soLanRoi: kq.soLanRoi };
  } catch (error) {
    // Logged server-side; the student's page never learns that anything failed.
    console.error('[giam-sat] không ghi được sự kiện tập trung', error);
    return { ok: false, soLanRoi: 0 };
  }
}
