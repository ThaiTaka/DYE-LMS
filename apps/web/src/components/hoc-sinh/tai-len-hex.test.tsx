/**
 * The .hex hand-in.
 *
 * What matters: the wrong file is refused BEFORE it uploads, with a sentence
 * that says what to do; the right file goes to the server as FormData with the
 * File in it; and success clears the picker so the next attempt starts clean.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nopStub = vi.hoisted(() => vi.fn());
vi.mock('@/app/bai-hoc/[slug]/code-actions', () => ({
  nopMicrobitHex: nopStub,
}));

import { TaiLenHex } from './tai-len-hex';

function tep(name: string, noiDung: string | number[], type = 'application/octet-stream'): File {
  const phan: BlobPart = typeof noiDung === 'string' ? noiDung : new Uint8Array(noiDung).buffer;
  return new File([phan], name, { type });
}

beforeEach(() => {
  nopStub.mockReset();
});

describe('Nộp tệp .hex', () => {
  it('nhận tệp .hex thật và gửi lên máy chủ dưới dạng FormData', async () => {
    nopStub.mockResolvedValue({
      trangThai: 'da-nhan',
      submissionId: 's1',
      attemptNo: 1,
      thongDiep: 'Đã nhận tệp.',
    });
    const onDaNop = vi.fn();
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" onDaNop={onDaNop} />);

    const input = screen.getByLabelText(/Chọn tệp \.hex/i);
    await nguoiDung.upload(input, tep('den-nhay.hex', ':020000040000FA\n:00000001FF\n'));

    // Named back before committing, with its size.
    expect(await screen.findByText('den-nhay.hex')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    await waitFor(() => expect(nopStub).toHaveBeenCalledTimes(1));
    const [blockId, fd] = nopStub.mock.calls[0] as [string, FormData];
    expect(blockId).toBe('b1');
    expect(fd).toBeInstanceOf(FormData);
    expect((fd.get('tep') as File).name).toBe('den-nhay.hex');

    expect(await screen.findByRole('status')).toHaveTextContent('Đã nhận tệp.');
    expect(onDaNop).toHaveBeenCalled();
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
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('từ chối tệp đuôi .hex nhưng ruột không phải Intel HEX', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('gia.hex', 'print(1)'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/không đúng định dạng/);
    expect(screen.getByRole('button', { name: /Nộp tệp này/ })).toBeDisabled();
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('từ chối tệp rỗng', async () => {
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);
    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('rong.hex', ''));
    expect(await screen.findByRole('alert')).toHaveTextContent(/trống/);
    expect(nopStub).not.toHaveBeenCalled();
  });

  it('máy chủ từ chối thì hiện lý do của máy chủ, giữ tệp để em thử lại', async () => {
    nopStub.mockResolvedValue({
      trangThai: 'tu-choi',
      submissionId: null,
      attemptNo: null,
      thongDiep: 'Tệp .hex bị lỗi khi tải về (sai mã kiểm tra). Em tải lại từ MakeCode nhé.',
    });
    const nguoiDung = userEvent.setup();
    render(<TaiLenHex blockId="b1" />);

    await nguoiDung.upload(screen.getByLabelText(/Chọn tệp \.hex/i), tep('x.hex', ':00000001FE\n'));
    await nguoiDung.click(screen.getByRole('button', { name: /Nộp tệp này/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sai mã kiểm tra/);
    expect(screen.getByText('x.hex')).toBeInTheDocument();
  });

  it('không có vi phạm axe', async () => {
    const { container } = render(<TaiLenHex blockId="b1" />);
    const kq = await axe.run(container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(kq.violations).toEqual([]);
  });
});
