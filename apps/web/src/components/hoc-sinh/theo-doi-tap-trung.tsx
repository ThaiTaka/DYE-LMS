'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
 * The notice is also what earns the warning dialog below the right to be blunt.
 * A child who was told up front what is counted is being held to a rule they
 * were given; one who was not is being ambushed.
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

/** Tab-outs in this lesson before the student is stopped and told. */
const NGUONG_CANH_BAO = 2;

/** Where the count survives a reload when the server cannot be reached. */
const KHOA_LUU = 'dye:so-lan-roi-tab';

function docSoLanDaLuu(lessonId: string): number {
  try {
    const n = Number(window.localStorage.getItem(`${KHOA_LUU}:${lessonId}`));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    // Private mode, or site data blocked. The server count still works.
    return 0;
  }
}

function luuSoLan(lessonId: string, n: number): void {
  try {
    window.localStorage.setItem(`${KHOA_LUU}:${lessonId}`, String(n));
  } catch {
    // Nothing to do. This mirror is a convenience, not the source of truth.
  }
}

export function TheoDoiTapTrung({
  lessonId,
  bat,
}: {
  lessonId: string;
  /** False for teachers and admins previewing the lesson. */
  bat: boolean;
}) {
  /*
   * Tracking stays in refs. The lesson page holds a code editor with unsaved
   * work in it, and a re-render on every alt-tab is how a student loses what
   * they were typing.
   *
   * `soLanRoi` is the one exception, and it is deliberately narrow: it changes
   * only when the student crosses the threshold, which is rare, and this
   * component is a leaf — nothing of the editor is below it, so the re-render
   * stops here.
   */
  const roiLuc = useRef<number | null>(null);
  const guiLanCuoi = useRef(0);
  const demRef = useRef(0);

  const [soLanRoi, setSoLanRoi] = useState<number | null>(null);

  const dong = useCallback(() => setSoLanRoi(null), []);

  useEffect(() => {
    if (!bat || !lessonId) return;

    demRef.current = docSoLanDaLuu(lessonId);

    /**
     * Post one event and return what the server knows.
     *
     * Resolves `null` when the post was suppressed or failed, so the caller can
     * fall back to the locally held count rather than treating a dropped
     * request as "zero tab-outs".
     */
    const gui = async (
      loai: 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'RETURNED',
      awaySeconds?: number,
    ): Promise<number | null> => {
      const now = Date.now();
      if (now - guiLanCuoi.current < CHONG_TRUNG_MS) return null;
      guiLanCuoi.current = now;

      try {
        // A failure here must never reach the student — the action already
        // answers `{ ok: false }` rather than throwing, and this catch covers a
        // genuine network drop.
        const kq = await ghiNhanRoiTab({
          lessonId,
          loai,
          ...(awaySeconds !== undefined ? { awaySeconds } : {}),
        });
        if (!kq.ok) return null;

        // The server's count is the authoritative one: it survives a reload, a
        // different browser, and clearing site data.
        demRef.current = kq.soLanRoi;
        luuSoLan(lessonId, kq.soLanRoi);
        return kq.soLanRoi;
      } catch {
        return null;
      }
    };

    const roiDi = (loai: 'TAB_HIDDEN' | 'WINDOW_BLUR'): void => {
      if (roiLuc.current !== null) return; // already away
      roiLuc.current = Date.now();
      void gui(loai);
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

      void gui('RETURNED', Math.round(vangMs / 1000)).then((tuMayChu) => {
        /*
         * Count the departure locally when the server did not answer with one.
         * A student who is offline, or whose RETURNED was deduped, still left
         * the screen — silently dropping it would make the dialog avoidable by
         * going offline first.
         */
        const dem = tuMayChu ?? demRef.current + 1;
        if (tuMayChu === null) {
          demRef.current = dem;
          luuSoLan(lessonId, dem);
        }

        if (dem >= NGUONG_CANH_BAO) setSoLanRoi(dem);
      });
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
    <>
      <p className="m-0 flex items-start gap-2 rounded-nut border border-vien bg-the-mo px-3.5 py-2.5 text-sm text-chu-phu">
        <span aria-hidden="true">👀</span>
        <span>
          Trang này có ghi lại <strong className="text-chu">số lần em rời khỏi tab</strong> trong
          lúc học, để thầy cô biết lúc nào nên ghé hỏi thăm em. Hệ thống{' '}
          <strong className="text-chu">không biết em đã mở gì</strong> — và rời tab không phải là
          lỗi. Nếu em đang thấy khó ở chỗ nào, cứ nói với thầy cô nhé.
        </span>
      </p>

      {soLanRoi !== null ? <CanhBaoRoiTab soLan={soLanRoi} onDong={dong} /> : null}
    </>
  );
}

/**
 * The blocking warning.
 *
 * ── On the wording ───────────────────────────────────────────────────────────
 * Every claim in here is one the system actually carries out. The count is
 * real, it is written to the student's record, and it does reach the teacher's
 * alerts page — so the dialog can say so plainly.
 *
 * It does NOT claim the system is filming the student, and it does not threaten
 * an automatic zero. There is no camera anywhere in this codebase and nothing
 * locks or zeroes work over a tab-out, and a warning that tells a 12-year-old
 * they are being filmed when they are not is a lie told to a child by their
 * school. The tone stays strict; the facts stay true. If a lock-and-zero rule
 * is ever built, this text should be updated to match it — not before.
 *
 * ── On being blocking ────────────────────────────────────────────────────────
 * A plain `div` with `role="alertdialog"`, not `<dialog>`: `showModal()` is
 * uneven across the browsers on a school laptop, and this needs to behave the
 * same everywhere. Escape is deliberately swallowed and there is no backdrop
 * close, so the acknowledgement button is the only way out.
 */
function CanhBaoRoiTab({ soLan, onDong }: { soLan: number; onDong: () => void }) {
  const nut = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    nut.current?.focus();

    const onKey = (e: KeyboardEvent): void => {
      // No Escape hatch: the student has to acknowledge it.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Keep Tab inside the dialog. With one button that is a short loop, but
      // without it focus walks off into the lesson behind the overlay, where a
      // keyboard user could still edit code they are supposedly blocked from.
      if (e.key === 'Tab') {
        e.preventDefault();
        nut.current?.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="canh-bao-roi-tab-tieu-de"
        aria-describedby="canh-bao-roi-tab-noi-dung"
        className="w-full max-w-lg rounded-nut border-2 border-thu-lai bg-the p-6 shadow-2xl"
      >
        <h2 id="canh-bao-roi-tab-tieu-de" className="mt-0 mb-3 text-xl font-bold text-thu-lai">
          <span aria-hidden="true">🚨 </span>CẢNH BÁO TỪ HỆ THỐNG
        </h2>

        <p id="canh-bao-roi-tab-noi-dung" className="mt-0 mb-5 text-chu">
          Bạn đã rời khỏi màn hình làm bài <strong>{soLan} lần</strong>! Hệ thống DYE LMS đang ghi
          nhận và giám sát quá trình làm bài. Số lần rời màn hình được gửi trực tiếp đến giáo viên
          quản lý, và giáo viên sẽ xem xét bài làm của bạn!
        </p>

        <button
          ref={nut}
          type="button"
          onClick={onDong}
          className="min-h-cham w-full rounded-nut bg-thu-lai px-5 py-3 font-semibold text-white hover:opacity-90"
        >
          Tôi Đã Hiểu Và Sẽ Không Vi Phạm
        </button>
      </div>
    </div>
  );
}
