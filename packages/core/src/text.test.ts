/**
 * Plain-text rendering of Markdown fragments.
 *
 * The case that started this: lesson titles legitimately contain code spans, and
 * Phase 5 shipped them raw into lock reasons — a student saw
 * "Buổi 19 · `calendar` & Luyện tập", backticks and all.
 */
import { describe, expect, it } from 'vitest';

import { bocMarkdown, rutGon, tenBuoi } from './text';

describe('bocMarkdown', () => {
  it('gỡ dấu backtick khỏi tiêu đề — đúng ca lỗi của Phase 5', () => {
    expect(bocMarkdown('Buổi 19 · `calendar` & Luyện tập')).toBe(
      'Buổi 19 · calendar & Luyện tập',
    );
  });

  it('giữ nguyên tiêu đề không có cú pháp markdown', () => {
    expect(bocMarkdown('Vòng lặp for và while')).toBe('Vòng lặp for và while');
  });

  it('gỡ in đậm và in nghiêng', () => {
    expect(bocMarkdown('**Quan trọng** và *rất* cần thiết')).toBe('Quan trọng và rất cần thiết');
    expect(bocMarkdown('phần _nghiêng_ ở giữa')).toBe('phần nghiêng ở giữa');
  });

  it('giữ chữ của liên kết, bỏ địa chỉ', () => {
    expect(bocMarkdown('Xem [tài liệu Python](https://docs.python.org) nhé')).toBe(
      'Xem tài liệu Python nhé',
    );
  });

  it('giữ alt text của ảnh', () => {
    expect(bocMarkdown('![Sơ đồ vòng lặp](/img/loop.png)')).toBe('Sơ đồ vòng lặp');
  });

  it('gỡ gạch ngang', () => {
    expect(bocMarkdown('~~Bỏ phần này~~ dùng phần kia')).toBe('Bỏ phần này dùng phần kia');
  });

  it('gỡ dấu hiệu khối ở đầu dòng', () => {
    expect(bocMarkdown('## Tiêu đề mục')).toBe('Tiêu đề mục');
    expect(bocMarkdown('> Trích dẫn')).toBe('Trích dẫn');
    expect(bocMarkdown('- Gạch đầu dòng')).toBe('Gạch đầu dòng');
    expect(bocMarkdown('1. Mục thứ nhất')).toBe('Mục thứ nhất');
  });

  it('KHÔNG phá tên biến Python có gạch dưới', () => {
    // The dangerous case: treating `_` as emphasis would rewrite these silently.
    expect(bocMarkdown('Hàm so_sanh_hai_list')).toBe('Hàm so_sanh_hai_list');
    expect(bocMarkdown('Dùng snake_case cho tên biến')).toBe('Dùng snake_case cho tên biến');
  });

  it('giữ nguyên dunder — CommonMark sẽ đọc __init__ thành in đậm, ở đây thì không', () => {
    // A deliberate departure from CommonMark: in a Python curriculum this string
    // is a method name, and turning it into a bold "init" teaches a wrong name.
    expect(bocMarkdown('Phương thức __init__ của lớp')).toBe('Phương thức __init__ của lớp');
    expect(bocMarkdown('__str__ và __repr__')).toBe('__str__ và __repr__');
  });

  it('không coi ký tự bên trong code span là cú pháp', () => {
    expect(bocMarkdown('Toán tử `a * b` và `x_y`')).toBe('Toán tử a * b và x_y');
  });

  it('xử lý code span nhiều backtick', () => {
    expect(bocMarkdown('Viết ``a`b`` trong code')).toBe('Viết a`b trong code');
  });

  it('gỡ ký tự thoát', () => {
    expect(bocMarkdown('Dấu sao thật: \\*')).toBe('Dấu sao thật: *');
  });

  it('gộp khoảng trắng và xuống dòng về một dòng', () => {
    expect(bocMarkdown('Dòng một\ndòng hai   cách  xa')).toBe('Dòng một dòng hai cách xa');
  });

  it('là hàm toàn phần: chuỗi rỗng, markdown hỏng, ký tự lạ đều không ném lỗi', () => {
    expect(bocMarkdown('')).toBe('');
    expect(() => bocMarkdown('**chưa đóng')).not.toThrow();
    expect(() => bocMarkdown('`chưa đóng')).not.toThrow();
    expect(() => bocMarkdown('[liên kết hỏng](')).not.toThrow();
    expect(() => bocMarkdown('```')).not.toThrow();
  });

  it('KHÔNG phải bộ khử trùng — markup vẫn là markup', () => {
    // Recorded as a test so nobody later mistakes this for XSS protection.
    // Safe rendering is renderMarkdown()'s job; it builds React nodes and so
    // cannot emit HTML at all.
    expect(bocMarkdown('<script>alert(1)</script>')).toContain('<script>');
  });

  it('giữ nguyên dấu tiếng Việt', () => {
    expect(bocMarkdown('**Đặng Hoài Nam** — lớp `7A2`')).toBe('Đặng Hoài Nam — lớp 7A2');
  });
});

describe('rutGon', () => {
  it('trả nguyên văn khi đã đủ ngắn', () => {
    expect(rutGon('Vòng lặp for', 40)).toBe('Vòng lặp for');
  });

  it('cắt tại ranh giới từ, không cắt giữa âm tiết', () => {
    const nguon = 'Buổi 19 · calendar và Luyện tập nâng cao thêm nữa';
    const result = rutGon(nguon, 24);

    expect(result.length).toBeLessThanOrEqual(24);
    expect(result.endsWith('…')).toBe(true);

    // The real requirement: what survives is a whole-word prefix of the source,
    // so the cut landed on a space rather than inside a Vietnamese syllable.
    const than = result.slice(0, -1);
    expect(nguon.startsWith(than)).toBe(true);
    expect(nguon[than.length]).toBe(' ');
  });

  it('gỡ markdown trước khi đo độ dài', () => {
    // Without stripping first, the backticks would eat two characters of budget.
    expect(rutGon('`calendar`', 20)).toBe('calendar');
  });

  it('vẫn cắt được khi chuỗi không có khoảng trắng nào', () => {
    const result = rutGon('a'.repeat(50), 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('tenBuoi', () => {
  it('ghép số buổi với tiêu đề đã gỡ markdown', () => {
    expect(tenBuoi(19, '`calendar` & Luyện tập')).toBe('Buổi 19 · calendar & Luyện tập');
  });
});
