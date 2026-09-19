/**
 * The teacher's password-reset dialog.
 *
 * What is being protected: the secret is never on the page until asked for,
 * the dialog says what a reset actually does before the teacher commits, it
 * behaves like a dialog (focus, Escape, labelled), and it comes up clean on
 * every opening. The authorization behind it is covered in `@dye/core`.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DoiMatKhauHocSinh } from './doi-mat-khau-hoc-sinh';

const resetStub = vi.hoisted(() => vi.fn());

vi.mock('@/app/giao-vien/actions', () => ({
  resetMatKhauHocSinh: resetStub,
}));

beforeEach(() => {
  resetStub.mockReset();
  resetStub.mockResolvedValue({ trangThai: 'chua-lam', thongDiep: '' });
});

describe('DoiMatKhauHocSinh', () => {
  it('không có ô mật khẩu nào trên trang cho tới khi bấm nút', () => {
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    expect(screen.getByRole('button', { name: /Đổi mật khẩu/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Mật khẩu mới/)).not.toBeInTheDocument();
  });

  it('mở hộp thoại có tên em, nói rõ hậu quả, và đưa con trỏ vào ô đầu', async () => {
    const nguoiDung = userEvent.setup();
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    await nguoiDung.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }));

    const hop = screen.getByRole('dialog', { name: 'Đổi mật khẩu cho Từ Minh Nguyên' });
    expect(hop).toHaveAttribute('aria-modal', 'true');
    // The teacher is told, before typing, that this logs the child out and
    // that the password is one-time.
    expect(hop).toHaveTextContent(/đăng xuất khỏi mọi thiết bị/);
    expect(hop).toHaveTextContent(/phải tự đặt mật khẩu mới/);

    const oMoi = screen.getByLabelText(/Mật khẩu mới/);
    expect(oMoi).toHaveFocus();
    expect(oMoi).toHaveAttribute('type', 'password');
    expect(oMoi).toHaveAttribute('autocomplete', 'new-password');
    expect(oMoi).toHaveAttribute('minlength', '8');
  });

  it('gửi đúng studentId và hai lần mật khẩu lên server action', async () => {
    const nguoiDung = userEvent.setup();
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    await nguoiDung.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }));
    await nguoiDung.type(screen.getByLabelText(/Mật khẩu mới/), 'matkhau123');
    await nguoiDung.type(screen.getByLabelText('Nhập lại mật khẩu'), 'matkhau123');
    await nguoiDung.click(screen.getByRole('button', { name: 'Xác nhận đổi' }));

    expect(resetStub).toHaveBeenCalledTimes(1);
    const form = resetStub.mock.calls[0]?.[1] as FormData;
    expect(form.get('studentId')).toBe('hs-1');
    expect(form.get('matKhauMoi')).toBe('matkhau123');
    expect(form.get('nhapLai')).toBe('matkhau123');
  });

  it('"Hiện mật khẩu" đổi cả hai ô sang chữ thường', async () => {
    const nguoiDung = userEvent.setup();
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    await nguoiDung.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }));
    await nguoiDung.click(screen.getByLabelText('Hiện mật khẩu'));

    expect(screen.getByLabelText(/Mật khẩu mới/)).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Nhập lại mật khẩu')).toHaveAttribute('type', 'text');
  });

  it('thành công thì giấu biểu mẫu đi, chỉ còn kết quả', async () => {
    resetStub.mockResolvedValue({
      trangThai: 'thanh-cong',
      thongDiep: 'Đã đổi mật khẩu cho Từ Minh Nguyên (nguyen).',
    });
    const nguoiDung = userEvent.setup();
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    await nguoiDung.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }));
    await nguoiDung.type(screen.getByLabelText(/Mật khẩu mới/), 'matkhau123');
    await nguoiDung.type(screen.getByLabelText('Nhập lại mật khẩu'), 'matkhau123');
    await nguoiDung.click(screen.getByRole('button', { name: 'Xác nhận đổi' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Đã đổi mật khẩu/);
    // The typed secret is gone from the screen.
    expect(screen.queryByLabelText(/Mật khẩu mới/)).not.toBeInTheDocument();
  });

  it('Escape đóng hộp thoại và trả con trỏ về nút; mở lại thì sạch', async () => {
    resetStub.mockResolvedValue({ trangThai: 'thanh-cong', thongDiep: 'Đã đổi mật khẩu.' });
    const nguoiDung = userEvent.setup();
    render(<DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />);

    const nut = screen.getByRole('button', { name: /Đổi mật khẩu/ });
    await nguoiDung.click(nut);
    await nguoiDung.type(screen.getByLabelText(/Mật khẩu mới/), 'matkhau123');
    await nguoiDung.type(screen.getByLabelText('Nhập lại mật khẩu'), 'matkhau123');
    await nguoiDung.click(screen.getByRole('button', { name: 'Xác nhận đổi' }));
    await screen.findByRole('status');

    await nguoiDung.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(nut).toHaveFocus();

    // Second opening: the form, not last time's result.
    await nguoiDung.click(nut);
    expect(screen.getByLabelText(/Mật khẩu mới/)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('không có lỗi tiếp cận khi đang mở', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(
      <DoiMatKhauHocSinh studentId="hs-1" tenHocSinh="Từ Minh Nguyên" />,
    );
    await nguoiDung.click(screen.getByRole('button', { name: /Đổi mật khẩu/ }));

    const kq = await axe.run(container);
    expect(kq.violations).toEqual([]);
  });
});
