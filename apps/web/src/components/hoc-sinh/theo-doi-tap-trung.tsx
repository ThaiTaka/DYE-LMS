'use client';

import { useEffect, useRef } from 'react';

import { ghiNhanRoiTab } from '@/app/bai-hoc/[slug]/giam-sat-actions';

/**
 * Focus tracker for the lesson page.
 *
 * ── It tells the student it is there ─────────────────────────────────────────
 * The visible notice below is not decoration and is not optional. Silently
 * watching a child's browser and reporting on them to an adult is surveillance;
 * telling them plainly what is recorded, what is not, and who sees it makes it
 * a classroom norm they can understand and argue with. It also happens to work
 * better — a student who knows the teacher will notice is far more likely to
 * just ask for help.
 *
 * The wording avoids any suggestion of catching someone out. It records that
 * the tab was left, it does not know where they went, and the teacher's
 * intended response is to come and ask how it is going.
 *
 * ── What the browser actually gives us ───────────────────────────────────────
 * Two events, and they overlap:
 *
 *   visibilitychange → hidden    tab switch, minimise, phone screen lock
 *   blur                          another window took focus, ours still visible
 *
 * A single alt-tab commonly fires BOTH. Counting that as two departures would
 * put a student over a threshold of three after leaving twice, so this
 * collapses them: one "away" state, entered by whichever event arrives first,
 * and a matching `RETURNED` on the way back carrying the duration.
 *
 * The server dedupes again on its own clock (`DEDUP_MS` in @dye/core). Both
 * layers are needed — this one keeps the request count sane, that one is the
 * one that cannot be edited in devtools.
 *
 * ── Why short blips are dropped ──────────────────────────────────────────────
 * A click on the taskbar, a notification toast stealing focus for 400 ms, a
 * password manager popping up — none of those are a student leaving the lesson,
 * and all of them fire `blur`. Anything under NGUONG_VANG_MS is discarded
 * client-side and never becomes a row.
 */

/** Below this, the student did not go anywhere. */
const NGUONG_VANG_MS = 1200;

/** Matches DEDUP_MS in @dye/core: one alt-tab must never post twice. */
const CHONG_TRUNG_MS = 1500;

export function TheoDoiTapTrung({
  lessonId,
  bat,
}: {
  lessonId: string;
  /** False for teachers and admins previewing the lesson. */
  bat: boolean;
}) {
  // Refs, not state: none of this may cause a re-render. The lesson page holds
  // a code editor with unsaved work in it, and re-rendering on every alt-tab is
  // how a student loses what they were typing.
  const roiLuc = useRef<number | null>(null);
  const guiLanCuoi = useRef(0);

  useEffect(() => {
    if (!bat || !lessonId) return;

    const gui = (loai: 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'RETURNED', awaySeconds?: number): void => {
      const now = Date.now();
      if (now - guiLanCuoi.current < CHONG_TRUNG_MS) return;
      guiLanCuoi.current = now;

      // Fire and forget. A failure here must never reach the student — the
      // action already answers `{ ok: false }` rather than throwing, and this
      // catch covers a genuine network drop.
      void ghiNhanRoiTab({
        lessonId,
        loai,
        ...(awaySeconds !== undefined ? { awaySeconds } : {}),
      }).catch(() => undefined);
    };

    const roiDi = (loai: 'TAB_HIDDEN' | 'WINDOW_BLUR'): void => {
      if (roiLuc.current !== null) return; // already away
      roiLuc.current = Date.now();
      gui(loai);
    };

    const quayLai = (): void => {
      const luc = roiLuc.current;
      if (luc === null) return;
      roiLuc.current = null;

      const vangMs = Date.now() - luc;
      // Too short to be a departure. The leave event has already been posted by
      // the time we know that, which is unavoidable — the server's own cap and
      // the teacher-facing wording both assume some of these are innocent.
      if (vangMs < NGUONG_VANG_MS) return;

      gui('RETURNED', Math.round(vangMs / 1000));
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') roiDi('TAB_HIDDEN');
      else quayLai();
    };

    const onBlur = (): void => roiDi('WINDOW_BLUR');
    const onFocus = (): void => quayLai();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [lessonId, bat]);

  if (!bat) return null;

  return (
    <p className="m-0 flex items-start gap-2 rounded-nut border border-vien bg-the-mo px-3.5 py-2.5 text-sm text-chu-phu">
      <span aria-hidden="true">👀</span>
      <span>
        Trang này có ghi lại <strong className="text-chu">số lần em rời khỏi tab</strong> trong lúc
        học, để thầy cô biết lúc nào nên ghé hỏi thăm em. Hệ thống{' '}
        <strong className="text-chu">không biết em đã mở gì</strong> — và rời tab không phải là
        lỗi. Nếu em đang thấy khó ở chỗ nào, cứ nói với thầy cô nhé.
      </span>
    </p>
  );
}
