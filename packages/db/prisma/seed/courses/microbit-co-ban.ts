/**
 * Lập trình Micro:bit Cơ Bản.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * The brief specifies Module 1 — Khởi lệnh BASIC — in full: five blocks
 * (`forever`, `show string`, `show icon`, `pause`, `clearScreen`) and two named
 * challenges. That is what this file contains, and `totalSessions` reflects the
 * sessions actually written rather than a placeholder count.
 *
 * Later modules are NOT invented here. The three Python courses are seeded from
 * real lesson plans; a fabricated Module 2 would look identical in the database
 * and be indistinguishable to a teacher browsing the curriculum. When the
 * Micro:bit plan for the remaining modules arrives, it gets added the same way.
 *
 * ── Why nothing here is auto-judged ──────────────────────────────────────────
 * Every task is `judgeMode: MAKECODE`. The output of this program is light on a
 * physical LED matrix; a Docker container cannot see it. Grading is a teacher
 * reading the block logic, which is why every task still carries a `problem`
 * row — the submission, review and progress pipelines then work unchanged.
 */
import { microbitTask, theory, example, quizBlock, reflection } from '../builders.ts';

import type { CourseSpec } from '../types.ts';

export const microbitCoBan: CourseSpec = {
  slug: 'microbit-co-ban',
  title: 'Lập trình Micro:bit Cơ Bản',
  subtitle: '4 buổi · Từ khối lệnh đầu tiên đến board mạch nhấp nháy trong tay em',
  description: [
    'Khoá học đưa em từ màn hình máy tính ra một board mạch thật cầm được trên tay.',
    '',
    'Em lập trình bằng cách **kéo thả khối lệnh** trong MakeCode — không cần gõ cú pháp,',
    'không lo thiếu dấu hai chấm. Viết xong, em tải tệp `.hex` về và thả vào Micro:bit,',
    'rồi nhìn 25 bóng đèn LED làm đúng điều em vừa nghĩ ra.',
    '',
    'Module 1 dạy năm khối lệnh nền tảng: `forever`, `show string`, `show icon`,',
    '`pause` và `clearScreen`. Chỉ với năm khối này em đã làm được hoạt ảnh chạy mãi.',
  ].join('\n'),
  totalSessions: 4,
  order: 4,
  colorToken: 'teal',
  iconEmoji: '🤖',
  modules: [
    {
      slug: 'khoi-lenh-basic',
      title: 'Module 1 · Khởi lệnh BASIC',
      description:
        'Năm khối lệnh nền tảng trong nhóm Basic: forever, show string, show icon, pause, clearScreen.',
      lessons: [
        // ═══════════════════════════════════════════════════════════════════
        {
          order: 1,
          slug: 'mb-b01-lam-quen-microbit',
          title: 'Buổi 1 · Làm quen Micro:bit và MakeCode',
          summary:
            'Em nhìn thấy board mạch, hiểu 25 đèn LED làm được gì, và chạy chương trình đầu tiên.',
          objectives: [
            'Chỉ được các bộ phận chính trên board Micro:bit',
            'Mở được MakeCode và nhận ra khu vực kéo thả khối lệnh',
            'Dùng `show string` để hiện tên mình ra màn hình LED',
            'Tải tệp .hex về và nạp vào board mạch',
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
          ].join(' '),
          blocks: [
            theory(
              'Micro:bit là gì?',
              [
                'Micro:bit là một **máy tính nhỏ bằng nửa tấm thẻ ATM**. Nó không có màn hình như',
                'điện thoại, mà có **25 bóng đèn LED** xếp thành lưới 5×5.',
                '',
                'Trên board còn có:',
                '',
                '- **Nút A và nút B** — hai nút bấm ở hai bên',
                '- **Cổng USB** — để nối với máy tính và nạp chương trình',
                '- **Cảm biến** — biết được board đang nghiêng, đang bị lắc, sáng hay tối',
                '',
                'Em viết chương trình trên máy tính, rồi **chuyển nó sang board** qua dây USB.',
                'Từ lúc đó board chạy chương trình của em, kể cả khi đã rút dây ra và lắp pin.',
              ],
              [
                'Micro:bit có 25 đèn LED xếp thành lưới 5×5',
                'Chương trình viết trên máy tính, sau đó nạp sang board qua USB',
                'Nạp xong, board chạy độc lập — không cần nối máy tính nữa',
              ],
            ),

            theory(
              'MakeCode — nơi em kéo thả khối lệnh',
              [
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
                'Khối lệnh **không ghép sai được**. Nếu hai khối không khớp nhau, MakeCode sẽ',
                'không cho dính vào — nên em cứ thử thoải mái, không sợ hỏng.',
              ],
              [
                'Kéo thả khối lệnh, không cần gõ cú pháp',
                'Trình mô phỏng cho xem trước khi có board thật',
                'Khối không khớp thì không dính — thử sai không sao cả',
              ],
            ),

            example(
              'Khối `show string` — hiện chữ ra màn hình LED',
              [
                'Khối `show string` cho phép hiện một dòng chữ. Vì màn hình chỉ có 5 cột,',
                'chữ sẽ **chạy ngang từ phải sang trái** cho hết câu.',
                '',
                'Kéo khối `show string` từ nhóm **Basic**, rồi sửa chữ `Hello!` thành tên của em.',
              ],
              [
                'basic.showString("An")',
              ].join('\n'),
              {
                output: 'Màn hình LED sáng lần lượt từng chữ cái: A → n',
                notes: [
                  'Chữ tiếng Việt có dấu KHÔNG hiện được — màn hình LED chỉ có 5×5 điểm.',
                  'Em viết tên không dấu nhé: "Dũng" viết thành "Dung".',
                  'Câu càng dài thì chạy càng lâu. Nên để dưới 10 chữ cái.',
                ],
              },
            ),

            microbitTask(
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
              },
            ),

            reflection(
              'Em nghĩ sao?',
              'Lúc thấy tên mình chạy trên board mạch, em cảm thấy thế nào? Em muốn làm gì tiếp theo với 25 đèn LED này?',
            ),
          ],
        },

        // ═══════════════════════════════════════════════════════════════════
        {
          order: 2,
          slug: 'mb-b02-show-icon-va-pause',
          title: 'Buổi 2 · `show icon`, `pause` và `clearScreen`',
          summary:
            'Ba khối lệnh còn lại của nhóm Basic, và thử thách hoạt ảnh mặt cười — mặt khóc.',
          objectives: [
            'Dùng `show icon` để hiện biểu tượng có sẵn',
            'Hiểu `pause` tính bằng mili giây, và đổi được giây sang mili giây',
            'Dùng `clearScreen` để tắt hết đèn LED',
            'Ghép ba khối thành một hoạt ảnh chạy một lần',
          ],
          difficulty: 2,
          estimatedMinutes: 90,
          status: 'REQUIRED',
          prerequisites: ['mb-b01-lam-quen-microbit'],
          teacherNotes: [
            'Điểm dễ nhầm nhất buổi này là ĐƠN VỊ của pause: học sinh hay viết pause(0.5) cho nửa giây.',
            'Cho các em tự thử pause(500) và pause(5) rồi so sánh — thấy bằng mắt sẽ nhớ lâu hơn nghe giảng.',
            'Thử thách 1 chạy MỘT LẦN duy nhất, nên KHÔNG dùng forever ở buổi này.',
            'Nếu học sinh hỏi vì sao hoạt ảnh dừng lại, đó chính là chỗ dẫn sang buổi 3.',
          ].join(' '),
          blocks: [
            theory(
              'Khối `show icon` — hiện biểu tượng có sẵn',
              [
                'MakeCode có sẵn một bộ biểu tượng: mặt cười, mặt khóc, trái tim, mũi tên…',
                'Em không phải bật từng đèn LED một, chỉ cần chọn biểu tượng trong danh sách.',
                '',
                'Kéo khối `show icon` từ nhóm **Basic**, rồi bấm vào ô biểu tượng để chọn hình khác.',
                '',
                'Vài biểu tượng hay dùng:',
                '',
                '| Biểu tượng | Tên trong MakeCode |',
                '|---|---|',
                '| Mặt cười 🙂 | `IconNames.Happy` |',
                '| Mặt khóc 🙁 | `IconNames.Sad` |',
                '| Trái tim ❤️ | `IconNames.Heart` |',
                '| Dấu tích ✓ | `IconNames.Yes` |',
              ],
              [
                '`show icon` hiện biểu tượng có sẵn, không cần vẽ từng đèn',
                'Bấm vào ô biểu tượng trong khối để đổi hình khác',
              ],
            ),

            theory(
              'Khối `pause` — bảo board đứng chờ',
              [
                'Máy tính chạy **rất nhanh**. Nếu em bảo nó hiện mặt cười rồi hiện ngay mặt khóc,',
                'em sẽ chẳng kịp nhìn thấy mặt cười đâu.',
                '',
                'Khối `pause` bảo board **đứng yên chờ** một lúc.',
                '',
                '> ⚠️ **Chỗ này em phải nhớ kỹ:** `pause` tính bằng **mili giây**, không phải giây.',
                '',
                '**1 giây = 1000 mili giây.** Nên:',
                '',
                '| Em muốn chờ | Em viết |',
                '|---|---|',
                '| 1 giây | `pause(1000)` |',
                '| 0,5 giây (nửa giây) | `pause(500)` |',
                '| 2 giây | `pause(2000)` |',
                '| 0,1 giây | `pause(100)` |',
                '',
                'Nếu em viết `pause(5)` thì board chỉ chờ 5 phần nghìn giây — mắt em không thấy được.',
              ],
              [
                '`pause` tính bằng MILI GIÂY, không phải giây',
                '1 giây = 1000 mili giây, nửa giây = 500',
                'Không có pause thì hoạt ảnh chạy quá nhanh để nhìn thấy',
              ],
            ),

            theory(
              'Khối `clearScreen` — tắt hết đèn',
              [
                '`clearScreen` tắt **toàn bộ 25 bóng đèn** trên board, trả màn hình về đen.',
                '',
                'Em dùng nó khi muốn xoá hình cũ trước khi vẽ hình mới, hoặc muốn tạo hiệu ứng',
                'nhấp nháy: hiện hình → chờ → tắt → chờ → hiện lại.',
              ],
              ['`clearScreen` tắt cả 25 đèn LED cùng lúc'],
            ),

            example(
              'Ghép ba khối lại với nhau',
              [
                'Chương trình dưới đây hiện trái tim trong 1 giây, rồi tắt màn hình:',
              ],
              [
                'basic.showIcon(IconNames.Heart)',
                'basic.pause(1000)',
                'basic.clearScreen()',
              ].join('\n'),
              {
                output: 'Trái tim sáng 1 giây → màn hình tối đen',
                notes: [
                  'Các khối chạy LẦN LƯỢT từ trên xuống dưới.',
                  'Thử đổi 1000 thành 200 xem khác thế nào nhé.',
                ],
              },
            ),

            // Challenge 1 — exactly as named in the brief.
            microbitTask(
              {
                slug: 'mb-p-b02-mat-cuoi-mat-khoc-mot-lan',
                title: 'Mặt cười rồi mặt khóc',
                statement: [
                  'Viết chương trình hiển thị **biểu tượng mặt cười trong 0,5 giây**,',
                  'sau đó **chuyển sang mặt khóc**. Chương trình chạy **một lần duy nhất**.',
                  '',
                  '**Yêu cầu:**',
                  '',
                  '1. Hiện mặt cười (`IconNames.Happy`)',
                  '2. Chờ **0,5 giây** — em nhớ đổi sang mili giây nhé',
                  '3. Hiện mặt khóc (`IconNames.Sad`)',
                  '4. **Không** dùng `forever` — bài này chạy một lần thôi',
                  '',
                  'Chạy thử trong trình mô phỏng. Nếu em không kịp thấy mặt cười,',
                  'kiểm tra lại số trong khối `pause`.',
                ].join('\n'),
                hints: [
                  'Nửa giây là bao nhiêu mili giây? Nhớ lại: 1 giây = 1000 mili giây.',
                  'Cả ba khối đều nằm trong nhóm **Basic**.',
                  'Thứ tự các khối rất quan trọng — chúng chạy từ trên xuống dưới.',
                  'Bài này KHÔNG dùng forever. Nếu em kéo forever vào, hoạt ảnh sẽ lặp mãi.',
                ],
                solutionCode: [
                  'basic.showIcon(IconNames.Happy)',
                  'basic.pause(500)',
                  'basic.showIcon(IconNames.Sad)',
                ].join('\n'),
                totalPoints: 100,
              },
              {
                goal: 'Mặt cười hiện 0,5 giây rồi đổi thành mặt khóc, chạy đúng một lần.',
                khoiLenh: ['show icon', 'pause'],
                markdown: 'Thử thách đầu tiên của em với hoạt ảnh. Đọc kỹ yêu cầu về thời gian nhé.',
              },
            ),

            quizBlock({
              slug: 'mb-q-b02-pause',
              title: 'Kiểm tra nhanh: đơn vị của pause',
              passingScore: 60,
              questions: [
                {
                  type: 'MULTIPLE_CHOICE',
                  prompt: 'Em muốn board chờ **nửa giây**. Em viết `pause` với số nào?',
                  explanation:
                    '1 giây = 1000 mili giây, nên nửa giây = 500 mili giây.',
                  choices: [
                    { text: 'pause(500)', isCorrect: true },
                    { text: 'pause(0.5)' },
                    { text: 'pause(50)' },
                    { text: 'pause(5)' },
                  ],
                },
                {
                  type: 'MULTIPLE_CHOICE',
                  prompt: 'Khối nào tắt hết 25 đèn LED trên board?',
                  explanation: '`clearScreen` xoá toàn bộ màn hình LED.',
                  choices: [
                    { text: 'clearScreen', isCorrect: true },
                    { text: 'show icon' },
                    { text: 'pause' },
                    { text: 'show string' },
                  ],
                },
                {
                  type: 'TRUE_FALSE',
                  prompt:
                    'Nếu bỏ khối `pause` giữa hai khối `show icon`, em vẫn nhìn rõ được hình đầu tiên.',
                  explanation:
                    'Sai. Board chạy rất nhanh, hình đầu tiên sẽ bị thay ngay lập tức và mắt em không kịp thấy.',
                  choices: [{ text: 'Đúng' }, { text: 'Sai', isCorrect: true }],
                },
              ],
            }),
          ],
        },

        // ═══════════════════════════════════════════════════════════════════
        {
          order: 3,
          slug: 'mb-b03-forever',
          title: 'Buổi 3 · `forever` — cho chương trình chạy mãi',
          summary:
            'Khối forever biến hoạt ảnh chạy một lần thành hoạt ảnh lặp vô hạn.',
          objectives: [
            'Hiểu `forever` lặp lại liên tục phần khối nằm bên trong',
            'Phân biệt chương trình chạy một lần và chương trình lặp mãi',
            'Nâng cấp hoạt ảnh mặt cười — mặt khóc thành lặp vô hạn',
          ],
          difficulty: 2,
          estimatedMinutes: 90,
          status: 'REQUIRED',
          prerequisites: ['mb-b02-show-icon-va-pause'],
          teacherNotes: [
            'Cho học sinh so sánh trực tiếp bài buổi 2 và bài buổi 3 trên hai board (hoặc hai tab mô phỏng).',
            'Nhìn thấy một cái dừng, một cái chạy mãi là cách hiểu forever nhanh nhất.',
            'Nhấn mạnh: khối nằm NGOÀI forever chỉ chạy một lần lúc khởi động.',
            'Đây là nền cho khái niệm vòng lặp ở khoá Python — nhưng đừng nhắc tới while/for ở buổi này.',
          ].join(' '),
          blocks: [
            theory(
              'Khối `forever` — vòng lặp liên tục',
              [
                'Ở buổi trước, hoạt ảnh của em chạy **một lần rồi dừng**. Muốn nó chạy mãi thì sao?',
                '',
                'Khối `forever` giải quyết đúng việc đó: mọi khối lệnh **đặt bên trong** nó sẽ',
                'được chạy đi chạy lại **liên tục**, không bao giờ dừng — cho tới khi em rút pin.',
                '',
                'Cách dùng: kéo khối `forever` ra vùng làm việc, rồi **kéo các khối khác vào bên trong** nó.',
                '',
                '> Khối nằm **ngoài** `forever` chỉ chạy **một lần** lúc board vừa khởi động.',
                '> Khối nằm **trong** `forever` chạy **mãi mãi**.',
              ],
              [
                '`forever` lặp lại liên tục các khối nằm bên trong nó',
                'Khối bên ngoài forever chỉ chạy một lần lúc khởi động',
                'Vòng lặp chỉ dừng khi board mất điện',
              ],
            ),

            example(
              'Trái tim nhấp nháy mãi',
              [
                'Chương trình này làm trái tim nhấp nháy không ngừng:',
              ],
              [
                'basic.forever(function () {',
                '    basic.showIcon(IconNames.Heart)',
                '    basic.pause(300)',
                '    basic.clearScreen()',
                '    basic.pause(300)',
                '})',
              ].join('\n'),
              {
                output: 'Trái tim sáng 0,3 giây → tắt 0,3 giây → sáng lại… mãi mãi',
                notes: [
                  'Bốn khối bên trong chạy hết rồi quay lại khối đầu tiên.',
                  'Đổi 300 thành 100 sẽ nháy nhanh hơn, thành 1000 sẽ nháy chậm hơn.',
                ],
              },
            ),

            // Challenge 2 — exactly as named in the brief.
            microbitTask(
              {
                slug: 'mb-p-b03-mat-cuoi-mat-khoc-lap-vo-han',
                title: 'Mặt cười — mặt khóc, lặp mãi không dừng',
                statement: [
                  'Nâng cấp chương trình ở buổi trước: cho hiệu ứng **mặt cười — mặt khóc**',
                  '**lặp lại vô hạn**.',
                  '',
                  '**Yêu cầu:**',
                  '',
                  '1. Dùng khối `forever`',
                  '2. Bên trong: hiện mặt cười → chờ 0,5 giây → hiện mặt khóc → chờ 0,5 giây',
                  '3. Hiệu ứng chạy mãi, không dừng lại',
                  '',
                  'Chạy thử trong trình mô phỏng và quan sát: hai khuôn mặt cứ đổi qua đổi lại.',
                  '',
                  '**Câu hỏi để em nghĩ thêm:** vì sao cần thêm một khối `pause` sau mặt khóc,',
                  'trong khi bài buổi trước không cần?',
                ].join('\n'),
                hints: [
                  'Kéo khối `forever` ra trước, rồi kéo các khối cũ vào BÊN TRONG nó.',
                  'Nếu thiếu pause sau mặt khóc, mặt khóc sẽ bị thay bằng mặt cười ngay lập tức.',
                  'Nửa giây vẫn là 500 mili giây nhé.',
                  'Nhìn kỹ: các khối phải nằm lọt hẳn vào trong khung của forever.',
                ],
                solutionCode: [
                  'basic.forever(function () {',
                  '    basic.showIcon(IconNames.Happy)',
                  '    basic.pause(500)',
                  '    basic.showIcon(IconNames.Sad)',
                  '    basic.pause(500)',
                  '})',
                ].join('\n'),
                totalPoints: 100,
              },
              {
                goal: 'Mặt cười và mặt khóc đổi cho nhau liên tục, mỗi hình 0,5 giây.',
                khoiLenh: ['forever', 'show icon', 'pause'],
                markdown:
                  'Cùng một hoạt ảnh như buổi trước, nhưng lần này nó không bao giờ dừng. Chỉ thêm một khối thôi.',
              },
            ),

            reflection(
              'So sánh hai chương trình',
              'Chương trình buổi 2 và buổi 3 khác nhau ở đúng một khối lệnh. Em hãy tả lại bằng lời: khối forever đã làm thay đổi điều gì?',
            ),
          ],
        },

        // ═══════════════════════════════════════════════════════════════════
        {
          order: 4,
          slug: 'mb-b04-tong-hop-bang-hieu',
          title: 'Buổi 4 · Tổng hợp — làm bảng hiệu của riêng em',
          summary:
            'Ghép cả năm khối lệnh của Module 1 thành một bảng hiệu LED hoàn chỉnh.',
          objectives: [
            'Kết hợp cả năm khối `forever`, `show string`, `show icon`, `pause`, `clearScreen`',
            'Tự thiết kế một chuỗi hoạt ảnh có ý đồ riêng',
            'Nạp chương trình lên board và trình bày cho bạn xem',
          ],
          difficulty: 3,
          estimatedMinutes: 90,
          status: 'REQUIRED',
          prerequisites: ['mb-b03-forever'],
          teacherNotes: [
            'Buổi tổng hợp, không có kiến thức mới. Để học sinh tự do sáng tạo trong khuôn khổ năm khối đã học.',
            'Dành 20 phút cuối cho các em cầm board đi khoe nhau — phần trình bày quan trọng ngang phần code.',
            'Chấm theo việc dùng ĐÚNG các khối và hoạt ảnh chạy được, KHÔNG chấm theo độ phức tạp.',
            'Em nào làm nhanh thì gợi ý thêm: xen kẽ chữ và biểu tượng, hoặc đổi nhịp pause để tạo tiết tấu.',
          ].join(' '),
          blocks: [
            theory(
              'Em đã có đủ công cụ rồi',
              [
                'Sau ba buổi, em đã biết cả năm khối lệnh của nhóm Basic:',
                '',
                '| Khối | Làm gì |',
                '|---|---|',
                '| `forever` | Lặp lại liên tục các khối bên trong |',
                '| `show string` | Hiện chữ chạy ngang màn hình |',
                '| `show icon` | Hiện biểu tượng có sẵn |',
                '| `pause` | Chờ một khoảng thời gian, tính bằng mili giây |',
                '| `clearScreen` | Tắt hết 25 đèn LED |',
                '',
                'Nghe thì ít, nhưng ghép lại em làm được rất nhiều thứ: bảng hiệu chạy chữ,',
                'đèn nhấp nháy theo nhịp, hoạt ảnh kể một câu chuyện ngắn.',
              ],
              ['Năm khối lệnh Basic đã đủ để làm một bảng hiệu LED hoàn chỉnh'],
            ),

            example(
              'Một bảng hiệu mẫu để em tham khảo',
              [
                'Đây là bảng hiệu đơn giản: hiện chữ, rồi hiện một biểu tượng, rồi xoá màn hình',
                'và bắt đầu lại từ đầu.',
                '',
                'Em **đừng chép y nguyên** — hãy đọc để hiểu cách ghép, rồi làm bảng hiệu của riêng em.',
              ],
              [
                'basic.forever(function () {',
                '    basic.showString("XIN CHAO")',
                '    basic.pause(300)',
                '    basic.showIcon(IconNames.Happy)',
                '    basic.pause(800)',
                '    basic.clearScreen()',
                '    basic.pause(300)',
                '})',
              ].join('\n'),
              {
                output: 'Chữ "XIN CHAO" chạy ngang → mặt cười 0,8 giây → màn hình tối → lặp lại',
                notes: [
                  'Chú ý mỗi lần hiện hình đều có một pause đi kèm.',
                  'clearScreen trước khi quay lại đầu làm chuyển cảnh gọn hơn.',
                ],
              },
            ),

            microbitTask(
              {
                slug: 'mb-p-b04-bang-hieu-cua-em',
                title: 'Bảng hiệu LED của riêng em',
                statement: [
                  'Làm một **bảng hiệu** chạy mãi trên Micro:bit, dùng những khối em đã học.',
                  '',
                  '**Yêu cầu bắt buộc:**',
                  '',
                  '1. Dùng `forever` để bảng hiệu chạy liên tục',
                  '2. Có ít nhất **một** lần `show string` (chữ của em)',
                  '3. Có ít nhất **hai** biểu tượng khác nhau bằng `show icon`',
                  '4. Dùng `pause` hợp lý để nhìn kịp từng phần',
                  '5. Dùng `clearScreen` ít nhất một lần',
                  '',
                  '**Em tự quyết định:** nội dung chữ, chọn biểu tượng nào, nhịp nhanh hay chậm.',
                  '',
                  'Không có đáp án đúng duy nhất ở bài này. Thầy cô sẽ xem cách em ghép khối',
                  'và nghe em kể về ý tưởng của mình.',
                ].join('\n'),
                hints: [
                  'Bắt đầu bằng việc viết ra giấy: em muốn bảng hiệu hiện những gì, theo thứ tự nào?',
                  'Nhớ đặt pause sau mỗi lần hiện hình, nếu không sẽ không nhìn kịp.',
                  'clearScreen giữa hai phần sẽ làm chuyển cảnh gọn gàng hơn.',
                  'Nếu chữ chạy lâu quá, rút ngắn câu lại.',
                ],
                solutionCode: [
                  'basic.forever(function () {',
                  '    basic.showString("DYE")',
                  '    basic.pause(300)',
                  '    basic.showIcon(IconNames.Happy)',
                  '    basic.pause(600)',
                  '    basic.clearScreen()',
                  '    basic.pause(200)',
                  '    basic.showIcon(IconNames.Heart)',
                  '    basic.pause(600)',
                  '})',
                ].join('\n'),
                totalPoints: 100,
              },
              {
                goal: 'Một bảng hiệu LED chạy liên tục, có chữ và ít nhất hai biểu tượng.',
                khoiLenh: ['forever', 'show string', 'show icon', 'pause', 'clearScreen'],
                markdown:
                  'Bài cuối Module 1. Em được tự do thiết kế — miễn là dùng đủ các khối trong yêu cầu.',
                minutes: 45,
              },
            ),

            reflection(
              'Khoe với bạn nào',
              'Em hãy cầm board cho bạn bên cạnh xem. Bạn có đoán được em định thể hiện điều gì không? Nếu chưa, em sẽ sửa chỗ nào?',
            ),
          ],
        },
      ],
    },
  ],
};
