/**
 * Micro:bit — the 30-session frame, sessions 5 to 30.
 *
 * ── What a "shell" is, and why it is honest ──────────────────────────────────
 * The Micro:bit brief specifies Module 1 in full — five Basic blocks and two
 * named challenges — and nothing beyond it. Modules 2 to 7 are a PLAN: the topic
 * order is real and comes from how the hardware itself is layered (you cannot
 * teach the radio before variables), but the lesson content has not been written
 * by a teacher yet.
 *
 * Inventing that content would be the worst option available. A fabricated
 * Buổi 17 looks identical in the database to an authored one, reads plausibly to
 * a student, and is indistinguishable to a teacher browsing the curriculum until
 * they are standing in front of a class teaching it.
 *
 * So each of these sessions ships as a shell that says so, out loud, in three
 * places at once:
 *
 *   • `status: 'OPTIONAL'` — a shell must never sit in a student's required
 *     denominator. With the default linear prerequisite chain, a REQUIRED empty
 *     lesson would park every child in the class behind a page with nothing on
 *     it and report the class as 15% complete.
 *   • `isDerived: true` — the flag the schema already carries for exactly this,
 *     so the teacher curriculum view can filter and the real plan can be
 *     swapped in later without a schema change.
 *   • Student-facing prose that names it as "đang được biên soạn", because a
 *     child who opens it deserves a straight answer rather than a blank page.
 *
 * Each shell still carries a THEORY block stating what the session WILL cover
 * and an INTERACTIVE_EXAMPLE pointing at the simulator, so it is a usable
 * self-study prompt rather than a dead end — and so the pedagogical-flow
 * assertion has something real to check once challenges are added.
 */
import { example, theory } from '../builders.ts';

import type { LessonSpec, ModuleSpec } from '../types.ts';

/** One planned session: what it will teach, in the order the hardware allows. */
interface KhungBuoi {
  order: number;
  slug: string;
  title: string;
  summary: string;
  objectives: string[];
  difficulty: number;
  /** MakeCode blocks this session introduces. Shown as the "what's coming" list. */
  khoiLenh: string[];
}

/**
 * Turn a planned session into a lesson row.
 *
 * The prerequisite chain is left to the default (each session requires the one
 * before it), which is right for a hardware course: every block group builds on
 * the previous one, and a teacher can waive any edge per class or per student
 * from the student detail page.
 */
function buoiSapMo(khung: KhungBuoi): LessonSpec {
  return {
    order: khung.order,
    slug: khung.slug,
    title: khung.title,
    summary: khung.summary,
    objectives: khung.objectives,
    difficulty: khung.difficulty,
    estimatedMinutes: 90,
    // Never REQUIRED. See the module comment: a shell in the required
    // denominator would report every student in the class as behind.
    status: 'OPTIONAL',
    isDerived: true,
    teacherNotes: [
      'BUỔI CHƯA BIÊN SOẠN. Khung nội dung đã có, phần bài giảng chi tiết chưa viết.',
      `Khối lệnh dự kiến: ${khung.khoiLenh.join(', ')}.`,
      'Trạng thái để OPTIONAL nên buổi này KHÔNG tính vào tiến độ bắt buộc của học sinh,',
      'và không chặn các buổi sau khi thầy cô bỏ tiền quyết.',
      'Khi có giáo án, thay khối nội dung ở đây theo mẫu của Buổi 1 (microbit-buoi-01.ts).',
    ].join(' '),
    blocks: [
      theory(
        `Buổi này sẽ có gì`,
        [
          `Buổi ${khung.order} sẽ dạy: **${khung.summary}**`,
          '',
          'Sau buổi này em sẽ:',
          '',
          ...khung.objectives.map((o) => `- ${o}`),
          '',
          'Khối lệnh mới em sẽ gặp:',
          '',
          ...khung.khoiLenh.map((k) => `- \`${k}\``),
          '',
          '> 📝 **Phần bài giảng chi tiết của buổi này đang được biên soạn.**',
          '> Trong lúc chờ, em mở MakeCode và tự thử các khối ở trên xem chúng làm gì —',
          '> đó đúng là cách thầy cô muốn em học phần cứng: nghịch trước, hiểu sau.',
        ].join('\n'),
        [`Buổi ${khung.order} tập trung vào: ${khung.khoiLenh.join(', ')}`],
        { minutes: 10 },
      ),
      example(
        'Tự khám phá trước trong trình mô phỏng',
        [
          'Chưa cần chờ bài giảng. Mở [MakeCode](https://makecode.microbit.org) ở tab khác,',
          'tìm các khối lệnh nêu trên trong hộp khối, kéo thử một khối ra và bấm chạy.',
          '',
          'Ghi lại vào vở: **khối đó làm gì?** Buổi học chính thức sẽ bắt đầu từ chính',
          'câu trả lời của em.',
        ].join('\n'),
        [
          '// Khối lệnh dự kiến của buổi này:',
          ...khung.khoiLenh.map((k) => `// - ${k}`),
        ].join('\n'),
        {
          notes: [
            'Không có gì hỏng được — khối không khớp thì MakeCode không cho ghép.',
            'Thử xong nhớ ghi lại một câu vào vở, buổi học sẽ dùng tới.',
          ],
          minutes: 10,
        },
      ),
    ],
  };
}

/**
 * The plan, sessions 5–30.
 *
 * Ordered by what the hardware makes possible, not by what sounds impressive.
 * Input before variables, variables before logic, logic before the radio — a
 * student cannot make two boards talk to each other before they can hold a
 * value in a variable.
 */
const KE_HOACH: Array<{ module: Omit<ModuleSpec, 'lessons'>; buoi: KhungBuoi[] }> = [
  {
    module: {
      slug: 'nhap-lieu-va-cam-bien',
      title: 'Module 2 · Nút bấm và cảm biến',
      description:
        'Board bắt đầu phản ứng lại với em: nút A, nút B, lắc, nghiêng, sáng tối và nhiệt độ.',
    },
    buoi: [
      {
        order: 5,
        slug: 'mb-b05-nut-a-nut-b',
        title: 'Buổi 5 · Nút A và nút B',
        summary: 'Cho board làm việc khác nhau tuỳ theo em bấm nút nào',
        objectives: [
          'Dùng khối `on button pressed` để bắt sự kiện bấm nút',
          'Cho nút A và nút B chạy hai chương trình khác nhau',
          'Phân biệt được "chạy một lần" và "chạy khi có người bấm"',
        ],
        difficulty: 2,
        khoiLenh: ['on button A pressed', 'on button B pressed'],
      },
      {
        order: 6,
        slug: 'mb-b06-bam-ca-hai-nut',
        title: 'Buổi 6 · Bấm cả hai nút cùng lúc',
        summary: 'Tổ hợp A+B, và cách sắp xếp nhiều sự kiện trong một chương trình',
        objectives: [
          'Dùng tổ hợp `A+B` làm một lệnh thứ ba',
          'Hiểu vì sao mỗi khối sự kiện chạy độc lập với nhau',
        ],
        difficulty: 2,
        khoiLenh: ['on button A+B pressed'],
      },
      {
        order: 7,
        slug: 'mb-b07-lac-va-nghieng',
        title: 'Buổi 7 · Lắc và nghiêng board',
        summary: 'Cảm biến gia tốc: board biết khi nào em lắc nó',
        objectives: [
          'Dùng khối `on shake` để phản ứng khi board bị lắc',
          'Phân biệt các cử chỉ: lắc, úp, ngửa, nghiêng trái, nghiêng phải',
        ],
        difficulty: 3,
        khoiLenh: ['on shake', 'on gesture'],
      },
      {
        order: 8,
        slug: 'mb-b08-anh-sang-va-nhiet-do',
        title: 'Buổi 8 · Cảm biến ánh sáng và nhiệt độ',
        summary: 'Board đọc được độ sáng của phòng và nhiệt độ xung quanh',
        objectives: [
          'Đọc giá trị từ `light level` và `temperature`',
          'Hiện giá trị cảm biến ra màn hình LED',
        ],
        difficulty: 3,
        khoiLenh: ['light level', 'temperature'],
      },
      {
        order: 9,
        slug: 'mb-b09-du-an-den-ngu',
        title: 'Buổi 9 · Dự án nhỏ — đèn báo trời tối',
        summary: 'Ghép cảm biến ánh sáng với màn hình LED thành một sản phẩm dùng được',
        objectives: [
          'Kết hợp cảm biến với `show icon` thành một thiết bị hoàn chỉnh',
          'Trình bày sản phẩm và giải thích cách nó hoạt động',
        ],
        difficulty: 3,
        khoiLenh: ['light level', 'show icon', 'forever'],
      },
    ],
  },
  {
    module: {
      slug: 'bien-va-phep-tinh',
      title: 'Module 3 · Biến và phép tính',
      description: 'Board bắt đầu nhớ được: đếm số lần bấm, cộng trừ, và tạo số ngẫu nhiên.',
    },
    buoi: [
      {
        order: 10,
        slug: 'mb-b10-bien-dau-tien',
        title: 'Buổi 10 · Biến đầu tiên',
        summary: 'Cho board nhớ một con số giữa các lần chạy',
        objectives: ['Tạo được một biến và đặt tên cho nó', 'Gán giá trị và hiện giá trị ra màn hình'],
        difficulty: 3,
        khoiLenh: ['set variable to', 'show number'],
      },
      {
        order: 11,
        slug: 'mb-b11-may-dem',
        title: 'Buổi 11 · Máy đếm bằng nút bấm',
        summary: 'Mỗi lần bấm nút A, con số tăng thêm một',
        objectives: ['Dùng `change variable by` để cộng dồn', 'Làm được một máy đếm hoàn chỉnh'],
        difficulty: 3,
        khoiLenh: ['change variable by', 'on button pressed'],
      },
      {
        order: 12,
        slug: 'mb-b12-phep-tinh',
        title: 'Buổi 12 · Cộng, trừ, nhân, chia trên board',
        summary: 'Bốn phép tính cơ bản, và cách hiện kết quả ra 25 đèn LED',
        objectives: ['Dùng các khối toán học của MakeCode', 'Tính và hiện kết quả một phép tính'],
        difficulty: 3,
        khoiLenh: ['+', '-', '×', '÷'],
      },
      {
        order: 13,
        slug: 'mb-b13-so-ngau-nhien',
        title: 'Buổi 13 · Số ngẫu nhiên và con xúc xắc',
        summary: 'Khối `pick random` và dự án xúc xắc điện tử',
        objectives: ['Dùng `pick random` để sinh số ngẫu nhiên', 'Làm một con xúc xắc lắc là ra số'],
        difficulty: 3,
        khoiLenh: ['pick random', 'on shake', 'show number'],
      },
      {
        order: 14,
        slug: 'mb-b14-du-an-may-dem-buoc',
        title: 'Buổi 14 · Dự án — máy đếm bước chân',
        summary: 'Ghép cảm biến lắc với biến đếm thành một thiết bị đeo được',
        objectives: ['Kết hợp cảm biến, biến và màn hình', 'Kiểm thử sản phẩm bằng cách đi thật'],
        difficulty: 4,
        khoiLenh: ['on shake', 'change variable by', 'show number'],
      },
    ],
  },
  {
    module: {
      slug: 'logic-va-dieu-kien',
      title: 'Module 4 · Điều kiện và vòng lặp',
      description: 'Board bắt đầu tự quyết định: nếu… thì…, và lặp lại đúng số lần cần thiết.',
    },
    buoi: [
      {
        order: 15,
        slug: 'mb-b15-neu-thi',
        title: 'Buổi 15 · Khối `if` — nếu… thì…',
        summary: 'Board làm việc này hay việc kia tuỳ vào điều kiện',
        objectives: ['Dùng khối `if` với một điều kiện đơn giản', 'Đọc hiểu một chương trình có rẽ nhánh'],
        difficulty: 4,
        khoiLenh: ['if … then'],
      },
      {
        order: 16,
        slug: 'mb-b16-neu-khong-thi',
        title: 'Buổi 16 · `if … else` — hai lối rẽ',
        summary: 'Khi điều kiện không đúng thì làm gì?',
        objectives: ['Dùng `if … else` cho hai trường hợp', 'Tránh lỗi lồng điều kiện quá sâu'],
        difficulty: 4,
        khoiLenh: ['if … then … else'],
      },
      {
        order: 17,
        slug: 'mb-b17-so-sanh',
        title: 'Buổi 17 · So sánh và điều kiện ghép',
        summary: 'Lớn hơn, nhỏ hơn, bằng — và cách ghép hai điều kiện bằng `and` / `or`',
        objectives: ['Dùng các phép so sánh trong điều kiện', 'Ghép hai điều kiện bằng `and` và `or`'],
        difficulty: 4,
        khoiLenh: ['<', '>', '=', 'and', 'or'],
      },
      {
        order: 18,
        slug: 'mb-b18-vong-lap-repeat',
        title: 'Buổi 18 · Vòng lặp `repeat`',
        summary: 'Lặp lại đúng số lần em muốn, thay vì lặp mãi như `forever`',
        objectives: ['Dùng `repeat n times`', 'Phân biệt `repeat` với `forever`'],
        difficulty: 4,
        khoiLenh: ['repeat n times'],
      },
      {
        order: 19,
        slug: 'mb-b19-vong-lap-while',
        title: 'Buổi 19 · Vòng lặp `while` — lặp trong khi còn đúng',
        summary: 'Vòng lặp dừng lại khi điều kiện không còn đúng nữa',
        objectives: ['Dùng `while` với một điều kiện', 'Nhận ra và tránh vòng lặp không bao giờ dừng'],
        difficulty: 5,
        khoiLenh: ['while'],
      },
      {
        order: 20,
        slug: 'mb-b20-du-an-tro-choi-doan-so',
        title: 'Buổi 20 · Dự án — trò chơi đoán số',
        summary: 'Ghép số ngẫu nhiên, nút bấm, điều kiện và vòng lặp thành một trò chơi',
        objectives: ['Thiết kế luật chơi trước khi kéo khối', 'Hoàn thành một trò chơi chơi được từ đầu đến cuối'],
        difficulty: 5,
        khoiLenh: ['pick random', 'if … then … else', 'while'],
      },
    ],
  },
  {
    module: {
      slug: 'am-thanh-va-ve-hinh',
      title: 'Module 5 · Âm thanh và vẽ hình',
      description: 'Board phát ra tiếng, và em tự vẽ từng bóng đèn thay vì dùng biểu tượng có sẵn.',
    },
    buoi: [
      {
        order: 21,
        slug: 'mb-b21-am-thanh',
        title: 'Buổi 21 · Nốt nhạc và tiếng bíp',
        summary: 'Nhóm khối Music: phát nốt, phát giai điệu có sẵn',
        objectives: ['Dùng `play tone` để phát một nốt', 'Ghép vài nốt thành một giai điệu ngắn'],
        difficulty: 3,
        khoiLenh: ['play tone', 'start melody'],
      },
      {
        order: 22,
        slug: 'mb-b22-tu-ve-led',
        title: 'Buổi 22 · Tự vẽ trên lưới 5×5',
        summary: 'Bật tắt từng bóng đèn một bằng `plot` và `unplot`',
        objectives: ['Dùng toạ độ (x, y) để bật một bóng đèn', 'Vẽ được một hình đơn giản của riêng em'],
        difficulty: 4,
        khoiLenh: ['plot', 'unplot', 'toggle'],
      },
      {
        order: 23,
        slug: 'mb-b23-hoat-hinh',
        title: 'Buổi 23 · Làm hoạt hình bằng nhiều khung hình',
        summary: 'Ghép `show leds` liên tiếp thành chuyển động',
        objectives: ['Dùng `show leds` để vẽ cả khung hình một lúc', 'Ghép nhiều khung thành hoạt hình'],
        difficulty: 4,
        khoiLenh: ['show leds', 'pause'],
      },
      {
        order: 24,
        slug: 'mb-b24-du-an-nhac-cu',
        title: 'Buổi 24 · Dự án — nhạc cụ mini',
        summary: 'Nút bấm và cảm biến nghiêng điều khiển cao độ',
        objectives: ['Kết hợp âm thanh với nhập liệu', 'Biểu diễn sản phẩm trước lớp'],
        difficulty: 4,
        khoiLenh: ['play tone', 'on button pressed', 'acceleration'],
      },
    ],
  },
  {
    module: {
      slug: 'song-radio',
      title: 'Module 6 · Sóng radio — hai board nói chuyện',
      description: 'Hai chiếc Micro:bit gửi tin cho nhau qua sóng, không cần dây.',
    },
    buoi: [
      {
        order: 25,
        slug: 'mb-b25-radio-dau-tien',
        title: 'Buổi 25 · Gửi và nhận số qua sóng radio',
        summary: 'Nhóm radio, gửi số, nhận số',
        objectives: ['Đặt cùng một nhóm radio cho hai board', 'Gửi một con số và nhận được ở board kia'],
        difficulty: 4,
        khoiLenh: ['radio set group', 'radio send number', 'on radio received'],
      },
      {
        order: 26,
        slug: 'mb-b26-radio-gui-chu',
        title: 'Buổi 26 · Gửi chữ và gửi nhiều giá trị',
        summary: 'Gửi chuỗi, gửi cặp tên–giá trị, và tránh nhiễu giữa các nhóm',
        objectives: ['Gửi và nhận chuỗi chữ', 'Hiểu vì sao hai nhóm khác nhau không nghe thấy nhau'],
        difficulty: 4,
        khoiLenh: ['radio send string', 'radio send value'],
      },
      {
        order: 27,
        slug: 'mb-b27-du-an-nhan-tin',
        title: 'Buổi 27 · Dự án — máy nhắn tin trong lớp',
        summary: 'Hai board nhắn tin cho nhau bằng biểu tượng',
        objectives: ['Thiết kế bộ tin nhắn quy ước trước khi lập trình', 'Thử nghiệm với bạn ở bàn khác'],
        difficulty: 5,
        khoiLenh: ['radio send number', 'on radio received', 'show icon'],
      },
    ],
  },
  {
    module: {
      slug: 'du-an-cuoi-khoa',
      title: 'Module 7 · Dự án cuối khoá',
      description: 'Ba buổi để em tự chọn đề tài, tự làm, và trình bày sản phẩm của mình.',
    },
    buoi: [
      {
        order: 28,
        slug: 'mb-b28-chon-de-tai',
        title: 'Buổi 28 · Chọn đề tài và phác thảo',
        summary: 'Chọn một vấn đề có thật và phác ra cách Micro:bit giải quyết nó',
        objectives: ['Mô tả được đề tài bằng ba câu', 'Liệt kê các khối lệnh sẽ cần dùng'],
        difficulty: 4,
        khoiLenh: ['(tuỳ đề tài)'],
      },
      {
        order: 29,
        slug: 'mb-b29-lam-san-pham',
        title: 'Buổi 29 · Làm và thử sản phẩm',
        summary: 'Buổi thực hành dài: dựng chương trình, chạy thử, sửa lỗi',
        objectives: ['Hoàn thành bản chạy được đầu tiên', 'Ghi lại ít nhất một lỗi đã tự sửa'],
        difficulty: 5,
        khoiLenh: ['(tuỳ đề tài)'],
      },
      {
        order: 30,
        slug: 'mb-b30-trinh-bay',
        title: 'Buổi 30 · Trình bày sản phẩm',
        summary: 'Mỗi em cầm board lên giới thiệu sản phẩm và trả lời câu hỏi của lớp',
        objectives: [
          'Giới thiệu sản phẩm trong 3 phút',
          'Giải thích được vì sao mình chọn các khối lệnh đó',
          'Nhận xét sản phẩm của một bạn khác một cách tử tế và cụ thể',
        ],
        difficulty: 4,
        khoiLenh: ['(tuỳ đề tài)'],
      },
    ],
  },
];

/** Modules 2–7 as lesson rows, ready to append after Module 1. */
export const microbitModuleSapMo: ModuleSpec[] = KE_HOACH.map(({ module, buoi }) => ({
  ...module,
  lessons: buoi.map(buoiSapMo),
}));
