/**
 * Bí, the robot in the corner.
 *
 * The tests are mostly about restraint: a mascot on a page a child is trying
 * to concentrate on earns its place by staying quiet, staying reachable from
 * the keyboard, and going away when asked.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { TroLyAo, VirtualAssistant } from './tro-ly-ao';

beforeEach(() => {
  window.localStorage.clear();
});

describe('TroLyAo', () => {
  it('không nói gì cho tới khi được bấm vào', () => {
    render(<TroLyAo />);

    expect(screen.getByRole('button', { name: /động viên/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('bấm vào thì hiện một câu động viên tiếng Việt', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await nguoiDung.click(screen.getByRole('button', { name: /động viên/ }));

    const bongBong = screen.getByRole('status');
    expect(bongBong.textContent).toMatch(/\S/);
    expect(screen.getByRole('button', { name: 'Câu khác' })).toBeInTheDocument();
  });

  it('“Câu khác” đổi sang câu khác thật', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await nguoiDung.click(screen.getByRole('button', { name: /động viên/ }));
    const dau = screen.getByRole('status').textContent;

    await nguoiDung.click(screen.getByRole('button', { name: 'Câu khác' }));
    // Repeating the same sentence reads as a broken toy, not a character.
    expect(screen.getByRole('status').textContent).not.toBe(dau);
  });

  it('ẩn đi được, và lần sau vào vẫn ẩn', async () => {
    const nguoiDung = userEvent.setup();
    const { unmount } = render(<TroLyAo />);

    await nguoiDung.click(screen.getByRole('button', { name: /động viên/ }));
    await nguoiDung.click(screen.getByRole('button', { name: 'Ẩn Bí đi' }));

    expect(screen.getByRole('button', { name: /Gọi Bí quay lại/ })).toBeInTheDocument();

    unmount();
    render(<TroLyAo />);
    // The choice survives a reload — a character you cannot switch off is not
    // a companion.
    expect(await screen.findByRole('button', { name: /Gọi Bí quay lại/ })).toBeInTheDocument();
  });

  it('gọi lại được sau khi đã ẩn', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await nguoiDung.click(screen.getByRole('button', { name: /động viên/ }));
    await nguoiDung.click(screen.getByRole('button', { name: 'Ẩn Bí đi' }));
    await nguoiDung.click(screen.getByRole('button', { name: /Gọi Bí quay lại/ }));

    expect(screen.getByRole('button', { name: /động viên/ })).toBeInTheDocument();
  });

  it('dùng được bằng bàn phím', async () => {
    const nguoiDung = userEvent.setup();
    render(<TroLyAo />);

    await nguoiDung.tab();
    expect(screen.getByRole('button', { name: /động viên/ })).toHaveFocus();

    await nguoiDung.keyboard('{Enter}');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('không có lỗi tiếp cận', async () => {
    const nguoiDung = userEvent.setup();
    const { container } = render(<TroLyAo />);
    await nguoiDung.click(screen.getByRole('button', { name: /động viên/ }));

    const kq = await axe.run(container);
    expect(kq.violations.map((v) => v.id)).toEqual([]);
  });

  it('tên tiếng Anh trỏ về cùng một component', () => {
    expect(VirtualAssistant).toBe(TroLyAo);
  });
});
