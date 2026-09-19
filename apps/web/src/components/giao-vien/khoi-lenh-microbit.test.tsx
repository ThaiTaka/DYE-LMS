/**
 * The Micro:bit grading view.
 *
 * What is being protected: a teacher opening a hand-in sees the PROGRAM, can
 * still reach the exact bytes, and is never shown a broken page because of
 * what a ten-year-old's browser happened to send.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import { KhoiLenhMicrobit } from './khoi-lenh-microbit';

const XML =
  '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="device_forever"><statement name="HANDLER">' +
  '<block type="basic_show_string"><value name="text">' +
  '<shadow type="text"><field name="TEXT">Xin chao</field></shadow>' +
  '</value></block>' +
  '</statement></block></xml>';

describe('KhoiLenhMicrobit', () => {
  it('mở ra là thấy chương trình, không phải XML', async () => {
    render(<KhoiLenhMicrobit blocksXml={XML} />);

    expect(screen.getByText('Lặp đi lặp lại mãi')).toBeInTheDocument();
    expect(screen.getByText('Hiện chữ “Xin chao”')).toBeInTheDocument();
    // The tag soup is not what greets the teacher.
    expect(screen.queryByText(/device_forever/)).not.toBeInTheDocument();
  });

  it('nguyên văn bài nộp vẫn lấy được', async () => {
    const nguoiDung = userEvent.setup();
    render(<KhoiLenhMicrobit blocksXml={XML} />);

    await nguoiDung.click(screen.getByRole('tab', { name: 'XML gốc' }));

    // The reading is an interpretation; the bytes are the record, and a
    // teacher must never have to take our word for what was handed in.
    const bang = screen.getByRole('tabpanel');
    expect(bang.textContent).toBe(XML);
  });

  it('bài nộp không đọc được vẫn giải thích, không để trang trắng', () => {
    render(<KhoiLenhMicrobit blocksXml="<xml><block" />);

    expect(screen.getByText(/Nguyên văn bài nộp vẫn còn nguyên/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'XML gốc' })).toBeInTheDocument();
  });

  it('bài nộp bằng tệp .hex nói rõ là .hex và cho tải về', () => {
    render(
      <KhoiLenhMicrobit
        blocksXml="# Tệp .hex nộp trực tiếp: bai1.hex (612 KB)"
        coTepHex
        hrefTepHex="/api/bai-nop/abc/hex"
      />,
    );

    expect(screen.getByRole('link', { name: /Tải tệp .hex/ })).toHaveAttribute(
      'href',
      '/api/bai-nop/abc/hex',
    );
    // "Không đọc được khối lệnh" would report a fault where there is none.
    expect(screen.queryByText(/Không đọc được/)).not.toBeInTheDocument();
  });

  it('chữ học sinh gõ không bao giờ trở thành thẻ HTML', () => {
    const { container } = render(
      <KhoiLenhMicrobit
        blocksXml={
          '<xml><block type="basic_show_string"><value name="text">' +
          '<block type="text"><field name="TEXT">&lt;img src=x onerror=1&gt;</field></block>' +
          '</value></block></xml>'
        }
      />,
    );

    expect(screen.getByText(/<img src=x onerror=1>/)).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('không có lỗi tiếp cận', async () => {
    const { container } = render(<KhoiLenhMicrobit blocksXml={XML} />);
    const kq = await axe.run(container);
    expect(kq.violations.map((v) => v.id)).toEqual([]);
  });
});
