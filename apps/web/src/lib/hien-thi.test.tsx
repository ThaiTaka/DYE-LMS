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

import { fireEvent, render, screen } from '@testing-library/react';
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
// Hình minh hoạ — lồng thẻ hợp lệ và ảnh hỏng
// ═══════════════════════════════════════════════════════════════════════════

/** Flow content that a `<p>` may never contain. */
const CAM_TRONG_P = ['figure', 'figcaption', 'div', 'p', 'ul', 'ol', 'table', 'pre', 'blockquote'];

describe('Hình minh hoạ trong bài học', () => {
  it('ảnh đứng riêng một dòng KHÔNG nằm trong thẻ p', () => {
    /*
     * The hydration bug this guards.
     *
     * `<figure>` is flow content and `<p>` may only hold phrasing content, so a
     * browser silently closes the paragraph and reparents the figure. The client
     * DOM then differs from the server HTML and React throws a hydration
     * mismatch on a page a child is reading.
     */
    const { container } = render(
      <VanBan>{'Đoạn văn trước.\n\n![Sơ đồ mạch](/hinh-anh/a.png)\n\nĐoạn văn sau.'}</VanBan>,
    );

    expect(container.querySelector('figure')).toBeTruthy();
    expect(container.querySelectorAll('p figure')).toHaveLength(0);
  });

  it('không thẻ p nào chứa nội dung khối — bất biến chống lỗi hydrate', () => {
    // Stated as a general invariant rather than one case, so a future construct
    // that lands inside <p> fails here instead of in a browser console.
    const { container } = render(
      <VanBan>
        {[
          '![Ảnh đầu](/hinh-anh/a.png)',
          '',
          'Chữ có ![ảnh giữa câu](/hinh-anh/b.png) nằm lẫn vào.',
          '',
          '- mục có ![ảnh](/hinh-anh/c.png)',
          '',
          '| cột | ảnh |',
          '|---|---|',
          '| 1 | ![trong bảng](/hinh-anh/d.png) |',
        ].join('\n')}
      </VanBan>,
    );

    for (const p of Array.from(container.querySelectorAll('p'))) {
      for (const the of CAM_TRONG_P) {
        expect(p.querySelector(the), `<p> chứa <${the}>`).toBeNull();
      }
    }
  });

  it('ảnh nằm giữa câu vẫn hiện, dưới dạng img nội dòng', () => {
    // Must not be dropped just because it cannot be a figure there.
    const { container } = render(
      <VanBan>{'Nhìn ![board](/hinh-anh/board.png) rồi làm theo.'}</VanBan>,
    );

    const img = container.querySelector('p img');
    expect(img).toBeTruthy();
    expect(img).toHaveAttribute('src', '/hinh-anh/board.png');
    expect(container.textContent).toContain('rồi làm theo');
  });

  it('dòng có chữ kèm ảnh KHÔNG bị nuốt mất chữ', () => {
    const { container } = render(<VanBan>{'Xem hình: ![sơ đồ](/hinh-anh/a.png)'}</VanBan>);
    expect(container.textContent).toContain('Xem hình:');
  });

  it('từ chối ảnh có scheme nguy hiểm nhưng giữ lại phần mô tả', () => {
    const { container } = render(
      <VanBan>{'![mô tả ảnh](javascript:alert(1))'}</VanBan>,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('mô tả ảnh');
  });

  it('nhiều ảnh trên cùng một dòng đều thành figure riêng', () => {
    const { container } = render(
      <VanBan>{'![một](/hinh-anh/1.png) ![hai](/hinh-anh/2.png)'}</VanBan>,
    );

    expect(container.querySelectorAll('figure')).toHaveLength(2);
    expect(container.querySelectorAll('p figure')).toHaveLength(0);
  });

  it('ảnh 404 hiện ô thay thế kèm mô tả, không phải biểu tượng ảnh vỡ', async () => {
    /*
     * The curriculum ships image paths ahead of the files, so a missing picture
     * is a normal authoring state. The browser's broken-image glyph reads to a
     * 12-year-old as "this page is broken".
     */
    const { container } = render(
      <VanBan>{'![Board Micro:bit nhìn từ mặt trước](/hinh-anh/chua-co.png)'}</VanBan>,
    );

    const img = container.querySelector('img');
    expect(img).toBeTruthy();

    fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/hình minh hoạ đang được vẽ/i)).toBeInTheDocument();
    // The alt text is genuinely useful on its own, so it is kept.
    expect(screen.getByText(/board micro:bit nhìn từ mặt trước/i)).toBeInTheDocument();
  });

  it('ảnh nội dòng hỏng thì thay bằng thẻ span, không phá cấu trúc p', () => {
    const { container } = render(
      <VanBan>{'Nhìn ![cái board](/hinh-anh/chua-co.png) nhé.'}</VanBan>,
    );

    fireEvent.error(container.querySelector('img')!);

    // Still phrasing content, so the paragraph stays valid.
    for (const the of CAM_TRONG_P) {
      expect(container.querySelector(`p ${the}`)).toBeNull();
    }
    expect(container.textContent).toContain('cái board');
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

  it('mọi màu cú pháp Python đều đạt AA trên nền khung soạn thảo', () => {
    /*
     * Read from soan-thao.tsx rather than restated here, so a colour added to
     * the highlight style cannot skip this check.
     *
     * This is the one CodeMirror's own default light theme fails: several of its
     * tokens sit near 3:1, which is fine for an adult skimming familiar code and
     * not fine for a child reading each character to find a typo.
     */
    const src = readFileSync(
      resolve(import.meta.dirname, '../components/hoc-sinh/soan-thao.tsx'),
      'utf8',
    );
    const khoi = src.slice(src.indexOf('HighlightStyle.define'), src.indexOf('const GIAO_DIEN'));
    const mau = [...khoi.matchAll(/color:\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => m[1]!);

    expect(mau.length).toBeGreaterThanOrEqual(10);

    for (const m of mau) {
      const ti = tuongPhan(m, token['the']!);
      expect(ti, `màu cú pháp ${m} chỉ đạt ${ti.toFixed(2)}:1 trên nền khung`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('khung soạn thảo không dùng cỡ chữ nhỏ hơn 16px', () => {
    const src = readFileSync(
      resolve(import.meta.dirname, '../components/hoc-sinh/soan-thao.tsx'),
      'utf8',
    );
    // 14px monospace is where beginners start reading `l` as `1`, and this is
    // exactly the audience that cannot yet tell a typo from a language rule.
    expect(src).toMatch(/fontSize:\s*'1rem'/);
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
