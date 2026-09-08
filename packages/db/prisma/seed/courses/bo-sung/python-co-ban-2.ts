/**
 * Expansion pack — Python Cơ Bản, sessions 6–15.
 *
 * From session 6 the course has `print()`, so these are auto-graded IO_MATCH
 * exercises: read from stdin, print to stdout, judged on an exact match.
 *
 * Every expected output in this file was produced by executing the reference
 * solution rather than reasoned out by hand — see the header of ./index.ts. A
 * test whose expected value was written from memory is a test that marks a
 * correct student wrong, and that failure mode is invisible until a child is
 * sitting in front of it.
 */
import { challenge, hidden, sample } from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungPythonCoBan2: BoSungKhoaHoc = {
  'b06-print-input-va-format-string': {
    khoi: [
      challenge({
        slug: 'p-bs-b06-gioi-thieu-ban-than',
        title: 'Lời chào có định dạng',
        statement: [
          'Đọc **tên** ở dòng thứ nhất và **tuổi** ở dòng thứ hai.',
          '',
          'In ra đúng một dòng theo mẫu:',
          '',
          '```',
          'Xin chao <tên>, nam nay em <tuổi> tuoi.',
          '```',
        ].join('\n'),
        hints: [
          'Dùng f-string: đặt chữ `f` ngay trước dấu nháy mở.',
          'Tên biến đặt trong cặp ngoặc nhọn `{}` sẽ được thay bằng giá trị của nó.',
        ],
        starterCode: ['ten = input()', 'tuoi = input()', '', '# In ra lời chào'].join('\n'),
        solutionCode: [
          'ten = input()',
          'tuoi = input()',
          'print(f"Xin chao {ten}, nam nay em {tuoi} tuoi.")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('Lan\n12\n', 'Xin chao Lan, nam nay em 12 tuoi.\n', 'Chú ý dấu phẩy và dấu chấm cuối câu.'),
          hidden('Minh\n13\n', 'Xin chao Minh, nam nay em 13 tuoi.\n', 25),
          hidden('An Nhien\n11\n', 'Xin chao An Nhien, nam nay em 11 tuoi.\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b06-chu-vi-dien-tich',
        title: 'Chu vi và diện tích hình chữ nhật',
        statement: [
          'Đọc **chiều dài** và **chiều rộng** (hai số nguyên, mỗi số một dòng).',
          '',
          'In ra hai dòng:',
          '',
          '```',
          'Chu vi: <chu vi>',
          'Dien tich: <diện tích>',
          '```',
        ].join('\n'),
        hints: ['Chu vi = (dài + rộng) × 2.', 'Nhớ `int()` để đổi chuỗi đọc được thành số.'],
        starterCode: ['dai = int(input())', 'rong = int(input())', '', '# Tính và in'].join('\n'),
        solutionCode: [
          'dai = int(input())',
          'rong = int(input())',
          'print(f"Chu vi: {(dai + rong) * 2}")',
          'print(f"Dien tich: {dai * rong}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n3\n', 'Chu vi: 16\nDien tich: 15\n', '(5 + 3) × 2 = 16 và 5 × 3 = 15.'),
          hidden('10\n10\n', 'Chu vi: 40\nDien tich: 100\n', 25),
          hidden('1\n7\n', 'Chu vi: 16\nDien tich: 7\n', 25),
        ],
      }),
    ],
  },

  'b07-luyen-tap-may-tinh-bo-tui': {
    khoi: [
      challenge({
        slug: 'p-bs-b07-doi-phut-sang-gio',
        title: 'Đổi phút sang giờ và phút',
        statement: [
          'Đọc một số nguyên là **số phút**.',
          '',
          'In ra đúng một dòng: `<giờ> gio <phút> phut`.',
          '',
          'Ví dụ 135 phút là 2 giờ 15 phút.',
        ].join('\n'),
        hints: ['Số giờ lấy bằng `//`, số phút còn lại lấy bằng `%`.'],
        starterCode: ['phut = int(input())', '', '# Đổi sang giờ và phút'].join('\n'),
        solutionCode: [
          'phut = int(input())',
          'print(f"{phut // 60} gio {phut % 60} phut")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('135\n', '2 gio 15 phut\n', '135 // 60 = 2 và 135 % 60 = 15.'),
          hidden('60\n', '1 gio 0 phut\n', 20),
          hidden('59\n', '0 gio 59 phut\n', 20),
          hidden('600\n', '10 gio 0 phut\n', 20),
        ],
      }),
      challenge({
        slug: 'p-bs-b07-trung-binh-ba-so',
        title: 'Trung bình cộng ba số',
        statement: [
          'Đọc **ba số nguyên**, mỗi số trên một dòng.',
          '',
          'In ra trung bình cộng của chúng, làm tròn tới **2 chữ số thập phân**.',
          '',
          'Gợi ý định dạng: `f"{gia_tri:.2f}"`.',
        ].join('\n'),
        hints: ['Chia bằng `/` để giữ phần thập phân.', '`:.2f` giữ đúng hai chữ số sau dấu chấm.'],
        starterCode: [
          'a = int(input())',
          'b = int(input())',
          'c = int(input())',
          '',
          '# Tính trung bình cộng',
        ].join('\n'),
        solutionCode: [
          'a = int(input())',
          'b = int(input())',
          'c = int(input())',
          'print(f"{(a + b + c) / 3:.2f}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('8\n9\n10\n', '9.00\n', 'Tổng 27 chia 3 bằng 9, in thành 9.00.'),
          hidden('1\n2\n2\n', '1.67\n', 25),
          hidden('0\n0\n1\n', '0.33\n', 25),
        ],
      }),
    ],
  },

  'b08-cau-lenh-if-else': {
    khoi: [
      challenge({
        slug: 'p-bs-b08-chan-hay-le',
        title: 'Số chẵn hay số lẻ',
        statement: [
          'Đọc một số nguyên.',
          '',
          'In ra `Chan` nếu số đó chia hết cho 2, ngược lại in ra `Le`.',
        ].join('\n'),
        hints: ['Một số chia hết cho 2 khi `n % 2 == 0`.'],
        starterCode: ['n = int(input())', '', '# Kiểm tra chẵn lẻ'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'if n % 2 == 0:',
          '    print("Chan")',
          'else:',
          '    print("Le")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n', 'Chan\n', '4 chia 2 dư 0.'),
          sample('7\n', 'Le\n', '7 chia 2 dư 1.'),
          hidden('0\n', 'Chan\n', 20),
          hidden('-3\n', 'Le\n', 20),
          hidden('1000000\n', 'Chan\n', 20),
        ],
      }),
      challenge({
        slug: 'p-bs-b08-du-tuoi-boi-loi',
        title: 'Đủ tuổi vào lớp bơi',
        statement: [
          'Lớp bơi nhận các bạn từ **10 tuổi trở lên**.',
          '',
          'Đọc một số nguyên là tuổi, in ra `Duoc dang ky` hoặc `Chua du tuoi`.',
        ].join('\n'),
        hints: ['“Từ 10 trở lên” viết là `tuoi >= 10`.'],
        starterCode: ['tuoi = int(input())', '', '# Kiểm tra điều kiện'].join('\n'),
        solutionCode: [
          'tuoi = int(input())',
          'if tuoi >= 10:',
          '    print("Duoc dang ky")',
          'else:',
          '    print("Chua du tuoi")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('12\n', 'Duoc dang ky\n', '12 lớn hơn 10.'),
          sample('9\n', 'Chua du tuoi\n', '9 nhỏ hơn 10.'),
          hidden('10\n', 'Duoc dang ky\n', 30),
          hidden('1\n', 'Chua du tuoi\n', 20),
        ],
      }),
    ],
  },

  'b09-elif-va-dieu-kien-long-nhau': {
    khoi: [
      challenge({
        slug: 'p-bs-b09-xep-loai-hoc-luc',
        title: 'Xếp loại theo điểm',
        statement: [
          'Đọc một số nguyên là **điểm** từ 0 đến 10, rồi in ra xếp loại:',
          '',
          '- từ 9 trở lên: `Xuat sac`',
          '- từ 7 đến dưới 9: `Gioi`',
          '- từ 5 đến dưới 7: `Kha`',
          '- dưới 5: `Can co gang`',
        ].join('\n'),
        hints: [
          'Xét từ mốc cao xuống mốc thấp thì mỗi nhánh chỉ cần một điều kiện.',
          '`elif` chỉ được xét khi mọi điều kiện phía trên đều sai.',
        ],
        starterCode: ['diem = int(input())', '', '# Xếp loại'].join('\n'),
        solutionCode: [
          'diem = int(input())',
          'if diem >= 9:',
          '    print("Xuat sac")',
          'elif diem >= 7:',
          '    print("Gioi")',
          'elif diem >= 5:',
          '    print("Kha")',
          'else:',
          '    print("Can co gang")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('9\n', 'Xuat sac\n', 'Đúng mốc 9.'),
          sample('6\n', 'Kha\n', '6 nằm giữa 5 và 7.'),
          hidden('10\n', 'Xuat sac\n', 15),
          hidden('7\n', 'Gioi\n', 15),
          hidden('5\n', 'Kha\n', 15),
          hidden('0\n', 'Can co gang\n', 15),
        ],
      }),
      challenge({
        slug: 'p-bs-b09-ngay-trong-tuan',
        title: 'Thứ mấy trong tuần',
        statement: [
          'Đọc một số nguyên từ 2 đến 8.',
          '',
          'In ra `Thu <n>` nếu n từ 2 đến 7, in ra `Chu nhat` nếu n bằng 8,',
          'và in ra `Khong hop le` với mọi giá trị khác.',
        ].join('\n'),
        hints: ['Ba nhánh: khoảng 2..7, đúng bằng 8, và phần còn lại.'],
        starterCode: ['n = int(input())', '', '# Xác định thứ'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'if 2 <= n <= 7:',
          '    print(f"Thu {n}")',
          'elif n == 8:',
          '    print("Chu nhat")',
          'else:',
          '    print("Khong hop le")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\n', 'Thu 3\n', 'n nằm trong khoảng 2 đến 7.'),
          sample('8\n', 'Chu nhat\n', 'Trường hợp riêng.'),
          hidden('2\n', 'Thu 2\n', 20),
          hidden('7\n', 'Thu 7\n', 20),
          hidden('1\n', 'Khong hop le\n', 20),
        ],
      }),
    ],
  },

  'b10-luyen-tap-phan-loai-ra-quyet-dinh': {
    khoi: [
      challenge({
        slug: 'p-bs-b10-tien-ve-xem-phim',
        title: 'Giá vé xem phim',
        statement: [
          'Rạp tính vé theo tuổi:',
          '',
          '- dưới 6 tuổi: miễn phí, in `0`',
          '- từ 6 đến 15 tuổi: `50000`',
          '- trên 15 tuổi: `80000`',
          '',
          'Đọc một số nguyên là tuổi và in ra giá vé.',
        ].join('\n'),
        hints: ['Ba khoảng liền nhau — `if` / `elif` / `else` là vừa đủ.'],
        starterCode: ['tuoi = int(input())', '', '# Tính giá vé'].join('\n'),
        solutionCode: [
          'tuoi = int(input())',
          'if tuoi < 6:',
          '    print(0)',
          'elif tuoi <= 15:',
          '    print(50000)',
          'else:',
          '    print(80000)',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n', '0\n', 'Dưới 6 tuổi được miễn phí.'),
          sample('12\n', '50000\n', 'Nằm trong khoảng 6 đến 15.'),
          hidden('6\n', '50000\n', 20),
          hidden('15\n', '50000\n', 20),
          hidden('16\n', '80000\n', 20),
        ],
      }),
      challenge({
        slug: 'p-bs-b10-so-lon-nhat-ba-so',
        title: 'Số lớn nhất trong ba số',
        statement: [
          'Đọc **ba số nguyên**, mỗi số một dòng, rồi in ra số lớn nhất.',
          '',
          'Nếu có nhiều số cùng lớn nhất thì chỉ in ra giá trị đó một lần.',
        ].join('\n'),
        hints: ['So sánh dần: giữ lại số lớn nhất tìm được cho tới lúc đó.'],
        starterCode: [
          'a = int(input())',
          'b = int(input())',
          'c = int(input())',
          '',
          '# Tìm số lớn nhất',
        ].join('\n'),
        solutionCode: [
          'a = int(input())',
          'b = int(input())',
          'c = int(input())',
          'lon_nhat = a',
          'if b > lon_nhat:',
          '    lon_nhat = b',
          'if c > lon_nhat:',
          '    lon_nhat = c',
          'print(lon_nhat)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\n9\n5\n', '9\n', '9 lớn hơn cả 3 và 5.'),
          hidden('-4\n-9\n-1\n', '-1\n', 25),
          hidden('7\n7\n7\n', '7\n', 25),
          hidden('100\n2\n99\n', '100\n', 25),
        ],
      }),
    ],
  },

  'b11-du-an-nho-doan-so': {
    khoi: [
      challenge({
        slug: 'p-bs-b11-cao-hay-thap',
        title: 'Một lượt đoán số',
        statement: [
          'Đọc **số bí mật** ở dòng thứ nhất và **số bạn đoán** ở dòng thứ hai.',
          '',
          'In ra `Chinh xac` nếu hai số bằng nhau, `Cao qua` nếu đoán lớn hơn,',
          'và `Thap qua` nếu đoán nhỏ hơn.',
        ].join('\n'),
        hints: ['Ba trường hợp: bằng, lớn hơn, nhỏ hơn.'],
        starterCode: [
          'bi_mat = int(input())',
          'doan = int(input())',
          '',
          '# So sánh và trả lời',
        ].join('\n'),
        solutionCode: [
          'bi_mat = int(input())',
          'doan = int(input())',
          'if doan == bi_mat:',
          '    print("Chinh xac")',
          'elif doan > bi_mat:',
          '    print("Cao qua")',
          'else:',
          '    print("Thap qua")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('42\n42\n', 'Chinh xac\n', 'Hai số bằng nhau.'),
          sample('42\n50\n', 'Cao qua\n', 'Đoán lớn hơn số bí mật.'),
          hidden('42\n10\n', 'Thap qua\n', 25),
          hidden('0\n-1\n', 'Thap qua\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b11-khoang-cach-doan',
        title: 'Đoán cách bao xa',
        statement: [
          'Đọc **số bí mật** và **số bạn đoán**.',
          '',
          'In ra khoảng cách giữa hai số — luôn là một số **không âm**.',
        ].join('\n'),
        hints: ['Nếu hiệu ra số âm, đổi dấu nó lại.', 'Hàm `abs()` làm đúng việc này.'],
        starterCode: [
          'bi_mat = int(input())',
          'doan = int(input())',
          '',
          '# Tính khoảng cách',
        ].join('\n'),
        solutionCode: [
          'bi_mat = int(input())',
          'doan = int(input())',
          'print(abs(doan - bi_mat))',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('42\n50\n', '8\n', 'Đoán hơn 8 đơn vị.'),
          hidden('42\n30\n', '12\n', 25),
          hidden('5\n5\n', '0\n', 25),
          hidden('-3\n4\n', '7\n', 25),
        ],
      }),
    ],
  },

  'b12-vong-lap-for-va-range': {
    khoi: [
      challenge({
        slug: 'p-bs-b12-tong-1-den-n',
        title: 'Tổng từ 1 đến n',
        statement: [
          'Đọc một số nguyên dương `n`.',
          '',
          'In ra tổng các số từ 1 đến n.',
        ].join('\n'),
        hints: ['`range(1, n + 1)` đi từ 1 tới đúng n.', 'Cộng dồn vào một biến bắt đầu từ 0.'],
        starterCode: ['n = int(input())', 'tong = 0', '', '# Cộng dồn'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'tong = 0',
          'for i in range(1, n + 1):',
          '    tong = tong + i',
          'print(tong)',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n', '15\n', '1 + 2 + 3 + 4 + 5 = 15.'),
          hidden('1\n', '1\n', 20),
          hidden('10\n', '55\n', 20),
          hidden('100\n', '5050\n', 20),
        ],
      }),
      challenge({
        slug: 'p-bs-b12-dem-nguoc',
        title: 'Đếm ngược',
        statement: [
          'Đọc một số nguyên dương `n`.',
          '',
          'In ra các số từ n xuống 1, **mỗi số một dòng**.',
        ].join('\n'),
        hints: ['`range(n, 0, -1)` đi lùi từng bước một.'],
        starterCode: ['n = int(input())', '', '# Đếm ngược'].join('\n'),
        solutionCode: ['n = int(input())', 'for i in range(n, 0, -1):', '    print(i)'].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\n', '3\n2\n1\n', 'Ba dòng, từ lớn xuống nhỏ.'),
          hidden('1\n', '1\n', 25),
          hidden('5\n', '5\n4\n3\n2\n1\n', 25),
        ],
      }),
    ],
  },

  'b13-vong-lap-while': {
    khoi: [
      challenge({
        slug: 'p-bs-b13-dem-chu-so',
        title: 'Đếm số chữ số',
        statement: [
          'Đọc một số nguyên dương và in ra **số chữ số** của nó.',
          '',
          'Ví dụ 4071 có 4 chữ số.',
        ].join('\n'),
        hints: [
          'Chia số đó cho 10 nhiều lần cho tới khi còn 0, đếm số lần chia.',
          '`n = n // 10` bỏ đi chữ số cuối cùng.',
        ],
        starterCode: ['n = int(input())', 'dem = 0', '', '# Đếm chữ số'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'dem = 0',
          'while n > 0:',
          '    dem = dem + 1',
          '    n = n // 10',
          'print(dem)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4071\n', '4\n', 'Chia 4 lần thì còn 0.'),
          hidden('7\n', '1\n', 25),
          hidden('100\n', '3\n', 25),
          hidden('999999\n', '6\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b13-tong-chu-so',
        title: 'Tổng các chữ số',
        statement: [
          'Đọc một số nguyên dương và in ra **tổng các chữ số** của nó.',
          '',
          'Ví dụ 4071 cho 4 + 0 + 7 + 1 = 12.',
        ].join('\n'),
        hints: ['`n % 10` cho chữ số cuối cùng.', '`n // 10` bỏ chữ số cuối cùng đi.'],
        starterCode: ['n = int(input())', 'tong = 0', '', '# Cộng từng chữ số'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'tong = 0',
          'while n > 0:',
          '    tong = tong + n % 10',
          '    n = n // 10',
          'print(tong)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4071\n', '12\n', '4 + 0 + 7 + 1 = 12.'),
          hidden('5\n', '5\n', 25),
          hidden('999\n', '27\n', 25),
          hidden('1000\n', '1\n', 25),
        ],
      }),
    ],
  },

  'b14-break-continue-vong-lap-long-nhau': {
    khoi: [
      challenge({
        slug: 'p-bs-b14-uoc-dau-tien',
        title: 'Ước nhỏ nhất lớn hơn 1',
        statement: [
          'Đọc một số nguyên `n` lớn hơn 1.',
          '',
          'In ra **ước nhỏ nhất lớn hơn 1** của n.',
          '',
          'Với số nguyên tố, ước đó chính là n.',
        ].join('\n'),
        hints: ['Thử lần lượt từ 2 trở lên, gặp ước đầu tiên thì `break`.'],
        starterCode: ['n = int(input())', '', '# Tìm ước nhỏ nhất lớn hơn 1'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'uoc = n',
          'for i in range(2, n):',
          '    if n % i == 0:',
          '        uoc = i',
          '        break',
          'print(uoc)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('15\n', '3\n', '15 chia hết cho 3 trước khi chia hết cho 5.'),
          sample('7\n', '7\n', '7 là số nguyên tố nên ước nhỏ nhất là chính nó.'),
          hidden('100\n', '2\n', 25),
          hidden('9\n', '3\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b14-bo-qua-so-am',
        title: 'Bỏ qua số âm',
        statement: [
          'Dòng đầu là số lượng `n`. `n` dòng tiếp theo, mỗi dòng một số nguyên.',
          '',
          'In ra tổng của **những số không âm** — bỏ qua mọi số âm.',
        ].join('\n'),
        hints: ['Gặp số âm thì `continue` để sang vòng lặp kế tiếp.'],
        starterCode: ['n = int(input())', 'tong = 0', '', '# Cộng các số không âm'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'tong = 0',
          'for _ in range(n):',
          '    x = int(input())',
          '    if x < 0:',
          '        continue',
          '    tong = tong + x',
          'print(tong)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n5\n-3\n7\n-1\n', '12\n', '5 + 7 = 12, hai số âm bị bỏ qua.'),
          hidden('3\n-1\n-2\n-3\n', '0\n', 25),
          hidden('3\n1\n2\n3\n', '6\n', 25),
        ],
      }),
    ],
  },

  'b15-luyen-tap-ve-hinh-va-bang': {
    khoi: [
      challenge({
        slug: 'p-bs-b15-tam-giac-sao',
        title: 'Tam giác dấu sao',
        statement: [
          'Đọc một số nguyên dương `n`.',
          '',
          'In ra một tam giác gồm n dòng: dòng thứ i có đúng i dấu `*`.',
        ].join('\n'),
        hints: ['`"*" * i` tạo ra chuỗi gồm i dấu sao.'],
        starterCode: ['n = int(input())', '', '# Vẽ tam giác'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'for i in range(1, n + 1):',
          '    print("*" * i)',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\n', '*\n**\n***\n', 'Dòng thứ i có i dấu sao.'),
          hidden('1\n', '*\n', 25),
          hidden('5\n', '*\n**\n***\n****\n*****\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b15-bang-cuu-chuong',
        title: 'Một bảng cửu chương',
        statement: [
          'Đọc một số nguyên `n` từ 1 đến 10.',
          '',
          'In ra bảng cửu chương của n, mỗi dòng theo mẫu `n x i = tich`,',
          'với i chạy từ 1 đến 10.',
        ].join('\n'),
        hints: ['Dùng f-string để ghép cả ba giá trị vào một dòng.'],
        starterCode: ['n = int(input())', '', '# In bảng cửu chương'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'for i in range(1, 11):',
          '    print(f"{n} x {i} = {n * i}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample(
            '2\n',
            '2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18\n2 x 10 = 20\n',
            'Đúng 10 dòng, có dấu cách quanh chữ x và dấu bằng.',
          ),
          hidden(
            '1\n',
            '1 x 1 = 1\n1 x 2 = 2\n1 x 3 = 3\n1 x 4 = 4\n1 x 5 = 5\n1 x 6 = 6\n1 x 7 = 7\n1 x 8 = 8\n1 x 9 = 9\n1 x 10 = 10\n',
            50,
          ),
        ],
      }),
    ],
  },
};
