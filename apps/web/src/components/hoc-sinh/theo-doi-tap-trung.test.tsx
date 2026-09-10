/**
 * The lesson-page focus tracker and its warning dialog.
 *
 * Two things are being protected here. One is the tracker's own rule that a
 * brief blip — a notification stealing focus, a taskbar click — is not a
 * student leaving the lesson. The other is that the dialog only ever tells a
 * 12-year-old things the system actually does.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ghiNhanStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/bai-hoc/[slug]/giam-sat-actions', () => ({
  ghiNhanRoiTab: ghiNhanStub,
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function dung(props?: { bat?: boolean }) {
  const { TheoDoiTapTrung } = await import('./theo-doi-tap-trung');
  return render(<TheoDoiTapTrung lessonId="l1" bat={props?.bat ?? true} {...props} />);
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
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 1 });
    await dung();

    roiTabRoiQuayLai();

    await waitFor(() => expect(ghiNhanStub).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('tới ngưỡng thì hiện cảnh báo chặn ngang, kèm số lần', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 2 });
    await dung();

    roiTabRoiQuayLai();

    const hop = await screen.findByRole('alertdialog');
    expect(hop).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/CẢNH BÁO TỪ HỆ THỐNG/)).toBeInTheDocument();
    expect(screen.getByText(/Bạn đã rời khỏi màn hình làm bài/)).toBeInTheDocument();
    expect(screen.getByText('2 lần')).toBeInTheDocument();
  });

  it('cảnh báo CHỈ nói những gì hệ thống thật sự làm', async () => {
    /*
     * The system logs the count and shows it to the teacher. It has no camera —
     * `getUserMedia` appears nowhere in this codebase — and nothing locks or
     * zeroes a submission over a tab-out. Telling a 12-year-old they are being
     * filmed, or that they are about to be given a zero, would be their school
     * lying to them. If either is ever built, this test is where to start.
     */
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 3 });
    await dung();

    roiTabRoiQuayLai();

    const hop = await screen.findByRole('alertdialog');
    const chu = hop.textContent ?? '';

    expect(chu).not.toContain('ghi hình');
    expect(chu).not.toContain('điểm 0');
    expect(chu).not.toContain('bị khóa');

    // What it does say is true, and is the part that actually matters.
    expect(chu).toContain('gửi trực tiếp đến giáo viên');
  });

  it('phải bấm nút xác nhận mới đóng được — Escape không thoát', async () => {
    const nguoiDung = userEvent.setup();
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 2 });
    await dung();

    roiTabRoiQuayLai();
    await screen.findByRole('alertdialog');

    await nguoiDung.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: 'Tôi Đã Hiểu Và Sẽ Không Vi Phạm' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('nút xác nhận được lấy nét ngay, cho người dùng bàn phím', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 2 });
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

    roiTabRoiQuayLai();
    luc += 5000;
    roiTabRoiQuayLai();

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('không có vi phạm axe khi đang hiện cảnh báo', async () => {
    ghiNhanStub.mockResolvedValue({ ok: true, soLanRoi: 2 });
    const { container } = await dung();

    roiTabRoiQuayLai();
    await screen.findByRole('alertdialog');

    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
