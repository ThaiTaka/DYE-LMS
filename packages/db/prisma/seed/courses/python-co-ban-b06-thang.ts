/**
 * Python Cơ Bản — Buổi 6, the ten-rung `IO_MATCH` coding ladder.
 *
 * ── Why the ladder lives in Buổi 6 and not earlier ───────────────────────────
 * An auto-graded task is judged by comparing stdout, so it cannot exist before
 * the student can produce stdout — and this course withholds `print()` on
 * purpose. Buổi 1–5 run entirely in the REPL, where an expression echoes its own
 * value, so a beginner meets results without meeting a function call first.
 * Buổi 6 is the hinge the curriculum was built around: its own teacher note
 * calls it the first session where students run a program from a file rather
 * than the REPL, and Module 2 opens with "từ buổi này chương trình bắt đầu biết
 * nói chuyện".
 *
 * So this is the earliest session where a graded ladder is possible at all, and
 * it is also where it belongs. Before Buổi 6 there is nothing to grade; the
 * `note-1` build assertion that bans `print()` in Buổi 1–2 is the floor of that
 * rule, not the whole of it.
 *
 * ── What the rungs may and may not use ───────────────────────────────────────
 * The hard ceiling is what a student has actually been taught by session six:
 *
 *     Buổi 1–2   arithmetic, operator precedence, `/` `//` `%`, comments
 *     Buổi 3     variables; int, float, str, bool; `type()`
 *     Buổi 4     casting with `int()`, `float()`, `str()`
 *     Buổi 5     `**`, comparison operators, `and` / `or` / `not`, `=` vs `==`
 *     Buổi 6     `print()`, `input()`, f-strings, `{:.2f}`
 *
 * `if` arrives in Buổi 8 and `for` / `while` in Buổi 12–13, so NOTHING here uses
 * them. That constraint is what makes rungs 9 and 10 interesting rather than
 * impossible: a boss task solvable only with syntax the student has never seen
 * is not difficult, it is unfair. Both are therefore branch-free by
 * construction — rung 9 pulls a number apart with `//` and `%`, and rung 10
 * replaces an `if` with a boolean expression cast to `int`.
 *
 * ── Difficulty is expressed as TIER, not as a lock ───────────────────────────
 * The rungs climb CO_BAN → THU_THACH → NANG_CAO → MO_RONG. A student working at
 * Cơ bản has rungs 1–5 counted as their required work and sees 6–10 as
 * EXPLORATION: visible, encouraged, never counted against them. That is how a
 * single 90-minute session carries ten graded tasks without any child being
 * expected to finish all ten.
 *
 * ── Test-case rules followed throughout ──────────────────────────────────────
 *   • Every task ships at least two SAMPLE tests (visible, worth 0, carrying the
 *     teaching explanation) and at least four HIDDEN tests that actually assess.
 *   • Fixed-output rungs still get hidden tests, and they are not duplicates of
 *     the sample: they feed stray stdin and still expect the fixed answer, which
 *     catches the classic `print(input())` misfire.
 *   • What a stdout comparison CANNOT catch is hard-coding on a zero-input rung:
 *     `print(2026)` and `print("2026")` are byte-identical on the wire. Rungs 1–3
 *     therefore say so out loud rather than pretending otherwise, and motivate
 *     the habit by pointing at rung 4, where the data changes every run and a
 *     typed-in constant stops working immediately. A rule the grader cannot
 *     enforce, asserted as though it could, teaches children that the rules are
 *     theatre.
 *   • No float lands on a `.xx5` rounding boundary. `f"{9.25:.1f}"` is `9.2` in
 *     Python, not `9.3`, and a 12-year-old losing marks to round-half-even is
 *     learning nothing except that the machine is arbitrary.
 */
import { codingTask, hidden, sample, theory } from '../builders.ts';

import type { BlockSpec } from '../types.ts';

/**
 * The rail the ladder opens with.
 *
 * Two constructs are introduced here because rungs 8 and 10 need them and the
 * lesson does not otherwise teach them: zero-padded integer formatting, and the
 * fact that a `bool` casts to 1 or 0. The second is the whole trick of the final
 * boss, so it is taught in the open rather than hidden as a gotcha — the
 * difficulty of that task is meant to be working out the leap-year RULE, not
 * guessing an undocumented language fact.
 */
const moDau: BlockSpec = theory(
  'Thang 10 bài — em leo tới bậc nào cũng tốt',
  [
    'Mười bài dưới đây có **chấm điểm tự động**: em viết chương trình, máy chạy thử với',
    'nhiều bộ dữ liệu khác nhau, rồi báo lại kết quả ngay.',
    '',
    '| Bậc | Nội dung | Dành cho |',
    '|---|---|---|',
    '| 1–3 | `print()` với nội dung có sẵn | Cả lớp |',
    '| 4–5 | Đọc dữ liệu bằng `input()` rồi in ra | Cả lớp |',
    '| 6–7 | Nhiều biến, nhiều dòng, định dạng số | Em nào muốn chắc thêm |',
    '| 8 | Đổi đơn vị bằng `//` và `%` | Thử thách |',
    '| 9–10 | Hai bài trùm — nghĩ thuật toán | Em nào còn muốn nghịch tiếp |',
    '',
    'Làm hết **5 bậc đầu** là em đã nắm chắc buổi 6. Từ bậc 6 trở lên là phần làm thêm:',
    'không làm cũng hoàn toàn bình thường, và không ảnh hưởng gì tới tiến độ của em.',
    '',
    '### Hai mẹo nhỏ em sẽ cần ở bậc 8 và bậc 10',
    '',
    '**1. Thêm số 0 cho đủ chữ số.** Đồng hồ luôn viết `07` chứ không viết `7`.',
    'F-string làm việc đó bằng `{gio:02d}` — "d" là số nguyên, "02" là *"cho đủ 2 chữ số,',
    'thiếu thì chèn số 0 vào trước"*.',
    '',
    '**2. `True` đổi thành số thì bằng 1, `False` bằng 0.** Nghe lạ nhưng rất tiện:',
    '`int(True)` cho ra `1`, `int(False)` cho ra `0`. Nhờ vậy em cộng thẳng một điều kiện',
    'vào phép tính mà chưa cần học câu lệnh rẽ nhánh (buổi 8 mới học).',
    '',
    '```python',
    'gio = 7',
    'print(f"{gio:02d} gio")        # 07 gio',
    '',
    'du_dieu_kien = 10 > 3',
    'print(du_dieu_kien)            # True',
    'print(100 + int(du_dieu_kien)) # 101',
    '```',
    '',
    '> 💡 **Đọc kỹ mẫu đầu ra trước khi viết.** Máy so sánh từng ký tự, nên thừa hay thiếu',
    '> một dấu cách cũng bị báo chưa đạt. Đây không phải bắt bẻ — lập trình thật cũng vậy.',
  ].join('\n'),
  [
    '`{x:02d}` in số nguyên có đủ 2 chữ số, thiếu thì thêm 0 ở trước',
    '`int(True)` là 1, `int(False)` là 0',
    'Máy so từng ký tự — thừa một dấu cách cũng chưa đạt',
    'Xong 5 bậc đầu là đã nắm chắc buổi này',
  ],
  { minutes: 10 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Bậc 1–3 · Khởi động — in nội dung có sẵn
// ═══════════════════════════════════════════════════════════════════════════

const bac01 = codingTask(
  {
    slug: 'p-b06-l01-loi-chao-dau-tien',
    title: 'Bậc 1. Lời chào đầu tiên',
    statement: [
      'Viết chương trình in ra **đúng một dòng**:',
      '',
      '```',
      'Xin chao Da Lat!',
      '```',
      '',
      'Chương trình này **không đọc gì** từ bàn phím — nội dung đã cố định sẵn.',
      '',
      'Chú ý viết **không dấu**, đúng chữ hoa chữ thường, và có dấu `!` ở cuối.',
    ].join('\n'),
    hints: [
      'Chỉ cần đúng một lệnh `print()`.',
      'Nội dung là chữ, nên phải nằm trong cặp dấu nháy: `print("...")`.',
      'Chép y nguyên dòng trong đề, kể cả dấu chấm than.',
    ],
    starterCode: ['# In ra đúng một dòng: Xin chao Da Lat!', ''].join('\n'),
    solutionCode: 'print("Xin chao Da Lat!")',
    tier: 'CO_BAN',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        '',
        'Xin chao Da Lat!\n',
        'Bài này không có dữ liệu vào. Em chỉ cần in đúng dòng chữ trong đề.',
      ),
      /*
       * Stray stdin, same expected answer.
       *
       * A fixed-output task has nothing for a hidden test to vary, so instead it
       * varies what arrives on the input stream. This catches the single most
       * common wrong answer at this rung — `print(input())`, which echoes
       * whatever it was fed and passes the sample by accident when the sample
       * has no input.
       */
      hidden('mot dong thua\n', 'Xin chao Da Lat!\n', 40),
      hidden('123\n456\n', 'Xin chao Da Lat!\n', 30),
      hidden('\n', 'Xin chao Da Lat!\n', 30),
    ],
  },
  {
    markdown:
      'Bài đầu tiên của thang. Rất ngắn — mục đích là để em quen với việc nộp bài và đọc kết quả chấm.',
    minutes: 6,
  },
);

const bac02 = codingTask(
  {
    slug: 'p-b06-l02-ba-dong-gioi-thieu',
    title: 'Bậc 2. Ba dòng giới thiệu',
    statement: [
      'In ra **đúng ba dòng**, theo đúng thứ tự này:',
      '',
      '```',
      'DYE LMS',
      'Lop hoc lap trinh',
      'Da Lat 2026',
      '```',
      '',
      'Vẫn **không đọc gì** từ bàn phím.',
      '',
      'Điều em cần nhận ra ở bài này: **mỗi lệnh `print()` tự xuống dòng**, nên ba dòng',
      'nghĩa là ba lệnh `print()` xếp chồng lên nhau.',
    ].join('\n'),
    hints: [
      'Ba dòng thì cần ba lệnh `print()`.',
      'Các lệnh chạy lần lượt từ trên xuống, nên thứ tự viết chính là thứ tự in ra.',
      'Không cần thêm gì để xuống dòng — `print()` đã tự làm việc đó.',
    ],
    starterCode: ['# In ra ba dòng theo đúng thứ tự trong đề', 'print("DYE LMS")', ''].join('\n'),
    solutionCode: [
      'print("DYE LMS")',
      'print("Lop hoc lap trinh")',
      'print("Da Lat 2026")',
    ].join('\n'),
    tier: 'CO_BAN',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        '',
        'DYE LMS\nLop hoc lap trinh\nDa Lat 2026\n',
        'Ba lệnh print() xếp chồng cho ra ba dòng, đúng thứ tự em viết.',
      ),
      hidden('du lieu thua\n', 'DYE LMS\nLop hoc lap trinh\nDa Lat 2026\n', 40),
      hidden('\n\n\n', 'DYE LMS\nLop hoc lap trinh\nDa Lat 2026\n', 30),
      hidden('x\n', 'DYE LMS\nLop hoc lap trinh\nDa Lat 2026\n', 30),
    ],
  },
  { markdown: 'Vẫn là nội dung cố định, nhưng lần này chương trình của em có nhiều hơn một dòng lệnh.', minutes: 6 },
);

const bac03 = codingTask(
  {
    slug: 'p-b06-l03-in-so-va-phep-tinh',
    title: 'Bậc 3. In số và kết quả phép tính',
    statement: [
      'In ra **đúng ba dòng**:',
      '',
      '1. Dòng 1: số `2026`',
      '2. Dòng 2: kết quả của phép tính `2026 - 1975`',
      '3. Dòng 3: kết quả của phép tính `100 / 8`',
      '',
      '**Không đọc gì** từ bàn phím.',
      '',
      '> 🧠 **Em hãy đặt thẳng phép tính vào `print()`** và để Python tự tính.',
      '> Nói thật với em: máy chấm chỉ nhìn dòng chữ in ra, nên gõ sẵn số `51` vào cũng được',
      '> chấm đạt — bài này máy không kiểm tra được điều đó.',
      '> Nhưng từ bậc 4 trở đi, dữ liệu **thay đổi sau mỗi lần chạy**. Lúc ấy con số gõ sẵn',
      '> sẽ sai ngay, còn phép tính thì luôn đúng. Tập thói quen từ bây giờ cho nhẹ về sau.',
      '',
      'Kết quả mong đợi:',
      '',
      '```',
      '2026',
      '51',
      '12.5',
      '```',
      '',
      'Để ý dòng 3: phép chia `/` **luôn** cho số thực, nên `100 / 8` ra `12.5` chứ không ra `12`.',
    ].join('\n'),
    hints: [
      'Số thì KHÔNG cần dấu nháy: `print(2026)` chứ không phải `print("2026")`.',
      'Em đặt thẳng phép tính vào trong print: `print(2026 - 1975)`.',
      'Nhớ dùng dấu `/` cho phép chia, và đừng làm tròn gì cả.',
    ],
    starterCode: [
      '# Dòng 1: in số 2026',
      'print(2026)',
      '',
      '# Dòng 2: in kết quả 2026 - 1975',
      '',
      '# Dòng 3: in kết quả 100 / 8',
    ].join('\n'),
    solutionCode: ['print(2026)', 'print(2026 - 1975)', 'print(100 / 8)'].join('\n'),
    tier: 'CO_BAN',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        '',
        '2026\n51\n12.5\n',
        'Số không cần dấu nháy. Phép chia / cho ra 12.5 — có phần thập phân.',
      ),
      // Stray stdin, fixed answer. A hidden test identical to the sample would
      // assess nothing; feeding the first expected line back in catches the
      // `print(input())` misfire, which would otherwise pass the empty sample.
      hidden('thua\n', '2026\n51\n12.5\n', 40),
      hidden('2026\n', '2026\n51\n12.5\n', 30),
      hidden('0\n', '2026\n51\n12.5\n', 30),
    ],
  },
  {
    markdown:
      'Bậc cuối của phần khởi động. Điểm mới: `print()` nhận được cả một phép tính, không chỉ nhận chữ.',
    minutes: 8,
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Bậc 4–5 · Đọc dữ liệu vào rồi in ra
// ═══════════════════════════════════════════════════════════════════════════

const bac04 = codingTask(
  {
    slug: 'p-b06-l04-chao-theo-ten',
    title: 'Bậc 4. Chào theo tên',
    statement: [
      'Chương trình đọc **một dòng** từ bàn phím là **tên** của một bạn,',
      'rồi in ra **đúng một dòng** theo mẫu:',
      '',
      '```',
      'Xin chao <ten>!',
      '```',
      '',
      'Ví dụ, nếu dữ liệu vào là `Lan` thì in ra `Xin chao Lan!`.',
      '',
      'Tên có thể có **dấu cách** ở giữa (ví dụ `Nam Anh`) — `input()` đọc trọn cả dòng',
      'nên em không phải xử lý gì thêm.',
    ].join('\n'),
    hints: [
      'Đọc một dòng bằng `ten = input()`.',
      'Ghép chữ với biến bằng f-string: `print(f"Xin chao {ten}!")`.',
      'Đừng quên chữ `f` ngay trước dấu nháy mở, nếu thiếu thì `{ten}` sẽ bị in ra nguyên văn.',
    ],
    starterCode: ['ten = input()', '', '# In lời chào bằng f-string ở đây', ''].join('\n'),
    solutionCode: ['ten = input()', 'print(f"Xin chao {ten}!")'].join('\n'),
    tier: 'CO_BAN',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample('Lan\n', 'Xin chao Lan!\n', 'Giá trị đọc được thay vào đúng chỗ {ten} trong f-string.'),
      sample(
        'Nam Anh\n',
        'Xin chao Nam Anh!\n',
        'input() đọc trọn một dòng, nên tên có dấu cách vẫn vào đủ.',
      ),
      hidden('Bao\n', 'Xin chao Bao!\n', 25),
      hidden('Nguyen Van A\n', 'Xin chao Nguyen Van A!\n', 25),
      hidden('Ha\n', 'Xin chao Ha!\n', 25),
      hidden('Tran Thi Bich Ngoc\n', 'Xin chao Tran Thi Bich Ngoc!\n', 25),
    ],
  },
  { markdown: 'Từ bài này trở đi chương trình bắt đầu **nhận dữ liệu**, nên mỗi lần chạy cho kết quả khác nhau.', minutes: 8 },
);

const bac05 = codingTask(
  {
    slug: 'p-b06-l05-tong-hai-so',
    title: 'Bậc 5. Tổng hai số',
    statement: [
      'Chương trình đọc **hai dòng**, mỗi dòng là một **số nguyên**.',
      '',
      'In ra **đúng một dòng** theo mẫu:',
      '',
      '```',
      '<a> + <b> = <tong>',
      '```',
      '',
      'Ví dụ với dữ liệu vào `3` và `5`, kết quả là:',
      '',
      '```',
      '3 + 5 = 8',
      '```',
      '',
      '> ⚠️ **Bẫy hay gặp:** `input()` luôn trả về **chữ**, kể cả khi em gõ số.',
      '> Nếu cộng thẳng hai chuỗi thì `"3" + "5"` ra `"35"` chứ không ra `8`.',
      '> Phải ép về số nguyên bằng `int()` trước.',
      '',
      'Số có thể **âm**. Khi đó cứ in đúng như mẫu, ví dụ `-7 + 7 = 0`.',
    ].join('\n'),
    hints: [
      'Ép kiểu ngay lúc đọc: `a = int(input())`.',
      'Trong f-string em đặt được cả phép tính: `{a + b}`.',
      'Nhớ đủ dấu cách quanh dấu `+` và dấu `=` như trong mẫu.',
      'Nếu kết quả ra kiểu `35` thay vì `8` thì em đang cộng chuỗi, chưa ép kiểu.',
    ],
    starterCode: [
      'a = int(input())',
      'b = int(input())',
      '',
      '# In theo mẫu: a + b = tong',
      '',
    ].join('\n'),
    solutionCode: ['a = int(input())', 'b = int(input())', 'print(f"{a} + {b} = {a + b}")'].join(
      '\n',
    ),
    tier: 'CO_BAN',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample('3\n5\n', '3 + 5 = 8\n', 'Chú ý đủ dấu cách quanh + và = , đúng y như mẫu.'),
      sample(
        '12\n0\n',
        '12 + 0 = 12\n',
        'Cộng với 0 vẫn phải in đủ cả ba phần, không được rút gọn.',
      ),
      hidden('100\n250\n', '100 + 250 = 350\n', 25),
      hidden('-7\n7\n', '-7 + 7 = 0\n', 25),
      hidden('0\n0\n', '0 + 0 = 0\n', 25),
      hidden('999\n-1000\n', '999 + -1000 = -1\n', 25),
    ],
  },
  { markdown: 'Bài này gộp cả ba thứ vừa học: `input()`, ép kiểu bằng `int()`, và f-string.', minutes: 10 },
);

// ═══════════════════════════════════════════════════════════════════════════
// Bậc 6–7 · Nhiều biến, nhiều dòng, định dạng số
// ═══════════════════════════════════════════════════════════════════════════

const bac06 = codingTask(
  {
    slug: 'p-b06-l06-chu-vi-dien-tich',
    title: 'Bậc 6. Chu vi và diện tích',
    statement: [
      'Chương trình đọc **hai dòng**: **chiều dài** rồi **chiều rộng** của một hình chữ nhật',
      '(cả hai đều là số nguyên dương).',
      '',
      'In ra **đúng hai dòng**:',
      '',
      '```',
      'Chu vi: <chu vi>',
      'Dien tich: <dien tich>',
      '```',
      '',
      'Nhắc lại công thức:',
      '',
      '- Chu vi = (chiều dài + chiều rộng) × 2',
      '- Diện tích = chiều dài × chiều rộng',
      '',
      'Ví dụ với chiều dài `5` và chiều rộng `3`:',
      '',
      '```',
      'Chu vi: 16',
      'Dien tich: 15',
      '```',
    ].join('\n'),
    hints: [
      'Dấu nhân trong Python là `*`, không phải `x`.',
      'Nhớ đặt ngoặc: `(dai + rong) * 2`. Thiếu ngoặc thì phép nhân chạy trước và ra sai.',
      'Hai dòng thì cần hai lệnh `print()`.',
      'Nhãn có dấu hai chấm rồi MỘT dấu cách: `Chu vi: 16`.',
    ],
    starterCode: [
      'dai = int(input())',
      'rong = int(input())',
      '',
      '# Tính rồi in ra hai dòng theo mẫu',
      '',
    ].join('\n'),
    solutionCode: [
      'dai = int(input())',
      'rong = int(input())',
      'chu_vi = (dai + rong) * 2',
      'dien_tich = dai * rong',
      'print(f"Chu vi: {chu_vi}")',
      'print(f"Dien tich: {dien_tich}")',
    ].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample('5\n3\n', 'Chu vi: 16\nDien tich: 15\n', '(5 + 3) × 2 = 16 và 5 × 3 = 15.'),
      sample(
        '10\n10\n',
        'Chu vi: 40\nDien tich: 100\n',
        'Hình vuông cũng là hình chữ nhật — công thức không đổi.',
      ),
      hidden('1\n1\n', 'Chu vi: 4\nDien tich: 1\n', 25),
      hidden('100\n25\n', 'Chu vi: 250\nDien tich: 2500\n', 25),
      hidden('7\n13\n', 'Chu vi: 40\nDien tich: 91\n', 25),
      hidden('2\n999\n', 'Chu vi: 2002\nDien tich: 1998\n', 25),
    ],
  },
  {
    markdown:
      'Từ bậc này trở lên là phần **làm thêm** — không làm cũng không sao. Bài đầu tiên có hai biến và hai dòng kết quả.',
    minutes: 12,
  },
);

const bac07 = codingTask(
  {
    slug: 'p-b06-l07-the-hoc-sinh',
    title: 'Bậc 7. Thẻ học sinh',
    statement: [
      'Chương trình đọc **bốn dòng**, theo đúng thứ tự:',
      '',
      '1. Họ tên (chữ)',
      '2. Lớp (chữ)',
      '3. Chiều cao tính bằng mét (số thực)',
      '4. Điểm trung bình (số thực)',
      '',
      'In ra **đúng bốn dòng** theo mẫu:',
      '',
      '```',
      'Ho ten: <ho ten>',
      'Lop: <lop>',
      'Chieu cao: <chieu cao> m',
      'Diem TB: <diem>',
      '```',
      '',
      'Trong đó:',
      '',
      '- **Chiều cao** hiển thị **đúng 2 chữ số thập phân**',
      '- **Điểm trung bình** hiển thị **đúng 1 chữ số thập phân**',
      '',
      'Ví dụ với `Lan`, `7A1`, `1.523`, `8.5`:',
      '',
      '```',
      'Ho ten: Lan',
      'Lop: 7A1',
      'Chieu cao: 1.52 m',
      'Diem TB: 8.5',
      '```',
    ].join('\n'),
    hints: [
      'Hai dòng đầu là chữ nên đọc thẳng bằng `input()`, không ép kiểu.',
      'Hai dòng sau là số thực nên cần `float(input())`.',
      'Định dạng 2 chữ số thập phân là `{chieu_cao:.2f}`, 1 chữ số là `{diem:.1f}`.',
      'Đừng quên chữ ` m` (có dấu cách ở trước) ở cuối dòng chiều cao.',
    ],
    starterCode: [
      'ho_ten = input()',
      'lop = input()',
      'chieu_cao = float(input())',
      'diem = float(input())',
      '',
      '# In ra bốn dòng theo mẫu',
      '',
    ].join('\n'),
    solutionCode: [
      'ho_ten = input()',
      'lop = input()',
      'chieu_cao = float(input())',
      'diem = float(input())',
      'print(f"Ho ten: {ho_ten}")',
      'print(f"Lop: {lop}")',
      'print(f"Chieu cao: {chieu_cao:.2f} m")',
      'print(f"Diem TB: {diem:.1f}")',
    ].join('\n'),
    tier: 'THU_THACH',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        'Lan\n7A1\n1.523\n8.5\n',
        'Ho ten: Lan\nLop: 7A1\nChieu cao: 1.52 m\nDiem TB: 8.5\n',
        '1.523 rút còn 2 chữ số thập phân thành 1.52. Điểm 8.5 giữ nguyên 1 chữ số.',
      ),
      sample(
        'Minh\n6A2\n1.4\n9.26\n',
        'Ho ten: Minh\nLop: 6A2\nChieu cao: 1.40 m\nDiem TB: 9.3\n',
        '1.4 phải hiện thành 1.40 — định dạng .2f luôn thêm cho đủ 2 chữ số.',
      ),
      hidden(
        'Bao\n8B\n1.6\n7.0\n',
        'Ho ten: Bao\nLop: 8B\nChieu cao: 1.60 m\nDiem TB: 7.0\n',
        25,
      ),
      hidden(
        'Nguyen Van A\n9C1\n1.75\n10\n',
        'Ho ten: Nguyen Van A\nLop: 9C1\nChieu cao: 1.75 m\nDiem TB: 10.0\n',
        25,
      ),
      hidden(
        'Ha\n7A2\n1.382\n6.44\n',
        'Ho ten: Ha\nLop: 7A2\nChieu cao: 1.38 m\nDiem TB: 6.4\n',
        25,
      ),
      hidden(
        'Tran Bich Ngoc\n6A1\n1.208\n5.97\n',
        'Ho ten: Tran Bich Ngoc\nLop: 6A1\nChieu cao: 1.21 m\nDiem TB: 6.0\n',
        25,
      ),
    ],
  },
  {
    markdown:
      'Bài này gần với một chương trình thật: nhiều dữ liệu vào, nhiều dòng ra, và mỗi số có kiểu định dạng riêng.',
    minutes: 12,
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Bậc 8 · Đổi đơn vị bằng `//` và `%`
// ═══════════════════════════════════════════════════════════════════════════

const bac08 = codingTask(
  {
    slug: 'p-b06-l08-doi-giay-sang-dong-ho',
    title: 'Bậc 8. Đổi giây sang giờ : phút : giây',
    statement: [
      'Chương trình đọc **một dòng** là số giây (số nguyên, từ `0` đến `86399`).',
      '',
      'In ra **đúng một dòng** dạng đồng hồ:',
      '',
      '```',
      '<gio>:<phut>:<giay>',
      '```',
      '',
      'Mỗi phần **luôn có đúng 2 chữ số** — thiếu thì thêm số `0` ở trước, y như đồng hồ thật.',
      '',
      'Ví dụ:',
      '',
      '| Dữ liệu vào | Kết quả | Vì sao |',
      '|---|---|---|',
      '| `3661` | `01:01:01` | 1 giờ, 1 phút, 1 giây |',
      '| `59` | `00:00:59` | Chưa đủ 1 phút |',
      '| `86399` | `23:59:59` | Một giây trước nửa đêm |',
      '',
      '**Gợi ý cách nghĩ.** Một giờ có 3600 giây. Vậy:',
      '',
      '- Số giờ = số giây **chia lấy phần nguyên** cho 3600 → dùng `//`',
      '- Phần còn thừa = số giây **chia lấy phần dư** cho 3600 → dùng `%`',
      '- Rồi làm y hệt như vậy với phần thừa và số 60',
    ].join('\n'),
    hints: [
      '`//` cho phần nguyên, `%` cho phần dư. Ví dụ `3661 // 3600` là `1`, còn `3661 % 3600` là `61`.',
      'Làm hai bước: tách giờ ra trước, rồi mới tách phút và giây từ phần còn lại.',
      'Thêm số 0 cho đủ 2 chữ số bằng `{gio:02d}` — đã có ở phần lý thuyết đầu thang.',
      'Nếu ra `1:1:1` thay vì `01:01:01` thì em quên phần `:02d`.',
    ],
    starterCode: [
      'tong_giay = int(input())',
      '',
      '# Tách giờ, phút, giây bằng // và %',
      'gio = tong_giay // 3600',
      'con_lai = tong_giay % 3600',
      '',
      '# Tách tiếp phút và giây từ con_lai, rồi in ra',
      '',
    ].join('\n'),
    solutionCode: [
      'tong_giay = int(input())',
      'gio = tong_giay // 3600',
      'con_lai = tong_giay % 3600',
      'phut = con_lai // 60',
      'giay = con_lai % 60',
      'print(f"{gio:02d}:{phut:02d}:{giay:02d}")',
    ].join('\n'),
    tier: 'NANG_CAO',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample('3661\n', '01:01:01\n', '3661 = 1 giờ + 1 phút + 1 giây. Mỗi phần đủ 2 chữ số.'),
      sample('59\n', '00:00:59\n', 'Chưa đủ một phút, nên giờ và phút đều là 00 — không được bỏ đi.'),
      hidden('0\n', '00:00:00\n', 20),
      hidden('86399\n', '23:59:59\n', 20),
      hidden('3600\n', '01:00:00\n', 20),
      hidden('7325\n', '02:02:05\n', 20),
      hidden('600\n', '00:10:00\n', 10),
      hidden('45296\n', '12:34:56\n', 10),
    ],
  },
  {
    markdown:
      'Bậc thử thách. Không có phép tính nào khó — cái khó là **nghĩ ra thứ tự các bước** để tách một con số thành ba phần.',
    minutes: 15,
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Bậc 9–10 · Hai bài trùm
// ═══════════════════════════════════════════════════════════════════════════

const bac09 = codingTask(
  {
    slug: 'p-b06-l09-tach-chu-so',
    title: 'Bậc 9. Bài trùm 1 — Mổ xẻ một con số',
    statement: [
      'Chương trình đọc **một dòng** là số nguyên có **đúng 4 chữ số** (từ `1000` đến `9999`).',
      '',
      'In ra **đúng ba dòng**:',
      '',
      '```',
      'Chu so: <a> <b> <c> <d>',
      'Tong: <tổng 4 chữ số>',
      'Dao nguoc: <số viết ngược lại>',
      '```',
      '',
      'Trong đó `a b c d` là bốn chữ số **theo đúng thứ tự từ trái sang phải**, cách nhau một dấu cách.',
      '',
      'Ví dụ với `5271`:',
      '',
      '```',
      'Chu so: 5 2 7 1',
      'Tong: 15',
      'Dao nguoc: 1725',
      '```',
      '',
      '> ⚠️ **Trường hợp đặc biệt em phải nghĩ tới:** nếu chữ số cuối là `0` thì số đảo ngược',
      '> sẽ **ngắn hơn 4 chữ số**. Ví dụ `1000` đảo lại thành `1`, chứ không phải `0001`.',
      '> Đó là đúng — số `0001` chính là số `1`.',
      '',
      '**Không được dùng vòng lặp hay câu lệnh rẽ nhánh** (chưa học tới). Cả bài này giải được',
      'chỉ bằng `//` và `%`.',
    ].join('\n'),
    hints: [
      'Chữ số hàng nghìn là `n // 1000`. Thử nghĩ xem hàng đơn vị là gì.',
      'Hàng đơn vị là `n % 10`. Hàng chục là `n // 10 % 10` — chia bỏ hàng đơn vị đi rồi lấy dư 10.',
      'Cứ theo mẫu đó: `n // 100 % 10` cho hàng trăm.',
      'Để đảo ngược, em ghép lại: chữ số cuối thành hàng nghìn, tức là `d * 1000 + c * 100 + b * 10 + a`.',
      'Ba dòng kết quả là ba lệnh print riêng.',
    ],
    starterCode: [
      'n = int(input())',
      '',
      '# Tách từng chữ số bằng // và %',
      'a = n // 1000',
      'b = n // 100 % 10',
      '',
      '# Tách nốt c và d, rồi tính tổng và số đảo ngược',
      '',
    ].join('\n'),
    solutionCode: [
      'n = int(input())',
      'a = n // 1000',
      'b = n // 100 % 10',
      'c = n // 10 % 10',
      'd = n % 10',
      'tong = a + b + c + d',
      'dao_nguoc = d * 1000 + c * 100 + b * 10 + a',
      'print(f"Chu so: {a} {b} {c} {d}")',
      'print(f"Tong: {tong}")',
      'print(f"Dao nguoc: {dao_nguoc}")',
    ].join('\n'),
    tier: 'NANG_CAO',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        '5271\n',
        'Chu so: 5 2 7 1\nTong: 15\nDao nguoc: 1725\n',
        '5+2+7+1 = 15. Đảo lại: chữ số 1 lên hàng nghìn, thành 1725.',
      ),
      sample(
        '1000\n',
        'Chu so: 1 0 0 0\nTong: 1\nDao nguoc: 1\n',
        'Đảo 1000 ra 0001, mà 0001 chính là số 1 — nên chỉ in ra 1.',
      ),
      hidden('9999\n', 'Chu so: 9 9 9 9\nTong: 36\nDao nguoc: 9999\n', 20),
      hidden('1234\n', 'Chu so: 1 2 3 4\nTong: 10\nDao nguoc: 4321\n', 20),
      hidden('2026\n', 'Chu so: 2 0 2 6\nTong: 10\nDao nguoc: 6202\n', 20),
      hidden('4090\n', 'Chu so: 4 0 9 0\nTong: 13\nDao nguoc: 904\n', 20),
      hidden('1001\n', 'Chu so: 1 0 0 1\nTong: 2\nDao nguoc: 1001\n', 10),
      hidden('8500\n', 'Chu so: 8 5 0 0\nTong: 13\nDao nguoc: 58\n', 10),
    ],
  },
  {
    markdown:
      'Bài trùm thứ nhất. Không có lệnh nào mới — cái khó nằm ở chỗ **tự nghĩ ra công thức** tách và ghép lại một con số.',
    minutes: 18,
  },
);

const bac10 = codingTask(
  {
    slug: 'p-b06-l10-nam-nhuan',
    title: 'Bậc 10. Bài trùm 2 — Năm nhuận',
    statement: [
      'Chương trình đọc **một dòng** là một năm (số nguyên từ `1` đến `9999`).',
      '',
      'In ra **đúng ba dòng**:',
      '',
      '```',
      'Nam <năm>',
      'Nam nhuan: <True hoặc False>',
      'So ngay: <365 hoặc 366>',
      '```',
      '',
      '### Quy tắc năm nhuận',
      '',
      'Một năm là năm nhuận khi thoả **một trong hai** điều kiện sau:',
      '',
      '1. Chia hết cho `4` **nhưng không** chia hết cho `100`',
      '2. **Hoặc** chia hết cho `400`',
      '',
      'Nghe rối, nên thử vài năm cho rõ:',
      '',
      '| Năm | Chia hết 4? | Chia hết 100? | Chia hết 400? | Nhuận? |',
      '|---|---|---|---|---|',
      '| 2024 | có | không | không | **có** — thoả điều kiện 1 |',
      '| 2023 | không | không | không | không |',
      '| 1900 | có | có | không | **không** — vướng điều kiện 1, không cứu được bằng điều kiện 2 |',
      '| 2000 | có | có | có | **có** — điều kiện 2 cứu |',
      '',
      'Năm nhuận có **366** ngày, năm thường có **365** ngày.',
      '',
      '### Hai ràng buộc làm nên độ khó',
      '',
      '**Không được dùng `if`** — buổi 8 mới học. Em phải viết cả quy tắc trên thành **một biểu thức',
      'đúng/sai duy nhất**, dùng `%`, `==`, `!=`, `and`, `or` (đã học ở buổi 5).',
      '',
      '**Không được dùng `if` để chọn 365 hay 366** nữa. Hãy nhớ lại mẹo ở đầu thang:',
      '`int(True)` là `1` và `int(False)` là `0` — nên số ngày viết được thành một phép cộng.',
      '',
      'Ví dụ với `2024`:',
      '',
      '```',
      'Nam 2024',
      'Nam nhuan: True',
      'So ngay: 366',
      '```',
    ].join('\n'),
    hints: [
      '"Chia hết cho 4" viết là `nam % 4 == 0`. "Không chia hết cho 100" viết là `nam % 100 != 0`.',
      'Nối hai điều kiện phải cùng đúng bằng `and`, nối hai khả năng bằng `or`.',
      'Khung bài: `la_nhuan = (nam % 4 == 0 and nam % 100 != 0) or (nam % 400 == 0)`.',
      'In thẳng biến đúng/sai ra: `print(f"Nam nhuan: {la_nhuan}")` sẽ hiện `True` hoặc `False`.',
      'Số ngày: `365 + int(la_nhuan)` — nhuận thì cộng 1, không nhuận thì cộng 0.',
    ],
    starterCode: [
      'nam = int(input())',
      '',
      '# Viết quy tắc năm nhuận thành MỘT biểu thức đúng/sai',
      'la_nhuan = ...',
      '',
      '# Số ngày: dùng int(la_nhuan) thay cho câu lệnh rẽ nhánh',
      '',
    ].join('\n'),
    solutionCode: [
      'nam = int(input())',
      'la_nhuan = (nam % 4 == 0 and nam % 100 != 0) or (nam % 400 == 0)',
      'so_ngay = 365 + int(la_nhuan)',
      'print(f"Nam {nam}")',
      'print(f"Nam nhuan: {la_nhuan}")',
      'print(f"So ngay: {so_ngay}")',
    ].join('\n'),
    tier: 'MO_RONG',
    judgeMode: 'IO_MATCH',
    totalPoints: 100,
    tests: [
      sample(
        '2024\n',
        'Nam 2024\nNam nhuan: True\nSo ngay: 366\n',
        '2024 chia hết cho 4 và không chia hết cho 100 — thoả điều kiện thứ nhất.',
      ),
      sample(
        '1900\n',
        'Nam 1900\nNam nhuan: False\nSo ngay: 365\n',
        'Đây là bẫy chính: 1900 chia hết cho 4 NHƯNG cũng chia hết cho 100, và không chia hết cho 400.',
      ),
      hidden('2000\n', 'Nam 2000\nNam nhuan: True\nSo ngay: 366\n', 15),
      hidden('2023\n', 'Nam 2023\nNam nhuan: False\nSo ngay: 365\n', 15),
      hidden('4\n', 'Nam 4\nNam nhuan: True\nSo ngay: 366\n', 15),
      hidden('100\n', 'Nam 100\nNam nhuan: False\nSo ngay: 365\n', 15),
      hidden('400\n', 'Nam 400\nNam nhuan: True\nSo ngay: 366\n', 15),
      hidden('2100\n', 'Nam 2100\nNam nhuan: False\nSo ngay: 365\n', 15),
      hidden('1\n', 'Nam 1\nNam nhuan: False\nSo ngay: 365\n', 5),
      hidden('9999\n', 'Nam 9999\nNam nhuan: False\nSo ngay: 365\n', 5),
    ],
  },
  {
    markdown:
      'Bài khó nhất buổi 6. Nó khó **không phải vì lệnh mới** — em vẫn chỉ dùng những thứ đã học. ' +
      'Nó khó vì em phải dịch một quy tắc bằng lời sang một biểu thức lôgic đúng, và phải tìm cách ' +
      'chọn giữa hai giá trị khi chưa có câu lệnh rẽ nhánh.',
    minutes: 20,
  },
);

/**
 * The ladder, in order.
 *
 * Exported as a flat array so the lesson file spreads it in at the end of its
 * block list — the ten rungs sit after the existing theory, example, playground
 * and first graded challenge, which is what keeps the mandated flow intact.
 */
export const thangBaiTapB06: BlockSpec[] = [
  moDau,
  bac01,
  bac02,
  bac03,
  bac04,
  bac05,
  bac06,
  bac07,
  bac08,
  bac09,
  bac10,
];
