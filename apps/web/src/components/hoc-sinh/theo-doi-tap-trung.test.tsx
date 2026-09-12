/**
 * The lesson-page focus tracker and its warning dialog.
 *
 * Three things are being protected here. One is the tracker's own rule that a
 * brief blip — a notification stealing focus, a taskbar click — is not a
 * student leaving the lesson. The second is that the dialog only ever tells a
 * 12-year-old things the system actually does. The third arrived with the
 * auto-zero lock: the WARNING may be raised from a locally held count, but the
 * LOCK may only ever be asked for on a number the server gave us, because a
 * warning shown wrongly costs an interruption and a lock applied wrongly costs
 * a child their work.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/** The clock the tracker measures "how long were they away" against. */
let luc = 1_000_000;

/** What `document.visibilityState` reports. */
let hienThi: 'visible' | 'hidden' = 'visible';

beforeEach(() => {
  luc = 1_000_000;
  hienThi = 'visible';
  window.localStorage.clear();

  vi.spyOn(Date, 'now').mockImplementation(() => luc);
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
  vi.restoreAllMocks();
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

/** Leave the tab, stay away `giay` seconds, come back. */
function roiTabRoiQuayLai(giay = 5) {
  act(() => {
    hienThi = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  });

  luc += giay * 1000;

  act(() => {
    hienThi = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
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

    roiTabRoiQuayLai();
    expect(ghiNhanStub).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('bỏ qua cái chớp ngắn — không phải là rời khỏi bài', async () => {
    // A notification toast stealing focus for 400 ms is not a student leaving.
    await dung();

    act(() => {
      hienThi = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    luc += 400;
    act(() => {
      hienThi = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // The departure itself is posted, but the return is not, so it never
    // becomes a completed tab-out and never raises the dialog.
    expect(ghiNhanStub).not.toHaveBeenCalledWith(expect.objectContaining({ loai: 'RETURNED' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('chưa tới ngưỡng thì KHÔNG chặn bài của học sinh', async () => {
    // One under the bar. A student who alt-tabbed a few times is not stopped.
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC - 1 });
    await dung();

    roiTabRoiQuayLai();

    await waitFor(() => expect(ghiNhanStub).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('tới ngưỡng thì hiện cảnh báo chặn ngang, kèm số lần', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    roiTabRoiQuayLai();

    const hop = await screen.findByRole('alertdialog');
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

    roiTabRoiQuayLai();

    const hop = await screen.findByRole('alertdialog');
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
    const nguoiDung = userEvent.setup();
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    roiTabRoiQuayLai();
    await screen.findByRole('alertdialog');

    await nguoiDung.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: 'Tôi Đã Hiểu Và Sẽ Không Vi Phạm' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('nút xác nhận được lấy nét ngay, cho người dùng bàn phím', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    await dung();

    roiTabRoiQuayLai();
    await screen.findByRole('alertdialog');

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Tôi Đã Hiểu Và Sẽ Không Vi Phạm' }),
    );
  });

  it('máy chủ không trả lời thì vẫn đếm, không né được bằng cách ngắt mạng', async () => {
    ghiNhanStub.mockResolvedValue({ ok: false, soLanRoi: 0 });
    await dung();

    for (let i = 0; i < NGUONG_NHAC; i += 1) {
      roiTabRoiQuayLai();
      // Past the client dedupe window, so each of these is a distinct trip.
      luc += 5000;
    }

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('tới ngưỡng khoá thì xin máy chủ khoá bài', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_KHOA });
    await dung();

    roiTabRoiQuayLai();

    await waitFor(() => expect(khoaStub).toHaveBeenCalledWith({ lessonId: 'l1' }));

    // The request carries NO count. The server re-counts FocusEvent rows for
    // itself and refuses anything under the threshold, so a tampered client
    // cannot zero a lesson early — and there is no parameter here for it to
    // lie through.
    expect(khoaStub.mock.calls[0]?.[0]).not.toHaveProperty('soLan');

    expect(await screen.findByText(/Bài này đã bị khoá/)).toBeInTheDocument();
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

    roiTabRoiQuayLai();

    await waitFor(() => expect(khoaStub).toHaveBeenCalled());
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
      roiTabRoiQuayLai();
      luc += 5000;
    }

    // The dialog is raised — the student is not getting away with it silently.
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    // But nothing was zeroed.
    expect(khoaStub).not.toHaveBeenCalled();
  });

  it('chỉ xin khoá một lần dù rời tab thêm nhiều lần nữa', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_KHOA });
    await dung();

    for (let i = 0; i < 4; i += 1) {
      roiTabRoiQuayLai();
      luc += 5000;
    }

    await waitFor(() => expect(khoaStub).toHaveBeenCalled());
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

  // ── Bấm vào trình soạn MakeCode không phải là rời khỏi bài ────────────────

  it('focus vào iframe của trang (trình soạn MakeCode) KHÔNG tính là rời đi', async () => {
    /*
     * The lesson page embeds MakeCode in an iframe. Clicking a block moves
     * focus into it and the window fires `blur` — indistinguishable from
     * switching apps, except by where focus landed. With the lock now able to
     * zero a lesson at NGUONG_KHOA, a student dragging blocks was being walked
     * toward a zero for doing the lesson.
     */
    const { container } = await dung();
    const khung = document.createElement('iframe');
    container.appendChild(khung);

    act(() => {
      khung.focus();
      expect(document.activeElement).toBe(khung);
      window.dispatchEvent(new Event('blur'));
    });
    // The verdict lands one tick later; give it that tick.
    await new Promise((r) => setTimeout(r, 5));

    luc += 5000;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(ghiNhanStub).not.toHaveBeenCalled();
  });

  it('mất focus sang ứng dụng khác vẫn tính là rời đi', async () => {
    // The control: a blur with focus on nothing of ours still opens a
    // departure, one tick late, and the return still closes it.
    await dung();

    act(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      window.dispatchEvent(new Event('blur'));
    });
    await new Promise((r) => setTimeout(r, 5));
    await waitFor(() =>
      expect(ghiNhanStub).toHaveBeenCalledWith(expect.objectContaining({ loai: 'WINDOW_BLUR' })),
    );

    luc += 5000;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() =>
      expect(ghiNhanStub).toHaveBeenCalledWith(expect.objectContaining({ loai: 'RETURNED' })),
    );
  });

  it('không có vi phạm axe khi đang hiện cảnh báo', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: NGUONG_NHAC });
    const { container } = await dung();

    roiTabRoiQuayLai();
    await screen.findByRole('alertdialog');

    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
