/**
 * Nhánh Thử thách cho Buổi 1, 2, 3, 4 và 6 — dành cho lớp 5.
 *
 * ── One block per lesson, tier THU_THACH ─────────────────────────────────────
 * Under STRICT branching (the course default) a Cơ bản student never sees
 * these; a student on Thử thách or above sees each one ONCE, at the end of its
 * lesson, after everything core. Each is appended to the lesson's `blocks`
 * from python-co-ban-m1.ts.
 *
 * ── Why Buổi 1–4 are UNIT_TEST and Buổi 6 is IO_MATCH ────────────────────────
 * `print()` is introduced in Buổi 6. The lesson plan keeps it out of the first
 * sessions on purpose, and the seed assertions REFUSE `print(` anywhere in
 * Buổi 1–2. An IO_MATCH problem has nothing to compare without stdout, so the
 * early challenges use the judge's other mode: the student's file is imported
 * as `solution` and pytest reads the values they assigned. Nothing is printed,
 * nothing is read from stdin, and the student writes exactly what the lesson
 * taught — an expression, an operator, a value.
 *
 * ── Extreme scaffolding ──────────────────────────────────────────────────────
 * Every file is complete except for `???`. The student replaces one or two of
 * them with an operator, a value, or a name. An untouched `???` is a
 * SyntaxError, which the editor's linter underlines before they press anything.
 *
 * ── Printed text is ASCII ────────────────────────────────────────────────────
 * Buổi 6's expected output has no diacritics ("Toc do", not "Tốc độ"), matching
 * the lesson's existing problems: it is compared byte-for-byte, and a child
 * on a school keyboard with no Vietnamese IME must be able to reproduce it.
 * Statements, hints and docstrings are full Vietnamese.
 */
import { challenge, hidden, sample } from '../builders.ts';

import type { BlockSpec } from '../types.ts';

const BAI_THU_THACH =
  'Bài này dành cho lộ trình **Thử thách**. Chương trình đã viết sẵn — em chỉ điền vào chỗ `???`.';

// ═══════════════════════════════════════════════════════════════════════════
// Buổi 1 — Python là gì? · Gõ một phép tính đầu tiên
// ═══════════════════════════════════════════════════════════════════════════

export const thuThachB01: BlockSpec = challenge(
  {
    slug: 'p-b01-dem-den-led-robot',
    title: 'Đếm đèn LED trên robot',
    statement: [
      'Robot của em có **4 bánh xe**. Mỗi bánh gắn **3 đèn LED** cho đẹp.',
      '',
      'Em hãy giúp máy tính đếm xem robot có **tất cả bao nhiêu đèn**.',
      '',
      'Trong tệp có sẵn một dòng như thế này:',
      '',
      '```python',
      'tong_den = 4 ??? 3',
      '```',
      '',
      'Em thay `???` bằng **một dấu tính** để máy ra đúng số đèn. Chỉ một dấu thôi!',
      '',
      'Bài này **không cần in ra gì**. Bấm **Nộp bài** — máy sẽ tự mở tệp của em, nhìn vào ' +
        '`tong_den` và kiểm tra.',
    ].join('\n'),
    hints: [
      '4 bánh, mỗi bánh 3 đèn. Em đang cộng 3 với 3 với 3 với 3… hay đang nhân?',
      'Bốn dấu tính em đã gõ trong REPL: `+`, `-`, `*`, `/`. Dấu nhân trong Python là `*`.',
      'Nếu máy báo `tong_den` bằng 7, em đã dùng dấu cộng. Nhân lên nhé!',
    ],
    starterCode: [
      '# Robot có 4 bánh xe, mỗi bánh có 3 đèn LED.',
      '# Dòng dưới đây tính tổng số đèn và lưu vào cái tên `tong_den`.',
      '#',
      '# Em chỉ cần thay ??? bằng một dấu tính: +  -  *  /',
      '',
      'tong_den = 4 ??? 3',
    ].join('\n'),
    solutionCode: ['tong_den = 4 * 3'].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'UNIT_TEST',
    runtimeImage: 'PY_TEST',
    totalPoints: 100,
    unitTestCode: [
      'from solution import tong_den',
      '',
      '',
      'def test_dung_tong_so_den():',
      '    # 4 bánh × 3 đèn.',
      '    assert tong_den == 12',
      '',
      '',
      'def test_la_so_nguyen():',
      '    # `/` would give 1.333…; `*` gives a whole number of lights.',
      '    assert isinstance(tong_den, int)',
    ].join('\n'),
  },
  { title: 'Thử thách: Đếm đèn LED trên robot', markdown: BAI_THU_THACH, minutes: 8 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Buổi 2 — Ba phép chia: / , // , %
// ═══════════════════════════════════════════════════════════════════════════

export const thuThachB02: BlockSpec = challenge(
  {
    slug: 'p-b02-chia-pin-cho-robot',
    title: 'Chia pin cho đội robot',
    statement: [
      'Đội của em có **5 robot** và một hộp **17 viên pin**. Em chia đều pin cho các robot.',
      '',
      'Hai câu hỏi:',
      '',
      '1. **Mỗi robot** được bao nhiêu viên?',
      '2. Chia xong, trong hộp **còn dư** bao nhiêu viên?',
      '',
      'Trong tệp có hai dòng chờ em điền:',
      '',
      '```python',
      'moi_robot = 17 ??? 5',
      'con_du = 17 ??? 5',
      '```',
      '',
      'Buổi này em học **ba phép chia**: `/` (chia thường, ra số thập phân), `//` (chia lấy phần ' +
        'nguyên) và `%` (chia lấy phần dư). Mỗi chỗ `???` là một trong ba dấu đó.',
      '',
      'Không cần in gì cả. Bấm **Nộp bài** để máy kiểm tra hai con số.',
    ].join('\n'),
    hints: [
      '17 chia 5 được 3, dư 2. Vậy `moi_robot` phải là 3 và `con_du` phải là 2.',
      'Dấu `/` cho ra `3.4` — không phải số viên pin. Em cần dấu chia cho ra số **nguyên**.',
      'Dấu `%` không phải "phần trăm" trong Python — nó là **phần dư** của phép chia.',
    ],
    starterCode: [
      '# 17 viên pin chia đều cho 5 robot.',
      '#',
      '# Ba dấu chia em vừa học:',
      '#   /   chia thường          17 / 5  ->  3.4',
      '#   //  chia lấy phần nguyên  17 // 5 ->  3',
      '#   %   chia lấy phần dư      17 % 5  ->  2',
      '#',
      '# Thay mỗi ??? bằng đúng dấu chia.',
      '',
      'moi_robot = 17 ??? 5   # mỗi robot được mấy viên?',
      'con_du = 17 ??? 5      # chia xong còn dư mấy viên?',
    ].join('\n'),
    solutionCode: ['moi_robot = 17 // 5', 'con_du = 17 % 5'].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'UNIT_TEST',
    runtimeImage: 'PY_TEST',
    totalPoints: 100,
    unitTestCode: [
      'from solution import con_du, moi_robot',
      '',
      '',
      'def test_moi_robot_duoc_3_vien():',
      '    assert moi_robot == 3',
      '',
      '',
      'def test_phai_la_so_nguyen_khong_phai_3_4():',
      '    # `/` gives 3.4 — you cannot hand a robot 0.4 of a battery.',
      '    assert isinstance(moi_robot, int)',
      '',
      '',
      'def test_con_du_2_vien():',
      '    assert con_du == 2',
    ].join('\n'),
  },
  { title: 'Thử thách: Chia pin cho đội robot', markdown: BAI_THU_THACH, minutes: 10 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Buổi 3 — Biến và bốn kiểu dữ liệu
// ═══════════════════════════════════════════════════════════════════════════

export const thuThachB03: BlockSpec = challenge(
  {
    slug: 'p-b03-the-thong-tin-robot',
    title: 'Thẻ thông tin của robot',
    statement: [
      'Mỗi robot trong đội có một **thẻ thông tin** gồm bốn dòng — đúng bốn kiểu dữ liệu em vừa học:',
      '',
      '| Thông tin | Kiểu | Ví dụ |',
      '|---|---|---|',
      '| Tốc độ (m/s) | số nguyên `int` | `12` |',
      '| Chiều cao (m) | số thực `float` | `1.5` |',
      '| Tên | chuỗi `str` | `"Robo"` |',
      '| Đang bật? | luận lý `bool` | `True` / `False` |',
      '',
      'Ba dòng đầu đã điền sẵn. Em điền **hai chỗ**:',
      '',
      '1. `dang_bat = ???` — robot **đang bật**, nên điền giá trị luận lý đúng.',
      '2. `quang_duong = toc_do ??? 3` — robot chạy **3 giây** với tốc độ `toc_do`. Đi được bao xa?',
      '',
      'Không cần in gì. Bấm **Nộp bài** để máy kiểm tra thẻ.',
    ].join('\n'),
    hints: [
      'Kiểu luận lý chỉ có hai giá trị: `True` và `False`. Viết hoa chữ cái đầu, không có dấu nháy.',
      'Quãng đường = tốc độ **nhân** thời gian. 12 m/s trong 3 giây là 36 m.',
      'Nếu em viết `"True"` có dấu nháy thì đó là **chuỗi**, không phải luận lý — máy sẽ báo sai kiểu.',
    ],
    starterCode: [
      '# Thẻ thông tin của robot — mỗi dòng một kiểu dữ liệu.',
      '',
      'toc_do = 12          # số nguyên (int): mét mỗi giây',
      'chieu_cao = 1.5      # số thực (float): mét',
      'ten = "Robo"         # chuỗi (str)',
      '',
      '# Robot ĐANG BẬT. Điền giá trị luận lý (bool) — không dùng dấu nháy!',
      'dang_bat = ???',
      '',
      '# Robot chạy 3 giây với tốc độ trên. Quãng đường = tốc độ ??? thời gian.',
      'quang_duong = toc_do ??? 3',
    ].join('\n'),
    solutionCode: [
      'toc_do = 12',
      'chieu_cao = 1.5',
      'ten = "Robo"',
      'dang_bat = True',
      'quang_duong = toc_do * 3',
    ].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'UNIT_TEST',
    runtimeImage: 'PY_TEST',
    totalPoints: 100,
    unitTestCode: [
      'from solution import chieu_cao, dang_bat, quang_duong, ten, toc_do',
      '',
      '',
      'def test_robot_dang_bat():',
      '    # `is True`, not `== True`: the string "True" must not pass.',
      '    assert dang_bat is True',
      '',
      '',
      'def test_dung_kieu_luan_ly():',
      '    assert isinstance(dang_bat, bool)',
      '',
      '',
      'def test_quang_duong():',
      '    assert quang_duong == 36',
      '',
      '',
      'def test_ba_dong_dau_giu_nguyen():',
      '    assert toc_do == 12 and isinstance(toc_do, int)',
      '    assert chieu_cao == 1.5 and isinstance(chieu_cao, float)',
      '    assert ten == "Robo" and isinstance(ten, str)',
    ].join('\n'),
  },
  { title: 'Thử thách: Thẻ thông tin của robot', markdown: BAI_THU_THACH, minutes: 10 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Buổi 4 — Ép kiểu: int(), float(), str()
// ═══════════════════════════════════════════════════════════════════════════

export const thuThachB04: BlockSpec = challenge(
  {
    slug: 'p-b04-cam-bien-bao-so-bang-chu',
    title: 'Cảm biến báo số bằng chữ',
    statement: [
      'Cảm biến nhiệt độ của robot hơi lạ: nó gửi con số về **dưới dạng chữ**. Robot nhận được ' +
        '`"25"` — có dấu nháy, tức là một **chuỗi**, không phải số.',
      '',
      'Robot muốn **cộng thêm 3 độ** rồi ghép thành một câu để hiện lên màn hình. Nhưng chuỗi ' +
        'không cộng với số được, và số không ghép với chữ được. Em phải **ép kiểu** hai lần:',
      '',
      '1. `nhiet_do = ???(doc_tu_cam_bien)` — đổi chuỗi `"25"` thành **số nguyên** để cộng.',
      '2. `cau = "Nhiet do: " + ???(nhiet_do_sau)` — đổi số thành **chuỗi** để ghép vào câu.',
      '',
      'Ba hàm ép kiểu em vừa học: `int()`, `float()`, `str()`.',
      '',
      'Không cần in gì. Bấm **Nộp bài** để máy kiểm tra.',
    ].join('\n'),
    hints: [
      '`"25" + 3` báo lỗi vì một bên là chữ, một bên là số. Đổi chữ thành số trước bằng `int(...)`.',
      '`"Nhiet do: " + 28` cũng báo lỗi — lần này phải đổi số thành chữ bằng `str(...)`.',
      'Kết quả cuối cùng phải là chuỗi `"Nhiet do: 28"`.',
    ],
    starterCode: [
      '# Cảm biến gửi nhiệt độ về dưới dạng CHỮ (chuỗi), không phải số.',
      'doc_tu_cam_bien = "25"',
      '',
      '# 1) Đổi chuỗi thành số nguyên để tính toán được. Điền int, float hay str?',
      'nhiet_do = ???(doc_tu_cam_bien)',
      '',
      '# Cộng thêm 3 độ (dòng này đã xong).',
      'nhiet_do_sau = nhiet_do + 3',
      '',
      '# 2) Ghép số vào câu. Số phải đổi thành chuỗi trước. Điền int, float hay str?',
      'cau = "Nhiet do: " + ???(nhiet_do_sau)',
    ].join('\n'),
    solutionCode: [
      'doc_tu_cam_bien = "25"',
      'nhiet_do = int(doc_tu_cam_bien)',
      'nhiet_do_sau = nhiet_do + 3',
      'cau = "Nhiet do: " + str(nhiet_do_sau)',
    ].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'UNIT_TEST',
    runtimeImage: 'PY_TEST',
    totalPoints: 100,
    unitTestCode: [
      'from solution import cau, nhiet_do, nhiet_do_sau',
      '',
      '',
      'def test_ep_ve_so_nguyen():',
      '    assert nhiet_do == 25',
      '    # float(...) would also let the addition work, but 25.0 is not what a',
      '    # whole-degree sensor reports; the lesson asks for int here.',
      '    assert isinstance(nhiet_do, int)',
      '',
      '',
      'def test_cong_them_3():',
      '    assert nhiet_do_sau == 28',
      '',
      '',
      'def test_ghep_thanh_cau():',
      '    assert cau == "Nhiet do: 28"',
    ].join('\n'),
  },
  { title: 'Thử thách: Cảm biến báo số bằng chữ', markdown: BAI_THU_THACH, minutes: 10 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Buổi 6 — print(), input() và f-string
// ═══════════════════════════════════════════════════════════════════════════

export const thuThachB06: BlockSpec = challenge(
  {
    slug: 'p-b06-toc-do-drone',
    title: 'Tính tốc độ của drone',
    statement: [
      'Drone của em bay được một **quãng đường** (mét) trong một khoảng **thời gian** (giây). ' +
        'Trạm điều khiển muốn biết **tốc độ** — tức là mỗi giây drone bay được bao nhiêu mét.',
      '',
      '**Đầu vào.** Hai dòng: quãng đường (mét), rồi thời gian (giây). Cả hai là số nguyên, ' +
        'thời gian luôn lớn hơn 0.',
      '',
      '**Đầu ra.** Một dòng, tốc độ làm tròn **2 chữ số thập phân**:',
      '',
      '```',
      'Toc do: 12.00 m/s',
      '```',
      '',
      'Chương trình đã đọc hai số và in gần xong. Em điền **hai chỗ**:',
      '',
      '1. `toc_do = quang_duong ??? thoi_gian` — tốc độ = quãng đường **chia** thời gian.',
      '2. `print(f"Toc do: {???:.2f} m/s")` — tên biến cần hiện ra trong f-string.',
      '',
      'Mẹo: ô **Dữ liệu đầu vào** dưới khung soạn thảo — gõ `120` rồi xuống dòng gõ `10`, bấm ' +
        '**Chạy thử** là thấy kết quả ngay.',
    ].join('\n'),
    hints: [
      'Tốc độ = quãng đường **chia** thời gian. Dấu chia thường là `/`.',
      'Trong `{...:.2f}`, phần trước dấu `:` là **tên biến** em muốn in; `.2f` là "hai chữ số thập phân".',
      'Chạy thử với `120` và `10`: phải ra `Toc do: 12.00 m/s`. Nếu ra `12.0` là em quên `.2f` — nhưng phần đó đã có sẵn rồi, đừng xoá nhé.',
    ],
    starterCode: [
      '# Trạm điều khiển gửi xuống hai số: quãng đường (m) và thời gian (s).',
      'quang_duong = int(input())',
      'thoi_gian = int(input())',
      '',
      '# 1) Tốc độ = quãng đường CHIA thời gian. Điền dấu chia.',
      'toc_do = quang_duong ??? thoi_gian',
      '',
      '# 2) In tốc độ với 2 chữ số thập phân. Điền TÊN BIẾN vào trước dấu hai chấm.',
      'print(f"Toc do: {???:.2f} m/s")',
    ].join('\n'),
    solutionCode: [
      'quang_duong = int(input())',
      'thoi_gian = int(input())',
      '',
      'toc_do = quang_duong / thoi_gian',
      '',
      'print(f"Toc do: {toc_do:.2f} m/s")',
    ].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample('120\n10\n', 'Toc do: 12.00 m/s\n', '120 mét trong 10 giây là 12 mét mỗi giây.'),
      sample(
        '7\n2\n',
        'Toc do: 3.50 m/s\n',
        'Kết quả có phần thập phân — vì thế mới cần `/` chứ không phải `//`.',
      ),
      hidden('100\n8\n', 'Toc do: 12.50 m/s\n', 25),
      hidden('0\n5\n', 'Toc do: 0.00 m/s\n', 25),
      hidden('1\n3\n', 'Toc do: 0.33 m/s\n', 25),
      hidden('9\n9\n', 'Toc do: 1.00 m/s\n', 25),
    ],
  },
  { title: 'Thử thách: Tính tốc độ của drone', markdown: BAI_THU_THACH, minutes: 12 },
);
