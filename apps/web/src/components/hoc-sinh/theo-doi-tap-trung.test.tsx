/**
 * The lesson-page focus tracker and its warning dialog.
 *
 * Four things are being protected here. One is the tracker's rule that a
 * brief hide — the OS switcher flashing past, a system dialog — is not a
 * student leaving the lesson, and that NOTHING is posted until the tab has
 * been hidden for the whole grace period: the old tracker posted the leave on
 * arrival and only dropped the return, so the server's count climbed on every
 * blink and a child who never left the page reached "5 lần". The second is
 * that `window.blur` is not a signal at all any more — the address bar, a
 * bookmark, the file picker and the MakeCode iframe all fire it. The third is
 * that the dialog only ever tells a 12-year-old things the system actually
 * does. The fourth arrived with the auto-zero lock: the WARNING may be raised
 * from a locally held count, but the LOCK may only ever be asked for on a
 * number the server gave us.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { batDauChonTep, ketThucChonTep } from './tieu-diem';

const ghiNhanStub = vi.hoisted(() => vi.fn());
const khoaStub = vi.hoisted(() => vi.fn());
const refreshStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/bai-hoc/[slug]/giam-sat-actions', () => ({
  ghiNhanRoiTab: ghiNhanStub,
  khoaBaiViPham: khoaStub,
}));

// The component calls `router.refresh()` so the lesson re-renders into its
// locked state. Without a mounted app router that throws in jsdom.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshStub }),
}));

/** What `document.visibilityState` reports. */
let hienThi: 'visible' | 'hidden' = 'visible';

const visibilityGoc = Object.getOwnPropertyDescriptor(document, 'visibilityState');

beforeEach(() => {
  // Fake timers drive both the grace period and `Date.now()`, so "how long
  // were they away" and "did the grace elapse" advance together.
  vi.useFakeTimers();
  hienThi = 'visible';
  window.localStorage.clear();
  ketThucChonTep();

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => hienThi,
  });

  ghiNhanStub.mockReset();
  ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 1 });

  khoaStub.mockReset();
  khoaStub.mockResolvedValue({
    dangKhoa: true,
    soLan: NGUONG_KHOA,
    nguong: NGUONG_KHOA,
    soBaiKhongDiem: 1,
    soCauKhongDiem: 0,
  });
  refreshStub.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  ketThucChonTep();
  if (visibilityGoc) Object.defineProperty(document, 'visibilityState', visibilityGoc);
  else delete (document as unknown as Record<string, unknown>)['visibilityState'];
});

/**
 * The thresholds under test.
 *
 * Passed in explicitly rather than relying on the component's defaults, exactly
 * as the lesson page passes them from @dye/core — so these tests exercise the
 * wiring the app actually uses, and a change to the core constants cannot make
 * them silently test a different rule than production runs.
 */
const NGUONG_NHAC = 5;
const NGUONG_KHOA = 20;

async function dung(props?: { bat?: boolean; nguongNhac?: number; nguongKhoa?: number }) {
  const { TheoDoiTapTrung } = await import('./theo-doi-tap-trung');
  return render(
    <TheoDoiTapTrung
      lessonId="l1"
      bat={props?.bat ?? true}
      nguongNhac={props?.nguongNhac ?? NGUONG_NHAC}
      nguongKhoa={props?.nguongKhoa ?? NGUONG_KHOA}
    />,
  );
}

function an(): void {
  hienThi = 'hidden';
  document.dispatchEvent(new Event('visibilitychange'));
}

function hien(): void {
  hienThi = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Let the stubbed server answer and React commit. */
async function cho(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Leave the tab, stay away `giay` seconds (well past the grace), come back. */
async function roiTabRoiQuayLai(giay = 5): Promise<void> {
  await act(async () => {
    an();
    vi.advanceTimersByTime(giay * 1000);
  });
  await act(async () => {
    hien();
  });
  await cho();
}

describe('Theo dõi tập trung', () => {
  it('nói thẳng với học sinh là trang có ghi lại số lần rời tab', async () => {
    // Watching a child and reporting to an adult without telling them is
    // surveillance. The notice is what makes it a classroom rule instead.
    await dung();
    expect(screen.getByText(/số lần em rời khỏi tab/i)).toBeInTheDocument();
    expect(screen.getByText(/không biết em đã mở gì/i)).toBeInTheDocument();
  });

  it('không theo dõi thầy cô đang xem thử bài', async () => {
    const { container } = await dung({ bat: false });

    await roiTabRoiQuayLai();
    expect(ghiNhanStub).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  // ── Ân hạn: chưa đủ lâu thì chưa có gì được gửi đi ──────────────────────

  it('cái chớp ngắn KHÔNG gửi gì lên máy chủ — không phải chỉ bỏ lượt về', async () => {
    /*
     * The bug this file exists for. The old tracker posted TAB_HIDDEN the
     * instant the tab hid and only suppressed RETURNED when the trip proved
     * short — so the server still counted every blink, and the dialog fired
     * on a count the student could not see coming. Now nothing at all goes
     * on the wire until the tab has been hidden for the whole grace.
     */
    const { NGUONG_VANG_MS } = await import('./theo-doi-tap-trung');
    await dung();

    await act(async () => {
      an();
      vi.advanceTimersByTime(NGUONG_VANG_MS - 100);
      hien();
    });
    await act(async () => {
      vi.advanceTimersByTime(NGUONG_VANG_MS * 2);
    });

    expect(ghiNhanStub).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('ẩn quá ân hạn thì mới báo rời đi, và về thì báo RETURNED kèm thời gian', async () => {
    const { NGUONG_VANG_MS } = await import('./theo-doi-tap-trung');
    await dung();

    await act(async () => {
      an();
      vi.advanceTimersByTime(NGUONG_VANG_MS - 1);
    });
    // One millisecond short: still nothing.
    expect(ghiNhanStub).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(ghiNhanStub).toHaveBeenCalledTimes(1);
    expect(ghiNhanStub).toHaveBeenCalledWith(expect.objectContaining({ loai: 'TAB_HIDDEN' }));

    await act(async () => {
      vi.advanceTimersByTime(8_500);
      hien();
    });
    await cho();

    expect(ghiNhanStub).toHaveBeenCalledTimes(2);
    expect(ghiNhanStub).toHaveBeenLastCalledWith(
      expect.objectContaining({ loai: 'RETURNED', awaySeconds: 10 }),
    );
  });

  it('một lần rời đi là MỘT cặp sự kiện, dù tab có ẩn/hiện chớp nhoáng khi về', async () => {
    await dung();

    await roiTabRoiQuayLai();
    // The OS switcher flashing the tab in and out on the way back.
    await act(async () => {
      an();
      vi.advanceTimersByTime(200);
      hien();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    const loai = ghiNhanStub.mock.calls.map(([x]) => (x as { loai: string }).loai);
    expect(loai).toEqual(['TAB_HIDDEN', 'RETURNED']);
  });

  // ── window.blur không còn là tín hiệu ───────────────────────────────────

  it('mất focus cửa sổ (thanh địa chỉ, hộp thoại, iframe) KHÔNG tính là rời đi', async () => {
    /*
     * `blur` fires for the address bar, a bookmark, an extension popup, the
     * OS file picker, an IME candidate window and every click into the
     * MakeCode iframe. None of those is leaving the lesson, and all of them
     * used to be posted as WINDOW_BLUR. The tracker no longer listens.
     */
    await dung();

    await act(async () => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(10_000);
      window.dispatchEvent(new Event('focus'));
    });
    await cho();

    expect(ghiNhanStub).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('không gắn listener blur/focus lên window', async () => {
    const addW = vi.spyOn(window, 'addEventListener');
    await dung();
    expect(addW.mock.calls.filter(([t]) => t === 'blur' || t === 'focus')).toHaveLength(0);
  });

  // ── Hộp chọn tệp ────────────────────────────────────────────────────────

  it('tab bị ẩn trong lúc hộp chọn tệp đang mở thì KHÔNG tính (Android)', async () => {
    // On Android the file chooser is an activity that covers the tab, and
    // Chrome fires `hidden` for it. The upload component flags the dialog.
    await dung();

    await act(async () => {
      batDauChonTep();
      an();
      vi.advanceTimersByTime(30_000); // browsing folders takes a while
    });
    await act(async () => {
      hien(); // the chooser closed — this also ends the pause
    });
    await cho();

    expect(ghiNhanStub).not.toHaveBeenCalled();
  });

  it('hộp chọn tệp đóng rồi thì theo dõi lại như thường', async () => {
    await dung();

    await act(async () => {
      batDauChonTep();
      window.dispatchEvent(new Event('focus')); // dialog closed on desktop
    });
    await roiTabRoiQuayLai();

    expect(ghiNhanStub).toHaveBeenCalledWith(expect.objectContaining({ loai: 'TAB_HIDDEN' }));
  });

  // ── Ngưỡng nhắc ─────────────────────────────────────────────────────────

  it('chưa tới ngưỡng thì KHÔNG chặn bài của học sinh', async () => {
    // One under the bar. A student who alt-tabbed a few times is not stopped.
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC - 1 });
    await dung();

    await roiTabRoiQuayLai();

    expect(ghiNhanStub).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('tới ngưỡng thì hiện cảnh báo chặn ngang, kèm số lần', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    await roiTabRoiQuayLai();

    const hop = screen.getByRole('alertdialog');
    expect(hop).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/CẢNH BÁO TỪ HỆ THỐNG/)).toBeInTheDocument();
    expect(screen.getByText(/Bạn đã rời khỏi màn hình làm bài/)).toBeInTheDocument();
    // Scoped to the dialog: the standing notice above it now quotes the same
    // number, and a bare document-wide query would pass on the wrong element.
    expect(within(hop).getByText(`${NGUONG_NHAC} lần`)).toBeInTheDocument();
  });

  it('cảnh báo CHỈ nói những gì hệ thống thật sự làm', async () => {
    /*
     * The rule this test enforces has not changed: the dialog may claim exactly
     * what the system carries out, and nothing else. What changed is the system.
     *
     * The zero is now real — at NGUONG_KHOA tab-outs `khoaBaiViPham` writes a
     * WRONG_ANSWER submission scored 0 and blocks every submit path — so the
     * dialog must now SAY so, and warning a student about it is the entire
     * reason the dialog is worth interrupting them for.
     *
     * The camera claim is still forbidden, and always will be: `getUserMedia`
     * appears nowhere in this codebase, and telling a 12-year-old they are being
     * filmed when they are not is their school lying to them.
     */
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    await roiTabRoiQuayLai();

    const hop = screen.getByRole('alertdialog');
    const chu = hop.textContent ?? '';

    expect(chu).not.toContain('ghi hình');
    expect(chu).not.toContain('quay màn hình');

    // The consequence is real, so it is stated — with the number attached, so
    // the student knows how much room is left rather than only that it exists.
    expect(chu).toContain('0 điểm');
    expect(chu).toContain('khoá');
    expect(chu).toContain(`${NGUONG_KHOA} lần`);

    // And the part that mattered before still holds.
    expect(chu).toContain('gửi trực tiếp đến giáo viên');
    // It says what was COUNTED, never what the student was doing.
    expect(chu).toContain('không biết bạn đã mở gì');
  });

  it('phải bấm nút xác nhận mới đóng được — Escape không thoát', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    await roiTabRoiQuayLai();
    screen.getByRole('alertdialog');

    // The dialog is up; from here on it is the user's keyboard, on the real clock.
    vi.useRealTimers();
    const nguoiDung = userEvent.setup();

    await nguoiDung.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: 'Tôi Đã Hiểu Và Sẽ Không Vi Phạm' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('nút xác nhận được lấy nét ngay, cho người dùng bàn phím', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    await roiTabRoiQuayLai();
    screen.getByRole('alertdialog');

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Tôi Đã Hiểu Và Sẽ Không Vi Phạm' }),
    );
  });

  it('máy chủ không trả lời thì vẫn đếm, không né được bằng cách ngắt mạng', async () => {
    ghiNhanStub.mockResolvedValue({ ok: false, soLanRoi: 0 });
    await dung();

    for (let i = 0; i < NGUONG_NHAC; i += 1) {
      await roiTabRoiQuayLai();
    }

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  // ── Ngưỡng khoá ─────────────────────────────────────────────────────────

  it('tới ngưỡng khoá thì xin máy chủ khoá bài', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_KHOA });
    await dung();

    await roiTabRoiQuayLai();
    await cho();

    expect(khoaStub).toHaveBeenCalledWith({ lessonId: 'l1' });

    // The request carries NO count. The server re-counts FocusEvent rows for
    // itself and refuses anything under the threshold, so a tampered client
    // cannot zero a lesson early — and there is no parameter here for it to
    // lie through.
    expect(khoaStub.mock.calls[0]?.[0]).not.toHaveProperty('soLan');

    expect(screen.getByText(/Bài này đã bị khoá/)).toBeInTheDocument();
    // The lesson re-renders from the server so each editor is replaced by the
    // locked panel, rather than staying live under an overlay.
    expect(refreshStub).toHaveBeenCalled();
  });

  it('máy chủ từ chối khoá thì bài vẫn mở', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_KHOA });
    // The server counted fewer events than the browser claimed. Its answer wins.
    khoaStub.mockResolvedValue({
      dangKhoa: false,
      soLan: 3,
      nguong: NGUONG_KHOA,
      soBaiKhongDiem: 0,
      soCauKhongDiem: 0,
    });
    await dung();

    await roiTabRoiQuayLai();
    await cho();

    expect(khoaStub).toHaveBeenCalled();
    expect(screen.queryByText(/Bài này đã bị khoá/)).not.toBeInTheDocument();
    expect(refreshStub).not.toHaveBeenCalled();
  });

  it('KHÔNG khoá bài dựa trên số đếm tự cộng khi mất mạng', async () => {
    /*
     * The asymmetry that matters most in this file.
     *
     * The offline fallback counts locally so the WARNING cannot be dodged by
     * pulling the network cable. It must never reach the LOCK: a locally
     * incremented number reflects nothing the server has recorded, and acting on
     * it would let a flaky school connection cost a child their work. A wrong
     * warning costs an interruption; a wrong lock costs the lesson.
     */
    ghiNhanStub.mockResolvedValue({ ok: false, soLanRoi: 0 });
    await dung();

    for (let i = 0; i < NGUONG_KHOA + 5; i += 1) {
      await roiTabRoiQuayLai();
    }

    // The dialog is raised — the student is not getting away with it silently.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // But nothing was zeroed.
    expect(khoaStub).not.toHaveBeenCalled();
  });

  it('chỉ xin khoá một lần dù rời tab thêm nhiều lần nữa', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_KHOA });
    await dung();

    for (let i = 0; i < 4; i += 1) {
      await roiTabRoiQuayLai();
    }
    await cho();

    // Idempotent on the server too, but a client that asked four times would
    // still be four round trips and four chances to race.
    expect(khoaStub).toHaveBeenCalledTimes(1);
  });

  it('lời nhắc thường trực nói cả hai ngưỡng trước khi phạt', async () => {
    // A rule a child is measured against but never shown is not a rule.
    await dung();

    const nhac = screen.getByText(/số lần em rời khỏi tab/i).closest('p');
    const chu = nhac?.textContent ?? '';

    expect(chu).toContain(`${NGUONG_NHAC} lần`);
    expect(chu).toContain(`${NGUONG_KHOA} lần`);
    expect(chu).toContain('0 điểm');
  });

  it('gỡ listener và huỷ hẹn giờ ân hạn khi rời trang', async () => {
    const { unmount } = await dung();

    await act(async () => {
      an(); // the grace timer is pending when the page unmounts
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      hien();
    });

    expect(ghiNhanStub).not.toHaveBeenCalled();
  });

  it('không có vi phạm axe khi đang hiện cảnh báo', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    const { container } = await dung();

    await roiTabRoiQuayLai();
    screen.getByRole('alertdialog');

    // axe drives its own timers; hand it the real clock.
    vi.useRealTimers();
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
