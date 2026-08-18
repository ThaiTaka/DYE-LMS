'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { tuDongLuu, type KetQuaLuu } from '@/app/bai-hoc/[slug]/code-actions';

/** Quiet by default; the indicator only speaks up when it has something to say. */
export type TrangThaiLuu = 'nghi' | 'cho' | 'dang-luu' | 'da-luu' | 'loi';

export interface TuLuu {
  trangThai: TrangThaiLuu;
  luuLuc: Date | null;
  thongDiep: string;
  /** Call on every keystroke; the hook does the debouncing. */
  ghiNhan: (code: string) => void;
  /** Force an immediate save — used before submitting or leaving. */
  luuNgay: (code: string) => Promise<void>;
}

/**
 * Debounced autosave.
 *
 * ── Why 1.5 s ────────────────────────────────────────────────────────────────
 * Long enough that ordinary typing does not generate a request per word, short
 * enough that a slammed laptop lid costs at most a sentence. The brief asks for
 * 1000–2000 ms; this sits in the middle.
 *
 * ── What makes it resilient rather than merely periodic ──────────────────────
 *   • The last text sent is remembered, so a timer firing on unchanged content
 *     never leaves the browser. The server checks again by hash; this is the
 *     cheaper first line of the same defence.
 *   • `visibilitychange` and `pagehide` flush immediately. A closed tab, a
 *     locked Chromebook and a dead battery all surface as one of those two, and
 *     they are the failure the brief actually cares about.
 *   • Saves are serialised. Two in flight can otherwise land out of order and
 *     leave the older text as the stored draft.
 */
export function useTuLuu(blockId: string, doTre = 1500): TuLuu {
  const [trangThai, setTrangThai] = useState<TrangThaiLuu>('nghi');
  const [luuLuc, setLuuLuc] = useState<Date | null>(null);
  const [thongDiep, setThongDiep] = useState('');

  const dongHo = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Latest text the student has typed. */
  const moiNhat = useRef<string>('');
  /** Last text we actually sent, so an unchanged body is never re-sent. */
  const daGui = useRef<string | null>(null);
  const dangChay = useRef(false);
  const conSong = useRef(true);

  const ganKetQua = useCallback((kq: KetQuaLuu) => {
    if (!conSong.current) return;

    if (kq.trangThai === 'da-luu' || kq.trangThai === 'khong-doi') {
      setTrangThai('da-luu');
      setThongDiep('');
      if (kq.luuLuc) setLuuLuc(new Date(kq.luuLuc));
      return;
    }

    setTrangThai('loi');
    setThongDiep(kq.thongDiep);
  }, []);

  const guiDi = useCallback(
    async (code: string) => {
      // Serialised: a second save waits for the first to land, so the newest
      // text cannot be overwritten by a slower earlier request.
      if (dangChay.current) return;
      if (daGui.current === code) {
        if (conSong.current) setTrangThai('da-luu');
        return;
      }

      dangChay.current = true;
      if (conSong.current) setTrangThai('dang-luu');

      try {
        const kq = await tuDongLuu(blockId, code);
        daGui.current = code;
        ganKetQua(kq);
      } catch {
        if (conSong.current) {
          setTrangThai('loi');
          setThongDiep('Chưa lưu được. Hệ thống sẽ tự thử lại.');
        }
      } finally {
        dangChay.current = false;
        // Anything typed while that request was in flight goes now.
        if (moiNhat.current !== code && conSong.current) {
          void guiDi(moiNhat.current);
        }
      }
    },
    [blockId, ganKetQua],
  );

  const ghiNhan = useCallback(
    (code: string) => {
      moiNhat.current = code;

      if (daGui.current === code) {
        // Typed back to exactly what is stored — nothing to do, and the pending
        // timer would only produce a no-op request.
        if (dongHo.current) clearTimeout(dongHo.current);
        setTrangThai('da-luu');
        return;
      }

      setTrangThai('cho');
      if (dongHo.current) clearTimeout(dongHo.current);
      dongHo.current = setTimeout(() => void guiDi(code), doTre);
    },
    [doTre, guiDi],
  );

  const luuNgay = useCallback(
    async (code: string) => {
      if (dongHo.current) clearTimeout(dongHo.current);
      moiNhat.current = code;
      await guiDi(code);
    },
    [guiDi],
  );

  useEffect(() => {
    conSong.current = true;

    // The tab-closing path. `visibilitychange` fires on a lid close, an app
    // switch and a tab change; `pagehide` covers navigation away. Between them
    // they catch the cases a student will actually hit.
    const khiRoiTrang = (): void => {
      if (dongHo.current) clearTimeout(dongHo.current);
      if (moiNhat.current && daGui.current !== moiNhat.current) {
        void tuDongLuu(blockId, moiNhat.current);
        daGui.current = moiNhat.current;
      }
    };

    const khiDoiHienThi = (): void => {
      if (document.visibilityState === 'hidden') khiRoiTrang();
    };

    document.addEventListener('visibilitychange', khiDoiHienThi);
    window.addEventListener('pagehide', khiRoiTrang);

    return () => {
      conSong.current = false;
      document.removeEventListener('visibilitychange', khiDoiHienThi);
      window.removeEventListener('pagehide', khiRoiTrang);
      if (dongHo.current) clearTimeout(dongHo.current);
    };
  }, [blockId]);

  return { trangThai, luuLuc, thongDiep, ghiNhan, luuNgay };
}
