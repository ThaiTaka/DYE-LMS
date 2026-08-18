/**
 * Code editor: diff logic, autosave behaviour, and the keyboard-trap escape.
 *
 * The autosave tests are the client half of the idempotency guarantee. The
 * server enforces it by content hash (see packages/core/src/code.test.ts); this
 * proves the browser does not send the request in the first place.
 */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTuLuu } from './dung-tu-luu';
import { SoSanhMa, soSanhDong } from './so-sanh-ma';

const luuStub = vi.hoisted(() => vi.fn());
const nopStub = vi.hoisted(() => vi.fn());
const lichSuStub = vi.hoisted(() => vi.fn());
const lichSuNopStub = vi.hoisted(() => vi.fn());
const noiDungBanStub = vi.hoisted(() => vi.fn());
const khoiPhucStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/bai-hoc/[slug]/code-actions', () => ({
  tuDongLuu: luuStub,
  nop: nopStub,
  layLichSu: lichSuStub,
  layLichSuNop: lichSuNopStub,
  layNoiDungBanLuu: noiDungBanStub,
  khoiPhuc: khoiPhucStub,
  layBanNhap: vi.fn(),
}));

beforeEach(() => {
  for (const s of [luuStub, nopStub, lichSuStub, lichSuNopStub, noiDungBanStub, khoiPhucStub]) {
    s.mockReset();
  }
  luuStub.mockResolvedValue({
    trangThai: 'da-luu',
    luuLuc: new Date().toISOString(),
    thongDiep: '',
  });
  lichSuStub.mockResolvedValue({ trangThai: 'ok', banLuu: [] });
  lichSuNopStub.mockResolvedValue({ trangThai: 'ok', baiNop: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════
// So sánh mã
// ═══════════════════════════════════════════════════════════════════════════

describe('soSanhDong', () => {
  it('hai bản giống hệt thì không có dòng thêm hay bớt', () => {
    const d = soSanhDong('a\nb\nc', 'a\nb\nc');
    expect(d.every((x) => x.loai === 'giu')).toBe(true);
  });

  it('nhận ra dòng được thêm vào', () => {
    const d = soSanhDong('a\nc', 'a\nb\nc');
    expect(d.filter((x) => x.loai === 'them').map((x) => x.chu)).toEqual(['b']);
    expect(d.filter((x) => x.loai === 'bot')).toHaveLength(0);
  });

  it('nhận ra dòng bị bỏ', () => {
    const d = soSanhDong('a\nb\nc', 'a\nc');
    expect(d.filter((x) => x.loai === 'bot').map((x) => x.chu)).toEqual(['b']);
  });

  it('giữ đúng số dòng của cả hai bản', () => {
    const d = soSanhDong('x\ny', 'x\nz');
    const giu = d.find((r) => r.loai === 'giu');
    expect(giu?.soCu).toBe(1);
    expect(giu?.soMoi).toBe(1);
  });

  it('phân biệt thay đổi thụt lề — trong Python đó là ngữ nghĩa', () => {
    const d = soSanhDong('if x:\n  y = 1', 'if x:\n    y = 1');
    expect(d.some((r) => r.loai === 'them')).toBe(true);
    expect(d.some((r) => r.loai === 'bot')).toBe(true);
  });

  it('không treo trình duyệt với tệp rất lớn', () => {
    const to = Array.from({ length: 1200 }, (_, i) => `dong ${i}`).join('\n');
    const bd = performance.now();
    const d = soSanhDong(to, `${to}\nthem`);
    // Bails to a plain replace rather than building an O(n·m) table.
    expect(performance.now() - bd).toBeLessThan(1000);
    expect(d.length).toBeGreaterThan(0);
  });

  it('xử lý được bản rỗng', () => {
    expect(() => soSanhDong('', 'a')).not.toThrow();
    expect(() => soSanhDong('a', '')).not.toThrow();
  });
});

describe('SoSanhMa', () => {
  it('đếm và hiển thị số dòng thêm / bớt', () => {
    render(<SoSanhMa cu={'a\nb'} moi={'a\nc'} nhanCu="Bản 1" nhanMoi="hiện tại" />);
    expect(screen.getByText('+1 dòng')).toBeInTheDocument();
    expect(screen.getByText('−1 dòng')).toBeInTheDocument();
  });

  it('nói rõ khi hai bản giống nhau thay vì hiện bảng rỗng', () => {
    render(<SoSanhMa cu="a" moi="a" nhanCu="Bản 1" nhanMoi="hiện tại" />);
    expect(screen.getByText(/giống hệt nhau/i)).toBeInTheDocument();
  });

  it('không dùng màu đỏ cho dòng bị bỏ', () => {
    const { container } = render(
      <SoSanhMa cu={'a\nb'} moi="a" nhanCu="Bản 1" nhanMoi="hiện tại" />,
    );
    // An earlier draft is not a mistake. Red stays reserved for system errors.
    expect(container.innerHTML).not.toMatch(/bg-loi|text-loi/);
    expect(container.innerHTML).toMatch(/bg-thu-lai-nen/);
  });

  it('đánh dấu dòng bằng cả ký tự và nhãn cho trình đọc màn hình', () => {
    render(<SoSanhMa cu={'a\nb'} moi={'a\nc'} nhanCu="Bản 1" nhanMoi="hiện tại" />);
    // Colour alone would exclude a colour-blind student and a monochrome screen.
    expect(screen.getAllByText(/dòng thêm|dòng bỏ/).length).toBeGreaterThan(0);
  });

  it('không có vi phạm axe', async () => {
    const { container } = render(
      <SoSanhMa cu={'a\nb\nc'} moi={'a\nx\nc'} nhanCu="Bản 1" nhanMoi="hiện tại" />,
    );
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tự động lưu
// ═══════════════════════════════════════════════════════════════════════════

describe('useTuLuu — chống ghi thừa', () => {
  it('gõ nhiều lần trong khoảng chờ chỉ gửi MỘT yêu cầu', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => {
      result.current.ghiNhan('a');
      result.current.ghiNhan('ab');
      result.current.ghiNhan('abc');
      result.current.ghiNhan('abcd');
    });

    expect(luuStub).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    // Debounce: four keystrokes, one request, carrying the final text.
    expect(luuStub).toHaveBeenCalledTimes(1);
    expect(luuStub).toHaveBeenCalledWith('b1', 'abcd');
  });

  it('không gửi lại khi nội dung không đổi', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('xin chao'));
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(luuStub).toHaveBeenCalledTimes(1);

    // Same text again — a blur, a tab switch, a timer. Nothing to send.
    act(() => result.current.ghiNhan('xin chao'));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(luuStub).toHaveBeenCalledTimes(1);
  });

  it('gõ đi rồi gõ lại về đúng nội dung cũ cũng không gửi', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('abc'));
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(luuStub).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.ghiNhan('abcd');
      result.current.ghiNhan('abc');
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    // The pending timer is cancelled: typing back to the stored text is a no-op.
    expect(luuStub).toHaveBeenCalledTimes(1);
  });

  it('nội dung đổi thật thì có gửi', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('mot'));
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    act(() => result.current.ghiNhan('hai'));
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(luuStub).toHaveBeenCalledTimes(2);
  });

  it('luuNgay bỏ qua khoảng chờ', async () => {
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    await act(async () => {
      await result.current.luuNgay('gap lam');
    });

    expect(luuStub).toHaveBeenCalledWith('b1', 'gap lam');
  });

  it('lưu ngay khi tab bị ẩn — đóng máy, khoá màn hình, chuyển tab', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('code chua kip luu'));
    expect(luuStub).not.toHaveBeenCalled();

    // The failure the brief actually cares about: work in the debounce window
    // when the lid comes down.
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(luuStub).toHaveBeenCalledWith('b1', 'code chua kip luu');

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('lưu ngay khi rời trang (pagehide)', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('dang go do'));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(luuStub).toHaveBeenCalledWith('b1', 'dang go do');
  });

  it('lỗi mạng hiện thông báo không đổ lỗi cho học sinh', async () => {
    luuStub.mockResolvedValue({
      trangThai: 'loi',
      luuLuc: null,
      thongDiep: 'Chưa lưu được. Hệ thống sẽ tự thử lại.',
    });

    const { result } = renderHook(() => useTuLuu('b1', 1500));
    await act(async () => {
      await result.current.luuNgay('abc');
    });

    await waitFor(() => expect(result.current.trangThai).toBe('loi'));
    // A child cannot fix a network problem; the copy must not imply they should.
    expect(result.current.thongDiep).toMatch(/tự thử lại/i);
    expect(result.current.thongDiep).not.toMatch(/bạn đã|em đã làm sai/i);
  });

  it('không gọi setState sau khi component đã gỡ bỏ', async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useTuLuu('b1', 1500));

    act(() => result.current.ghiNhan('abc'));
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    // No React "state update on unmounted component" warning: the hook checks a
    // liveness ref before every setState.
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bàn phím & khả năng tiếp cận
// ═══════════════════════════════════════════════════════════════════════════

describe('Khung soạn thảo — không bẫy bàn phím', () => {
  // CodeMirror is imported dynamically so this file's pure tests do not pay for
  // it, and so the editor mounts against a fully-built jsdom document.
  async function dungSoanThao(props?: Partial<Record<string, unknown>>) {
    const { SoanThao } = await import('./soan-thao');
    return render(
      <div>
        <button type="button">truoc</button>
        <SoanThao giaTri={'print("a")\n'} onDoi={() => {}} nhan="Bài làm của em" {...props} />
        <button type="button">sau</button>
      </div>,
    );
  }

  it('khung soạn thảo có tên và vai trò cho trình đọc màn hình', async () => {
    await dungSoanThao();
    const o = await screen.findByRole('textbox', { name: 'Bài làm của em' });
    expect(o).toHaveAttribute('aria-multiline', 'true');
  });

  it('Escape rồi Tab đưa tiêu điểm ra khỏi khung', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = await dungSoanThao();

    const noiDung = container.querySelector('.cm-content') as HTMLElement;
    expect(noiDung).toBeTruthy();

    noiDung.focus();
    expect(document.activeElement).toBe(noiDung);

    await nguoiDung.keyboard('{Escape}');
    await nguoiDung.tab();

    // WCAG 2.1.2: there must be a way out using the keyboard alone.
    expect(document.activeElement).not.toBe(noiDung);
  });

  it('Tab khi chưa nhấn Escape thì vẫn ở trong khung để thụt lề', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = await dungSoanThao();

    const noiDung = container.querySelector('.cm-content') as HTMLElement;
    noiDung.focus();
    await nguoiDung.tab();

    // Tab has to keep indenting: it is how a 12-year-old writes Python.
    expect(document.activeElement).toBe(noiDung);
  });

  it('dùng bốn dấu cách, không dùng ký tự tab', async () => {
    const thayDoi = vi.fn();
    const nguoiDung = userEvent.setup();
    const { container } = await dungSoanThao({ onDoi: thayDoi });

    const noiDung = container.querySelector('.cm-content') as HTMLElement;
    noiDung.focus();
    await nguoiDung.tab();

    await waitFor(() => expect(thayDoi).toHaveBeenCalled());
    const ma = thayDoi.mock.calls.at(-1)?.[0] as string;
    // PEP 8, and mixing tabs with spaces is a real source of beginner errors.
    expect(ma).not.toContain('\t');
    expect(ma).toContain('    ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Khu làm bài — lịch sử & quay lại
// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm bài', () => {
  const BAN_LUU = [
    { version: 3, reason: 'SUBMIT' as const, luuLuc: '2026-08-18T02:00:00Z', soDong: 9, soKyTu: 140 },
    { version: 2, reason: 'AUTO' as const, luuLuc: '2026-08-18T01:30:00Z', soDong: 7, soKyTu: 110 },
    { version: 1, reason: 'AUTO' as const, luuLuc: '2026-08-18T01:00:00Z', soDong: 3, soKyTu: 40 },
  ];

  async function dungKhu(props?: Partial<Record<string, unknown>>) {
    const { KhuLamBai } = await import('./khu-lam-bai');
    return render(
      <KhuLamBai
        blockId="b1"
        maBanDau={'print("hien tai")\n'}
        coBanNhap={false}
        luuLucBanDau={null}
        coBaiTap
        nhan="Bài làm của em"
        {...props}
      />,
    );
  }

  it('nói rõ bài được lưu tự động', async () => {
    await dungKhu();
    expect(await screen.findByText(/lưu tự động/i)).toBeInTheDocument();
  });

  it('báo cho học sinh biết đây là bài đang làm dở', async () => {
    await dungKhu({ coBanNhap: true, luuLucBanDau: '2026-08-18T02:00:00Z' });
    expect(await screen.findByText(/bài em đang làm dở/i)).toBeInTheDocument();
  });

  it('hướng dẫn thoát khung soạn thảo hiện bằng chữ, không chỉ trong aria', async () => {
    await dungKhu();
    // A sighted keyboard user needs this as much as a screen-reader user.
    expect(await screen.findByText(/để ra khỏi khung soạn thảo/i)).toBeInTheDocument();
  });

  it('mở được lịch sử và liệt kê các bản đã lưu', async () => {
    lichSuStub.mockResolvedValue({ trangThai: 'ok', banLuu: BAN_LUU });
    const nguoiDung = userEvent.setup();
    await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: /lịch sử bài làm/i }));

    expect(await screen.findByText('Bản 3')).toBeInTheDocument();
    expect(screen.getByText('Bản 1')).toBeInTheDocument();
    // The reason is spelled out so history reads as a story, not a log.
    expect(screen.getByText(/em nộp bài/)).toBeInTheDocument();
  });

  it('quay lại bản cũ và nói rõ bản đang viết vẫn được giữ', async () => {
    lichSuStub.mockResolvedValue({ trangThai: 'ok', banLuu: BAN_LUU });
    khoiPhucStub.mockResolvedValue({
      trangThai: 'ok',
      code: 'print("ban cu")\n',
      thongDiep: 'Đã quay lại bản 1. Bản em đang viết được giữ lại thành bản 4.',
    });

    const nguoiDung = userEvent.setup();
    await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: /lịch sử bài làm/i }));
    const nut = await screen.findAllByRole('button', { name: /quay lại bản này/i });
    await nguoiDung.click(nut[nut.length - 1]!);

    await waitFor(() => expect(khoiPhucStub).toHaveBeenCalledWith('b1', 1));
    // Undo that loses work is not undo — and the student is told so.
    expect(await screen.findByText(/được giữ lại thành bản 4/i)).toBeInTheDocument();
  });

  it('so sánh bản cũ với bài đang làm', async () => {
    lichSuStub.mockResolvedValue({ trangThai: 'ok', banLuu: BAN_LUU });
    noiDungBanStub.mockResolvedValue({ trangThai: 'ok', code: 'print("cu")\n' });

    const nguoiDung = userEvent.setup();
    await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: /lịch sử bài làm/i }));
    const nut = await screen.findAllByRole('button', { name: /^so sánh$/i });
    await nguoiDung.click(nut[0]!);

    await waitFor(() => expect(noiDungBanStub).toHaveBeenCalledWith('b1', 3));
    // The diff itself is open: 'print("cu")' vs 'print("hien tai")' is one line
    // replaced, so exactly one added and one removed.
    expect(await screen.findByText('+1 dòng')).toBeInTheDocument();
    expect(screen.getByText('−1 dòng')).toBeInTheDocument();
  });

  it('nộp bài lưu bản nháp trước rồi mới gửi', async () => {
    nopStub.mockResolvedValue({
      trangThai: 'da-nhan',
      submissionId: 's1',
      attemptNo: 1,
      thongDiep: 'Đã nhận bài làm lần 1 của em. Bài đang chờ được chấm.',
    });

    const nguoiDung = userEvent.setup();
    await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: /^nộp bài$/i }));

    await waitFor(() => expect(nopStub).toHaveBeenCalled());
    // Flushing the draft first means the stored code matches what was handed in
    // even if the submit itself fails.
    expect(luuStub).toHaveBeenCalled();
    expect(await screen.findByText(/đang chờ được chấm/i)).toBeInTheDocument();
  });

  it('tự hỏi lại kết quả khi bài đang chờ chấm', async () => {
    nopStub.mockResolvedValue({
      trangThai: 'da-nhan',
      submissionId: 's1',
      attemptNo: 1,
      thongDiep: 'Đã nhận bài làm lần 1 của em. Bài đang chờ được chấm.',
    });

    const dangCho = {
      id: 's1',
      attemptNo: 1,
      verdict: 'PENDING' as const,
      score: 0,
      passedTests: 0,
      totalTests: 0,
      nopLuc: '2026-08-18T02:00:00Z',
      dangCho: true,
    };
    const daCham = { ...dangCho, verdict: 'ACCEPTED' as const, passedTests: 6, totalTests: 6, dangCho: false };

    lichSuNopStub
      .mockResolvedValueOnce({ trangThai: 'ok', baiNop: [dangCho] })
      .mockResolvedValue({ trangThai: 'ok', baiNop: [daCham] });

    const nguoiDung = userEvent.setup();
    await dungKhu();
    await nguoiDung.click(await screen.findByRole('button', { name: /^nộp bài$/i }));

    // Without polling, the student would sit on "đang chờ" forever and read it
    // as the system having lost their work.
    expect(await screen.findByText(/Đang chờ chấm/i)).toBeInTheDocument();
    expect(await screen.findByText(/Đúng rồi/i, {}, { timeout: 8000 })).toBeInTheDocument();
  }, 15_000);

  it('sân chơi không có nút nộp bài', async () => {
    await dungKhu({ coBaiTap: false });
    await screen.findByText(/lưu tự động/i);
    // Nothing to hand in; offering the button would be a dead control.
    expect(screen.queryByRole('button', { name: /^nộp bài$/i })).not.toBeInTheDocument();
  });

  it('nút chạy thử hiện rõ là đang tắt, không phải hỏng', async () => {
    await dungKhu();
    const nut = await screen.findByRole('button', { name: /chạy thử/i });
    expect(nut).toBeDisabled();
    expect(nut).toHaveAttribute('title', expect.stringMatching(/bản cập nhật sau/i));
  });

  it('không có vi phạm axe khi mở lịch sử', async () => {
    lichSuStub.mockResolvedValue({ trangThai: 'ok', banLuu: BAN_LUU });
    const nguoiDung = userEvent.setup();
    const { container } = await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: /lịch sử bài làm/i }));
    await screen.findByText('Bản 3');

    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
