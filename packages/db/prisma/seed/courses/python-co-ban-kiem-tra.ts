/**
 * Milestone exams for Python Cơ Bản.
 *
 * ── Why a separate bank, not the lesson quizzes ──────────────────────────────
 * A lesson quiz is practice: the student has seen it, retried it, and read its
 * explanations. An exam bank is questions the student meets for the first
 * time under a clock — so every question here is new, even where it tests the
 * same idea as a quiz in Buổi 3.
 *
 * ── What the first checkpoint covers ─────────────────────────────────────────
 * Buổi 1–10: the environment, variables and types, casting, operators, print /
 * input / f-strings, and if / elif / else. Nothing from Buổi 11 onward, because
 * a checkpoint tests what has been taught, not what is coming.
 *
 * ── Machine-markable only ────────────────────────────────────────────────────
 * Multiple choice throughout. The exam marks itself at submit, and the seed
 * assertions refuse a SHORT_ANSWER in an exam bank for exactly that reason.
 */
import { mcq } from '../builders.ts';

import type { ExamSpec } from '../types.ts';

export const kiemTraPythonCoBan: ExamSpec[] = [
  {
    slug: 'kt-python-co-ban-1',
    title: 'Bài kiểm tra lớn 1 · Nền tảng Python',
    description:
      'Kiểm tra những gì em đã học trong mười buổi đầu: biến, kiểu dữ liệu, toán tử, ' +
      'in và nhập, và câu lệnh điều kiện. Mười câu, hai mươi phút.',
    afterLessonOrder: 10,
    durationMinutes: 20,
    passingScore: 60,
    maxStrikes: 2,
    quiz: {
      slug: 'q-kt-python-co-ban-1',
      title: 'Bài kiểm tra lớn 1 · Nền tảng Python',
      passingScore: 60,
      questions: [
        mcq(
          'Sau khi chạy `x = 7` rồi `x = x + 3`, giá trị của `x` là bao nhiêu?',
          '`10`',
          ['`7`', '`73`', 'Lỗi, vì `x` đã được gán rồi'],
          { explanation: 'Dòng thứ hai lấy giá trị cũ của `x` (7), cộng 3, rồi gán lại vào `x`.' },
        ),
        mcq(
          'Kiểu dữ liệu của `"12"` (có dấu nháy) trong Python là gì?',
          '`str` — chuỗi',
          ['`int` — số nguyên', '`float` — số thực', '`bool` — đúng/sai'],
          { explanation: 'Có dấu nháy là chuỗi, dù bên trong toàn chữ số. Muốn thành số phải ép kiểu bằng `int("12")`.' },
        ),
        mcq(
          '`input()` luôn trả về dữ liệu kiểu gì, kể cả khi người dùng gõ vào một con số?',
          '`str`',
          ['`int`', 'Tuỳ người dùng gõ gì', '`float`'],
          { explanation: 'Bàn phím chỉ gửi chữ. Muốn tính toán phải ép kiểu: `tuoi = int(input())`.' },
        ),
        mcq(
          'Kết quả của `17 % 5` là bao nhiêu?',
          '`2`',
          ['`3`', '`3.4`', '`12`'],
          { explanation: '`%` là phép chia lấy DƯ: 17 chia 5 được 3, dư 2.' },
        ),
        mcq(
          'Kết quả của `7 // 2` là bao nhiêu?',
          '`3`',
          ['`3.5`', '`4`', '`1`'],
          { explanation: '`//` là chia lấy phần NGUYÊN, bỏ phần thập phân.' },
        ),
        mcq(
          'Đoạn `ten = "Lan"` rồi `print(f"Chào {ten}!")` in ra gì?',
          '`Chào Lan!`',
          ['`Chào {ten}!`', '`Chào ten!`', 'Lỗi cú pháp'],
          { explanation: 'Chữ `f` trước dấu nháy bật f-string: mọi thứ trong `{}` được thay bằng giá trị.' },
        ),
        mcq(
          'Biểu thức `(5 > 3) and (2 > 4)` có giá trị gì?',
          '`False`',
          ['`True`', '`5`', 'Lỗi'],
          { explanation: '`and` chỉ đúng khi CẢ HAI vế đúng. `2 > 4` sai, nên cả biểu thức sai.' },
        ),
        mcq(
          [
            'Với `diem = 75`, đoạn sau in ra gì?',
            '',
            '```python',
            'if diem >= 80:',
            '    print("Giỏi")',
            'elif diem >= 65:',
            '    print("Khá")',
            'else:',
            '    print("Cố lên")',
            '```',
          ].join('\n'),
          '`Khá`',
          ['`Giỏi`', '`Cố lên`', 'In cả `Khá` và `Cố lên`'],
          { explanation: '75 không ≥ 80 nên bỏ qua `if`; 75 ≥ 65 nên vào `elif` và dừng — `else` không chạy.' },
        ),
        mcq(
          'Dòng nào SAI cú pháp Python?',
          '`if x > 5` (thiếu dấu hai chấm)',
          ['`if x > 5:`', '`x = 5`', '`print(x)`'],
          { explanation: 'Mọi dòng mở khối — `if`, `elif`, `else`, `for`, `def` — phải kết thúc bằng `:`.' },
        ),
        mcq(
          'Sau `a = 3` và `b = "3"`, biểu thức `a == b` có giá trị gì?',
          '`False`',
          ['`True`', 'Lỗi', '`33`'],
          { explanation: 'Số 3 và chuỗi "3" là hai kiểu khác nhau, nên không bằng nhau — dù trông giống.' },
        ),
      ],
    },
  },
];
