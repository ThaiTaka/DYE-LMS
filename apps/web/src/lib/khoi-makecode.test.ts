/**
 * Reading a MakeCode workspace.
 *
 * Two things are being protected here, and the second matters more than the
 * first:
 *
 *   1. The common curriculum blocks read as Vietnamese sentences, nested the
 *      way the program nests.
 *   2. NOTHING a student's browser can produce makes this throw. The input is
 *      untrusted and arrives on the page a teacher uses to mark a child's
 *      work; a crash there means the work cannot be marked at all.
 */
import { describe, expect, it } from 'vitest';

import { docKhoiLenh, toMauXml } from './khoi-makecode';

const BOC = 'https://developers.google.com/blockly/xml';

function xml(ruot: string): string {
  return `<xml xmlns="${BOC}">${ruot}</xml>`;
}

describe('docKhoiLenh — chương trình đọc được', () => {
  it('đọc "khi bắt đầu → hiện chữ" thành câu tiếng Việt', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="pxt-on-start"><statement name="HANDLER">' +
          '<block type="basic_show_string"><value name="text">' +
          '<shadow type="text"><field name="TEXT">An</field></shadow>' +
          '</value></block>' +
          '</statement></block>',
      ),
    );

    expect(kq.loi).toBeNull();
    expect(kq.dong[0]?.chu).toBe('Khi bắt đầu');
    expect(kq.dong[1]?.chu).toBe('Hiện chữ “An”');
    // The nesting is the program's structure, not decoration.
    expect(kq.dong[1]?.sau).toBe(1);
  });

  it('khối học sinh thả vào thắng khối mờ mặc định', () => {
    // MakeCode leaves its grey <shadow> in place next to the real <block>.
    // Reading the shadow would report the default the child replaced.
    const kq = docKhoiLenh(
      xml(
        '<block type="basic_show_string"><value name="text">' +
          '<shadow type="text"><field name="TEXT">Hello!</field></shadow>' +
          '<block type="text"><field name="TEXT">Xin chao</field></block>' +
          '</value></block>',
      ),
    );

    expect(kq.dong[0]?.chu).toBe('Hiện chữ “Xin chao”');
  });

  it('đọc lặp mãi mãi, chờ, và hình mặt cười', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="device_forever"><statement name="HANDLER">' +
          '<block type="basic_show_icon"><field name="i">IconNames.Happy</field>' +
          '<next><block type="basic_pause"><value name="pause">' +
          '<shadow type="math_number"><field name="NUM">500</field></shadow>' +
          '</value></block></next>' +
          '</block></statement></block>',
      ),
    );

    expect(kq.dong.map((d) => d.chu)).toEqual([
      'Lặp đi lặp lại mãi',
      'Hiện hình 🙂 mặt cười',
      'Chờ 500 mili giây',
    ]);
    // Both body blocks sit at the same depth — <next> is a sibling, not a child.
    expect(kq.dong[1]?.sau).toBe(1);
    expect(kq.dong[2]?.sau).toBe(1);
  });

  it('đọc if / else với điều kiện so sánh', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="controls_if"><mutation else="1"></mutation>' +
          '<value name="IF0"><block type="logic_compare"><field name="OP">GT</field>' +
          '<value name="A"><block type="variables_get"><field name="VAR">diem</field></block></value>' +
          '<value name="B"><shadow type="math_number"><field name="NUM">5</field></shadow></value>' +
          '</block></value>' +
          '<statement name="DO0"><block type="basic_show_icon"><field name="i">IconNames.Yes</field></block></statement>' +
          '<statement name="ELSE"><block type="basic_show_icon"><field name="i">IconNames.No</field></block></statement>' +
          '</block>',
      ),
    );

    expect(kq.dong.map((d) => d.chu)).toEqual([
      'Nếu diem > 5 thì',
      'Hiện hình ✔️ dấu đúng',
      'Nếu không thì',
      'Hiện hình ✖️ dấu sai',
    ]);
  });

  it('đọc biến, phép tính và nút bấm', () => {
    const kq = docKhoiLenh(
      xml(
        '<variables><variable id="a">diem</variable></variables>' +
          '<block type="device_button_event"><field name="NAME">Button.AB</field>' +
          '<statement name="HANDLER">' +
          '<block type="variables_set"><field name="VAR">diem</field>' +
          '<value name="VALUE"><block type="math_arithmetic"><field name="OP">ADD</field>' +
          '<value name="A"><block type="variables_get"><field name="VAR">diem</field></block></value>' +
          '<value name="B"><shadow type="math_number"><field name="NUM">1</field></shadow></value>' +
          '</block></value></block>' +
          '</statement></block>',
      ),
    );

    expect(kq.bien).toEqual(['diem']);
    expect(kq.dong[0]?.chu).toBe('Khi nhấn nút A+B');
    expect(kq.dong[1]?.chu).toBe('Đặt diem bằng diem + 1');
  });

  it('hình tự vẽ trở thành lưới 5×5, không phải một câu mô tả', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="basic_show_leds"><field name="LEDS">' +
          '. # . # .\n' +
          '. # . # .\n' +
          '. . . . .\n' +
          '# . . . #\n' +
          '. # # # .' +
          '</field></block>',
      ),
    );

    const luoi = kq.dong[0]?.luoi;
    expect(luoi).toHaveLength(5);
    expect(luoi?.[0]).toEqual([false, true, false, true, false]);
    expect(luoi?.[4]).toEqual([false, true, true, true, false]);
  });

  it('khối ngoài từ điển vẫn đọc được tên và tham số', () => {
    const kq = docKhoiLenh(
      xml('<block type="servo_write_pin"><field name="name">AnalogPin.P0</field></block>'),
    );

    expect(kq.loi).toBeNull();
    expect(kq.dong[0]?.chu).toContain('P0');
  });

  it('đếm đủ số khối, kể cả khối chưa dịch được', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="pxt-on-start"><statement name="HANDLER">' +
          '<block type="basic_clear_screen"><next>' +
          '<block type="khong_ai_biet_khoi_nay"/>' +
          '</next></block></statement></block>',
      ),
    );

    expect(kq.soKhoi).toBe(3);
  });
});

describe('docKhoiLenh — không bao giờ ném lỗi', () => {
  const xau: Array<[string, string]> = [
    ['chuỗi rỗng', ''],
    ['chỉ khoảng trắng', '   \n  '],
    ['không phải XML', '# Tệp .hex nộp trực tiếp: bai1.hex (612 KB)'],
    ['thẻ chưa đóng', '<xml><block type="device_forever">'],
    ['thẻ đóng thừa', '</block></xml>'],
    ['dấu ngoặc lẻ', '<xml><block type="a"'],
    ['vùng làm việc trống', `<xml xmlns="${BOC}"></xml>`],
    [
      'chỉ có khai báo biến',
      `<xml xmlns="${BOC}"><variables><variable>x</variable></variables></xml>`,
    ],
  ];

  for (const [ten, dau] of xau) {
    it(`xử lý được: ${ten}`, () => {
      const kq = docKhoiLenh(dau);
      expect(Array.isArray(kq.dong)).toBe(true);
      // Nothing readable must come back as a Vietnamese explanation, never as
      // an empty page that reads like the child submitted nothing.
      if (kq.dong.length === 0) expect(kq.loi).toBeTruthy();
    });
  }

  it('lồng nhau rất sâu không làm tràn ngăn xếp', () => {
    const sau = 400;
    const ruot =
      '<block type="device_forever"><statement name="HANDLER">'.repeat(sau) +
      '<block type="basic_clear_screen"/>' +
      '</statement></block>'.repeat(sau);

    expect(() => docKhoiLenh(xml(ruot))).not.toThrow();
  });

  it('chuỗi <next> rất dài không làm tràn ngăn xếp', () => {
    const dai = 1500;
    const ruot =
      '<block type="basic_clear_screen">' +
      '<next><block type="basic_clear_screen">'.repeat(dai) +
      '</block></next>'.repeat(dai) +
      '</block>';

    const kq = docKhoiLenh(xml(ruot));
    expect(kq.dong.length).toBeGreaterThan(1400);
  });

  it('nội dung học sinh gõ vào vẫn là chữ, không bao giờ là thẻ', () => {
    const kq = docKhoiLenh(
      xml(
        '<block type="basic_show_string"><value name="text">' +
          '<block type="text"><field name="TEXT">&lt;script&gt;x&lt;/script&gt;</field></block>' +
          '</value></block>',
      ),
    );

    // Decoded back to the characters the student typed — and it stays a
    // string all the way to the renderer, which emits React text nodes.
    expect(kq.dong[0]?.chu).toBe('Hiện chữ “<script>x</script>”');
  });
});

describe('docKhoiLenh — chữ dán vào không phá bố cục', () => {
  it('cắt giá trị dài quá 100 ký tự và đánh dấu chỗ cắt', () => {
    const dai = 'a'.repeat(500);
    const kq = docKhoiLenh(
      xml(
        '<block type="basic_show_string"><value name="text">' +
          `<block type="text"><field name="TEXT">${dai}</field></block>` +
          '</value></block>',
      ),
    );

    const chu = kq.dong[0]?.chu ?? '';
    expect(chu).toBe(`Hiện chữ “${'a'.repeat(100)}…”`);
    expect(chu.length).toBeLessThan(120);
  });

  it('giữ nguyên giá trị vừa đúng 100 ký tự', () => {
    const vua = 'b'.repeat(100);
    const kq = docKhoiLenh(xml(`<block type="text"><field name="TEXT">${vua}</field></block>`));
    // Read via the unknown-statement path: the field is echoed verbatim.
    expect(kq.dong[0]?.chu).toContain(vua);
    expect(kq.dong[0]?.chu).not.toContain('…');
  });

  it('tên biến dài cũng bị cắt, ở cả câu lệnh lẫn danh sách biến', () => {
    const ten = 'x'.repeat(300);
    const kq = docKhoiLenh(
      xml(
        `<variables><variable>${ten}</variable></variables>` +
          '<block type="variables_set">' +
          `<field name="VAR">${ten}</field>` +
          '<value name="VALUE"><shadow type="math_number"><field name="NUM">1</field></shadow></value>' +
          '</block>',
      ),
    );

    expect(kq.bien[0]).toHaveLength(101);
    expect(kq.bien[0]?.endsWith('…')).toBe(true);
    expect(kq.dong[0]?.chu.length ?? 0).toBeLessThan(200);
  });

  it('lưới LED không bị cắt dù MakeCode thụt lề từng dòng', () => {
    // Real MakeCode output: backtick-wrapped, four spaces before every row.
    const luoi =
      '`\n' +
      '    . # . # .\n' +
      '    . # . # .\n' +
      '    . . . . .\n' +
      '    # . . . #\n' +
      '    . # # # .\n' +
      '    `';
    const kq = docKhoiLenh(
      xml(`<block type="basic_show_leds"><field name="LEDS">${luoi}</field></block>`),
    );

    expect(kq.dong[0]?.luoi).toHaveLength(5);
    expect(kq.dong[0]?.luoi?.[4]).toEqual([false, true, true, true, false]);
  });
});

describe('toMauXml', () => {
  it('nối lại đúng bằng chuỗi gốc', () => {
    const nguon =
      `<xml xmlns="${BOC}">\n  <block type="device_forever">\n` +
      `    <field name="TEXT">a &lt; b</field>\n  </block>\n</xml>`;

    expect(
      toMauXml(nguon)
        .map((m) => m.chu)
        .join(''),
    ).toBe(nguon);
  });

  it('tách được tên thẻ, tên thuộc tính và giá trị', () => {
    const manh = toMauXml('<block type="basic_pause"/>');

    expect(manh.find((m) => m.loai === 'the')?.chu).toBe('block');
    expect(manh.find((m) => m.loai === 'thuoc-tinh')?.chu).toBe('type');
    expect(manh.find((m) => m.loai === 'gia-tri')?.chu).toBe('"basic_pause"');
  });

  it('chuỗi hỏng vẫn nối lại nguyên vẹn', () => {
    for (const xau of ['<block type="a"', '</', '<<>>', 'không có thẻ nào']) {
      expect(
        toMauXml(xau)
          .map((m) => m.chu)
          .join(''),
      ).toBe(xau);
    }
  });
});
