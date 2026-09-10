import { python } from '@codemirror/lang-python';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';

import { chuanDoanPython, nguonKiemLoiPython } from './kiem-loi-python';

/**
 * The Python syntax checker.
 *
 * ── Why these tests are about WORDING as much as detection ───────────────────
 * A red squiggle a 12-year-old cannot act on is worse than no squiggle: it tells
 * them something is wrong and leaves them to guess what. The whole value of this
 * module over CodeMirror's raw `⚠` node is the sentence it produces, so the
 * assertions check the sentence.
 *
 * ── And why the valid-code cases matter more than the invalid ones ───────────
 * The failure that would sink this feature is not missing an error. It is
 * underlining code that runs. A beginner who sees red on a working program
 * learns to ignore red, and then the checker has made the editor worse than if
 * it had never been added — so every construct a Buổi 1–20 student meets is
 * asserted clean below.
 */

function trangThai(ma: string): EditorState {
  return EditorState.create({ doc: ma, extensions: [python()] });
}

function loiCua(ma: string): string[] {
  return chuanDoanPython(trangThai(ma)).map((d) => d.message);
}

describe('code hợp lệ không bị gạch đỏ', () => {
  const HOP_LE: Array<[string, string]> = [
    ['print đơn giản', 'print("Xin chào")'],
    ['gán biến', 'ten = "Lan"\ntuoi = 12\nprint(ten, tuoi)'],
    [
      'if / elif / else',
      'diem = 8\nif diem >= 8:\n    print("Giỏi")\nelif diem >= 5:\n    print("Khá")\nelse:\n    print("Cố lên")',
    ],
    ['vòng lặp for', 'for i in range(5):\n    print(i)'],
    ['vòng lặp while', 'i = 0\nwhile i < 3:\n    print(i)\n    i = i + 1'],
    ['hàm có tham số', 'def chao(ten):\n    return "Chào " + ten\n\nprint(chao("Nam"))'],
    ['danh sách và vòng lặp', 'ds = [1, 2, 3]\nfor x in ds:\n    print(x * 2)'],
    ['từ điển', 'd = {"a": 1, "b": 2}\nprint(d["a"])'],
    ['chuỗi có dấu nháy lồng', 'print("Bạn ấy nói \'xin chào\'")'],
    ['chuỗi thoát dấu nháy', 'print("Anh \\"Nam\\" đến rồi")'],
    ['chuỗi ba nháy nhiều dòng', 'mo_ta = """dòng một\ndòng hai"""\nprint(mo_ta)'],
    ['bình luận có dấu hai chấm', '# ghi chú: nhớ chạy thử\nprint(1)'],
    ['if có bình luận sau dấu hai chấm', 'if True:  # luôn đúng\n    print(1)'],
    ['try / except', 'try:\n    x = 1 / 0\nexcept ZeroDivisionError:\n    print("Lỗi")'],
    ['lớp đơn giản', 'class Cho:\n    def keu(self):\n        print("Gâu")'],
    ['ngoặc xuống dòng', 'tong = sum([\n    1,\n    2,\n])\nprint(tong)'],
    ['f-string', 'ten = "Lan"\nprint(f"Chào {ten}")'],
    ['tệp rỗng', ''],
    ['chỉ có dòng trắng', '\n\n\n'],
  ];

  for (const [ten, ma] of HOP_LE) {
    it(`không báo lỗi: ${ten}`, () => {
      expect(loiCua(ma), `"${ten}" bị báo lỗi oan`).toEqual([]);
    });
  }
});

describe('thiếu dấu hai chấm', () => {
  it('nêu đích danh dấu hai chấm cho if', () => {
    const loi = loiCua('diem = 9\nif diem > 5\n    print("Giỏi")');
    expect(loi).toHaveLength(1);
    expect(loi[0]).toContain('hai chấm');
    expect(loi[0]).toContain('`if`');
  });

  it('nêu đích danh dấu hai chấm cho for', () => {
    const loi = loiCua('for i in range(3)\n    print(i)');
    expect(loi[0]).toContain('`for`');
    expect(loi[0]).toContain(':');
  });

  it('nêu đích danh dấu hai chấm cho def', () => {
    const loi = loiCua('def chao(ten)\n    return ten');
    expect(loi[0]).toContain('`def`');
  });

  it('nêu đích danh dấu hai chấm cho while', () => {
    const loi = loiCua('i = 0\nwhile i < 3\n    i = i + 1');
    expect(loi[0]).toContain('`while`');
  });
});

describe('dấu nháy và dấu ngoặc', () => {
  it('phát hiện chuỗi chưa đóng', () => {
    const loi = loiCua('print("Xin chào)\nprint(2)');
    expect(loi.length).toBeGreaterThan(0);
    expect(loi[0]).toMatch(/nháy|chuỗi/);
  });

  it('phát hiện ngoặc tròn chưa đóng', () => {
    const loi = loiCua('print("a"\nx = 1');
    expect(loi.length).toBeGreaterThan(0);
    expect(loi[0]).toMatch(/ngoặc|nháy/);
  });
});

describe('gom lỗi', () => {
  /*
   * One typo, one underline.
   *
   * A missing colon on line 2 makes everything below it unparseable, so lezer
   * emits error nodes all the way down. Reporting each of them turns one mistake
   * into a wall of red, which is how a beginner concludes the editor is broken
   * rather than that they forgot a character.
   */
  it('một lỗi cú pháp không sinh ra hàng loạt gạch đỏ', () => {
    const ma = [
      'tong = 0',
      'for i in range(10)',
      '    tong = tong + i',
      '    print(tong)',
      '    print(tong * 2)',
      '    print(tong * 3)',
    ].join('\n');

    expect(chuanDoanPython(trangThai(ma)).length).toBeLessThanOrEqual(2);
  });
});

describe('hình dạng chẩn đoán', () => {
  it('mọi chẩn đoán đều có vùng gạch nhìn thấy được', () => {
    const ds = chuanDoanPython(trangThai('if x > 1\n    print(x)'));
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) {
      // A zero-width diagnostic renders as nothing at all — the student sees a
      // gutter marker pointing at an underline that is not there.
      expect(d.to, JSON.stringify(d)).toBeGreaterThan(d.from);
      expect(d.severity).toBe('error');
      expect(d.message.length).toBeGreaterThan(20);
    }
  });

  it('vùng gạch nằm trong tài liệu', () => {
    const ma = 'def f(\n';
    const state = trangThai(ma);
    for (const d of chuanDoanPython(state)) {
      expect(d.from).toBeGreaterThanOrEqual(0);
      expect(d.to).toBeLessThanOrEqual(state.doc.length);
    }
  });

  it('nguồn lint gắn nhãn tiếng Việt cho CodeMirror', () => {
    const ds = nguonKiemLoiPython(trangThai('if x > 1\n    print(x)'));
    expect(ds.length).toBeGreaterThan(0);
    expect(ds[0]?.source).toBe('Cú pháp Python');
  });

  it('không có chẩn đoán nào dùng tiếng Anh kỹ thuật của lezer', () => {
    // "⚠" is what the parser calls an error node. It is not a message.
    for (const ma of ['if x\n  print(1)', 'def f(\n', 'print("a']) {
      for (const m of loiCua(ma)) {
        expect(m).not.toContain('⚠');
        expect(m.toLowerCase()).not.toContain('unexpected');
      }
    }
  });
});
