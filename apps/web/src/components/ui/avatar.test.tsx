/**
 * The initials avatar.
 *
 * What is being protected: the letters follow Vietnamese name order, a bad
 * name never renders an empty circle, and the circle is either an image named
 * after the person or invisible to a screen reader — never a nameless blob.
 */
import { render, screen } from '@testing-library/react';
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
});
