/**
 * Expansion pack — Python Cơ Bản, sessions 16–30.
 *
 * Two lessons here are shaped by teacher notes rather than by convenience:
 *
 *   • `b23-tuple-set-khai-niem` gets MULTIPLE_CHOICE and FILL_IN_BLANK, never a
 *     coding block. `assertPythonBasicNotes` (note 5) fails the seed outright if
 *     that lesson carries a CODING or MINI_CHALLENGE block — Tuple and Set stay
 *     conceptual, and the practical load sits on List and Dictionary.
 *
 *   • `b27-xu-ly-ngoai-le` uses only built-in exceptions. Note 6 forbids
 *     `class X(Exception)` here; custom exception types belong to the Advanced
 *     course.
 *
 * Anything touching dates reads its values from stdin instead of calling
 * `date.today()`. A test whose expected output depends on the day it runs is a
 * test that starts failing on its own.
 */
import {
  challenge,
  dienKhuyet,
  fillBlankBlock,
  hidden,
  mcq,
  mcqBlock,
  sample,
} from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungPythonCoBan3: BoSungKhoaHoc = {
  'b16-on-tap-va-kiem-tra-giua-khoa': {
    khoi: [
      challenge({
        slug: 'p-bs-b16-dem-so-chan',
        title: 'Đếm số chẵn trong dãy',
        statement: [
          'Dòng đầu là số lượng `n`. `n` dòng sau, mỗi dòng một số nguyên.',
          '',
          'In ra có bao nhiêu số chẵn trong dãy.',
        ].join('\n'),
        hints: ['Kết hợp vòng lặp với `if` — hai thứ vừa ôn.'],
        starterCode: ['n = int(input())', 'dem = 0', '', '# Đếm số chẵn'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'dem = 0',
          'for _ in range(n):',
          '    x = int(input())',
          '    if x % 2 == 0:',
          '        dem = dem + 1',
          'print(dem)',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n1\n2\n3\n4\n6\n', '3\n', 'Các số chẵn là 2, 4 và 6.'),
          hidden('3\n1\n3\n5\n', '0\n', 25),
          hidden('4\n0\n-2\n-4\n7\n', '3\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b16-lon-nhat-nho-nhat',
        title: 'Lớn nhất và nhỏ nhất',
        statement: [
          'Dòng đầu là số lượng `n` (n ≥ 1). `n` dòng sau, mỗi dòng một số nguyên.',
          '',
          'In ra hai dòng: `Lon nhat: <giá trị>` rồi `Nho nhat: <giá trị>`.',
        ].join('\n'),
        hints: ['Nhớ lại số đầu tiên rồi so sánh dần với những số sau.'],
        starterCode: ['n = int(input())', '', '# Tìm lớn nhất và nhỏ nhất'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'dau = int(input())',
          'lon = dau',
          'nho = dau',
          'for _ in range(n - 1):',
          '    x = int(input())',
          '    if x > lon:',
          '        lon = x',
          '    if x < nho:',
          '        nho = x',
          'print(f"Lon nhat: {lon}")',
          'print(f"Nho nhat: {nho}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n3\n9\n1\n7\n', 'Lon nhat: 9\nNho nhat: 1\n', 'Duyệt hết dãy rồi mới in.'),
          hidden('1\n5\n', 'Lon nhat: 5\nNho nhat: 5\n', 25),
          hidden('3\n-1\n-9\n-4\n', 'Lon nhat: -1\nNho nhat: -9\n', 25),
        ],
      }),
    ],
  },

  'b17-module-math': {
    khoi: [
      challenge({
        slug: 'p-bs-b17-canh-huyen',
        title: 'Cạnh huyền tam giác vuông',
        statement: [
          'Đọc hai số nguyên là độ dài hai cạnh góc vuông.',
          '',
          'In ra độ dài cạnh huyền, làm tròn tới **2 chữ số thập phân**.',
        ].join('\n'),
        hints: ['`math.sqrt(x)` cho căn bậc hai của x.', 'Định dạng bằng `f"{gt:.2f}"`.'],
        starterCode: [
          'import math',
          '',
          'a = int(input())',
          'b = int(input())',
          '',
          '# Tính cạnh huyền',
        ].join('\n'),
        solutionCode: [
          'import math',
          '',
          'a = int(input())',
          'b = int(input())',
          'print(f"{math.sqrt(a * a + b * b):.2f}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\n4\n', '5.00\n', 'Tam giác 3-4-5 quen thuộc.'),
          hidden('5\n12\n', '13.00\n', 25),
          hidden('1\n1\n', '1.41\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b17-lam-tron-len-xuong',
        title: 'Làm tròn lên và làm tròn xuống',
        statement: [
          'Đọc một số thực trên một dòng.',
          '',
          'In ra hai dòng: `Len: <ceil>` rồi `Xuong: <floor>`.',
        ].join('\n'),
        hints: ['`math.ceil` làm tròn lên, `math.floor` làm tròn xuống.'],
        starterCode: ['import math', '', 'x = float(input())', '', '# Làm tròn hai chiều'].join('\n'),
        solutionCode: [
          'import math',
          '',
          'x = float(input())',
          'print(f"Len: {math.ceil(x)}")',
          'print(f"Xuong: {math.floor(x)}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3.2\n', 'Len: 4\nXuong: 3\n', 'Lên thành 4, xuống thành 3.'),
          hidden('5.0\n', 'Len: 5\nXuong: 5\n', 25),
          hidden('-2.5\n', 'Len: -2\nXuong: -3\n', 25),
        ],
      }),
    ],
  },

  'b18-datetime-ngay-gio': {
    khoi: [
      challenge({
        slug: 'p-bs-b18-so-ngay-giua-hai-moc',
        title: 'Số ngày giữa hai mốc',
        statement: [
          'Đọc hai ngày, mỗi ngày một dòng, theo dạng `YYYY-MM-DD`.',
          '',
          'In ra số ngày giữa hai mốc đó (luôn là số không âm).',
        ].join('\n'),
        hints: ['`date.fromisoformat("2026-01-31")` đọc thẳng được dạng này.', 'Hiệu hai `date` cho một `timedelta` có thuộc tính `.days`.'],
        starterCode: [
          'from datetime import date',
          '',
          'a = date.fromisoformat(input())',
          'b = date.fromisoformat(input())',
          '',
          '# Tính số ngày',
        ].join('\n'),
        solutionCode: [
          'from datetime import date',
          '',
          'a = date.fromisoformat(input())',
          'b = date.fromisoformat(input())',
          'print(abs((b - a).days))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2026-01-01\n2026-01-31\n', '30\n', 'Từ 1 đến 31 tháng 1 là 30 ngày.'),
          hidden('2026-03-01\n2026-03-01\n', '0\n', 25),
          hidden('2024-02-28\n2024-03-01\n', '2\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b18-thu-cua-ngay',
        title: 'Ngày đó là thứ mấy',
        statement: [
          'Đọc một ngày dạng `YYYY-MM-DD`.',
          '',
          'In ra thứ trong tuần bằng tiếng Việt không dấu:',
          '`Thu hai`, `Thu ba`, `Thu tu`, `Thu nam`, `Thu sau`, `Thu bay`, `Chu nhat`.',
        ].join('\n'),
        hints: ['`.weekday()` trả 0 cho thứ hai và 6 cho chủ nhật.', 'Một danh sách bảy phần tử tra ra tên là đủ.'],
        starterCode: [
          'from datetime import date',
          '',
          'ngay = date.fromisoformat(input())',
          '',
          '# Tra ra tên thứ',
        ].join('\n'),
        solutionCode: [
          'from datetime import date',
          '',
          'ngay = date.fromisoformat(input())',
          'ten = ["Thu hai", "Thu ba", "Thu tu", "Thu nam", "Thu sau", "Thu bay", "Chu nhat"]',
          'print(ten[ngay.weekday()])',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2026-01-01\n', 'Thu nam\n', 'Ngày 1 tháng 1 năm 2026 rơi vào thứ năm.'),
          hidden('2026-01-04\n', 'Chu nhat\n', 25),
          hidden('2026-01-05\n', 'Thu hai\n', 25),
        ],
      }),
    ],
  },

  'b19-calendar-va-luyen-tap': {
    khoi: [
      challenge({
        slug: 'p-bs-b19-nam-nhuan',
        title: 'Năm đó có nhuận không',
        statement: [
          'Đọc một số nguyên là năm.',
          '',
          'In ra `Nam nhuan` hoặc `Khong nhuan`.',
        ].join('\n'),
        hints: ['`calendar.isleap(nam)` trả về True hoặc False.'],
        starterCode: ['import calendar', '', 'nam = int(input())', '', '# Kiểm tra năm nhuận'].join('\n'),
        solutionCode: [
          'import calendar',
          '',
          'nam = int(input())',
          'if calendar.isleap(nam):',
          '    print("Nam nhuan")',
          'else:',
          '    print("Khong nhuan")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2024\n', 'Nam nhuan\n', '2024 chia hết cho 4.'),
          hidden('2026\n', 'Khong nhuan\n', 25),
          hidden('2000\n', 'Nam nhuan\n', 25),
          hidden('1900\n', 'Khong nhuan\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b19-so-ngay-trong-thang',
        title: 'Tháng đó có bao nhiêu ngày',
        statement: [
          'Đọc **năm** rồi **tháng**, mỗi số một dòng.',
          '',
          'In ra số ngày của tháng đó.',
        ].join('\n'),
        hints: ['`calendar.monthrange(nam, thang)` trả về một cặp; phần tử thứ hai là số ngày.'],
        starterCode: [
          'import calendar',
          '',
          'nam = int(input())',
          'thang = int(input())',
          '',
          '# Lấy số ngày',
        ].join('\n'),
        solutionCode: [
          'import calendar',
          '',
          'nam = int(input())',
          'thang = int(input())',
          'print(calendar.monthrange(nam, thang)[1])',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2026\n2\n', '28\n', 'Tháng 2 năm thường có 28 ngày.'),
          hidden('2024\n2\n', '29\n', 25),
          hidden('2026\n1\n', '31\n', 25),
          hidden('2026\n4\n', '30\n', 25),
        ],
      }),
    ],
  },

  'b20-list-danh-sach': {
    khoi: [
      challenge({
        slug: 'p-bs-b20-tong-va-trung-binh-list',
        title: 'Tổng và trung bình của danh sách',
        statement: [
          'Dòng đầu là số lượng `n`. Dòng sau gồm `n` số nguyên cách nhau bởi dấu cách.',
          '',
          'In ra hai dòng: `Tong: <tổng>` rồi `Trung binh: <trung bình>` (2 chữ số thập phân).',
        ].join('\n'),
        hints: ['`input().split()` tách dòng thành danh sách chuỗi.', '`sum(ds)` cộng cả danh sách.'],
        starterCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          '',
          '# Tính tổng và trung bình',
        ].join('\n'),
        solutionCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          'print(f"Tong: {sum(ds)}")',
          'print(f"Trung binh: {sum(ds) / n:.2f}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n1 2 3 4\n', 'Tong: 10\nTrung binh: 2.50\n', 'Tổng 10 chia 4 bằng 2.5.'),
          hidden('3\n5 5 5\n', 'Tong: 15\nTrung binh: 5.00\n', 25),
          hidden('2\n-3 3\n', 'Tong: 0\nTrung binh: 0.00\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b20-dao-nguoc-danh-sach',
        title: 'Đảo ngược danh sách',
        statement: [
          'Dòng đầu là số lượng `n`. Dòng sau gồm `n` số nguyên cách nhau bởi dấu cách.',
          '',
          'In ra dãy đó theo thứ tự ngược lại, các số cách nhau một dấu cách.',
        ].join('\n'),
        hints: ['`ds[::-1]` cho một bản sao đảo ngược.', '`" ".join(...)` nối lại thành một dòng.'],
        starterCode: [
          'n = int(input())',
          'ds = input().split()',
          '',
          '# In ngược lại',
        ].join('\n'),
        solutionCode: [
          'n = int(input())',
          'ds = input().split()',
          'print(" ".join(ds[::-1]))',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n1 2 3 4 5\n', '5 4 3 2 1\n', 'Các số cách nhau đúng một dấu cách.'),
          hidden('1\n9\n', '9\n', 25),
          hidden('3\n-1 0 1\n', '1 0 -1\n', 25),
        ],
      }),
    ],
  },

  'b21-list-nang-cao': {
    khoi: [
      challenge({
        slug: 'p-bs-b21-sap-xep-danh-sach',
        title: 'Sắp xếp tăng dần',
        statement: [
          'Dòng đầu là số lượng `n`. Dòng sau gồm `n` số nguyên cách nhau bởi dấu cách.',
          '',
          'In ra dãy đã sắp xếp **tăng dần**, cách nhau một dấu cách.',
        ].join('\n'),
        hints: ['`sorted(ds)` trả về danh sách đã sắp xếp.', 'Nhớ đổi sang số trước khi sắp xếp, không thì 10 sẽ đứng trước 9.'],
        starterCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          '',
          '# Sắp xếp rồi in',
        ].join('\n'),
        solutionCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          'print(" ".join(str(x) for x in sorted(ds)))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n3 1 10 9 2\n', '1 2 3 9 10\n', 'So sánh theo giá trị số, nên 9 đứng trước 10.'),
          hidden('3\n-5 0 -10\n', '-10 -5 0\n', 25),
          hidden('4\n7 7 7 7\n', '7 7 7 7\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b21-loc-so-lon-hon',
        title: 'Lọc những số lớn hơn ngưỡng',
        statement: [
          'Dòng đầu là số lượng `n`. Dòng thứ hai gồm `n` số nguyên.',
          'Dòng thứ ba là **ngưỡng** `k`.',
          '',
          'In ra những số **lớn hơn k**, giữ nguyên thứ tự, cách nhau một dấu cách.',
          '',
          'Nếu không có số nào, in ra `Khong co`.',
        ].join('\n'),
        hints: ['List comprehension có thể kèm điều kiện: `[x for x in ds if x > k]`.'],
        starterCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          'k = int(input())',
          '',
          '# Lọc và in',
        ].join('\n'),
        solutionCode: [
          'n = int(input())',
          'ds = [int(x) for x in input().split()]',
          'k = int(input())',
          'ket = [x for x in ds if x > k]',
          'if len(ket) == 0:',
          '    print("Khong co")',
          'else:',
          '    print(" ".join(str(x) for x in ket))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5\n1 5 3 9 7\n4\n', '5 9 7\n', 'Giữ nguyên thứ tự xuất hiện.'),
          sample('3\n1 2 3\n10\n', 'Khong co\n', 'Không số nào vượt ngưỡng.'),
          hidden('4\n-1 -2 0 5\n-1\n', '0 5\n', 25),
        ],
      }),
    ],
  },

  'b22-dictionary-tu-dien': {
    khoi: [
      challenge({
        slug: 'p-bs-b22-dem-tan-suat-tu',
        title: 'Đếm số lần xuất hiện',
        statement: [
          'Đọc một dòng gồm các từ cách nhau bởi dấu cách.',
          '',
          'In ra mỗi từ khác nhau trên một dòng theo dạng `<từ>: <số lần>`,',
          'theo **thứ tự xuất hiện lần đầu**.',
        ].join('\n'),
        hints: ['Dùng dictionary với từ làm khoá.', 'Từ Python 3.7, dictionary giữ đúng thứ tự thêm vào.'],
        starterCode: ['tu = input().split()', 'dem = {}', '', '# Đếm rồi in'].join('\n'),
        solutionCode: [
          'tu = input().split()',
          'dem = {}',
          'for t in tu:',
          '    if t in dem:',
          '        dem[t] = dem[t] + 1',
          '    else:',
          '        dem[t] = 1',
          'for t in dem:',
          '    print(f"{t}: {dem[t]}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('meo cho meo ca\n', 'meo: 2\ncho: 1\nca: 1\n', 'meo xuất hiện đầu tiên nên đứng đầu.'),
          hidden('a a a\n', 'a: 3\n', 25),
          hidden('x y z\n', 'x: 1\ny: 1\nz: 1\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b22-tra-diem-hoc-sinh',
        title: 'Tra điểm theo tên',
        statement: [
          'Dòng đầu là số lượng `n`. `n` dòng sau, mỗi dòng gồm **tên** và **điểm** cách nhau một dấu cách.',
          'Dòng cuối là một **tên cần tra**.',
          '',
          'In ra điểm của bạn đó, hoặc `Khong tim thay` nếu tên không có trong danh sách.',
        ].join('\n'),
        hints: ['`ten, diem = dong.split()` tách được hai phần.', '`if ten in tu_dien` kiểm tra khoá có tồn tại không.'],
        starterCode: ['n = int(input())', 'bang = {}', '', '# Đọc rồi tra'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'bang = {}',
          'for _ in range(n):',
          '    ten, diem = input().split()',
          '    bang[ten] = diem',
          'can_tra = input()',
          'if can_tra in bang:',
          '    print(bang[can_tra])',
          'else:',
          '    print("Khong tim thay")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2\nLan 9\nMinh 8\nLan\n', '9\n', 'Tra đúng khoá Lan.'),
          sample('1\nLan 9\nHoa\n', 'Khong tim thay\n', 'Hoa không có trong danh sách.'),
          hidden('3\nA 1\nB 2\nC 3\nC\n', '3\n', 25),
        ],
      }),
    ],
  },

  // Note 5: theory only. No CODING or MINI_CHALLENGE block may appear here.
  'b23-tuple-set-khai-niem': {
    khoi: [
      mcqBlock({
        slug: 'q-bs-b23-tuple-set',
        title: 'Luyện tập: Tuple và Set',
        questions: [
          mcq(
            'Điểm khác nhau cơ bản giữa tuple và list là gì?',
            'Tuple không sửa được sau khi tạo, list thì sửa được',
            [
              'Tuple chỉ chứa được số, list chứa được mọi thứ',
              'Tuple luôn dài hơn list',
              'Tuple không có thứ tự, list thì có',
            ],
            { explanation: 'Tuple là bất biến. Cần một dãy cố định thì tuple nói rõ ý định đó ngay từ lúc viết.' },
          ),
          mcq(
            'Đặc điểm nổi bật của set là gì?',
            'Mỗi giá trị chỉ xuất hiện một lần',
            ['Luôn được sắp xếp tăng dần', 'Chỉ chứa được chuỗi', 'Không thể thêm phần tử mới'],
            { explanation: 'Set loại bỏ trùng lặp — đó là lý do người ta chọn nó.' },
          ),
          mcq(
            'Từ danh sách `[1, 2, 2, 3, 3, 3]`, chuyển sang set sẽ còn lại bao nhiêu phần tử?',
            '3',
            ['6', '1', '2'],
            { explanation: 'Chỉ còn 1, 2 và 3 — mỗi giá trị một lần.' },
          ),
          mcq(
            'Cặp ngoặc nào dùng để viết một tuple?',
            'Ngoặc tròn `( )`',
            ['Ngoặc vuông `[ ]`', 'Ngoặc nhọn `{ }`', 'Dấu nháy kép'],
          ),
        ],
      }),
      fillBlankBlock({
        slug: 'q-bs-b23-dien-khuyet',
        title: 'Điền khuyết: hai kiểu dữ liệu mới',
        questions: [
          dienKhuyet(
            'Kiểu dữ liệu nào không cho phép sửa sau khi tạo?',
            'Kiểu dữ liệu không sửa được sau khi tạo là ___.',
            ['tuple'],
          ),
          dienKhuyet(
            'Kiểu dữ liệu nào tự loại bỏ giá trị trùng lặp?',
            'Kiểu dữ liệu tự loại bỏ trùng lặp là ___.',
            ['set'],
          ),
        ],
      }),
    ],
  },

  'b24-ham-do-nguoi-dung-dinh-nghia': {
    khoi: [
      challenge({
        slug: 'p-bs-b24-ham-tinh-dien-tich',
        title: 'Hàm tính diện tích hình tròn',
        statement: [
          'Viết hàm `dien_tich(r)` trả về diện tích hình tròn bán kính r.',
          '',
          'Chương trình đọc một số nguyên là bán kính và in ra diện tích,',
          'làm tròn tới **2 chữ số thập phân**.',
        ].join('\n'),
        hints: ['`math.pi` là hằng số pi.', 'Hàm dùng `return` để trả giá trị về nơi gọi.'],
        starterCode: [
          'import math',
          '',
          'def dien_tich(r):',
          '    # Trả về diện tích',
          '    pass',
          '',
          'r = int(input())',
        ].join('\n'),
        solutionCode: [
          'import math',
          '',
          'def dien_tich(r):',
          '    return math.pi * r * r',
          '',
          'r = int(input())',
          'print(f"{dien_tich(r):.2f}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('1\n', '3.14\n', 'Bán kính 1 cho diện tích đúng bằng pi.'),
          hidden('2\n', '12.57\n', 25),
          hidden('10\n', '314.16\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b24-ham-kiem-tra-nguyen-to',
        title: 'Hàm kiểm tra số nguyên tố',
        statement: [
          'Viết hàm `la_nguyen_to(n)` trả về `True` hoặc `False`.',
          '',
          'Chương trình đọc một số nguyên và in ra `Nguyen to` hoặc `Khong phai`.',
          '',
          'Nhắc lại: số nguyên tố là số lớn hơn 1 và chỉ chia hết cho 1 và chính nó.',
        ].join('\n'),
        hints: ['Số nhỏ hơn 2 chắc chắn không phải số nguyên tố.', 'Chỉ cần thử các ước từ 2 tới n - 1.'],
        starterCode: [
          'def la_nguyen_to(n):',
          '    # Trả về True hoặc False',
          '    pass',
          '',
          'n = int(input())',
        ].join('\n'),
        solutionCode: [
          'def la_nguyen_to(n):',
          '    if n < 2:',
          '        return False',
          '    for i in range(2, n):',
          '        if n % i == 0:',
          '            return False',
          '    return True',
          '',
          'n = int(input())',
          'if la_nguyen_to(n):',
          '    print("Nguyen to")',
          'else:',
          '    print("Khong phai")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('7\n', 'Nguyen to\n', '7 chỉ chia hết cho 1 và 7.'),
          sample('1\n', 'Khong phai\n', '1 không được coi là số nguyên tố.'),
          hidden('2\n', 'Nguyen to\n', 20),
          hidden('9\n', 'Khong phai\n', 20),
          hidden('97\n', 'Nguyen to\n', 20),
        ],
      }),
    ],
  },

  'b25-tham-so-tra-ve-pham-vi-bien': {
    khoi: [
      challenge({
        slug: 'p-bs-b25-ham-nhieu-tham-so',
        title: 'Hàm với giá trị mặc định',
        statement: [
          'Viết hàm `chao(ten, loi="Xin chao")` trả về chuỗi `"<lời> <tên>"`.',
          '',
          'Chương trình đọc **tên** ở dòng đầu. Dòng thứ hai là **lời chào**;',
          'nếu dòng đó rỗng thì dùng giá trị mặc định.',
        ].join('\n'),
        hints: ['Tham số có giá trị mặc định được viết `def f(a, b="gi do")`.', 'Một dòng rỗng đọc lên là chuỗi rỗng `""`.'],
        starterCode: [
          'def chao(ten, loi="Xin chao"):',
          '    # Trả về chuỗi lời chào',
          '    pass',
          '',
          'ten = input()',
          'loi = input()',
        ].join('\n'),
        solutionCode: [
          'def chao(ten, loi="Xin chao"):',
          '    return f"{loi} {ten}"',
          '',
          'ten = input()',
          'loi = input()',
          'if loi == "":',
          '    print(chao(ten))',
          'else:',
          '    print(chao(ten, loi))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('Lan\n\n', 'Xin chao Lan\n', 'Dòng thứ hai rỗng nên dùng mặc định.'),
          sample('Minh\nChao buoi sang\n', 'Chao buoi sang Minh\n', 'Có lời chào riêng thì dùng nó.'),
          hidden('An\nHello\n', 'Hello An\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-b25-tra-ve-nhieu-gia-tri',
        title: 'Hàm trả về hai giá trị',
        statement: [
          'Viết hàm `chia_lay_du(a, b)` trả về **cả thương nguyên và phần dư**.',
          '',
          'Chương trình đọc hai số nguyên rồi in ra `Thuong: <t>` và `Du: <d>` trên hai dòng.',
        ].join('\n'),
        hints: ['`return a // b, a % b` trả về một tuple hai phần tử.', 'Nơi gọi nhận bằng `t, d = chia_lay_du(...)`.'],
        starterCode: [
          'def chia_lay_du(a, b):',
          '    # Trả về thương và dư',
          '    pass',
          '',
          'a = int(input())',
          'b = int(input())',
        ].join('\n'),
        solutionCode: [
          'def chia_lay_du(a, b):',
          '    return a // b, a % b',
          '',
          'a = int(input())',
          'b = int(input())',
          't, d = chia_lay_du(a, b)',
          'print(f"Thuong: {t}")',
          'print(f"Du: {d}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('17\n5\n', 'Thuong: 3\nDu: 2\n', '17 = 5 × 3 + 2.'),
          hidden('100\n10\n', 'Thuong: 10\nDu: 0\n', 25),
          hidden('7\n9\n', 'Thuong: 0\nDu: 7\n', 25),
        ],
      }),
    ],
  },

  'b26-module-va-package': {
    khoi: [
      challenge({
        slug: 'p-bs-b26-random-co-hat-giong',
        title: 'Số ngẫu nhiên lặp lại được',
        statement: [
          'Đọc một số nguyên là **hạt giống** (seed).',
          '',
          'Đặt hạt giống đó cho `random`, rồi in ra **ba số** `random.randint(1, 100)`,',
          'mỗi số một dòng.',
          '',
          'Cùng một hạt giống luôn cho cùng một dãy số — đó là điều làm cho bài này chấm được.',
        ].join('\n'),
        hints: ['`random.seed(x)` đặt điểm bắt đầu.', 'Gọi `random.randint(1, 100)` đúng ba lần.'],
        starterCode: [
          'import random',
          '',
          'hat = int(input())',
          'random.seed(hat)',
          '',
          '# In ba số',
        ].join('\n'),
        solutionCode: [
          'import random',
          '',
          'hat = int(input())',
          'random.seed(hat)',
          'for _ in range(3):',
          '    print(random.randint(1, 100))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('1\n', '18\n73\n98\n', 'Hạt giống 1 luôn cho đúng dãy này.'),
          hidden('42\n', '82\n15\n4\n', 30),
          hidden('7\n', '42\n20\n51\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-b26-dung-nhieu-module',
        title: 'Kết hợp hai module',
        statement: [
          'Đọc một số nguyên `n`.',
          '',
          'In ra hai dòng:',
          '',
          '- `Can bac hai: <math.sqrt(n) làm tròn 2 chữ số>`',
          '- `Giai thua: <math.factorial(n)>`',
        ].join('\n'),
        hints: ['Cả hai hàm đều nằm trong module `math`.'],
        starterCode: ['import math', '', 'n = int(input())', '', '# In hai dòng'].join('\n'),
        solutionCode: [
          'import math',
          '',
          'n = int(input())',
          'print(f"Can bac hai: {math.sqrt(n):.2f}")',
          'print(f"Giai thua: {math.factorial(n)}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n', 'Can bac hai: 2.00\nGiai thua: 24\n', 'Căn của 4 là 2, giai thừa của 4 là 24.'),
          hidden('1\n', 'Can bac hai: 1.00\nGiai thua: 1\n', 25),
          hidden('5\n', 'Can bac hai: 2.24\nGiai thua: 120\n', 25),
        ],
      }),
    ],
  },

  // Note 6: try/except only. No `class X(Exception)` anywhere in this lesson.
  'b27-xu-ly-ngoai-le': {
    khoi: [
      challenge({
        slug: 'p-bs-b27-doc-so-an-toan',
        title: 'Đọc số một cách an toàn',
        statement: [
          'Đọc một dòng bất kỳ.',
          '',
          'Nếu dòng đó là một số nguyên, in ra số đó nhân đôi.',
          'Nếu không, in ra `Khong phai so`.',
        ].join('\n'),
        hints: ['`int()` ném ra `ValueError` khi chuỗi không phải số.', 'Bọc phần có thể hỏng trong `try`, xử lý trong `except ValueError`.'],
        starterCode: ['dong = input()', '', '# Thử đổi sang số'].join('\n'),
        solutionCode: [
          'dong = input()',
          'try:',
          '    n = int(dong)',
          '    print(n * 2)',
          'except ValueError:',
          '    print("Khong phai so")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('21\n', '42\n', 'Đổi được thành số nên nhân đôi.'),
          sample('meo\n', 'Khong phai so\n', '`int("meo")` ném ValueError.'),
          hidden('-5\n', '-10\n', 25),
          hidden('3.5\n', 'Khong phai so\n', 25),
        ],
      }),
      challenge({
        slug: 'p-bs-b27-chia-an-toan',
        title: 'Chia mà không sập chương trình',
        statement: [
          'Đọc hai số nguyên `a` và `b`.',
          '',
          'In ra thương `a / b` với **2 chữ số thập phân**,',
          'hoặc `Khong chia cho 0` nếu b bằng 0.',
        ].join('\n'),
        hints: ['Chia cho 0 ném ra `ZeroDivisionError`.'],
        starterCode: [
          'a = int(input())',
          'b = int(input())',
          '',
          '# Chia an toàn',
        ].join('\n'),
        solutionCode: [
          'a = int(input())',
          'b = int(input())',
          'try:',
          '    print(f"{a / b:.2f}")',
          'except ZeroDivisionError:',
          '    print("Khong chia cho 0")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('10\n4\n', '2.50\n', '10 chia 4 bằng 2.5.'),
          sample('5\n0\n', 'Khong chia cho 0\n', 'Bắt được ZeroDivisionError.'),
          hidden('-9\n3\n', '-3.00\n', 25),
        ],
      }),
    ],
  },

  'b28-doc-ghi-tep-van-ban': {
    khoi: [
      challenge({
        slug: 'p-bs-b28-ghi-roi-doc-lai',
        title: 'Ghi ra tệp rồi đọc lại',
        statement: [
          'Đọc một số nguyên `n`, rồi `n` dòng chữ.',
          '',
          'Ghi `n` dòng đó vào tệp `ghi_chu.txt`, sau đó **đọc lại tệp** và in ra',
          'từng dòng kèm số thứ tự theo mẫu `<i>. <nội dung>`, i bắt đầu từ 1.',
        ].join('\n'),
        hints: [
          'Mở bằng `open("ghi_chu.txt", "w")` để ghi, `"r"` để đọc.',
          'Nhớ xuống dòng khi ghi, và `.rstrip("\\n")` khi đọc lại.',
        ],
        starterCode: ['n = int(input())', '', '# Ghi rồi đọc lại'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'dong = [input() for _ in range(n)]',
          'with open("ghi_chu.txt", "w", encoding="utf-8") as f:',
          '    for d in dong:',
          '        f.write(d + "\\n")',
          'with open("ghi_chu.txt", "r", encoding="utf-8") as f:',
          '    for i, d in enumerate(f, start=1):',
          '        print(f"{i}. {d.rstrip()}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2\nmua bai\nlam bai tap\n', '1. mua bai\n2. lam bai tap\n', 'Đọc lại đúng thứ tự đã ghi.'),
          hidden('1\nxin chao\n', '1. xin chao\n', 30),
          hidden('3\na\nb\nc\n', '1. a\n2. b\n3. c\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-b28-dem-dong-trong-tep',
        title: 'Đếm dòng và ký tự',
        statement: [
          'Đọc một số nguyên `n`, rồi `n` dòng chữ. Ghi chúng vào tệp `du_lieu.txt`.',
          '',
          'Sau đó đọc lại tệp và in ra hai dòng:',
          '`So dong: <n>` và `So ky tu: <tổng số ký tự, không tính ký tự xuống dòng>`.',
        ].join('\n'),
        hints: ['`len(dong)` cho số ký tự của một dòng.'],
        starterCode: ['n = int(input())', '', '# Ghi, đọc lại rồi đếm'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'dong = [input() for _ in range(n)]',
          'with open("du_lieu.txt", "w", encoding="utf-8") as f:',
          '    for d in dong:',
          '        f.write(d + "\\n")',
          'so_dong = 0',
          'so_ky_tu = 0',
          'with open("du_lieu.txt", "r", encoding="utf-8") as f:',
          '    for d in f:',
          '        so_dong = so_dong + 1',
          '        so_ky_tu = so_ky_tu + len(d.rstrip("\\n"))',
          'print(f"So dong: {so_dong}")',
          'print(f"So ky tu: {so_ky_tu}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2\nabc\nde\n', 'So dong: 2\nSo ky tu: 5\n', '3 ký tự cộng 2 ký tự.'),
          hidden('1\nxyz\n', 'So dong: 1\nSo ky tu: 3\n', 30),
          hidden('3\na\nbb\nccc\n', 'So dong: 3\nSo ky tu: 6\n', 30),
        ],
      }),
    ],
  },

  'b29-lam-viec-voi-json': {
    khoi: [
      challenge({
        slug: 'p-bs-b29-doc-json-lay-truong',
        title: 'Đọc JSON và lấy một trường',
        statement: [
          'Dòng đầu là một chuỗi JSON mô tả một đối tượng. Dòng thứ hai là **tên trường** cần lấy.',
          '',
          'In ra giá trị của trường đó, hoặc `Khong co truong nay` nếu không tồn tại.',
        ].join('\n'),
        hints: ['`json.loads(chuoi)` đổi chuỗi JSON thành dictionary.'],
        starterCode: [
          'import json',
          '',
          'du_lieu = json.loads(input())',
          'truong = input()',
          '',
          '# Lấy giá trị',
        ].join('\n'),
        solutionCode: [
          'import json',
          '',
          'du_lieu = json.loads(input())',
          'truong = input()',
          'if truong in du_lieu:',
          '    print(du_lieu[truong])',
          'else:',
          '    print("Khong co truong nay")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('{"ten": "Lan", "tuoi": 12}\nten\n', 'Lan\n', 'Lấy đúng trường ten.'),
          sample('{"ten": "Lan"}\ndiem\n', 'Khong co truong nay\n', 'Trường diem không tồn tại.'),
          hidden('{"a": 1, "b": 2}\nb\n', '2\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-b29-ghi-json-tu-dong',
        title: 'Dựng JSON từ dữ liệu nhập',
        statement: [
          'Đọc **tên**, **tuổi** (số nguyên) và **lớp**, mỗi giá trị một dòng.',
          '',
          'In ra một dòng JSON có đúng ba khoá `ten`, `tuoi`, `lop`,',
          'dùng `json.dumps(..., ensure_ascii=False)` và giữ nguyên thứ tự trên.',
        ].join('\n'),
        hints: ['`json.dumps` đổi dictionary thành chuỗi JSON.', '`ensure_ascii=False` giữ nguyên chữ có dấu.'],
        starterCode: [
          'import json',
          '',
          'ten = input()',
          'tuoi = int(input())',
          'lop = input()',
          '',
          '# Dựng và in JSON',
        ].join('\n'),
        solutionCode: [
          'import json',
          '',
          'ten = input()',
          'tuoi = int(input())',
          'lop = input()',
          'print(json.dumps({"ten": ten, "tuoi": tuoi, "lop": lop}, ensure_ascii=False))',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample(
            'Lan\n12\n7A1\n',
            '{"ten": "Lan", "tuoi": 12, "lop": "7A1"}\n',
            'Chú ý dấu cách sau mỗi dấu hai chấm và dấu phẩy.',
          ),
          hidden('Minh\n13\n8B\n', '{"ten": "Minh", "tuoi": 13, "lop": "8B"}\n', 30),
        ],
      }),
    ],
  },

  'b30-du-an-cuoi-khoa': {
    khoi: [
      challenge({
        slug: 'p-bs-b30-so-diem-tong-ket',
        title: 'Bảng điểm tổng kết',
        statement: [
          'Dòng đầu là số lượng `n`. `n` dòng sau, mỗi dòng gồm **tên** và **điểm** (số nguyên).',
          '',
          'In ra tên bạn có điểm cao nhất và điểm đó, theo mẫu `<tên>: <điểm>`.',
          'Nếu có nhiều bạn cùng điểm cao nhất, in ra bạn **xuất hiện trước**.',
        ].join('\n'),
        hints: ['Giữ lại tên và điểm cao nhất tìm được cho tới lúc đó.', 'Chỉ thay khi gặp điểm **lớn hơn hẳn** thì bạn xuất hiện trước sẽ được giữ.'],
        starterCode: ['n = int(input())', '', '# Tìm bạn điểm cao nhất'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'ten_max = ""',
          'diem_max = -1',
          'for _ in range(n):',
          '    ten, diem = input().split()',
          '    diem = int(diem)',
          '    if diem > diem_max:',
          '        diem_max = diem',
          '        ten_max = ten',
          'print(f"{ten_max}: {diem_max}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\nLan 8\nMinh 10\nHoa 9\n', 'Minh: 10\n', 'Minh có điểm cao nhất.'),
          sample('2\nLan 9\nMinh 9\n', 'Lan: 9\n', 'Bằng điểm thì giữ bạn xuất hiện trước.'),
          hidden('1\nAn 7\n', 'An: 7\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-b30-thong-ke-cuoi-khoa',
        title: 'Thống kê điểm cả lớp',
        statement: [
          'Dòng đầu là số lượng `n`. Dòng sau gồm `n` số nguyên là điểm, cách nhau dấu cách.',
          '',
          'In ra ba dòng:',
          '',
          '- `Cao nhat: <max>`',
          '- `Thap nhat: <min>`',
          '- `Trung binh: <trung bình 2 chữ số thập phân>`',
        ].join('\n'),
        hints: ['`max()`, `min()` và `sum()` làm được cả ba việc.'],
        starterCode: [
          'n = int(input())',
          'diem = [int(x) for x in input().split()]',
          '',
          '# Thống kê',
        ].join('\n'),
        solutionCode: [
          'n = int(input())',
          'diem = [int(x) for x in input().split()]',
          'print(f"Cao nhat: {max(diem)}")',
          'print(f"Thap nhat: {min(diem)}")',
          'print(f"Trung binh: {sum(diem) / n:.2f}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample(
            '5\n7 9 10 6 8\n',
            'Cao nhat: 10\nThap nhat: 6\nTrung binh: 8.00\n',
            'Tổng 40 chia 5 bằng 8.',
          ),
          hidden('3\n5 5 5\n', 'Cao nhat: 5\nThap nhat: 5\nTrung binh: 5.00\n', 30),
          hidden('2\n0 10\n', 'Cao nhat: 10\nThap nhat: 0\nTrung binh: 5.00\n', 30),
        ],
      }),
    ],
  },
};
