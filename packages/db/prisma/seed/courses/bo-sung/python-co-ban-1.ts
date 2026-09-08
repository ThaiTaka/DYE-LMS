/**
 * Expansion pack — Python Cơ Bản, sessions 1–5.
 *
 * ── These sessions carry no `print()`, and that is not a limit to work round ──
 * The lesson plan withholds `print()` until session 6: sessions 1–5 run in the
 * interactive REPL, where an expression echoes its own value, so a student sees
 * a result without meeting a function call, parentheses and a string literal all
 * at once. `assertPythonBasicNotes` enforces it for sessions 1–2, and the module
 * header of python-co-ban-m1.ts states the intent for the rest.
 *
 * An auto-graded IO_MATCH exercise is judged on stdout, and stdout needs
 * `print()`. So the practice here is MULTIPLE_CHOICE and FILL_IN_BLANK. Both are
 * graded block types that ask a student to produce an answer — `assertPedagogicalFlow`
 * counts them as assessment — and neither needs syntax the lesson has not taught.
 */
import { dienKhuyet, fillBlankBlock, mcq, mcqBlock } from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungPythonCoBan1: BoSungKhoaHoc = {
  'b01-tong-quan-va-lam-quen-python': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b01-python-la-gi',
        title: 'Luyện tập: Python là ngôn ngữ thế nào?',
        questions: [
          mcq(
            'Vì sao người ta nói Python “dễ đọc”?',
            'Vì cú pháp của nó gần với tiếng Anh thường ngày',
            [
              'Vì nó chạy nhanh hơn mọi ngôn ngữ khác',
              'Vì nó chỉ dùng được trên Windows',
              'Vì nó không cần máy tính',
            ],
            {
              explanation:
                'Một dòng Python đọc lên gần như một câu tiếng Anh, nên em đoán được nó làm gì trước khi học hết cú pháp.',
            },
          ),
          mcq(
            'Chế độ tương tác (REPL) khác gì so với chạy một tệp chương trình?',
            'REPL trả lời ngay từng dòng em gõ',
            [
              'REPL chỉ làm được phép cộng',
              'REPL không cần cài Python',
              'REPL tự lưu chương trình lại',
            ],
            {
              explanation:
                'REPL đọc một dòng, tính, rồi hiện kết quả. Vòng lặp đó là lý do nó hợp với những buổi đầu.',
            },
          ),
          mcq(
            'Việc nào sau đây KHÔNG phải là thứ lập trình giúp làm được?',
            'Thay pin cho chiếc điều khiển TV',
            [
              'Sắp xếp danh sách điểm của cả lớp',
              'Tự động đổi tên hàng trăm tấm ảnh',
              'Vẽ biểu đồ từ một bảng số liệu',
            ],
            {
              explanation:
                'Lập trình xử lý thông tin. Việc tay chân ngoài đời vẫn cần một người làm.',
            },
          ),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b01-dien-khuyet',
        title: 'Điền khuyết: những từ đầu tiên',
        questions: [
          dienKhuyet(
            'Chế độ gõ tới đâu thấy kết quả tới đó gọi tắt là gì?',
            'Chế độ tương tác của Python còn gọi tắt là ___.',
            ['REPL', 'repl'],
            { explanation: 'Read - Eval - Print - Loop: đọc, tính, hiện, rồi lặp lại.' },
          ),
          dienKhuyet(
            'Tên ngôn ngữ chúng ta học trong khoá này là gì?',
            'Khoá học này dạy ngôn ngữ ___.',
            ['Python', 'python'],
          ),
        ],
      }),
    ],
  },

  'b02-lam-quen-moi-truong-lap-trinh': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b02-moi-truong',
        title: 'Luyện tập: môi trường lập trình',
        questions: [
          mcq(
            'Trong chế độ tương tác, gõ `12 + 5` rồi nhấn Enter thì máy hiện ra gì?',
            '17',
            ['12 + 5', 'Không hiện gì cả', 'Một thông báo lỗi'],
            {
              explanation:
                'Một biểu thức tự vọng lại giá trị của nó. Đó là điều khiến chế độ tương tác hợp với buổi đầu.',
            },
          ),
          mcq('Gõ `10 / 4` trong chế độ tương tác cho kết quả nào?', '2.5', ['2', '3', '2.0'], {
            explanation: 'Dấu `/` luôn cho số thập phân, kể cả khi chia hết.',
          }),
          mcq(
            'Dấu nhắc `>>>` trong chế độ tương tác có nghĩa gì?',
            'Máy đang chờ em gõ dòng tiếp theo',
            [
              'Chương trình đã bị lỗi',
              'Máy đang bận tính toán',
              'Em phải gõ đúng ba dấu lớn hơn',
            ],
          ),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b02-dien-khuyet',
        title: 'Điền khuyết: phép tính đầu tiên',
        questions: [
          dienKhuyet('Kết quả của `7 * 6` là bao nhiêu?', '`7 * 6` cho kết quả là ___.', ['42']),
          dienKhuyet('Kết quả của `20 - 8` là bao nhiêu?', '`20 - 8` cho kết quả là ___.', ['12']),
          dienKhuyet(
            'Dấu nào dùng cho phép nhân trong Python?',
            'Phép nhân trong Python viết bằng dấu ___.',
            ['*', 'sao', 'dau sao'],
          ),
        ],
      }),
    ],
  },

  'b03-bien-va-kieu-du-lieu': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b03-kieu-du-lieu',
        title: 'Luyện tập: nhận diện kiểu dữ liệu',
        questions: [
          mcq('Giá trị `3.14` thuộc kiểu nào?', 'float', ['int', 'str', 'bool'], {
            explanation: 'Có phần thập phân thì là `float`.',
          }),
          mcq('Giá trị `"7"` (có dấu nháy) thuộc kiểu nào?', 'str', ['int', 'float', 'bool'], {
            explanation:
              'Dấu nháy biến mọi thứ bên trong thành chuỗi, kể cả khi trông giống một con số.',
          }),
          mcq('Giá trị `True` thuộc kiểu nào?', 'bool', ['str', 'int', 'float'], {
            explanation: '`bool` chỉ có đúng hai giá trị: `True` và `False`.',
          }),
          mcq(
            'Tên biến nào sau đây KHÔNG hợp lệ trong Python?',
            '2diem',
            ['diem2', 'diem_toan', '_diem'],
            { explanation: 'Tên biến không được bắt đầu bằng chữ số.' },
          ),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b03-dien-khuyet',
        title: 'Điền khuyết: đặt tên và gán biến',
        questions: [
          dienKhuyet(
            'Dấu nào dùng để gán giá trị cho biến?',
            'Để gán giá trị cho một biến, em dùng dấu ___.',
            ['=', 'bang', 'dau bang'],
          ),
          dienKhuyet('Kiểu của giá trị `25` là gì?', 'Giá trị `25` thuộc kiểu ___.', ['int']),
          dienKhuyet(
            'Kiểu của giá trị `"Xin chao"` là gì?',
            'Giá trị `"Xin chao"` thuộc kiểu ___.',
            ['str'],
          ),
        ],
      }),
    ],
  },

  'b04-ep-kieu-va-thuc-hanh-bien': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b04-ep-kieu',
        title: 'Luyện tập: ép kiểu',
        questions: [
          mcq('`int("42")` cho kết quả gì?', 'Số nguyên 42', [
            'Chuỗi "42"',
            'Một thông báo lỗi',
            'Số thực 42.0',
          ]),
          mcq('`int(9.87)` cho kết quả gì?', '9', ['10', '9.87', 'Một thông báo lỗi'], {
            explanation: '`int()` cắt bỏ phần thập phân chứ không làm tròn.',
          }),
          mcq('`float("3")` cho kết quả gì?', '3.0', ['3', '"3.0"', 'Một thông báo lỗi']),
          mcq(
            'Vì sao `int("mot tram")` báo lỗi?',
            'Vì chuỗi đó không gồm chữ số nên không đọc thành số được',
            ['Vì chuỗi quá dài', 'Vì thiếu dấu nháy', 'Vì `int()` chỉ nhận số thực'],
          ),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b04-dien-khuyet',
        title: 'Điền khuyết: đổi qua đổi lại',
        questions: [
          dienKhuyet(
            'Hàm nào đổi một giá trị sang số nguyên?',
            'Để đổi sang số nguyên, em dùng hàm ___.',
            ['int', 'int()'],
          ),
          dienKhuyet(
            'Hàm nào đổi một giá trị sang chuỗi?',
            'Để đổi sang chuỗi, em dùng hàm ___.',
            ['str', 'str()'],
          ),
          dienKhuyet('`int(7.99)` cho kết quả là bao nhiêu?', '`int(7.99)` cho kết quả ___.', ['7']),
        ],
      }),
    ],
  },

  'b05-toan-tu-so-hoc-so-sanh-logic': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b05-toan-tu',
        title: 'Luyện tập: toán tử',
        questions: [
          mcq('`17 // 5` cho kết quả gì?', '3', ['3.4', '2', '4'], {
            explanation: '`//` chia lấy phần nguyên và bỏ phần dư.',
          }),
          mcq('`17 % 5` cho kết quả gì?', '2', ['3', '3.4', '0'], {
            explanation: '`%` cho phần dư — rất hay dùng để kiểm tra chia hết.',
          }),
          mcq('`2 ** 5` cho kết quả gì?', '32', ['10', '25', '7'], {
            explanation: '`**` là luỹ thừa: 2 nhân với chính nó 5 lần.',
          }),
          mcq('`(5 > 3) and (2 > 4)` cho kết quả gì?', 'False', ['True', '5', '2'], {
            explanation:
              '`and` chỉ đúng khi cả hai vế cùng đúng. Vế thứ hai sai nên cả biểu thức sai.',
          }),
          mcq('`not (10 == 10)` cho kết quả gì?', 'False', ['True', '10', '0'], {
            explanation: '`10 == 10` đúng, `not` lật lại thành sai.',
          }),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b05-dien-khuyet',
        title: 'Điền khuyết: dấu nào cho việc gì',
        questions: [
          dienKhuyet(
            'Toán tử nào cho phần dư của phép chia?',
            'Phần dư của phép chia lấy bằng toán tử ___.',
            ['%', 'phan tram', 'modulo'],
          ),
          dienKhuyet('`9 % 2` cho kết quả là bao nhiêu?', '`9 % 2` bằng ___.', ['1']),
          dienKhuyet(
            'Toán tử nào kiểm tra hai giá trị có bằng nhau không?',
            'Để so sánh bằng nhau, em dùng ___.',
            ['==', 'hai dau bang'],
          ),
        ],
      }),
    ],
  },
};
