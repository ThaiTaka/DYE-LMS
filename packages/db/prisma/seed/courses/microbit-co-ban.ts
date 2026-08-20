/**
 * Lập trình Micro:bit Cơ Bản.
 *
 * ── Scope ────────────────────────────────────────────────────────────────────
 * The course runs to 30 sessions, and the sessions are NOT all equal:
 *
 *   Buổi 1       authored in full, in ./microbit-buoi-01.ts — deep theory,
 *                illustrations, 10 trắc nghiệm, 10 điền khuyết and a ten-rung
 *                ladder of kéo-thả tasks. This is the reference shape.
 *   Buổi 2–4     the rest of Module 1, written from the brief: five Basic
 *                blocks and the two named challenges.
 *   Buổi 5–30    PLANNED shells from ./microbit-khung.ts. The topic order is
 *                real; the lesson content has not been written by a teacher yet.
 *
 * That distinction is load-bearing and is stated in the data, not just in this
 * comment. A shell ships `isDerived: true` and `status: 'OPTIONAL'`, so it never
 * enters a student's required denominator and a teacher browsing the curriculum
 * can see at a glance which sessions are real. Fabricating plausible content for
 * Buổi 17 would look identical in the database to an authored session and be
 * indistinguishable until someone had to teach it.
 *
 * ── Why nothing here is auto-judged ──────────────────────────────────────────
 * Every task is `judgeMode: MAKECODE`. The output of this program is light on a
 * physical LED matrix; a Docker container cannot see it. Grading is a teacher
 * reading the block logic, which is why every task still carries a `problem`
 * row — the submission, review and progress pipelines then work unchanged.
 */
import { microbitTask, theory, example, quizBlock, reflection } from '../builders.ts';
import { microbitBuoi01 } from './microbit-buoi-01.ts';
import { microbitModuleSapMo } from './microbit-khung.ts';

import type { CourseSpec } from '../types.ts';

export const microbitCoBan: CourseSpec = {
  slug: 'microbit-co-ban',
  title: 'Lập trình Micro:bit Cơ Bản',
  subtitle: '30 buổi · Từ khối lệnh đầu tiên đến board mạch nhấp nháy trong tay em',
  description: [
    'Khoá học đưa em từ màn hình máy tính ra một board mạch thật cầm được trên tay.',
    '',
    'Em lập trình bằng cách **kéo thả khối lệnh** trong MakeCode — không cần gõ cú pháp,',
    'không lo thiếu dấu hai chấm. Viết xong, em tải tệp `.hex` về và thả vào Micro:bit,',
    'rồi nhìn 25 bóng đèn LED làm đúng điều em vừa nghĩ ra.',
    '',
    'Module 1 dạy năm khối lệnh nền tảng: `forever`, `show string`, `show icon`,',
    '`pause` và `clearScreen`. Chỉ với năm khối này em đã làm được hoạt ảnh chạy mãi.',
    '',
    'Sau đó khoá học đi tiếp qua nút bấm và cảm biến, biến và phép tính, điều kiện và vòng lặp,',
    'âm thanh và vẽ hình, sóng radio để hai board nói chuyện với nhau, rồi kết thúc bằng',
    'một dự án của riêng em.',
  ].join('\n'),
  totalSessions: 30,
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
        microbitBuoi01,

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

    // Buổi 5–30. Planned, not yet authored — see ./microbit-khung.ts for what
    // that means and why the distinction is written into the rows themselves.
    ...microbitModuleSapMo,
  ],
};
