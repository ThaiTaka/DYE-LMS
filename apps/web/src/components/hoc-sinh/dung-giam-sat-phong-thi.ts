'use client';

import { useEffect, useRef } from 'react';

import { baoViPham, type KetQuaViPhamUI } from '@/app/kiem-tra/[slug]/actions';

import { dangTrongIframe } from './tieu-diem';

/**
 * The exam room's lockdown hook.
 *
 * ── What it watches ──────────────────────────────────────────────────────────
 *   visibilitychange → hidden   tab switch, minimise, screen lock
 *   blur                        another window took focus (ours still visible)
 *   fullscreenchange → exited   Esc, F11, or the OS pulling the window out
 *
 * ── The one thing it must get right: an episode, not an event ────────────────
 * A single Alt-Tab in fullscreen fires ALL THREE of the above, in an order
 * that varies by browser and OS. Reporting each one would put a student on
 * strike three — past a two-strike lock — for pressing Alt-Tab once.
 *
 * So this hook tracks a DEPARTURE EPISODE: the first leave-signal opens it
 * and sends exactly one report, carrying the kind of that first signal; every
 * further signal while the episode is open is ignored; and the episode closes
 * only when the page is visible AND focused AND fullscreen again. The next
 * departure after that is a new episode and a new report.
 *
 * The server dedupes again on its own clock (`DEDUP_VI_PHAM_MS` in @dye/core).
 * Both layers are needed: this one keeps the request count sane, that one is
 * the one that cannot be edited in devtools.
 *
 * ── The blur grace, and why it applies to blur only ──────────────────────────
 * `blur` on its own — window still visible, still fullscreen — is the signal
 * with the most innocent causes: a Vietnamese IME's candidate popup, a
 * password manager, a notification toast. Those take focus for a few hundred
 * milliseconds and give it back. A bare blur therefore waits NGUONG_BLIP_MS;
 * if focus returns inside that window, nothing is reported. A hidden tab or an
 * exited fullscreen is unambiguous and is reported at once.
 *
 * ── No React state ───────────────────────────────────────────────────────────
 * Everything is in refs. The exam page holds the student's answers, and a
 * re-render on every focus flicker is a way to lose one mid-keystroke. The
 * caller learns what happened through `onKetQua`, which fires only when the
 * server has answered — a handful of times per sitting at most.
 */

/** A bare blur shorter than this is a popup, not a departure. */
export const NGUONG_BLIP_MS = 800;

export type LoaiRoiDi = 'FULLSCREEN_EXIT' | 'TAB_HIDDEN' | 'WINDOW_BLUR';

export interface TuyChonGiamSat {
  /** The attempt to report against. Null disarms the hook entirely. */
  attemptId: string | null;
  /** Called with the server's answer to each report. */
  onKetQua: (kq: KetQuaViPhamUI) => void;
  /** The exam room element, so "still fullscreen" can be checked. */
  goc: React.RefObject<HTMLElement | null>;
}

function dangFullscreen(goc: HTMLElement | null): boolean {
  if (typeof document === 'undefined') return false;
  const fs = document.fullscreenElement;
  return fs !== null && (goc === null || fs === goc || goc.contains(fs));
}

export function useGiamSatPhongThi({ attemptId, onKetQua, goc }: TuyChonGiamSat): void {
  /** An episode is open: the student has left and not fully come back. */
  const dangVang = useRef(false);
  /** Pending bare-blur report, cancelled if focus returns in time. */
  const henBlur = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Read at event time, so a fresh closure never goes stale in a listener. */
  const ketQuaRef = useRef(onKetQua);
  ketQuaRef.current = onKetQua;

  useEffect(() => {
    if (!attemptId) return;

    const huyHenBlur = (): void => {
      if (henBlur.current !== null) {
        clearTimeout(henBlur.current);
        henBlur.current = null;
      }
    };

    /** Open the episode and send its one report. */
    const roiDi = (loai: LoaiRoiDi): void => {
      huyHenBlur();
      if (dangVang.current) return; // Already away: this is the same departure.
      dangVang.current = true;

      // Fire and forget. The action answers a result object rather than
      // throwing; this catch covers a genuine network drop.
      void baoViPham(attemptId, loai)
        .then((kq) => ketQuaRef.current(kq))
        .catch(() => undefined);
    };

    /** Close the episode — but only once EVERYTHING is back. */
    const thuQuayLai = (): void => {
      huyHenBlur();
      if (!dangVang.current) return;
      const veRoi =
        document.visibilityState === 'visible' &&
        document.hasFocus() &&
        dangFullscreen(goc.current);
      if (veRoi) dangVang.current = false;
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') roiDi('TAB_HIDDEN');
      else thuQuayLai();
    };

    const onBlur = (): void => {
      if (dangVang.current) return;
      huyHenBlur();

      /*
       * Every blur is judged on a timer now, never on arrival.
       *
       * Where focus went is only knowable after a tick — the spec fires blur
       * BEFORE the new focused area is set — and "into one of our own iframes"
       * is the one destination that is not a departure at all: a student
       * clicking a block in an embedded editor is inside the exam, not outside
       * it. Reading `activeElement` synchronously here would never see it.
       *
       * The unambiguous case (page hidden, or fullscreen already gone) keeps
       * its immediate verdict, one tick late. The ambiguous case — still
       * visible, still fullscreen — keeps the full grace period, in which the
       * page has to have genuinely lost focus before it counts.
       */
      const roRang = document.visibilityState === 'hidden' || !dangFullscreen(goc.current);
      henBlur.current = setTimeout(
        () => {
          henBlur.current = null;
          if (dangTrongIframe()) return;
          if (roRang || !document.hasFocus()) roiDi('WINDOW_BLUR');
        },
        roRang ? 0 : NGUONG_BLIP_MS,
      );
    };

    const onFocus = (): void => thuQuayLai();

    const onFullscreen = (): void => {
      if (dangFullscreen(goc.current)) thuQuayLai();
      else roiDi('FULLSCREEN_EXIT');
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      huyHenBlur();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      dangVang.current = false;
    };
  }, [attemptId, goc]);
}
