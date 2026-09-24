'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * A copy of the student's code in the browser, for when the server cannot be
 * reached.
 *
 * ── Why a second copy, when autosave already exists ──────────────────────────
 * `useTuLuu` saves to the server 1.5 s after typing stops — but a server save
 * needs the network. A school's Wi-Fi dropping for ten minutes while a child
 * keeps typing, then the lid closing, loses all ten minutes: the pagehide
 * flush is a request that never arrives. `localStorage` is written
 * synchronously and survives all of that, so it is the net under the net.
 *
 * ── Every three seconds while typing, not on every keystroke ─────────────────
 * A throttle rather than a debounce: a student typing steadily for a minute
 * still gets a copy every three seconds, instead of one only when they pause.
 * Plus an immediate write when the tab is hidden or closed.
 *
 * ── Keyed by student AND block ───────────────────────────────────────────────
 * School laptops are shared. A key without the student id would offer the next
 * child on the machine the previous child's solution. With no student id there
 * is no copy at all — never a shared one.
 *
 * ── Deleted as soon as the server has it ─────────────────────────────────────
 * The copy only needs to exist while it is AHEAD of the server. Once autosave
 * confirms the same text, it is removed — which keeps a student's code off a
 * shared machine's disk for all but the minutes it is actually needed.
 */

/** Throttle for writes while typing. */
export const CHU_KY_LUU_CUC_BO_MS = 3000;

export interface BanSaoCucBo {
  v: 1;
  code: string;
  /** Browser clock when this copy was written. */
  luuLuc: number;
  /**
   * The server draft's `updatedAt` (ISO) that this copy was typed on top of,
   * or null when the server had no draft yet. Comparing this against the
   * server's current timestamp is what makes "newer than the server" work
   * without trusting a school laptop's clock.
   */
  coSo: string | null;
}

export function khoaBanSao(hocSinhId: string, blockId: string): string {
  return `dye:ban-sao:v1:${hocSinhId}:${blockId}`;
}

/*
 * Storage can be missing (private mode), full, or switched off by a school
 * image. Every access is wrapped: a backup that throws would take down the
 * editor it exists to protect.
 */

export function docBanSao(khoa: string): BanSaoCucBo | null {
  try {
    const raw = window.localStorage.getItem(khoa);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<BanSaoCucBo> | null;
    if (
      v?.v !== 1 ||
      typeof v.code !== 'string' ||
      typeof v.luuLuc !== 'number' ||
      (v.coSo !== null && typeof v.coSo !== 'string')
    ) {
      return null;
    }
    return { v: 1, code: v.code, luuLuc: v.luuLuc, coSo: v.coSo };
  } catch {
    return null;
  }
}

export function ghiBanSao(khoa: string, banSao: BanSaoCucBo): void {
  try {
    window.localStorage.setItem(khoa, JSON.stringify(banSao));
  } catch {
    // Quota or disabled storage. The server autosave is still running.
  }
}

export function xoaBanSao(khoa: string): void {
  try {
    window.localStorage.removeItem(khoa);
  } catch {
    // Nothing to do; the next successful write replaces it anyway.
  }
}

/**
 * Should the editor offer to bring the browser copy back?
 *
 * Only when it holds something the server does not:
 *   • it differs from what the server sent, and is not empty;
 *   • and it is AHEAD of the server — either the server has no draft at all,
 *     or the server's draft is still the exact one this copy was typed on top
 *     of (so the edits never reached it), or, failing both, the copy is newer
 *     by the clock.
 *
 * The middle test is the one that does the work: it needs no clock, so a
 * laptop whose time is ten minutes off still gets the right answer. The clock
 * is the fallback for a copy written before the server's version was known.
 */
export function nenKhoiPhuc(
  banSao: BanSaoCucBo | null,
  maMayChu: string,
  luuLucMayChu: string | null,
): boolean {
  if (!banSao) return false;
  if (banSao.code === maMayChu || banSao.code.trim() === '') return false;
  if (luuLucMayChu === null) return true;
  if (banSao.coSo === luuLucMayChu) return true;
  const moc = Date.parse(luuLucMayChu);
  return Number.isFinite(moc) && banSao.luuLuc > moc;
}

type DongHo = { current: ReturnType<typeof setTimeout> | null };

function huyHen(dongHo: DongHo): void {
  if (dongHo.current) clearTimeout(dongHo.current);
  dongHo.current = null;
}

export interface BanSaoHook {
  /** Call on every edit; writes at most once per `CHU_KY_LUU_CUC_BO_MS`. */
  ghiNhan: (code: string) => void;
  /** The server now holds `code`. Drops the copy unless newer text is pending. */
  daDongBo: (code: string) => void;
  /** Forget the copy outright — dismissed, or handed in. */
  xoa: () => void;
}

/**
 * The write side. `khoa` null means "no backup for this editor" and turns every
 * call into a no-op; `coSo` is read at write time so a copy always records the
 * server version it was typed on top of.
 */
export function useBanSaoCucBo(khoa: string | null, coSo: string | null): BanSaoHook {
  const dongHo = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Newest text not yet written to storage. */
  const choGhi = useRef<string | null>(null);
  const coSoRef = useRef(coSo);
  coSoRef.current = coSo;

  const ghiNgay = useCallback(() => {
    huyHen(dongHo);
    if (!khoa || choGhi.current === null) return;
    ghiBanSao(khoa, { v: 1, code: choGhi.current, luuLuc: Date.now(), coSo: coSoRef.current });
    choGhi.current = null;
  }, [khoa]);

  const ghiNhan = useCallback(
    (code: string) => {
      if (!khoa) return;
      choGhi.current = code;
      // Throttle: one write is already booked, and it will take the newest text.
      if (dongHo.current) return;
      dongHo.current = setTimeout(ghiNgay, CHU_KY_LUU_CUC_BO_MS);
    },
    [khoa, ghiNgay],
  );

  const daDongBo = useCallback(
    (code: string) => {
      if (!khoa) return;
      // Typed again since that save went out: the booked write must still land.
      if (choGhi.current !== null && choGhi.current !== code) return;
      // A slow save can confirm text OLDER than what storage already holds —
      // the student kept typing and the three-second write got there first.
      // That copy is ahead of the server; it stays.
      const daGhi = docBanSao(khoa);
      if (choGhi.current === null && daGhi && daGhi.code !== code) return;
      huyHen(dongHo);
      choGhi.current = null;
      xoaBanSao(khoa);
    },
    [khoa],
  );

  const xoa = useCallback(() => {
    huyHen(dongHo);
    choGhi.current = null;
    if (khoa) xoaBanSao(khoa);
  }, [khoa]);

  // A hidden or closing tab writes now — localStorage is synchronous, so this
  // lands even when the network request beside it never does.
  useEffect(() => {
    const khiDoiHienThi = (): void => {
      if (document.visibilityState === 'hidden') ghiNgay();
    };
    document.addEventListener('visibilitychange', khiDoiHienThi);
    window.addEventListener('pagehide', ghiNgay);
    return () => {
      document.removeEventListener('visibilitychange', khiDoiHienThi);
      window.removeEventListener('pagehide', ghiNgay);
      ghiNgay();
    };
  }, [ghiNgay]);

  // Stable identity, so callers can list it as an effect dependency without
  // that effect re-running on every render.
  return useMemo(() => ({ ghiNhan, daDongBo, xoa }), [ghiNhan, daDongBo, xoa]);
}
