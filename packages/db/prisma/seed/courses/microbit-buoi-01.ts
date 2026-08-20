/**
 * Micro:bit — Buổi 1, authored in full.
 *
 * ── Why this one lesson lives in its own file ────────────────────────────────
 * It is the reference implementation for every lesson that follows: the shape a
 * fully-authored DYE session takes once the curriculum team fills in a shell.
 * It carries every block type the platform supports —
 *
 *     THEORY → INTERACTIVE_EXAMPLE → PLAYGROUND
 *       → MULTIPLE_CHOICE (10)  → FILL_IN_BLANK (10)
 *       → MICROBIT_WORKSPACE ×10, easiest to hardest
 *       → REFLECTION
 *
 * — so a teacher opening it sees what "finished" means, and a later author has
 * something to copy rather than a blank page.
 *
 * ── Writing for 11- and 12-year-olds ─────────────────────────────────────────
 * Three rules the prose here follows, and the reason for each:
 *
 *   1. Every abstract idea gets a physical anchor first. "A computer the size
 *      of half a bank card" lands; "an embedded microcontroller" does not.
 *   2. The most common mistake is named BEFORE the student makes it, not after.
 *      Vietnamese names with dấu will not render on a 5×5 LED grid, and a child
 *      who discovers that alone concludes the board is broken.
 *   3. Nothing is framed as a test. Wrong answers say "thử lại nhé" and the
 *      explanation appears either way, because the explanation is the point.
 *
 * ── Image URLs ───────────────────────────────────────────────────────────────
 * The illustrations are referenced as `/hinh-anh/microbit/...` — app-relative
 * paths under the web app's public directory, deliberately NOT hotlinks to
 * microbit.org. A lesson that renders differently depending on whether a school
 * firewall allows a third-party CDN is a lesson that fails in the room it was
 * written for. Dropping the files in at those paths is all that is left to do.
 */
import {
  dienKhuyet,
  example,
  fillBlankBlock,
  mcq,
  mcqBlock,
  microbitTask,
  playground,
  reflection,
  theory,
} from '../builders.ts';

import type { LessonSpec, ProblemSpec } from '../types.ts';

const HINH = '/hinh-anh/microbit';

/**
 * One rung of the coding ladder.
 *
 * Every Micro:bit task is `judgeMode: MAKECODE` (set by `microbitTask`), because
 * the output of these programs is light on a physical LED matrix and no
 * container can observe it. A teacher reads the block logic. The reference
 * solution is therefore not a grading key — it is what the teacher compares
 * against, which is why every single one is written out even for the tasks that
 * have several right answers.
 */
function bacThang(
  n: number,
  problem: Omit<ProblemSpec, 'slug'> & { slug: string },
  opts: { goal: string; khoiLenh: string[]; markdown: string; minutes?: number; isOptional?: boolean },
) {
  return microbitTask(problem, {
    title: `Bài ${n}. ${problem.title}`,
    goal: opts.goal,
    khoiLenh: opts.khoiLenh,
    markdown: opts.markdown,
    minutes: opts.minutes ?? 15,
    isOptional: opts.isOptional ?? false,
  });
}

export const microbitBuoi01: LessonSpec = {
  order: 1,
  slug: 'mb-b01-lam-quen-microbit',
  title: 'Buổi 1 · Làm quen Micro:bit và MakeCode',
  summary:
    'Em nhìn thấy board mạch, hiểu 25 đèn LED làm được gì, và chạy chương trình đầu tiên của mình.',
  objectives: [
    'Chỉ được các bộ phận chính trên board Micro:bit',
    'Giải thích được màn hình LED 5×5 hiện chữ bằng cách chạy ngang',
    'Mở được MakeCode và nhận ra ba khu vực của màn hình',
    'Dùng `show string` để hiện tên mình ra màn hình LED',
    'Tải tệp `.hex` về và nạp vào board mạch',
  ],
  difficulty: 1,
  estimatedMinutes: 90,
  status: 'REQUIRED',
  teacherNotes: [
    'Buổi này KHÔNG dạy cú pháp. Học sinh chỉ kéo thả.',
    'Nếu lớp chưa có đủ board, cho học sinh dùng trình mô phỏng trong MakeCode —',
    'mô phỏng chạy đúng như board thật cho các lệnh của Module 1.',
    'Dành ít nhất 15 phút cuối cho thao tác nạp .hex: đây là bước học sinh hay vướng nhất,',
    'và cảm giác thấy board sáng lên là thứ giữ các em ở lại với môn học.',
    'Mười bài kéo thả ở cuối xếp từ dễ đến khó — KHÔNG yêu cầu cả lớp làm hết.',
    'Bài 1–4 là phần mọi em nên làm được; từ bài 8 trở đi để dành cho em nào đi nhanh.',
  ].join(' '),
  prerequisites: [],
  blocks: [
    // ═══════════════════════════════════════════════════════════════════════
    // Lý thuyết
    // ═══════════════════════════════════════════════════════════════════════
    theory(
      'Micro:bit là gì?',
      [
        `![Board Micro:bit nhìn từ mặt trước, thấy rõ lưới 25 đèn LED và hai nút A, B](${HINH}/board-mat-truoc.png)`,
        '',
        'Micro:bit là một **máy tính nhỏ bằng nửa tấm thẻ ATM**. Nó không có màn hình như',
        'điện thoại, mà có **25 bóng đèn LED** xếp thành lưới 5 hàng × 5 cột.',
        '',
        'Nghe "máy tính" thì em hay nghĩ tới cái màn hình và bàn phím. Nhưng máy tính thật ra',
        'chỉ cần ba thứ: **nhận thông tin vào**, **xử lý**, rồi **đưa kết quả ra**.',
        'Micro:bit có đủ cả ba:',
        '',
        '| Bộ phận | Nằm ở đâu | Làm gì |',
        '|---|---|---|',
        '| Lưới 25 đèn LED | Chính giữa mặt trước | Đưa kết quả ra cho em nhìn |',
        '| Nút A và nút B | Hai bên màn hình LED | Nhận thao tác bấm của em |',
        '| Cảm biến | Nằm chìm trong board | Biết board đang nghiêng, bị lắc, sáng hay tối |',
        '| Cổng USB | Cạnh trên | Nối với máy tính để nạp chương trình |',
        '| Chân cắm pin | Cạnh trên, bên cạnh USB | Cho board chạy khi đã rút dây |',
        '',
        'Em viết chương trình trên máy tính, rồi **chuyển nó sang board** qua dây USB.',
        'Từ lúc đó board chạy chương trình của em — **kể cả khi đã rút dây ra và lắp pin**.',
        'Đó là điểm khác biệt lớn nhất so với những thứ em từng lập trình trên màn hình:',
        'chương trình của em rời khỏi máy tính và đi vào một vật thật.',
      ],
      [
        'Micro:bit có 25 đèn LED xếp thành lưới 5×5',
        'Chương trình viết trên máy tính, sau đó nạp sang board qua cổng USB',
        'Nạp xong, board chạy độc lập — lắp pin vào là đi đâu cũng được',
      ],
      { minutes: 12 },
    ),

    theory(
      'Vì sao chữ lại chạy ngang?',
      [
        `![Ba khung hình liên tiếp cho thấy chữ A, N, H lần lượt hiện lên trên lưới LED](${HINH}/chu-chay-ngang.png)`,
        '',
        'Màn hình LED chỉ rộng **5 cột**. Một chữ cái đã chiếm gần hết chiều ngang rồi,',
        'nên không thể hiện cả từ cùng một lúc được.',
        '',
        'Cách Micro:bit giải quyết: **hiện từng chữ cái một, rất nhanh, lần lượt từ trái sang phải**.',
        'Mắt em ghép các khung hình đó lại và thấy chữ đang "chạy".',
        '',
        'Đây cũng chính là cách hoạt hình và phim hoạt động — nhiều hình đứng yên,',
        'thay nhau đủ nhanh, thành ra chuyển động.',
        '',
        '> 🔔 **Nhớ trước để khỏi bực:** màn hình 5×5 **không hiện được chữ có dấu tiếng Việt**.',
        '> Mỗi ô chỉ là một bóng đèn sáng hoặc tắt, không đủ chỗ để vẽ dấu sắc hay dấu ngã.',
        '> Em viết tên **không dấu** nhé: "Dũng" → `Dung`, "Hồng" → `Hong`.',
        '',
        'Câu càng dài thì chạy càng lâu. Một câu 20 chữ cái mất khoảng 8 giây mới hết —',
        'người xem thường bỏ đi trước khi đọc xong. Nên để dưới **10 chữ cái**.',
      ],
      [
        'Màn hình chỉ 5 cột, nên chữ phải chạy ngang từng chữ cái một',
        'Không hiện được dấu tiếng Việt — viết không dấu',
        'Câu ngắn dưới 10 chữ cái thì người xem mới đọc hết',
      ],
      { minutes: 12 },
    ),

    theory(
      'MakeCode — nơi em kéo thả khối lệnh',
      [
        `![Màn hình MakeCode chia làm ba phần: trình mô phỏng bên trái, hộp khối lệnh ở giữa, vùng làm việc bên phải](${HINH}/makecode-ba-phan.png)`,
        '',
        'MakeCode là công cụ lập trình Micro:bit của Microsoft. Điểm hay nhất của nó:',
        'em **không gõ chữ**, mà **kéo các khối lệnh** ghép lại với nhau như xếp Lego.',
        '',
        'Màn hình MakeCode có ba phần:',
        '',
        '| Phần | Nằm ở đâu | Dùng để làm gì |',
        '|---|---|---|',
        '| Trình mô phỏng | Bên trái | Xem thử chương trình chạy ra sao mà chưa cần board |',
        '| Hộp khối lệnh | Ở giữa | Nơi lấy các khối: Basic, Input, Music… |',
        '| Vùng làm việc | Bên phải | Nơi em ghép các khối thành chương trình |',
        '',
        '**Trình mô phỏng là một cái Micro:bit vẽ trên màn hình.** Nó chạy y hệt board thật',
        'cho những lệnh em học ở Module 1. Nghĩa là em học được cả buổi mà chưa cần cầm board —',
        'nhưng lúc cầm board thật thì vẫn thích hơn nhiều.',
        '',
        'Khối lệnh **không ghép sai được**. Nếu hai khối không khớp nhau, MakeCode sẽ',
        'không cho dính vào nhau — giống mảnh ghép Lego không đúng chỗ thì không bấm xuống được.',
        'Nên em cứ thử thoải mái: **không có cách nào làm hỏng board bằng cách kéo nhầm khối**.',
      ],
      [
        'Kéo thả khối lệnh, không cần gõ cú pháp',
        'Trình mô phỏng chạy y hệt board thật, dùng được khi chưa có board',
        'Khối không khớp thì không dính — thử sai không hỏng gì cả',
      ],
      { minutes: 12 },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // Ví dụ tương tác
    // ═══════════════════════════════════════════════════════════════════════
    example(
      'Khối `show string` — hiện chữ ra màn hình LED',
      [
        `![Khối show string màu xanh dương, bên trong có ô chữ ghi Hello!](${HINH}/khoi-show-string.png)`,
        '',
        'Khối `show string` cho phép hiện một dòng chữ. Vì màn hình chỉ có 5 cột,',
        'chữ sẽ **chạy ngang từ phải sang trái** cho hết câu.',
        '',
        'Kéo khối `show string` từ nhóm **Basic** (màu xanh dương), rồi bấm vào chữ',
        '`Hello!` bên trong khối để sửa thành tên của em.',
        '',
        'Ô chữ dưới đây là **cách MakeCode ghi lại** khối em vừa kéo. Em không cần gõ nó —',
        'nhưng nhìn quen dần cũng có ích, vì đây chính là JavaScript mà MakeCode sinh ra.',
      ],
      ['basic.showString("An")'].join('\n'),
      {
        output: 'Màn hình LED sáng lần lượt từng chữ cái: A → n',
        notes: [
          'Chữ tiếng Việt có dấu KHÔNG hiện được — em viết tên không dấu nhé: "Dũng" viết thành "Dung".',
          'Câu càng dài thì chạy càng lâu. Nên để dưới 10 chữ cái.',
          'Dấu nháy kép " " bao quanh chữ là bắt buộc — MakeCode tự thêm khi em sửa trong khối.',
        ],
        minutes: 12,
      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // Sân chơi
    // ═══════════════════════════════════════════════════════════════════════
    playground(
      'Sân chơi: thử trước khi làm bài',
      [
        'Mở MakeCode ở một tab khác và thử ba việc sau. Chưa chấm điểm gì cả — em cứ nghịch.',
        '',
        '1. Kéo một khối `show string` và cho nó hiện tên em',
        '2. Sửa thành một câu dài (khoảng 20 chữ cái) và bấm chạy — đếm xem mất bao lâu',
        '3. Thử gõ một chữ **có dấu** vào xem màn hình hiện ra cái gì',
        '',
        'Việc thứ ba quan trọng nhất: em tự nhìn thấy vì sao phải viết không dấu,',
        'thay vì chỉ đọc thầy cô dặn.',
        '',
        'Khung dưới đây chỉ để em ghi lại thứ mình định làm — bài thật nằm ở phần sau.',
      ].join('\n'),
      [
        '# Em định cho board hiện chữ gì?',
        '# Viết ra đây trước, rồi sang MakeCode kéo khối.',
        '',
        'chu_em_muon_hien = "..."',
      ].join('\n'),
      'Thử được cả ba việc trong MakeCode và tự trả lời được vì sao chữ có dấu không hiện ra.',
      { minutes: 15 },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // 10 câu trắc nghiệm
    // ═══════════════════════════════════════════════════════════════════════
    mcqBlock(
      {
        slug: 'mb-tn-b01-lam-quen-microbit',
        title: 'Trắc nghiệm: Micro:bit và MakeCode',
        description: 'Mười câu kiểm tra lại phần vừa học. Sai câu nào làm lại câu đó ngay được.',
        tier: 'CO_BAN',
        passingScore: 60,
        questions: [
          mcq(
            'Màn hình của Micro:bit có bao nhiêu bóng đèn LED?',
            '25 bóng, xếp thành lưới 5 hàng × 5 cột',
            ['16 bóng, xếp thành lưới 4×4', '30 bóng, xếp thành lưới 5×6', 'Không có bóng nào — Micro:bit dùng màn hình cảm ứng'],
            {
              explanation: '5 hàng nhân 5 cột là 25 bóng. Đó là toàn bộ "màn hình" của board.',
              hint: 'Đếm số hàng rồi nhân với số cột.',
            },
          ),
          mcq(
            'Vì sao chữ trên Micro:bit lại chạy ngang thay vì hiện cả câu một lúc?',
            'Vì màn hình chỉ rộng 5 cột, không đủ chỗ cho cả câu',
            [
              'Vì làm như vậy trông đẹp hơn',
              'Vì Micro:bit chạy chậm nên phải hiện từ từ',
              'Vì pin không đủ để sáng cả câu cùng lúc',
            ],
            {
              explanation:
                'Một chữ cái đã chiếm gần hết 5 cột rồi. Board hiện từng chữ một, rất nhanh, nên mắt em thấy chữ đang chạy.',
            },
          ),
          mcq(
            'Em muốn hiện tên "Dũng" lên màn hình LED. Em nên viết thế nào?',
            'Dung — bỏ hết dấu',
            ['Dũng — cứ viết đúng chính tả', 'DŨNG — viết hoa thì mới hiện được dấu', 'D.ũ.n.g — tách từng chữ cái ra'],
            {
              explanation:
                'Mỗi ô trên màn hình chỉ là một bóng đèn sáng hoặc tắt, không đủ chỗ vẽ dấu ngã. Viết không dấu là cách duy nhất.',
              hint: 'Nghĩ xem một bóng đèn có vẽ được dấu ngã không.',
            },
          ),
          mcq(
            'Khối `show string` nằm trong nhóm khối lệnh nào của MakeCode?',
            'Basic — nhóm màu xanh dương',
            ['Input — nhóm màu xanh lá', 'Music — nhóm màu hồng', 'Radio — nhóm màu đỏ'],
            {
              explanation: 'Cả năm khối nền tảng của Module 1 đều nằm trong nhóm Basic.',
            },
          ),
          mcq(
            'Sau khi nạp chương trình vào board và rút dây USB ra, điều gì xảy ra?',
            'Board vẫn chạy chương trình đó, chỉ cần lắp pin vào',
            [
              'Board xoá chương trình và tắt hẳn',
              'Board chạy được thêm 5 phút rồi quên',
              'Board phải nối lại máy tính mới chạy tiếp được',
            ],
            {
              explanation:
                'Chương trình được ghi hẳn vào bộ nhớ của board. Đó là lý do em mang board đi khoe được mà không cần vác theo máy tính.',
            },
          ),
          mcq(
            'Trình mô phỏng (simulator) trong MakeCode dùng để làm gì?',
            'Xem thử chương trình chạy ra sao khi chưa có board thật trong tay',
            [
              'Tải chương trình lên mạng cho bạn bè xem',
              'Sửa lỗi chính tả trong chữ em viết',
              'Sạc pin cho board qua cổng USB',
            ],
            {
              explanation:
                'Trình mô phỏng là một cái Micro:bit vẽ trên màn hình, chạy y hệt board thật cho các lệnh của Module 1.',
            },
          ),
          mcq(
            'Em kéo hai khối lệnh lại gần nhau nhưng chúng không dính vào nhau. Chuyện gì đã xảy ra?',
            'Hai khối đó không ghép được với nhau — MakeCode không cho ghép sai',
            [
              'Em đã làm hỏng MakeCode, phải tải lại trang',
              'Board bị lỗi, phải rút dây USB ra cắm lại',
              'Máy tính hết bộ nhớ',
            ],
            {
              explanation:
                'Khối lệnh giống mảnh Lego: không đúng chỗ thì không bấm xuống được. Đây là tính năng bảo vệ em, không phải lỗi.',
              hint: 'Nghĩ tới mảnh ghép Lego không đúng chỗ.',
            },
          ),
          mcq(
            'Tệp em tải từ MakeCode về để nạp vào board có đuôi là gì?',
            '.hex',
            ['.mp3', '.docx', '.png'],
            {
              explanation:
                'Tệp `.hex` chứa chương trình của em ở dạng board hiểu được. Em thả tệp này vào ổ đĩa MICROBIT là board tự nạp.',
            },
          ),
          mcq(
            'Bộ phận nào trên board giúp Micro:bit **nhận** thao tác từ em?',
            'Nút A và nút B',
            ['Lưới 25 đèn LED', 'Chân cắm pin', 'Cổng USB'],
            {
              explanation:
                'Đèn LED là phần đưa kết quả RA. Nút A và B là phần nhận thông tin VÀO. Một máy tính cần cả hai.',
            },
          ),
          mcq(
            'Câu nào dưới đây sẽ chạy hết nhanh nhất trên màn hình LED?',
            '"OK"',
            ['"XIN CHAO CAC BAN"', '"CHUC MOT NGAY VUI VE"', '"HOM NAY TROI DEP QUA"'],
            {
              explanation:
                'Chữ chạy từng chữ cái một, nên câu càng ít chữ cái càng nhanh hết. "OK" chỉ có 2 chữ cái.',
              hint: 'Đếm số chữ cái của từng câu.',
            },
          ),
        ],
      },
      {
        title: 'Trắc nghiệm: em nhớ được bao nhiêu?',
        markdown: [
          'Mười câu về những gì em vừa đọc. Chọn đáp án em cho là đúng.',
          '',
          'Sai cũng **không sao cả** — em sẽ thấy ngay lời giải thích, rồi làm lại câu đó.',
          'Phần này không tính vào điểm tổng kết; nó ở đây để em tự kiểm tra mình.',
        ].join('\n'),
        minutes: 15,
      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // 10 câu điền khuyết
    // ═══════════════════════════════════════════════════════════════════════
    fillBlankBlock(
      {
        slug: 'mb-dk-b01-lam-quen-microbit',
        title: 'Điền khuyết: từ khoá của buổi 1',
        description: 'Mười chỗ trống. Gõ không dấu cũng được, hoa thường đều tính là đúng.',
        tier: 'CO_BAN',
        passingScore: 60,
        questions: [
          dienKhuyet(
            'Điền số còn thiếu.',
            'Màn hình Micro:bit có ___ bóng đèn LED.',
            ['25', 'hai mươi lăm', 'hai muoi lam'],
            { explanation: '5 hàng × 5 cột = 25 bóng.' },
          ),
          dienKhuyet(
            'Điền tên khối lệnh.',
            'Muốn hiện một dòng chữ ra màn hình LED, em dùng khối `___`.',
            ['show string', 'showString', 'basic.showString'],
            { explanation: 'Khối `show string` nằm trong nhóm Basic.', hint: 'Hai từ tiếng Anh: "hiện" và "chuỗi chữ".' },
          ),
          dienKhuyet(
            'Điền tên nhóm khối lệnh.',
            'Năm khối nền tảng của Module 1 đều nằm trong nhóm ___ , nhóm màu xanh dương.',
            ['Basic', 'basic', 'nhóm Basic'],
            { explanation: 'Basic là nhóm đầu tiên trong hộp khối lệnh của MakeCode.' },
          ),
          dienKhuyet(
            'Điền đuôi tệp.',
            'Tệp em tải từ MakeCode về để nạp vào board có đuôi là `.___`',
            ['hex', '.hex'],
            { explanation: 'Tệp `.hex` là chương trình ở dạng board đọc được.' },
          ),
          dienKhuyet(
            'Điền tên cổng kết nối.',
            'Em nối board với máy tính bằng dây cắm vào cổng ___ .',
            ['USB', 'usb', 'cổng USB'],
            { explanation: 'Cổng USB nằm ở cạnh trên của board, ngay bên cạnh chân cắm pin.' },
          ),
          dienKhuyet(
            'Điền hai chữ cái.',
            'Hai nút bấm ở hai bên màn hình LED tên là nút ___ và nút B.',
            ['A', 'a'],
            { explanation: 'Nút A bên trái, nút B bên phải. Đây là cách em ra lệnh cho board.' },
          ),
          dienKhuyet(
            'Điền số cột.',
            'Chữ phải chạy ngang vì màn hình chỉ rộng ___ cột, không đủ chỗ cho cả câu.',
            ['5', 'năm', 'nam'],
            { explanation: 'Một chữ cái đã chiếm gần hết 5 cột rồi.' },
          ),
          dienKhuyet(
            'Điền một từ.',
            'Chữ tiếng Việt có ___ thì màn hình LED không hiện được, nên em phải viết không dấu.',
            ['dấu', 'dau'],
            {
              explanation: 'Mỗi ô chỉ là một bóng đèn sáng hoặc tắt, không đủ chỗ vẽ dấu sắc, huyền, hỏi, ngã, nặng.',
            },
          ),
          dienKhuyet(
            'Điền tên công cụ.',
            'Khi chưa có board thật, em xem thử chương trình bằng trình ___ trong MakeCode.',
            ['mô phỏng', 'mo phong', 'simulator', 'trình mô phỏng'],
            { explanation: 'Trình mô phỏng chạy y hệt board thật cho các lệnh của Module 1.' },
          ),
          dienKhuyet(
            'Điền tên viết không dấu.',
            'Bạn Hồng muốn hiện tên mình lên board. Bạn ấy phải viết là `___`.',
            ['Hong', 'HONG', 'hong'],
            {
              explanation: 'Bỏ dấu huyền đi là được. Chữ hoa hay thường đều hiện tốt.',
              hint: 'Chỉ cần bỏ dấu, không cần đổi chữ cái nào.',
            },
          ),
        ],
      },
      {
        title: 'Điền khuyết: nhớ lại từ khoá',
        markdown: [
          'Điền từ còn thiếu vào chỗ trống.',
          '',
          'Em **gõ không dấu cũng được** và **không phân biệt chữ hoa chữ thường** —',
          'máy ở trường nhiều khi không gõ được tiếng Việt, và bài này kiểm tra em hiểu gì,',
          'không kiểm tra bàn phím của em.',
        ].join('\n'),
        minutes: 15,
      },
    ),

    // ═══════════════════════════════════════════════════════════════════════
    // Thang 10 bài kéo thả, dễ → khó
    // ═══════════════════════════════════════════════════════════════════════
    theory(
      'Mười bài thực hành — em làm được tới đâu cũng tốt',
      [
        'Mười bài dưới đây xếp **từ dễ đến khó**.',
        '',
        '- **Bài 1–4** là phần thầy cô mong mọi em làm được trong buổi hôm nay.',
        '- **Bài 5–7** khó hơn một chút, làm được thì rất tốt.',
        '- **Bài 8–10** dành cho em nào xong sớm và còn muốn nghịch tiếp.',
        '',
        'Không làm hết cũng **hoàn toàn bình thường**. Bốn bài đầu làm chắc còn hơn mười bài làm vội.',
      ].join('\n'),
      ['Bài 1–4 là phần chính, bài 8–10 là phần làm thêm', 'Làm chắc quan trọng hơn làm nhiều'],
      { minutes: 3 },
    ),

    bacThang(
      1,
      {
        slug: 'mb-p-b01-hien-ten',
        title: 'Hiện tên của em',
        statement: [
          'Viết chương trình hiện **tên của em** ra màn hình LED.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Dùng khối `show string`',
          '2. Nội dung là tên em, viết **không dấu**',
          '3. Chạy thử trong trình mô phỏng để xem chữ chạy ngang',
          '',
          'Xong rồi, nếu lớp có board, em tải `.hex` về và nạp vào Micro:bit nhé.',
        ].join('\n'),
        hints: [
          'Khối `show string` nằm trong nhóm **Basic** (màu xanh dương).',
          'Bấm vào chữ "Hello!" trong khối để sửa thành tên em.',
          'Tên có dấu sẽ không hiện được — bỏ dấu đi nhé.',
        ],
        solutionCode: 'basic.showString("An")',
        totalPoints: 100,
      },
      {
        goal: 'Màn hình LED chạy ngang tên của em.',
        khoiLenh: ['show string'],
        markdown:
          'Đây là chương trình đầu tiên của em. Cứ thử, sai cũng không sao — kéo khối ra rồi kéo lại là được.',
        minutes: 12,
      },
    ),

    bacThang(
      2,
      {
        slug: 'mb-p-b01-hien-lop',
        title: 'Hiện tên lớp',
        statement: [
          'Đổi chương trình vừa rồi để nó hiện **tên lớp của em** thay vì tên em.',
          '',
          '**Yêu cầu:** dùng `show string`, nội dung là tên lớp viết không dấu, ví dụ `7A1`.',
          '',
          'Bài này chỉ khác bài 1 ở nội dung bên trong khối. Em sẽ thấy: đổi chữ trong khối là',
          'đổi được cả chương trình, không cần kéo lại từ đầu.',
        ].join('\n'),
        hints: [
          'Không cần kéo khối mới — chỉ cần bấm vào ô chữ và sửa.',
          'Số cũng hiện được bình thường: "7A1" chạy tốt.',
        ],
        solutionCode: 'basic.showString("7A1")',
        totalPoints: 100,
      },
      {
        goal: 'Màn hình LED chạy ngang tên lớp.',
        khoiLenh: ['show string'],
        markdown: 'Sửa lại bài 1 thôi. Mục đích là để em thấy nội dung trong khối đổi được bất cứ lúc nào.',
        minutes: 8,
      },
    ),

    bacThang(
      3,
      {
        slug: 'mb-p-b01-loi-chao',
        title: 'Lời chào ngắn gọn',
        statement: [
          'Cho board hiện một **lời chào dưới 10 chữ cái**, viết không dấu.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Dùng `show string`',
          '2. Câu chào **không quá 10 chữ cái** (tính cả dấu cách)',
          '3. Không dùng chữ có dấu',
          '',
          'Ví dụ đạt yêu cầu: `XIN CHAO` (8 chữ cái). Ví dụ **chưa** đạt: `XIN CHAO CAC BAN` (16 chữ cái).',
        ].join('\n'),
        hints: [
          'Đếm cả dấu cách nhé.',
          'Nếu câu dài quá, cắt bớt: "XIN CHAO CAC BAN" rút thành "XIN CHAO".',
          'Thử chạy câu dài rồi câu ngắn để tự thấy khác biệt.',
        ],
        solutionCode: 'basic.showString("XIN CHAO")',
        totalPoints: 100,
      },
      {
        goal: 'Một lời chào không dấu, dưới 10 chữ cái, chạy hết trong khoảng 3 giây.',
        khoiLenh: ['show string'],
        markdown: 'Bài này luyện một thói quen: viết ngắn để người xem đọc kịp.',
        minutes: 10,
      },
    ),

    bacThang(
      4,
      {
        slug: 'mb-p-b01-tuoi-cua-em',
        title: 'Hiện tuổi của em',
        statement: [
          'Cho board hiện **tuổi của em** ra màn hình.',
          '',
          '**Yêu cầu:** dùng `show string` với nội dung là số tuổi, ví dụ `12`.',
          '',
          'Em sẽ nhận ra: `show string` hiện được cả **số**, vì với board thì số cũng chỉ là',
          'những chữ cái đặc biệt mà thôi.',
        ].join('\n'),
        hints: [
          'Gõ số vào trong ô chữ của khối `show string`, y như gõ tên.',
          'Số một chữ số hiện xong rất nhanh — nhìn kỹ kẻo lỡ.',
        ],
        solutionCode: 'basic.showString("12")',
        totalPoints: 100,
      },
      {
        goal: 'Màn hình hiện đúng số tuổi của em.',
        khoiLenh: ['show string'],
        markdown: 'Bài cuối của phần "mọi em nên làm được". Xong bốn bài này là em đã nắm chắc buổi 1.',
        minutes: 10,
      },
    ),

    bacThang(
      5,
      {
        slug: 'mb-p-b01-ten-va-lop',
        title: 'Tên và lớp, nối thành một dòng',
        statement: [
          'Cho board hiện **cả tên và lớp của em trong một dòng chữ**, ví dụ `AN 7A1`.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Chỉ dùng **một** khối `show string`',
          '2. Nội dung gồm cả tên và lớp, cách nhau một dấu cách',
          '3. Vẫn viết không dấu',
          '',
          'Bài này khó hơn ở chỗ em phải tự cân: viết đủ thông tin mà vẫn đủ ngắn để đọc kịp.',
        ].join('\n'),
        hints: [
          'Dấu cách gõ bình thường trong ô chữ, board hiểu được.',
          'Nếu tên em dài, dùng tên gọi ở nhà cho ngắn.',
          'Đếm thử: câu bao nhiêu chữ cái? Trên 12 là bắt đầu lâu đấy.',
        ],
        solutionCode: 'basic.showString("AN 7A1")',
        totalPoints: 100,
      },
      {
        goal: 'Một dòng chữ chứa cả tên và lớp, đủ ngắn để đọc hết một lượt.',
        khoiLenh: ['show string'],
        markdown: 'Từ đây trở đi khó dần lên. Em cứ thử, sai thì sửa.',
        minutes: 12,
      },
    ),

    bacThang(
      6,
      {
        slug: 'mb-p-b01-hai-dong-chu',
        title: 'Hai dòng chữ nối tiếp nhau',
        statement: [
          'Cho board hiện **hai dòng chữ lần lượt**: tên em trước, rồi tên lớp.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Dùng **hai** khối `show string` xếp chồng lên nhau',
          '2. Khối trên hiện tên, khối dưới hiện lớp',
          '',
          'Đây là lần đầu chương trình của em có **nhiều hơn một câu lệnh**. Các khối chạy',
          'lần lượt **từ trên xuống dưới**, đúng thứ tự em xếp.',
        ].join('\n'),
        hints: [
          'Kéo khối `show string` thứ hai và ghép nó ngay bên dưới khối thứ nhất.',
          'Hai khối phải dính vào nhau thành một chồng, không rời nhau ra.',
          'Thứ tự trên–dưới chính là thứ tự chạy.',
        ],
        solutionCode: ['basic.showString("AN")', 'basic.showString("7A1")'].join('\n'),
        totalPoints: 100,
      },
      {
        goal: 'Tên chạy hết rồi mới tới lớp, không lẫn vào nhau.',
        khoiLenh: ['show string'],
        markdown:
          'Ý quan trọng nhất của bài này: **các khối chạy từ trên xuống dưới**. Em sẽ dùng lại điều này suốt cả khoá.',
        minutes: 15,
      },
    ),

    bacThang(
      7,
      {
        slug: 'mb-p-b01-dem-nguoc',
        title: 'Đếm ngược 3 – 2 – 1',
        statement: [
          'Cho board đếm ngược: hiện `3`, rồi `2`, rồi `1`, rồi chữ `GO`.',
          '',
          '**Yêu cầu:** dùng **bốn** khối `show string` xếp chồng, đúng thứ tự 3 → 2 → 1 → GO.',
          '',
          'Chạy thử và để ý: có thể em thấy nó trôi qua hơi nhanh. Buổi sau em sẽ học khối',
          '`pause` để làm chậm lại — hôm nay cứ để nó nhanh cũng được.',
        ].join('\n'),
        hints: [
          'Bốn khối `show string`, xếp chồng lên nhau theo đúng thứ tự.',
          'Kéo khối thứ nhất xong hãy kéo khối thứ hai — dễ hơn là kéo cả bốn rồi mới sắp xếp.',
          'Nếu thứ tự bị sai, em kéo khối lên xuống để đổi chỗ được.',
        ],
        solutionCode: [
          'basic.showString("3")',
          'basic.showString("2")',
          'basic.showString("1")',
          'basic.showString("GO")',
        ].join('\n'),
        totalPoints: 100,
      },
      {
        goal: 'Bốn nội dung hiện đúng thứ tự 3, 2, 1, GO.',
        khoiLenh: ['show string'],
        markdown: 'Bài này luyện việc xếp nhiều khối đúng thứ tự — kỹ năng em cần cho mọi buổi sau.',
        minutes: 15,
      },
    ),

    bacThang(
      8,
      {
        slug: 'mb-p-b01-bang-hieu-truong',
        title: 'Bảng hiệu giới thiệu trường',
        statement: [
          'Làm một bảng hiệu hiện **ba dòng lần lượt**: tên trường, tên lớp, tên em.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Ba khối `show string`, đúng thứ tự trường → lớp → em',
          '2. Mỗi dòng **không quá 12 chữ cái**',
          '3. Tất cả viết không dấu',
          '',
          'Bài này bắt đầu giống một sản phẩm thật: có nội dung, có thứ tự, có giới hạn.',
        ].join('\n'),
        hints: [
          'Viết ra giấy ba dòng trước, đếm chữ cái, rồi mới sang MakeCode.',
          'Tên trường dài quá thì viết tắt: "THCS Da Lat" → "THCS DL".',
          'Ba khối phải dính thành một chồng.',
        ],
        solutionCode: [
          'basic.showString("THCS DL")',
          'basic.showString("7A1")',
          'basic.showString("AN")',
        ].join('\n'),
        totalPoints: 100,
      },
      {
        goal: 'Ba dòng chạy đúng thứ tự, mỗi dòng đủ ngắn để đọc kịp.',
        khoiLenh: ['show string'],
        markdown: 'Phần làm thêm bắt đầu từ đây. Không làm cũng không sao cả.',
        minutes: 18,
        isOptional: true,
      },
    ),

    bacThang(
      9,
      {
        slug: 'mb-p-b01-cau-do',
        title: 'Câu đố cho bạn cùng bàn',
        statement: [
          'Làm một chương trình **đố bạn cùng bàn**: hiện một câu hỏi ngắn, rồi hiện đáp án.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Ít nhất **hai** khối `show string`',
          '2. Khối đầu là câu hỏi (không dấu, ngắn gọn)',
          '3. Khối sau là đáp án',
          '',
          'Ví dụ: `5 X 5 ?` rồi `25`.',
          '',
          'Xong thì đưa board cho bạn bên cạnh xem, và **đừng nói trước đáp án**.',
        ].join('\n'),
        hints: [
          'Câu hỏi càng ngắn thì bạn càng kịp đọc và nghĩ.',
          'Dấu `?` hiện được bình thường.',
          'Nếu đáp án hiện ra quá nhanh sau câu hỏi, đó là chuyện buổi sau sẽ giải quyết bằng `pause`.',
        ],
        solutionCode: ['basic.showString("5 X 5 ?")', 'basic.showString("25")'].join('\n'),
        totalPoints: 100,
      },
      {
        goal: 'Một câu đố hiện ra rồi tới đáp án, bạn cùng bàn hiểu được mà không cần giải thích.',
        khoiLenh: ['show string'],
        markdown:
          'Bài này có người xem thật. Nếu bạn em không hiểu câu đố, đó là góp ý quý nhất em nhận được hôm nay.',
        minutes: 20,
        isOptional: true,
      },
    ),

    bacThang(
      10,
      {
        slug: 'mb-p-b01-cau-chuyen-ngan',
        title: 'Kể một câu chuyện bằng năm dòng chữ',
        statement: [
          'Dùng **năm khối `show string`** để kể một câu chuyện rất ngắn — mỗi khối một cảnh.',
          '',
          '**Yêu cầu:**',
          '',
          '1. Đúng **năm** khối `show string`, xếp chồng theo thứ tự',
          '2. Mỗi dòng **không quá 10 chữ cái**',
          '3. Đọc hết năm dòng phải ra một câu chuyện có đầu có cuối',
          '',
          'Ví dụ: `TROI MUA` → `EM CHAY` → `VE NHA` → `MEO KEU` → `VUI QUA`.',
          '',
          'Đây là bài khó nhất buổi 1, và nó khó **không phải vì khối lệnh** — em vẫn chỉ dùng',
          'đúng một loại khối. Nó khó vì em phải nghĩ ra nội dung vừa ngắn vừa đủ nghĩa.',
          'Lập trình phần lớn là như vậy: công cụ đơn giản, cái khó nằm ở ý tưởng.',
        ].join('\n'),
        hints: [
          'Viết cả năm dòng ra giấy trước. Sửa trên giấy nhanh hơn sửa trong MakeCode nhiều.',
          'Mỗi dòng chỉ nên có một ý — đừng nhồi hai chuyện vào một dòng.',
          'Đọc to năm dòng lên: nghe có thành câu chuyện không?',
          'Nếu một dòng dài quá 10 chữ cái, cắt đôi thành hai cảnh.',
        ],
        solutionCode: [
          'basic.showString("TROI MUA")',
          'basic.showString("EM CHAY")',
          'basic.showString("VE NHA")',
          'basic.showString("MEO KEU")',
          'basic.showString("VUI QUA")',
        ].join('\n'),
        totalPoints: 100,
      },
      {
        goal: 'Năm dòng chữ ngắn, đọc liền mạch thành một câu chuyện có đầu có cuối.',
        khoiLenh: ['show string'],
        markdown:
          'Bài cuối cùng, và là bài để khoe. Ai làm xong thì cho cả lớp xem board của mình nhé.',
        minutes: 25,
        isOptional: true,
      },
    ),

    reflection(
      'Em nghĩ sao?',
      'Lúc thấy tên mình chạy trên board mạch, em cảm thấy thế nào? Em muốn làm gì tiếp theo với 25 đèn LED này?',
    ),
  ],
};
