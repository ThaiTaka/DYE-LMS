'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ghiNhanRoiTab, khoaBaiViPham } from '@/app/(hoc-sinh)/bai-hoc/[slug]/giam-sat-actions';

import { dangMoHopChonTep } from './tieu-diem';

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
 * ── What the browser is asked, and what it is not ────────────────────────────
 * ONE signal: `visibilitychange`, and only its `hidden` state. A tab switch, a
 * minimise, a phone screen lock — everything that means the lesson is no
 * longer on the student's screen — arrives as `hidden`.
 *
 * `window.blur` is deliberately NOT listened to any more. It fires for the
 * address bar, a bookmark, a browser extension popup, the OS file picker, a
 * Vietnamese IME candidate window, a notification toast, and every click into
 * the MakeCode iframe — none of which is a student leaving the lesson, and
 * every one of which was being posted to the server as a departure the moment
 * it fired. The blip filter that followed only dropped the RETURNED row; the
 * leave row had already been counted. That is how a child who never left the
 * page reached "5 lần" and the dialog. What blur adds over `hidden` — a second
 * window on a second monitor — is not worth a false accusation at a
 * ten-year-old.
 *
 * ── Nothing is posted until the departure is confirmed ───────────────────────
 * `hidden` starts a timer, and only if the tab is STILL hidden after
 * NGUONG_VANG_MS does the leave go on the wire. A transient hide — the OS
 * switcher flashing past, a system dialog, a phone notification shade pulled
 * and let go — comes back inside the grace and is never a row anywhere. The
 * matching `RETURNED` on the way back carries the duration; the two are one
 * trip, and the trip is the unit the thresholds count.
 *
 * ── The file picker ──────────────────────────────────────────────────────────
 * "Nộp tệp .hex" opens the OS file dialog, which on Android hides the tab.
 * The upload component flags that through `batDauChonTep` and the `hidden`
 * it causes is ignored here — see `dangMoHopChonTep` in tieu-diem.ts.
 *
 * The server dedupes again on its own clock (`DEDUP_MS` in @dye/core). Both
 * layers are needed — this one keeps the request count sane, that one is the
 * one that cannot be edited in devtools.
 */

/**
 * How long the tab must stay hidden before it counts as leaving.
 *
 * Nothing at all is sent below this — not the leave, not the return. The old
 * value (1 200 ms) only suppressed the RETURNED row after a leave had already
 * been posted, which is the bug this rewrite exists for.
 */
export const NGUONG_VANG_MS = 1500;

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
  /** When the tab went hidden. Null while it is on screen. */
  const roiLuc = useRef<number | null>(null);
  /** The grace timer for the current hide; fires only if still hidden. */
  const henXacNhan = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The current departure was confirmed and posted; a RETURNED must follow. */
  const daBaoRoi = useRef(false);
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
      loai: 'TAB_HIDDEN' | 'RETURNED',
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

    const huyHen = (): void => {
      if (henXacNhan.current !== null) {
        clearTimeout(henXacNhan.current);
        henXacNhan.current = null;
      }
    };

    /**
     * The grace period ran out with the tab still hidden: this is a departure.
     *
     * Checked against the live `visibilityState` rather than trusted from the
     * timer alone — a `visible` that raced the timer is not a trip.
     */
    const xacNhanRoiDi = (): void => {
      henXacNhan.current = null;
      if (roiLuc.current === null || document.visibilityState !== 'hidden') return;
      daBaoRoi.current = true;
      void gui('TAB_HIDDEN');
    };

    const roiDi = (): void => {
      if (roiLuc.current !== null) return; // already away
      // The OS file dialog covering the tab. The student is doing what the
      // page asked; nothing starts, and the return below has nothing to close.
      if (dangMoHopChonTep()) return;
      roiLuc.current = Date.now();
      daBaoRoi.current = false;
      huyHen();
      henXacNhan.current = setTimeout(xacNhanRoiDi, NGUONG_VANG_MS);
    };

    const quayLai = (): void => {
      const luc = roiLuc.current;
      if (luc === null) return;
      roiLuc.current = null;
      huyHen();

      const vangMs = Date.now() - luc;
      const daBao = daBaoRoi.current;
      daBaoRoi.current = false;

      /*
       * Back inside the grace: nothing was posted, so there is nothing to
       * close and nothing to count. This is the whole point of the timer — a
       * blink is not a row anywhere, not on the server and not in this tab.
       */
      if (!daBao || vangMs < NGUONG_VANG_MS) return;

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

    /*
     * The only listener. `window.blur` / `window.focus` are gone on purpose —
     * see the header comment for the list of innocent things that fire blur.
     */
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') roiDi();
      else quayLai();
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      huyHen();
      document.removeEventListener('visibilitychange', onVisibility);
      roiLuc.current = null;
      daBaoRoi.current = false;
    };
  }, [lessonId, bat, nguongNhac, nguongKhoa, xinKhoa]);

  if (!bat) return null;

  return (
    <>
      {/*
        A warning, and drawn as one.

        This was the same grey box as a study tip, so students skimmed a rule
        that can zero their lesson as if it were a tip. The heavy left rule and
        orange tint (see `--color-canh-bao` in globals.css) mark it as "this has
        consequences" before a word of it is read. `role="note"`, not `alert`:
        it is standing information on page load, not an event, and must not
        interrupt a screen reader on every visit.
      */}
      <div
        role="note"
        aria-label="Lưu ý về việc rời khỏi tab"
        className="flex items-start gap-3 rounded-r-nut border-l-4 border-canh-bao bg-canh-bao/10 px-4 py-3 text-sm text-canh-bao-chu"
      >
        <span aria-hidden="true" className="text-base leading-6">
          ⚠️
        </span>
        <p className="m-0">
          <strong className="font-bold text-canh-bao">Đừng rời khỏi tab này.</strong> Trang này có
          ghi lại <strong className="text-chu">số lần em rời khỏi tab</strong> trong lúc học. Tới{' '}
          <strong className="text-chu">{nguongNhac} lần</strong> hệ thống sẽ nhắc em, tới{' '}
          <strong className="text-chu">{nguongKhoa} lần</strong> bài sẽ bị khoá và tính 0 điểm cho
          tới khi thầy cô mở lại. Hệ thống{' '}
          <strong className="text-chu">không biết em đã mở gì</strong> — nếu em đang thấy khó ở chỗ
          nào, cứ nói với thầy cô nhé.
        </p>
      </div>

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
          className="min-h-cham w-full rounded-nut bg-thu-lai px-5 py-3 font-semibold text-nen hover:opacity-90"
        >
          Tôi Đã Hiểu Và Sẽ Không Vi Phạm
        </button>
      </div>
    </div>
  );
}
