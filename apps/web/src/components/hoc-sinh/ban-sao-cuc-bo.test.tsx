/**
 * The browser-side backup of a student's code.
 *
 * Three things are pinned: WHEN a copy is offered back (only when it is ahead
 * of the server, and never across students), HOW OFTEN it is written (every
 * three seconds while typing, at once when the tab goes away), and that it is
 * DROPPED once the server has the same text — but not a moment before.
 */
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHU_KY_LUU_CUC_BO_MS,
  docBanSao,
  ghiBanSao,
  khoaBanSao,
  nenKhoiPhuc,
  useBanSaoCucBo,
  type BanSaoCucBo,
} from './ban-sao-cuc-bo';

const luuStub = vi.hoisted(() => vi.fn());
const nopStub = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions', () => ({
  tuDongLuu: luuStub,
  nop: nopStub,
  layLichSu: vi.fn(() => Promise.resolve({ trangThai: 'ok', banLuu: [] })),
  layLichSuNop: vi.fn(() => Promise.resolve({ trangThai: 'ok', baiNop: [] })),
  layNoiDungBanLuu: vi.fn(),
  khoiPhuc: vi.fn(),
  chayThu: vi.fn(),
  layBanNhap: vi.fn(),
}));

const MAY_CHU_LUC = '2026-09-24T02:00:00.000Z';

function banSao(over: Partial<BanSaoCucBo> = {}): BanSaoCucBo {
  return {
    v: 1,
    code: 'print("offline")\n',
    luuLuc: Date.parse(MAY_CHU_LUC) + 60_000,
    coSo: MAY_CHU_LUC,
    ...over,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  luuStub.mockReset();
  nopStub.mockReset();
  luuStub.mockResolvedValue({
    trangThai: 'da-luu',
    luuLuc: new Date().toISOString(),
    thongDiep: '',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('nenKhoiPhuc', () => {
  it('không có bản sao → không hỏi', () => {
    expect(nenKhoiPhuc(null, 'x', MAY_CHU_LUC)).toBe(false);
  });

  it('giống hệt máy chủ → không hỏi', () => {
    expect(nenKhoiPhuc(banSao({ code: 'x' }), 'x', MAY_CHU_LUC)).toBe(false);
  });

  it('bản sao rỗng → không hỏi', () => {
    expect(nenKhoiPhuc(banSao({ code: '  \n' }), 'x', MAY_CHU_LUC)).toBe(false);
  });

  it('máy chủ chưa có bản nháp nào → hỏi', () => {
    expect(nenKhoiPhuc(banSao({ coSo: null }), 'print("mau")', null)).toBe(true);
  });

  it('gõ trên đúng bản máy chủ đang giữ mà chưa gửi được → hỏi, kể cả khi đồng hồ máy chạy chậm', () => {
    // The laptop clock is an hour behind: the copy LOOKS older than the server.
    const cham = banSao({ luuLuc: Date.parse(MAY_CHU_LUC) - 3_600_000 });
    expect(nenKhoiPhuc(cham, 'print("cu")', MAY_CHU_LUC)).toBe(true);
  });

  it('máy chủ đã có bản mới hơn (em làm tiếp ở máy khác) → không hỏi', () => {
    const cu = banSao({
      coSo: '2026-09-24T01:00:00.000Z',
      luuLuc: Date.parse('2026-09-24T01:30:00Z'),
    });
    expect(nenKhoiPhuc(cu, 'print("may khac")', MAY_CHU_LUC)).toBe(false);
  });

  it('không rõ gốc nhưng mới hơn theo đồng hồ → hỏi', () => {
    const moi = banSao({ coSo: '2026-09-24T01:00:00.000Z' });
    expect(nenKhoiPhuc(moi, 'print("cu")', MAY_CHU_LUC)).toBe(true);
  });
});

describe('docBanSao', () => {
  it('dữ liệu hỏng hoặc sai dạng → null, không ném', () => {
    window.localStorage.setItem('k1', '{not json');
    window.localStorage.setItem('k2', JSON.stringify({ v: 2, code: 'x' }));
    expect(docBanSao('k1')).toBeNull();
    expect(docBanSao('k2')).toBeNull();
  });
});

describe('useBanSaoCucBo', () => {
  const KHOA = khoaBanSao('hs1', 'b1');

  it('gõ liên tục: ghi mỗi 3 giây với nội dung mới nhất, không ghi theo từng phím', () => {
    vi.useFakeTimers();
    const ghi = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useBanSaoCucBo(KHOA, MAY_CHU_LUC));

    act(() => {
      result.current.ghiNhan('p');
      result.current.ghiNhan('pr');
      result.current.ghiNhan('pri');
    });
    expect(ghi).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(CHU_KY_LUU_CUC_BO_MS));
    expect(ghi).toHaveBeenCalledTimes(1);
    expect(docBanSao(KHOA)).toMatchObject({ code: 'pri', coSo: MAY_CHU_LUC });

    // Still typing: the next write comes three seconds later, not on a pause.
    act(() => {
      result.current.ghiNhan('prin');
      vi.advanceTimersByTime(1000);
      result.current.ghiNhan('print');
      vi.advanceTimersByTime(2000);
    });
    expect(ghi).toHaveBeenCalledTimes(2);
    expect(docBanSao(KHOA)?.code).toBe('print');
    ghi.mockRestore();
  });

  it('tab bị ẩn → ghi ngay, không đợi hết 3 giây', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBanSaoCucBo(KHOA, MAY_CHU_LUC));

    act(() => result.current.ghiNhan('print(1)'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });

    expect(docBanSao(KHOA)?.code).toBe('print(1)');
  });

  it('máy chủ đã có đúng nội dung đó → xoá bản sao', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBanSaoCucBo(KHOA, MAY_CHU_LUC));

    act(() => {
      result.current.ghiNhan('print(1)');
      vi.advanceTimersByTime(CHU_KY_LUU_CUC_BO_MS);
    });
    act(() => result.current.daDongBo('print(1)'));

    expect(docBanSao(KHOA)).toBeNull();
  });

  it('máy chủ xác nhận bản CŨ hơn bản đã ghi → giữ bản sao', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBanSaoCucBo(KHOA, MAY_CHU_LUC));

    act(() => {
      result.current.ghiNhan('print(1)\nprint(2)');
      vi.advanceTimersByTime(CHU_KY_LUU_CUC_BO_MS);
    });
    // A slow save of the earlier text lands after the newer copy was written.
    act(() => result.current.daDongBo('print(1)'));

    expect(docBanSao(KHOA)?.code).toBe('print(1)\nprint(2)');
  });

  it('không có khoá (không biết học sinh nào) → không ghi gì', () => {
    vi.useFakeTimers();
    const ghi = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useBanSaoCucBo(null, MAY_CHU_LUC));

    act(() => {
      result.current.ghiNhan('print(1)');
      vi.advanceTimersByTime(CHU_KY_LUU_CUC_BO_MS * 2);
    });
    expect(ghi).not.toHaveBeenCalled();
    ghi.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Khu làm bài — khôi phục bản trên máy', () => {
  async function dungKhu(props?: Partial<Record<string, unknown>>) {
    const { KhuLamBai } = await import('./khu-lam-bai');
    return render(
      <KhuLamBai
        blockId="b1"
        maBanDau={'print("tren may chu")\n'}
        coBanNhap
        luuLucBanDau={MAY_CHU_LUC}
        coBaiTap
        nhan="Bài làm của em"
        hocSinhId="hs1"
        {...props}
      />,
    );
  }

  it('bản trên máy mới hơn → hỏi em, và khôi phục thì đưa vào khung rồi lưu lên máy chủ', async () => {
    ghiBanSao(khoaBanSao('hs1', 'b1'), banSao({ code: 'print("go luc mat mang")\n' }));
    const nguoiDung = userEvent.setup();
    const { container } = await dungKhu();

    const hoi = await screen.findByRole('alert');
    expect(hoi).toHaveTextContent(/chưa kịp lưu lên hệ thống/);
    expect((await axe.run(container)).violations.map((v) => v.id)).toEqual([]);

    await nguoiDung.click(screen.getByRole('button', { name: 'Khôi phục bản này' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Autosave carries the restored text to the server.
    await waitFor(() => expect(luuStub).toHaveBeenCalledWith('b1', 'print("go luc mat mang")\n'), {
      timeout: 5000,
    });
  });

  it('bản của học sinh KHÁC trên cùng máy → không bao giờ được hỏi', async () => {
    ghiBanSao(khoaBanSao('hs-khac', 'b1'), banSao({ code: 'print("loi giai cua ban")\n' }));
    await dungKhu();

    // Give the mount effect its turn, then check nothing was offered.
    await screen.findByText(/lưu lúc|lưu tự động/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Khôi phục bản này' })).not.toBeInTheDocument();
  });

  it('bỏ qua → xoá bản trên máy, không hỏi lại lần sau', async () => {
    const khoa = khoaBanSao('hs1', 'b1');
    ghiBanSao(khoa, banSao());
    const nguoiDung = userEvent.setup();
    await dungKhu();

    await nguoiDung.click(await screen.findByRole('button', { name: 'Bỏ qua' }));

    expect(docBanSao(khoa)).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('bản trên máy cũ hơn máy chủ → không hỏi, và dọn đi', async () => {
    const khoa = khoaBanSao('hs1', 'b1');
    ghiBanSao(
      khoa,
      banSao({ coSo: '2026-09-24T01:00:00.000Z', luuLuc: Date.parse('2026-09-24T01:10:00Z') }),
    );
    await dungKhu();

    await waitFor(() => expect(docBanSao(khoa)).toBeNull());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('khung đã khoá vì đã nộp → không hỏi khôi phục', async () => {
    ghiBanSao(khoaBanSao('hs1', 'b1'), banSao());
    await dungKhu({ soLanDaNop: 1, baiNopCuoi: { verdict: 'WRONG_ANSWER', dangCho: false } });

    await screen.findByTestId('het-luot');
    expect(screen.queryByRole('button', { name: 'Khôi phục bản này' })).not.toBeInTheDocument();
  });
});
