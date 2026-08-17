/**
 * Rendering safety and design-token verification.
 *
 * Two things are checked here that a component test cannot reach:
 *   • markdown from a teacher-authored lesson can never become markup;
 *   • every text colour in the design system genuinely meets WCAG AA, computed
 *     from the tokens rather than eyeballed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { parseNoiDung } from './block-content';
import { VanBan, renderMarkdown } from './markdown';

// ═══════════════════════════════════════════════════════════════════════════
// Markdown
// ═══════════════════════════════════════════════════════════════════════════

describe('Hiển thị Markdown', () => {
  it('dựng được đoạn văn, in đậm và mã nội dòng', () => {
    render(<VanBan>{'Một **biến** là một cái tên trỏ tới `giá trị`.'}</VanBan>);

    expect(screen.getByText('biến').tagName).toBe('STRONG');
    expect(screen.getByText('giá trị').tagName).toBe('CODE');
  });

  it('dựng khối mã có rào ```', () => {
    const { container } = render(<VanBan>{'```python\nprint("xin chao")\n```'}</VanBan>);
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toBe('print("xin chao")');
    expect(pre?.getAttribute('data-ngon-ngu')).toBe('python');
  });

  it('dựng bảng thành table thật, có scope cho ô tiêu đề', () => {
    render(<VanBan>{'| Toán tử | Ý nghĩa |\n|---|---|\n| `%` | Phần dư |'}</VanBan>);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Toán tử' })).toHaveAttribute('scope', 'col');
  });

  it('dựng danh sách có thứ tự và không thứ tự', () => {
    const { container } = render(<VanBan>{'- một\n- hai\n\n1. đầu\n2. sau'}</VanBan>);
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('không đọc theo thứ tự mảng mà theo cấu trúc thật của văn bản', () => {
    const nodes = renderMarkdown('# Tiêu đề\n\nNội dung.\n\n> Trích dẫn');
    expect(nodes).toHaveLength(3);
  });

  // ── An toàn ──────────────────────────────────────────────────────────────

  it('thẻ HTML thô trở thành CHỮ, không thành thẻ', () => {
    // Nội dung bài học do giáo viên soạn từ giai đoạn 6. Nếu chuỗi này trở
    // thành thẻ script thật thì đó là lỗ hổng XSS trên trang trẻ em đăng nhập.
    const { container } = render(
      <VanBan>{'<script>alert(1)</script> và <img src=x onerror=alert(2)>'}</VanBan>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('liên kết javascript: bị bỏ, chỉ giữ lại chữ', () => {
    const { container } = render(<VanBan>{'[bấm vào đây](javascript:alert(1))'}</VanBan>);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('bấm vào đây');
  });

  it('liên kết http hợp lệ vẫn hoạt động và mở tab mới an toàn', () => {
    render(<VanBan>{'[Tài liệu](https://docs.python.org)'}</VanBan>);

    const link = screen.getByRole('link', { name: 'Tài liệu' });
    expect(link).toHaveAttribute('href', 'https://docs.python.org');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phân tích nội dung khối
// ═══════════════════════════════════════════════════════════════════════════

describe('Phân tích nội dung khối', () => {
  it('đọc được nội dung lý thuyết đầy đủ', () => {
    const nd = parseNoiDung({ kind: 'theory', markdown: 'abc', keyPoints: ['x', 'y'] });
    expect(nd).toEqual({ kind: 'theory', markdown: 'abc', keyPoints: ['x', 'y'] });
  });

  it('nội dung lạ hoặc hỏng trở thành "không đọc được", không ném lỗi', () => {
    for (const xau of [null, undefined, 'chuoi', 42, [], { kind: 'khong-biet' }, {}]) {
      expect(parseNoiDung(xau).kind).toBe('khong-doc-duoc');
    }
  });

  it('thiếu trường thì điền mặc định thay vì vỡ', () => {
    const nd = parseNoiDung({ kind: 'example' });
    expect(nd).toMatchObject({ kind: 'example', markdown: '', code: '', output: null, notes: [] });
  });

  it('lọc bỏ liên kết tài nguyên có giao thức không an toàn', () => {
    const nd = parseNoiDung({
      kind: 'resource',
      links: [
        { label: 'An toàn', url: 'https://python.org' },
        { label: 'Nguy hiểm', url: 'javascript:alert(1)' },
        { label: 'Nguy hiểm 2', url: 'data:text/html,<script>' },
      ],
    });

    expect(nd.kind).toBe('resource');
    if (nd.kind === 'resource') {
      expect(nd.links).toHaveLength(1);
      expect(nd.links[0]?.label).toBe('An toàn');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Tương phản màu — tính từ token, không phải ước lượng bằng mắt
// ═══════════════════════════════════════════════════════════════════════════

/** Độ sáng tương đối theo WCAG 2.1. */
function doSang(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) throw new Error(`Màu không hợp lệ: ${hex}`);

  const kenh = [0, 2, 4].map((i) => {
    const v = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * kenh[0]! + 0.7152 * kenh[1]! + 0.0722 * kenh[2]!;
}

function tuongPhan(a: string, b: string): number {
  const [sang, toi] = [doSang(a), doSang(b)].sort((x, y) => y - x);
  return (sang! + 0.05) / (toi! + 0.05);
}

/** Đọc token màu trực tiếp từ globals.css để test không lệch khỏi thực tế. */
function docToken(): Record<string, string> {
  const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
  const token: Record<string, string> = {};
  for (const m of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)) {
    token[m[1]!] = m[2]!;
  }
  return token;
}

describe('Tương phản màu đạt chuẩn WCAG AA', () => {
  const token = docToken();

  it('đọc được token từ globals.css', () => {
    expect(Object.keys(token).length).toBeGreaterThan(10);
  });

  it('mọi màu chữ trên nền thẻ đều đạt ít nhất 4.5:1', () => {
    const nenThe = token['the']!;
    const mauChu = ['chu', 'chu-phu', 'chu-nhat', 'chinh', 'dung', 'thu-lai', 'loi'];

    for (const ten of mauChu) {
      const ti = tuongPhan(token[ten]!, nenThe);
      expect(ti, `${ten} (${token[ten]}) trên nền thẻ chỉ đạt ${ti.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('màu bốn nhánh đều đạt AA trên nền riêng của chúng', () => {
    const cap: Array<[string, string]> = [
      ['co-ban', 'co-ban-nen'],
      ['thu-thach', 'thu-thach-nen'],
      ['nang-cao', 'nang-cao-nen'],
      ['mo-rong', 'mo-rong-nen'],
    ];

    for (const [chu, nen] of cap) {
      const ti = tuongPhan(token[chu]!, token[nen]!);
      expect(ti, `${chu} trên ${nen} chỉ đạt ${ti.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chữ trắng trên nút chính đạt AA', () => {
    expect(tuongPhan('#ffffff', token['chinh']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('phản hồi đúng/thử lại đạt AA trên nền tương ứng', () => {
    expect(tuongPhan(token['dung']!, token['dung-nen']!)).toBeGreaterThanOrEqual(4.5);
    expect(tuongPhan(token['thu-lai']!, token['thu-lai-nen']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('cỡ chữ nền tảng là 18px, không nhỏ hơn', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
    expect(css).toMatch(/--text-base:\s*1\.125rem/);
    // Vùng chạm tối thiểu 44px.
    expect(css).toMatch(/--spacing-cham:\s*2\.75rem/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bố cục co giãn
// ═══════════════════════════════════════════════════════════════════════════

describe('Bố cục co giãn cho máy tính bảng và máy tính bàn', () => {
  it('bảng rộng tự cuộn trong khung riêng, không đẩy cả trang sang ngang', () => {
    // Trên iPad dọc (768px), bảng 5 cột của bài học sẽ tràn. Nó phải cuộn
    // trong hộp của mình, chứ không làm cả trang cuộn ngang.
    const { container } = render(
      <VanBan>{'| a | b | c | d | e |\n|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 |'}</VanBan>,
    );

    const khung = container.querySelector('.bang-cuon');
    expect(khung).not.toBeNull();
    expect(khung?.querySelector('table')).not.toBeNull();

    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
    expect(css).toMatch(/\.van-ban \.bang-cuon\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('khối mã dài tự cuộn ngang', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
    expect(css).toMatch(/\.van-ban pre\s*\{[^}]*overflow-x:\s*auto/);
  });

  it('tôn trọng cài đặt giảm chuyển động của hệ điều hành', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
    expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('có liên kết bỏ qua để tới thẳng nội dung chính', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
    // Ẩn cho tới khi nhận tiêu điểm bàn phím.
    expect(css).toMatch(/\.bo-qua\s*\{[^}]*left:\s*-9999px/);
    expect(css).toMatch(/\.bo-qua:focus\s*\{[^}]*left:\s*0/);
  });
});
