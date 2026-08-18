/**
 * Pure judging logic: output comparison, error classification, seeded
 * generators, driver parsing. No containers, no database.
 *
 * These are where a beginner gets wrongly failed, so they are worth testing at
 * this granularity rather than only through the end-to-end path.
 */
import { describe, expect, it } from 'vitest';

import { giaiThichLoi, laLoiCuPhap, locVetLoi, phanLoaiKetThuc } from './classify';
import { chuanHoa, docLuat, LUAT_MAC_DINH, soSanhDauRa } from './compare';
import { docKetQuaDriver, dungDriver, MOC_KET_QUA } from './driver';
import { BO_SINH, coBoSinh, sinhDauVao } from './generators';

// ═══════════════════════════════════════════════════════════════════════════
// So sánh đầu ra
// ═══════════════════════════════════════════════════════════════════════════

describe('So sánh đầu ra', () => {
  it('khớp chính xác thì đúng', () => {
    expect(soSanhDauRa('6', '6').khop).toBe(true);
  });

  it('tha thứ khoảng trắng cuối dòng', () => {
    // A 12-year-old who prints the right answer with a trailing space and is
    // told WRONG learns the machine is arbitrary. That lesson outlasts the
    // exercise.
    expect(soSanhDauRa('6   ', '6').khop).toBe(true);
    expect(soSanhDauRa('6\t', '6').khop).toBe(true);
  });

  it('tha thứ dòng trống ở cuối', () => {
    expect(soSanhDauRa('6\n\n\n', '6').khop).toBe(true);
    expect(soSanhDauRa('6', '6\n').khop).toBe(true);
  });

  it('tha thứ xuống dòng kiểu Windows', () => {
    expect(soSanhDauRa('a\r\nb', 'a\nb').khop).toBe(true);
  });

  it('KHÔNG tha thứ khoảng trắng ở giữa', () => {
    // "1 2 3" and "123" are genuinely different answers.
    expect(soSanhDauRa('1 2 3', '123').khop).toBe(false);
  });

  it('KHÔNG tha thứ sai thứ tự dòng', () => {
    expect(soSanhDauRa('a\nb', 'b\na').khop).toBe(false);
  });

  it('phân biệt hoa thường theo mặc định', () => {
    expect(soSanhDauRa('Yes', 'yes').khop).toBe(false);
    expect(soSanhDauRa('Yes', 'yes', { ...LUAT_MAC_DINH, ignoreCase: true }).khop).toBe(true);
  });

  it('so sánh số với dung sai khi được cấu hình', () => {
    const luat = { ...LUAT_MAC_DINH, floatTolerance: 0.01 };
    expect(soSanhDauRa('3.14159', '3.14', luat).khop).toBe(true);
    expect(soSanhDauRa('3.20', '3.14', luat).khop).toBe(false);
  });

  it('báo riêng trường hợp chỉ khác khoảng trắng', () => {
    // Lets the UI say "kiểm tra lại cách in" instead of a bare "sai".
    const kq = soSanhDauRa('1 2 3', '1  2  3', { ...LUAT_MAC_DINH, trimTrailing: false });
    expect(kq.khop).toBe(false);
    expect(kq.chiKhacKhoangTrang).toBe(true);
  });

  it('đọc luật từ JSONB hỏng mà không nổ', () => {
    expect(docLuat(null)).toEqual(LUAT_MAC_DINH);
    expect(docLuat('rac')).toEqual(LUAT_MAC_DINH);
    expect(docLuat({ trimTrailing: 'khong phai bool' })).toEqual(LUAT_MAC_DINH);
    expect(docLuat({ floatTolerance: 'x' }).floatTolerance).toBeNull();
  });

  it('đọc đúng luật hợp lệ', () => {
    expect(docLuat({ trimTrailing: false, ignoreCase: true, floatTolerance: 0.5 })).toEqual({
      trimTrailing: false,
      ignoreCase: true,
      floatTolerance: 0.5,
    });
  });

  it('chuẩn hoá giữ nguyên nội dung tiếng Việt', () => {
    expect(chuanHoa('Chào em  \n', LUAT_MAC_DINH)).toBe('Chào em');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phân loại lỗi
// ═══════════════════════════════════════════════════════════════════════════

describe('Phân loại kết thúc', () => {
  it('ánh xạ đúng từng trạng thái sandbox', () => {
    expect(phanLoaiKetThuc('het-gio', null)).toBe('TIME_LIMIT_EXCEEDED');
    expect(phanLoaiKetThuc('het-bo-nho', 137)).toBe('MEMORY_LIMIT_EXCEEDED');
    expect(phanLoaiKetThuc('qua-nhieu-dau-ra', null)).toBe('OUTPUT_LIMIT_EXCEEDED');
    expect(phanLoaiKetThuc('khong-chay-duoc', 125)).toBe('INTERNAL_ERROR');
  });

  it('thoát 0 không phải lỗi — đầu ra sẽ được so sánh sau', () => {
    expect(phanLoaiKetThuc('binh-thuong', 0)).toBeNull();
  });

  it('thoát khác 0 là lỗi của chương trình, không phải của sandbox', () => {
    expect(phanLoaiKetThuc('binh-thuong', 1)).toBe('RUNTIME_ERROR');
  });
});

describe('Lỗi cú pháp tách khỏi lỗi chạy', () => {
  it('nhận ra SyntaxError, IndentationError, TabError', () => {
    expect(laLoiCuPhap('  SyntaxError: invalid syntax')).toBe(true);
    expect(laLoiCuPhap('IndentationError: unexpected indent')).toBe(true);
    expect(laLoiCuPhap('TabError: inconsistent use of tabs')).toBe(true);
  });

  it('không nhầm lỗi chạy thành lỗi cú pháp', () => {
    expect(laLoiCuPhap('ValueError: x')).toBe(false);
    expect(laLoiCuPhap('NameError: name "a" is not defined')).toBe(false);
  });
});

describe('Giải thích lỗi cho học sinh', () => {
  it('NameError nêu đúng tên bị thiếu', () => {
    const g = giaiThichLoi(`
Traceback (most recent call last):
  File "/sandbox/main.py", line 3, in <module>
NameError: name 'tong' is not defined
`);
    expect(g.thongDiep).toContain('tong');
    expect(g.dong).toBe(3);
    expect(g.loai).toBe('NameError');
  });

  it('IndentationError nói về thụt lề bằng lời dễ hiểu', () => {
    const g = giaiThichLoi('  File "/sandbox/main.py", line 2\nIndentationError: expected an indented block');
    expect(g.thongDiep).toMatch(/thụt lề/i);
    expect(g.thongDiep).toMatch(/4 dấu cách/);
  });

  it('ZeroDivisionError chỉ ra chỗ cần kiểm tra', () => {
    const g = giaiThichLoi('ZeroDivisionError: division by zero');
    expect(g.thongDiep).toMatch(/chia cho 0/i);
  });

  it('lỗi lạ vẫn cho câu trả lời dùng được, không để trống', () => {
    const g = giaiThichLoi('SomethingWeirdError: ???');
    expect(g.thongDiep.length).toBeGreaterThan(10);
  });

  it('không bao giờ dùng ngôn ngữ chê học sinh', () => {
    const mau = [
      'NameError: name "x" is not defined',
      'TypeError: bad operand',
      'ZeroDivisionError: division by zero',
      'IndexError: list index out of range',
      'RecursionError: maximum recursion depth exceeded',
    ];
    for (const m of mau) {
      const g = giaiThichLoi(m);
      expect(g.thongDiep).not.toMatch(/sai rồi|kém|dở|tệ|ngu/i);
    }
  });
});

describe('Lọc vết lỗi', () => {
  it('bỏ đường dẫn sandbox và nội bộ Python', () => {
    const sach = locVetLoi(`
Traceback (most recent call last):
  File "/usr/local/lib/python3.12/runpy.py", line 198, in _run_module
  File "/sandbox/main.py", line 4, in <module>
ValueError: x
`);
    // A student cannot act on a path inside the container.
    expect(sach).not.toContain('/usr/local/lib/python');
    expect(sach).not.toContain('/sandbox/');
    expect(sach).toContain('main.py');
    expect(sach).toContain('ValueError');
  });

  it('bỏ khung của driver do hệ thống chèn vào', () => {
    const sach = locVetLoi('File "/sandbox/_dye_driver.py", line 9\nAssertionError');
    // The student did not write that file and cannot fix it.
    expect(sach).not.toContain('_dye_driver');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Bộ sinh dữ liệu
// ═══════════════════════════════════════════════════════════════════════════

describe('Bộ sinh dữ liệu hiệu năng', () => {
  const TEN = Object.keys(BO_SINH);

  it('có đủ các bộ sinh mà dữ liệu seed nhắc tới', () => {
    for (const t of [
      'mang_ngau_nhien',
      'mang_da_sap_xep',
      'mang_gan_nhu_sap_xep',
      'mang_sap_xep_va_truy_van',
      'mang_ngau_nhien_va_truy_van_tong',
    ]) {
      expect(coBoSinh(t), `thieu bo sinh ${t}`).toBe(true);
    }
  });

  it('tất định — cùng seed cho cùng dữ liệu', () => {
    // Two students on the same scenario must get byte-identical input, or a
    // timing comparison between them means nothing.
    for (const ten of TEN) {
      const a = sinhDauVao(ten, { n: 50, seed: 42 });
      const b = sinhDauVao(ten, { n: 50, seed: 42 });
      expect(a, ten).toBe(b);
    }
  });

  it('seed khác cho dữ liệu khác', () => {
    const a = sinhDauVao('mang_ngau_nhien', { n: 50, seed: 1 });
    const b = sinhDauVao('mang_ngau_nhien', { n: 50, seed: 2 });
    expect(a).not.toBe(b);
  });

  it('sinh đúng số phần tử được yêu cầu', () => {
    const out = sinhDauVao('mang_ngau_nhien', { n: 100, seed: 7 });
    const dong = out.trim().split('\n');
    expect(Number(dong[0])).toBe(100);
    expect(dong[1]!.split(' ')).toHaveLength(100);
  });

  it('mảng đã sắp xếp thì thực sự tăng dần', () => {
    const out = sinhDauVao('mang_da_sap_xep', { n: 200, seed: 3 });
    const a = out.trim().split('\n')[1]!.split(' ').map(Number);
    for (let i = 1; i < a.length; i += 1) expect(a[i]!).toBeGreaterThanOrEqual(a[i - 1]!);
  });

  it('mảng gần như sắp xếp chỉ đảo một phần nhỏ', () => {
    const out = sinhDauVao('mang_gan_nhu_sap_xep', { n: 500, seed: 5 });
    const a = out.trim().split('\n')[1]!.split(' ').map(Number);
    const nghich = a.filter((v, i) => i > 0 && v < a[i - 1]!).length;
    // This is the scenario that makes insertion sort look good — the whole
    // teaching point of that session.
    expect(nghich).toBeLessThan(a.length * 0.1);
  });

  it('truy vấn có cả trúng và trượt', () => {
    const out = sinhDauVao('mang_sap_xep_va_truy_van', { n: 300, seed: 11 });
    const dong = out.trim().split('\n');
    const mang = new Set(dong[1]!.split(' '));
    const truyVan = dong[3]!.split(' ');

    const trung = truyVan.filter((q) => mang.has(q)).length;
    // A solution that only handles found values must not score full marks.
    expect(trung).toBeGreaterThan(0);
    expect(trung).toBeLessThan(truyVan.length);
  });

  it('bộ sinh không tồn tại thì từ chối, không trả dữ liệu rỗng', () => {
    // Grading against empty input would show a confusing failure for a problem
    // that was simply mis-authored.
    expect(() => sinhDauVao('khong_co_that', { n: 10, seed: 1 })).toThrow(/khong co bo sinh/);
    expect(coBoSinh('khong_co_that')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Driver kiểm thử
// ═══════════════════════════════════════════════════════════════════════════

describe('Driver kiểm thử', () => {
  it('đọc được kết quả JSON sau mốc', () => {
    const nonce = 'abc123';
    const out = `linh tinh\n${MOC_KET_QUA}${nonce}{"tests":[{"ten":"test_a","dat":true,"bo_qua":false,"loi":null}],"loi_nap":null}\n`;
    const kq = docKetQuaDriver(out, nonce);

    expect(kq?.tests).toHaveLength(1);
    expect(kq?.tests[0]?.dat).toBe(true);
  });

  it('bỏ qua mốc giả do học sinh in ra', () => {
    const nonce = 'that-su';
    const gia = `${MOC_KET_QUA}gia-mao{"tests":[{"ten":"x","dat":true,"bo_qua":false,"loi":null}],"loi_nap":null}`;
    const that = `${MOC_KET_QUA}${nonce}{"tests":[{"ten":"test_a","dat":false,"bo_qua":false,"loi":"sai"}],"loi_nap":null}`;

    const kq = docKetQuaDriver(`${gia}\n${that}\n`, nonce);
    // The nonce is what makes the sentinel unforgeable.
    expect(kq?.tests[0]?.dat).toBe(false);
  });

  it('không có mốc thì trả null', () => {
    expect(docKetQuaDriver('chi la dau ra thoi', 'n')).toBeNull();
  });

  it('JSON hỏng thì trả null chứ không nổ', () => {
    expect(docKetQuaDriver(`${MOC_KET_QUA}n{khong phai json`, 'n')).toBeNull();
  });

  it('driver nhúng đúng nonce vào mã nguồn Python', () => {
    const src = dungDriver('nonce-thu');
    expect(src).toContain('nonce-thu');
    expect(src).toContain('test_bai');
  });
});
