/**
 * The .hex hand-in.
 *
 * What matters: the wrong file is refused BEFORE it uploads, with a sentence
 * that says what to do; the right file goes to the route handler as multipart
 * form data with the File in it — a plain POST, not a server action, because
 * the action's 1 MB body cap is what broke this for every real .hex; success
 * clears the picker so the next attempt starts clean; and opening the OS file
 * dialog pauses the lesson's tab-switch tracker until it closes.
 *
 * And the one-upload rule: while a .hex is on record the picker is not in the
 * page at all — what is there is the file's details and a red button that
 * deletes it, after a confirm, so the student can upload another.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaiLenHex, type BaiNopHexHienThi } from './tai-len-hex';
import { dangMoHopChonTep, ketThucChonTep } from './tieu-diem';

import type { KetQuaNop } from '@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions';

const fetchStub = vi.fn<typeof fetch>();
const xoaStub = vi.hoisted(() => vi.fn());
const refreshStub = vi.hoisted(() => vi.fn());

// The delete is a server action; under Vitest the real module would pull in
// next-auth. The router is what the panel refreshes after a delete.
vi.mock('@/app/(hoc-sinh)/bai-hoc/[slug]/code-actions', () => ({ xoaBaiNopHexCu: xoaStub }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshStub }) }));

/** What the route handler answers: JSON, whatever the status. */
function traLoi(kq: KetQuaNop, status = 200): Response {
  return new Response(JSON.stringify(kq), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function tep(name: string, noiDung: string | number[], type = 'application/octet-stream'): File {
  const phan: BlobPart = typeof noiDung === 'string' ? noiDung : new Uint8Array(noiDung).buffer;
  return new File([phan], name, { type });
}

beforeEach(() => {
  fetchStub.mockReset();
  xoaStub.mockReset();
  refreshStub.mockReset();
  vi.stubGlobal('fetch', fetchStub);
  ketThucChonTep();
});

afterEach(() => {
  vi.unstubAllGlobals();
  ketThucChonTep();
});

describe('Nộp tệp .hex', () => {
  it('nhận tệp .hex thật và POST lên route handler dưới dạng FormData', async () => {
    fetchStub.mockResolvedValue(
      traLoi({ trangThai: 'da-nhan', submissionId: 's1', attemptNo: 1, thongDiep: 'Đã nhận tệp.' }),
    );
    const onDaNop = vi.fn();
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" onDaNop={onDaNop} />);

    const input = screen.getByLabelText(/Chọn tệp \.hex/i);
    await nguoiDung.upload(input, tep('den-nhay.hex', ':020000040000FA\n:00000001FF\n'));

    // Named back before committing, with its size.
    expect(await screen.findByText('den-nhay.hex')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    // The block id is in the path; the body is the file itself, not base64 in
    // a JSON argument, and not a server-action envelope.
    expect(url).toBe('/api/khoi/b1/hex');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(((init.body as FormData).get('tep') as File).name).toBe('den-nhay.hex');

    expect(await screen.findByRole('status')).toHaveTextContent('Đã nhận tệp.');
    expect(onDaNop).toHaveBeenCalledWith(expect.objectContaining({ trangThai: 'da-nhan' }));
    // Cleared for the next attempt.
    expect(screen.queryByText('den-nhay.hex')).not.toBeInTheDocument();
  });

  it('từ chối tệp không phải .hex TRƯỚC khi gửi, và nói phải làm gì', async () => {
    // The picker's `accept` would already filter this out; drag-and-drop does
    // not go through `accept`, which is the path the pre-check exists for.
    const nguoiDung = userEvent.setup({ applyAccept: false });
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(
      screen.getByLabelText(/Chọn tệp \.hex/i),
      tep('anh-man-hinh.png', [0x89, 0x50, 0x4e, 0x47], 'image/png'),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/không phải \.hex/);
    expect(alert).toHaveTextContent(/Tải xuống/);
    expect(screen.getByRole('button', { name: /Nộp tệp này/ })).toBeDisabled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('từ chối tệp đuôi .hex nhưng ruột không phải Intel HEX', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('gia.hex', 'print(1)'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/không đúng định dạng/);
    expect(screen.getByRole('button', { name: /Nộp tệp này/ })).toBeDisabled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('từ chối tệp rỗng', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);
    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('rong.hex', ''));
    expect(await screen.findByRole('alert')).toHaveTextContent(/trống/);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('máy chủ từ chối thì hiện lý do của máy chủ, giữ tệp để em thử lại', async () => {
    // A 4xx with a reason is an ANSWER, not a network problem: the sentence
    // the server wrote is what the student reads.
    fetchStub.mockResolvedValue(
      traLoi(
        {
          trangThai: 'tu-choi',
          submissionId: null,
          attemptNo: null,
          thongDiep: 'Tệp .hex bị lỗi khi tải về (sai mã kiểm tra). Em tải lại từ MakeCode nhé.',
        },
        422,
      ),
    );
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('x.hex', ':00000001FE\n'));
    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sai mã kiểm tra/);
    expect(screen.getByText('x.hex')).toBeInTheDocument();
  });

  it('mất mạng thật thì mới nói là mạng', async () => {
    fetchStub.mockRejectedValue(new TypeError('Failed to fetch'));
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('x.hex', ':00000001FF\n'));
    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/kiểm tra mạng/);
    // The file is kept so they can retry without picking it again.
    expect(screen.getByText('x.hex')).toBeInTheDocument();
  });

  it('bị chuyển hướng về trang đăng nhập thì nói phiên đã hết hạn, không đổ cho mạng', async () => {
    // The middleware answers a cookie-less POST with a redirect to /dang-nhap;
    // fetch follows it and hands back the login page. That is not the network.
    fetchStub.mockResolvedValue(
      Object.defineProperty(new Response('<html>đăng nhập</html>', { status: 200 }), 'redirected', {
        value: true,
      }),
    );
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('x.hex', ':00000001FF\n'));
    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/đăng nhập lại/);
  });

  // ── Hộp chọn tệp không phải là rời khỏi bài ──────────────────────────────

  it('mở hộp chọn tệp thì tạm dừng theo dõi rời tab, chọn xong thì bật lại', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);
    const input = screen.getByLabelText<HTMLInputElement>(/Chọn tệp \.hex/i);

    expect(dangMoHopChonTep()).toBe(false);

    // The click that opens the OS dialog. jsdom opens nothing, so the flag
    // stays up exactly as it would while a real dialog is on screen.
    await nguoiDung.click(input);
    expect(dangMoHopChonTep()).toBe(true);

    // A file chosen: the dialog closed, tracking resumes.
    await nguoiDung.upload(input, tep('x.hex', ':00000001FF\n'));
    expect(dangMoHopChonTep()).toBe(false);
  });

  it('huỷ hộp chọn tệp cũng bật lại theo dõi — không để tắt mãi', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);
    const input = screen.getByLabelText<HTMLInputElement>(/Chọn tệp \.hex/i);

    await nguoiDung.click(input);
    expect(dangMoHopChonTep()).toBe(true);

    // React does not forward `cancel` from an <input>; it is bound natively.
    act(() => {
      input.dispatchEvent(new Event('cancel'));
    });
    expect(dangMoHopChonTep()).toBe(false);
  });

  it('focus quay lại cửa sổ (hộp thoại đã đóng) cũng bật lại theo dõi', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.click(screen.getByLabelText(/Chọn tệp \.hex/i));
    expect(dangMoHopChonTep()).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(dangMoHopChonTep()).toBe(false);
  });

  it('không có vi phạm axe', async () => {
    const { container } = render(<TaiLenHex blockId="b1" />);
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Đã nộp rồi: xoá để nộp lại
// ═══════════════════════════════════════════════════════════════════════════

describe('Tệp .hex đã nộp', () => {
  const DA_NOP: BaiNopHexHienThi = {
    submissionId: 's1',
    tenTep: 'den-nhay.hex',
    kichThuocKb: 612,
    nopLuc: '2026-09-14T08:15:00Z',
    daCham: false,
    verdict: 'SKIPPED',
  };

  it('có bài trên máy chủ thì KHÔNG hiện ô chọn tệp — hiện chi tiết tệp và nút đỏ xoá', () => {
    render(<TaiLenHex blockId="b1" daNop={DA_NOP} />);

    // Not disabled, not hidden: absent. "Upload" is not a thing to offer.
    expect(screen.queryByLabelText(/Chọn tệp \.hex/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nộp tệp này/ })).not.toBeInTheDocument();

    const bang = screen.getByTestId('da-nop-hex');
    expect(bang).toHaveTextContent('den-nhay.hex');
    expect(bang).toHaveTextContent('612 KB');
    expect(bang).toHaveTextContent(/Đang chờ thầy cô xem/);

    const nut = screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' });
    expect(nut.className).toContain('bg-loi');
  });

  it('xoá phải qua một bước xác nhận; "Giữ lại" thì không gọi máy chủ', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" daNop={DA_NOP} />);

    await nguoiDung.click(screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' }));
    const nhom = screen.getByRole('group');
    expect(nhom).toHaveTextContent(/Xoá den-nhay\.hex\?/);

    await nguoiDung.click(screen.getByRole('button', { name: 'Giữ lại' }));

    expect(xoaStub).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' })).toBeInTheDocument();
  });

  it('xác nhận xoá → gọi hành động với đúng bài nộp, báo kết quả, rồi tải lại trang để hiện ô chọn tệp', async () => {
    xoaStub.mockResolvedValue({
      trangThai: 'da-xoa',
      thongDiep: 'Đã xoá den-nhay.hex. Em chọn tệp .hex mới rồi nộp lại nhé.',
    });
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" daNop={DA_NOP} />);

    await nguoiDung.click(screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' }));
    await nguoiDung.click(screen.getByRole('button', { name: 'Xoá và nộp lại' }));

    await waitFor(() => expect(xoaStub).toHaveBeenCalledWith('s1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/Đã xoá den-nhay\.hex/);
    // The page re-renders from the server: no record → the picker is back.
    expect(refreshStub).toHaveBeenCalledTimes(1);
  });

  it('máy chủ từ chối (đã chấm rồi) thì hiện lý do và KHÔNG tải lại trang', async () => {
    xoaStub.mockResolvedValue({
      trangThai: 'tu-choi',
      thongDiep: 'Thầy cô đã chấm bài này rồi nên không xoá được nữa.',
    });
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" daNop={DA_NOP} />);

    await nguoiDung.click(screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' }));
    await nguoiDung.click(screen.getByRole('button', { name: 'Xoá và nộp lại' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/đã chấm bài này rồi/);
    expect(refreshStub).not.toHaveBeenCalled();
  });

  it('thầy cô đã chấm thì không có nút xoá — chỉ có lời chỉ đường', () => {
    render(<TaiLenHex blockId="b1" daNop={{ ...DA_NOP, daCham: true, verdict: 'ACCEPTED' }} />);

    expect(screen.queryByRole('button', { name: /Xóa bài nộp cũ/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('da-nop-hex')).toHaveTextContent(/Thầy cô đã chấm: đạt/);
    expect(screen.getByTestId('da-nop-hex')).toHaveTextContent(/nhờ thầy cô mở khoá/);
  });

  it('không có vi phạm axe ở cả hai trạng thái', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(<TaiLenHex blockId="b1" daNop={DA_NOP} />);
    const tuyChon = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };

    expect((await axe.run(container, tuyChon)).violations).toEqual([]);

    await nguoiDung.click(screen.getByRole('button', { name: 'Xóa bài nộp cũ để nộp lại' }));
    expect((await axe.run(container, tuyChon)).violations).toEqual([]);
  });
});
