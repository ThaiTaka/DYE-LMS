'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ghiNhanRoiTab, khoaBaiViPham } from '@/app/bai-hoc/[slug]/giam-sat-actions';

import { dangTrongIframe } from './tieu-diem';

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
 * were given; one who was not is being ambushed. Now that a tab-out can END in a
 * zero, the notice carries BOTH numbers — a rule with a real penalty has to be
 * stated before it is applied, not after.
 *
 * ── Two thresholds ───────────────────────────────────────────────────────────
 *   NGUONG_CANH_BAO   the blocking dialog. The last moment the outcome can
 *                     still change, so it leads with the count and the limit.
 *   NGUONG_KHOA       the lesson locks at zero. The server decides this, not
 *                     this file — see below.
 *
 * ── Which side decides ───────────────────────────────────────────────────────
 * The LOCK is decided entirely by the server: `khoaBaiViPham` re-counts
 * FocusEvent rows itself and refuses anything under the threshold, so the number
 * held here can never zero a lesson early. The local count still drives the
 * WARNING, and still counts up while offline, because a dialog that could be
 * skipped by pulling the network cable would be worthless — but a warning shown
 * wrongly costs a child an interruption, while a lock applied wrongly costs them
 * their work. The two are trusted differently on purpose.
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

/**
 * Tab-outs before the student is stopped and told.
 *
 * The real value arrives as a prop from the server component, which reads it
 * from @dye/core — the same module the lock enforces from. This constant is only
 * the fallback for a caller that passes nothing, and it matches the core default
 * so the two can never disagree silently.
 */
const NGUONG_CANH_BAO_MAC_DINH = 5;

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
  blockId,
  nguongNhac = NGUONG_CANH_BAO_MAC_DINH,
  nguongKhoa = 20,
}: {
  lessonId: string;
  /** False for teachers and admins previewing the lesson. */
  bat: boolean;
  /** The code block in view. Recorded on the zeroed submission if it locks. */
  blockId?: string | undefined;
  /*
   * Both numbers come from @dye/core through the server component that renders
   * this, so what a student is SHOWN and what the server ENFORCES are the same
   * value. A client bundle restating them would be free to drift — and the
   * failure mode of drift is a child locked without ever seeing a warning.
   */
  nguongNhac?: number;
  nguongKhoa?: number;
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
  /** Set once the lock has been asked for, so it is asked for exactly once. */
  const daXinKhoa = useRef(false);

  const [soLanRoi, setSoLanRoi] = useState<number | null>(null);
  const [daKhoa, setDaKhoa] = useState(false);

  const router = useRouter();

  const dong = useCallback(() => setSoLanRoi(null), []);

  /**
   * Ask the server to lock the lesson at zero.
   *
   * ── The browser asks; the server decides ─────────────────────────────────
   * There is no count in this request and there must never be one. The action
   * re-counts FocusEvent rows for this student and refuses when its own total is
   * under the threshold, so the worst a tampered client achieves by calling this
   * early is one wasted query. `dangKhoa: false` means the server said no, and
   * the flag is re-armed so a genuinely later crossing can still ask.
   */
  const xinKhoa = useCallback(async () => {
    if (daXinKhoa.current) return;
    daXinKhoa.current = true;

    const kq = await khoaBaiViPham({
      lessonId,
      ...(blockId ? { blockId } : {}),
    }).catch(() => null);

    if (!kq?.dangKhoa) {
      daXinKhoa.current = false;
      return;
    }

    setSoLanRoi(null);
    setDaKhoa(true);
    /*
     * Re-render the lesson from the server.
     *
     * The overlay below lands instantly but is only a cover; the panel that
     * REPLACES each editor is server-rendered from the lock row. Without this
     * the student sits behind a dialog with live editors underneath it until
     * they navigate.
     */
    router.refresh();
  }, [lessonId, blockId, router]);

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

        /*
         * The lock is asked for only on a count the SERVER gave us.
         *
         * The offline fallback above is deliberately good enough to raise the
         * warning — a student must not be able to dodge the dialog by pulling
         * the network cable — but it is not good enough to zero a lesson. A
         * locally incremented number reflects nothing the server has recorded,
         * and acting on it would mean a flaky connection could cost a child
         * their work. When the server is reachable it answers with its own
         * count, and only that number reaches here.
         */
        if (tuMayChu !== null && dem >= nguongKhoa) {
          void xinKhoa();
          return;
        }

        if (dem >= nguongNhac) setSoLanRoi(dem);
      });
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') roiDi('TAB_HIDDEN');
      else quayLai();
    };

    /*
     * A blur is judged one tick later, not on arrival.
     *
     * Clicking into the MakeCode iframe on this very page fires `blur` on the
     * window exactly as switching to another app does. The two are told apart
     * only by where focus LANDED, and that is not yet set when the event fires
     * — see `dangTrongIframe`. A real departure loses nothing to the delay: a
     * tab switch is caught by `visibilitychange` on its own, and a bare blur
     * still opens the episode a millisecond later.
     */
    let henBlur: ReturnType<typeof setTimeout> | null = null;
    const onBlur = (): void => {
      if (henBlur !== null) clearTimeout(henBlur);
      henBlur = setTimeout(() => {
        henBlur = null;
        if (dangTrongIframe()) return; // still in the lesson, inside the editor
        roiDi('WINDOW_BLUR');
      }, 0);
    };
    const onFocus = (): void => quayLai();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    return () => {
      if (henBlur !== null) clearTimeout(henBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [lessonId, bat, nguongNhac, nguongKhoa, xinKhoa]);

  if (!bat) return null;

  return (
    <>
      <p className="m-0 flex items-start gap-2 rounded-nut border border-vien bg-the-mo px-3.5 py-2.5 text-sm text-chu-phu">
        <span aria-hidden="true">👀</span>
        <span>
          Trang này có ghi lại <strong className="text-chu">số lần em rời khỏi tab</strong> trong
          lúc học. Tới <strong className="text-chu">{nguongNhac} lần</strong> hệ thống sẽ nhắc em,
          tới <strong className="text-chu">{nguongKhoa} lần</strong> bài sẽ bị khoá và tính 0 điểm
          cho tới khi thầy cô mở lại. Hệ thống{' '}
          <strong className="text-chu">không biết em đã mở gì</strong> — nếu em đang thấy khó ở chỗ
          nào, cứ nói với thầy cô nhé.
        </span>
      </p>

      {soLanRoi !== null ? (
        <CanhBaoRoiTab soLan={soLanRoi} gioiHan={nguongKhoa} onDong={dong} />
      ) : null}

      {/*
        The instant the lock lands.

        `router.refresh()` is a round trip, and until it returns the page still
        holds live editors. This covers them immediately, so a student cannot
        type one more line into work that has already been voided — and so the
        news does not arrive as a silent change under their cursor.
      */}
      {daKhoa ? <DaBiKhoa /> : null}
    </>
  );
}

/**
 * The lock overlay.
 *
 * Not an `alertdialog` and not focus-trapped, unlike the warning above: there is
 * nothing to acknowledge and no decision to make, and trapping focus in a box a
 * student cannot dismiss would leave a keyboard user stuck on a page they are
 * meant to be able to leave. `role="alert"` announces it once; the lesson
 * underneath re-renders into its locked state a moment later.
 */
function DaBiKhoa() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-lg rounded-nut border-2 border-thu-lai bg-the p-6 text-center shadow-2xl">
        <p aria-hidden="true" className="m-0 text-4xl">
          🔒
        </p>
        <h2 className="mt-3 mb-2 text-2xl font-bold text-thu-lai">Bài này đã bị khoá</h2>
        <p className="m-0 text-chu">
          Hệ thống ghi nhận em rời khỏi bài quá số lần cho phép, nên bài này bị tính 0 điểm. Thầy cô
          đã nhận được thông báo — em nói với thầy cô để được mở lại nhé.
        </p>
      </div>
    </div>
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
 * It does NOT claim the system is filming the student. There is no camera
 * anywhere in this codebase, and a warning that tells a 12-year-old they are
 * being filmed when they are not is a lie told to a child by their school.
 *
 * It DOES now state the automatic zero, because as of the 5/20 escalation the
 * system carries that out: at `gioiHan` tab-outs the lesson locks, the work is
 * scored zero, and only a teacher can lift it. The previous version of this
 * comment said the text should be updated if a lock-and-zero rule was ever
 * built. It has been, so this is that update — and stating it here is the whole
 * reason the dialog exists, since this is the last point at which a student can
 * still act on the information.
 *
 * The tone stays strict; the facts stay true. What it does not do is accuse:
 * the browser reports that a tab was hidden and nothing else, so the text says
 * what was COUNTED and what will HAPPEN, never what the student was doing.
 *
 * ── On being blocking ────────────────────────────────────────────────────────
 * A plain `div` with `role="alertdialog"`, not `<dialog>`: `showModal()` is
 * uneven across the browsers on a school laptop, and this needs to behave the
 * same everywhere. Escape is deliberately swallowed and there is no backdrop
 * close, so the acknowledgement button is the only way out.
 */
function CanhBaoRoiTab({
  soLan,
  gioiHan,
  onDong,
}: {
  soLan: number;
  /** The tab-out count at which the lesson locks at zero. */
  gioiHan: number;
  onDong: () => void;
}) {
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

        <div id="canh-bao-roi-tab-noi-dung" className="mt-0 mb-5 space-y-3 text-chu">
          <p className="m-0">
            Bạn đã rời khỏi màn hình làm bài <strong>{soLan} lần</strong>! Hệ thống DYE LMS đang ghi
            nhận và giám sát quá trình làm bài. Số lần rời màn hình được gửi trực tiếp đến giáo viên
            quản lý, và giáo viên sẽ xem xét bài làm của bạn!
          </p>
          <p className="m-0">
            Nếu bạn rời khỏi màn hình <strong>{gioiHan} lần</strong>, bài này sẽ{' '}
            <strong>tự động bị khoá và tính 0 điểm</strong>, và chỉ giáo viên mới mở lại được.
          </p>
          <p className="m-0">
            Hệ thống chỉ đếm số lần, <strong>không biết bạn đã mở gì</strong>. Nếu bạn đang tra cứu
            hoặc đang gặp khó, hãy hỏi thầy cô — nhanh hơn nhiều.
          </p>
        </div>

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
