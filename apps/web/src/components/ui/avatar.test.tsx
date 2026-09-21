/**
 * The avatar.
 *
 * What is being protected: the letters follow Vietnamese name order, a bad
 * name never renders an empty circle, the circle is either named after the
 * person or invisible to a screen reader — never a nameless blob — and a
 * picture that does not arrive falls back to the letters rather than leaving a
 * torn-page icon in the sidebar.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, chuCaiTen } from './avatar';

describe('chuCaiTen', () => {
  it('lấy chữ đầu của họ và của tên: "Từ Minh Nguyên" → "TN"', () => {
    expect(chuCaiTen('Từ Minh Nguyên')).toBe('TN');
    expect(chuCaiTen('Nguyễn Văn An')).toBe('NA');
  });

  it('một từ thì một chữ; giữ nguyên dấu tiếng Việt khi viết hoa', () => {
    expect(chuCaiTen('bí')).toBe('B');
    expect(chuCaiTen('đặng thị hoa')).toBe('ĐH');
  });

  it('khoảng trắng thừa không làm sai chữ', () => {
    expect(chuCaiTen('  Lê   Thái  ')).toBe('LT');
  });

  it('tên rỗng cho "?" thay vì vòng tròn trống', () => {
    expect(chuCaiTen('')).toBe('?');
    expect(chuCaiTen('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('mặc định là một ảnh mang tên người đó', () => {
    render(<Avatar name="Từ Minh Nguyên" />);
    const anh = screen.getByRole('img', { name: 'Từ Minh Nguyên' });
    expect(anh).toHaveTextContent('TN');
    expect(anh.className).toContain('rounded-full');
    expect(anh.className).toContain('from-chinh');
  });

  it('khi tên đã in ngay bên cạnh thì ẩn khỏi trình đọc màn hình', () => {
    render(<Avatar name="Từ Minh Nguyên" trangTri />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('TN')).toHaveAttribute('aria-hidden', 'true');
  });

  it('có ảnh thì ưu tiên ảnh, vẫn tròn và vẫn mang tên người đó', () => {
    render(<Avatar name="Từ Minh Nguyên" anh="/anh/nguyen.png" />);

    const anh = screen.getByRole('img', { name: 'Từ Minh Nguyên' });
    expect(anh.tagName).toBe('IMG');
    expect(anh).toHaveAttribute('src', '/anh/nguyen.png');
    // A portrait dropped in as an avatar must fill the circle, not letterbox.
    expect(anh.className).toContain('object-cover');
    expect(anh.className).toContain('rounded-full');
    // Nothing is drawn twice: the letters are not also on screen.
    expect(screen.queryByText('TN')).not.toBeInTheDocument();
  });

  it('ảnh rỗng tính là không có ảnh, không phải ảnh ở ""', () => {
    // `src=""` makes the browser re-request the current PAGE as an image.
    render(<Avatar name="Từ Minh Nguyên" anh="   " />);
    expect(screen.getByRole('img', { name: 'Từ Minh Nguyên' })).toHaveTextContent('TN');
  });

  it('ảnh tải hỏng thì quay về chữ cái, không để lại ô ảnh vỡ', () => {
    // The CSP blocks any avatar not served from this origin, and a file can
    // simply be deleted. Both land here.
    render(<Avatar name="Từ Minh Nguyên" anh="https://vi.dt/khong-co.png" />);

    fireEvent.error(screen.getByRole('img', { name: 'Từ Minh Nguyên' }));

    const thay = screen.getByRole('img', { name: 'Từ Minh Nguyên' });
    expect(thay.tagName).not.toBe('IMG');
    expect(thay).toHaveTextContent('TN');
  });

  it('ảnh trang trí thì không đọc tên hai lần', () => {
    render(<Avatar name="Từ Minh Nguyên" anh="/anh/nguyen.png" trangTri />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
