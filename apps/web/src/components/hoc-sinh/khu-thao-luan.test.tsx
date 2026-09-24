/**
 * The class chat panel.
 *
 * The server decides everything that matters — who may send, whether a message
 * is acceptable, whether the sender is now locked. What this holds the page to
 * is REPORTING that faithfully: a blocked message is cleared from the box and
 * explained, the composer turns into the lock notice, and nothing a classmate
 * types is ever rendered as markup.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KhuThaoLuan } from './khu-thao-luan';

import type { KetQuaDocThaoLuan, TinNhanGuiDi } from '@/lib/thao-luan-data';

const fetchStub = vi.fn();

beforeEach(() => {
  fetchStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function tin(
  id: string,
  tacGia: string,
  noiDung: string,
  luc = '2026-09-25T01:00:00.000Z',
): TinNhanGuiDi {
  return {
    id,
    noiDung,
    luc,
    tacGia: { id: tacGia, ten: tacGia === 'hs1' ? 'Minh' : 'Lan', anh: null },
  };
}

function banDau(over: Partial<KetQuaDocThaoLuan> = {}): KetQuaDocThaoLuan {
  return {
    tinNhan: [tin('m1', 'hs2', 'Chào cả lớp!'), tin('m2', 'hs1', 'Chào Lan')],
    toi: 'hs1',
    coTheGui: true,
    biKhoa: false,
    daLuuTru: false,
    ...over,
  };
}

function traVe(body: unknown, status = 200) {
  fetchStub.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

const oNhap = () => screen.getByRole('textbox', { name: 'Nhắn cho cả lớp' });

describe('Thảo luận lớp', () => {
  it('hiện tin nhắn: của em bên phải là "Em", của bạn kèm tên', () => {
    render(<KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />);
    const log = screen.getByRole('log', { name: 'Tin nhắn của lớp Lớp 6A' });
    expect(within(log).getByText('Lan')).toBeInTheDocument();
    expect(within(log).getByText('Em')).toBeInTheDocument();
    expect(within(log).getByText('Chào cả lớp!')).toBeInTheDocument();
  });

  it('nói trước cho em biết thầy cô đọc được và lời lẽ xấu sẽ bị chặn', () => {
    render(<KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />);
    expect(screen.getByText(/Thầy cô của lớp đọc được mọi tin nhắn/)).toBeInTheDocument();
  });

  it('gửi được → tin mới hiện trong luồng, ô nhập được xoá', async () => {
    const nd = userEvent.setup();
    render(<KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />);

    traVe(
      {
        trangThai: 'da-gui',
        thongDiep: '',
        tinNhan: tin('m3', 'hs1', 'Bài 3 khó quá', '2026-09-25T01:01:00.000Z'),
      },
      201,
    );
    await nd.type(oNhap(), 'Bài 3 khó quá{Enter}');

    expect(fetchStub).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ lop: 'lop1', noiDung: 'Bài 3 khó quá' });
    expect(await screen.findByText('Bài 3 khó quá')).toBeInTheDocument();
    expect(oNhap()).toHaveValue('');
  });

  it('vi phạm → cảnh báo, xoá chữ khỏi ô, thay ô nhập bằng thông báo khoá', async () => {
    const nd = userEvent.setup();
    render(<KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />);

    traVe(
      {
        trangThai: 'vi-pham',
        thongDiep: 'Tin nhắn KHÔNG được gửi vì có lời lẽ không phù hợp với lớp học.',
      },
      403,
    );
    await nd.type(oNhap(), 'lời xấu{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('KHÔNG được gửi');
    expect(screen.queryByRole('textbox', { name: 'Nhắn cho cả lớp' })).not.toBeInTheDocument();
    expect(screen.getByText(/tạm thời không gửi được tin nhắn/)).toBeInTheDocument();
    // The blocked text never lands in the feed.
    expect(screen.queryByText('lời xấu')).not.toBeInTheDocument();
  });

  it('bị chờ (429) → giữ nguyên chữ trong ô, hiện lý do', async () => {
    const nd = userEvent.setup();
    render(<KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />);

    traVe({ trangThai: 'tu-choi', thongDiep: 'Em bấm hơi nhanh rồi.' }, 429);
    await nd.type(oNhap(), 'ok{Enter}');

    expect(await screen.findByText('Em bấm hơi nhanh rồi.')).toBeInTheDocument();
    expect(oNhap()).toHaveValue('ok');
  });

  it('đang bị khoá từ trước → không có ô nhập, vẫn đọc được', () => {
    render(
      <KhuThaoLuan
        lop={{ id: 'lop1', ten: 'Lớp 6A' }}
        banDau={banDau({ biKhoa: true, coTheGui: false })}
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Chào cả lớp!')).toBeInTheDocument();
  });

  it('giáo viên: chỉ xem, không có ô nhập', () => {
    render(
      <KhuThaoLuan
        lop={{ id: 'lop1', ten: 'Lớp 6A' }}
        banDau={banDau({ toi: 'gv1', coTheGui: false })}
        cheDo="giao-vien"
      />,
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Chế độ xem của giáo viên/)).toBeInTheDocument();
  });

  it('nội dung là chữ thuần — không thành thẻ HTML, không thành đường link', () => {
    render(
      <KhuThaoLuan
        lop={{ id: 'lop1', ten: 'Lớp 6A' }}
        banDau={banDau({
          tinNhan: [tin('x', 'hs2', '<img src=x onerror=alert(1)> https://lua-dao.vn')],
        })}
      />,
    );
    expect(screen.getByText('<img src=x onerror=alert(1)> https://lua-dao.vn')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('không có lỗi trợ năng', async () => {
    const { container } = render(
      <KhuThaoLuan lop={{ id: 'lop1', ten: 'Lớp 6A' }} banDau={banDau()} />,
    );
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
