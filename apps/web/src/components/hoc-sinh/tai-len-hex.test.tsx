/**
 * The .hex hand-in.
 *
 * What matters: the wrong file is refused BEFORE it uploads, with a sentence
 * that says what to do; the right file goes to the route handler as multipart
 * form data with the File in it — a plain POST, not a server action, because
 * the action's 1 MB body cap is what broke this for every real .hex; success
 * clears the picker so the next attempt starts clean; and opening the OS file
 * dialog pauses the lesson's tab-switch tracker until it closes.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaiLenHex } from './tai-len-hex';
import { dangMoHopChonTep, ketThucChonTep } from './tieu-diem';

import type { KetQuaNop } from '@/app/bai-hoc/[slug]/code-actions';

const fetchStub = vi.fn<typeof fetch>();

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
