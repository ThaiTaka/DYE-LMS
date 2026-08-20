/**
 * Python Cơ Bản — Module 1 & 2 (Buổi 1–7).
 *
 * Teacher notes enforced here:
 *   • Note 1 — sessions 1–2 introduce NO heavy syntax and NO print(). Both
 *     sessions stay in the interactive REPL, where an expression echoes its own
 *     value, so students see results without meeting a function call first.
 *   • Note 2 — `complex` is excluded from the numeric types entirely.
 *   • Note 3 — session 6 makes f-strings the centrepiece.
 *
 * Session 6 also carries the ten-rung auto-graded ladder, in
 * ./python-co-ban-b06-thang.ts. It is placed there rather than earlier because
 * an IO_MATCH task is judged on stdout, and stdout requires `print()` — which
 * this course deliberately withholds until session 6, the first session where a
 * program runs from a file rather than in the REPL.
 */
import type { ModuleSpec } from '../types.ts';
import { thangBaiTapB06 } from './python-co-ban-b06-thang.ts';
import {
  challenge,
  dienKhuyet,
  example,
  fillBlankBlock,
  hidden,
  mcq,
  mcqBlock,
  playground,
  quizBlock,
  reflection,
  sample,
  theory,
} from '../builders.ts';

export const module1: ModuleSpec = {
  slug: 'khoi-dong-cung-python',
  title: 'Khởi động cùng Python',
  description:
    'Làm quen với Python và môi trường lập trình, rồi bước đầu lưu trữ dữ liệu bằng biến. ' +
    'Cả bốn buổi đều chạy trong chế độ tương tác để em thấy kết quả ngay lập tức.',
  lessons: [
    {
      order: 1,
      slug: 'b01-tong-quan-va-lam-quen-python',
      title: 'Tổng quan khoá học · Python là gì? · Cài đặt môi trường',
      summary:
        'Buổi đầu tiên trả lời ba câu hỏi: lập trình để làm gì, Python là ngôn ngữ thế nào, ' +
        'và làm sao để chạy được Python trên máy của em.',
      objectives: [
        'Kể được ít nhất ba việc mà lập trình có thể làm trong đời sống',
        'Giải thích được Python là ngôn ngữ thông dịch, dễ đọc, gần với tiếng Anh',
        'Mở được chế độ tương tác (REPL) và gõ một phép tính đầu tiên',
        'Biết khoá học sẽ đi qua những nội dung nào trong 30 buổi',
      ],
      difficulty: 1,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Buổi 1: chỉ giới thiệu tổng quan, Python và môi trường. KHÔNG dạy cú pháp nặng, ' +
        'KHÔNG giới thiệu hàm print() ở buổi này để tránh quá tải cho học sinh.',
      prerequisites: [],
      blocks: [
        theory(
          'Lập trình là gì và tại sao lại là Python?',
          [
            /*
             * App-relative image paths, deliberately not hotlinks.
             *
             * A lesson whose illustrations come from a third-party CDN renders
             * differently depending on whether the school firewall allows that
             * host — and the room this course was written for is exactly the
             * room where it will not. The files drop into apps/web/public at
             * these paths; nothing else has to change.
             */
            '![Sơ đồ: người viết chỉ dẫn ở bên trái, máy tính thực hiện ở bên phải](/hinh-anh/python/lap-trinh-la-gi.png)',
            '',
            'Lập trình là cách em **ra lệnh cho máy tính** bằng một ngôn ngữ mà cả người và máy đều hiểu được.',
            '',
            'Máy tính rất nhanh nhưng không tự nghĩ ra việc. Người lập trình là người nói cho nó biết phải làm gì, theo thứ tự nào.',
            '',
            'Python được chọn cho khoá học này vì ba lý do:',
            '',
            '1. **Dễ đọc** — câu lệnh Python gần với tiếng Anh thường ngày.',
            '2. **Chạy ngay** — em gõ một dòng là thấy kết quả một dòng, không cần bước biên dịch.',
            '3. **Làm được nhiều thứ** — từ tính toán, xử lý dữ liệu, cho tới làm game (khoá Pygame ở sau).',
            '',
            'Trong 30 buổi tới, em sẽ đi từ những phép tính đơn giản đến chỗ tự viết được một chương trình hoàn chỉnh.',
          ].join('\n'),
          [
            'Lập trình = ra lệnh cho máy tính theo đúng thứ tự',
            'Python là ngôn ngữ thông dịch: gõ tới đâu, chạy tới đó',
            'Khoá học đi từ phép tính đơn giản đến chương trình hoàn chỉnh',
          ],
        ),
        theory(
          'Môi trường lập trình: em sẽ gõ code ở đâu?',
          [
            'Có hai cách chạy Python, và hôm nay chúng ta chỉ dùng cách thứ nhất.',
            '',
            '**1. Chế độ tương tác (REPL)** — giống một chiếc máy tính bỏ túi thông minh. ' +
              'Em gõ một biểu thức, nhấn Enter, máy trả lời ngay. Rất hợp để thử nghiệm.',
            '',
            '**2. Chạy từ tệp `.py`** — em viết nhiều dòng vào một tệp rồi chạy cả tệp một lượt. ' +
              'Cách này dùng khi chương trình đã dài. Chúng ta sẽ học ở các buổi sau.',
            '',
            'Trong DYE LMS, khung **Sân chơi Code** ở mỗi bài chính là một REPL chạy ngay trong trình duyệt — ' +
              'em không cần cài gì cả để bắt đầu.',
            '',
            'Nếu em muốn cài trên máy ở nhà, có hai thứ cần tải: bản Python từ `python.org` và một trình soạn thảo như VS Code. ' +
              'Thầy cô sẽ hướng dẫn riêng phần này.',
          ],
          undefined,
          { minutes: 15 },
        ),
        example(
          'Thử máy tính bỏ túi Python',
          [
            'Trong chế độ tương tác, em **không cần lệnh nào để xem kết quả**. Cứ gõ phép tính rồi nhấn Enter, ' +
              'Python tự trả lời.',
            '',
            'Dấu `>>>` là lời mời của Python, nghĩa là "mời bạn gõ". Em không gõ lại dấu này.',
            '',
            '![Cửa sổ dòng lệnh với dấu nhắc >>> và một phép tính đã cho kết quả](/hinh-anh/python/repl-dau-nhac.png)',
          ].join('\n'),
          [
            '>>> 2 + 3',
            '5',
            '>>> 10 - 4',
            '6',
            '>>> 7 * 6',
            '42',
            '>>> 100 / 8',
            '12.5',
          ].join('\n'),
          {
            notes: [
              'Phép chia `/` luôn cho kết quả có phần thập phân — 100 / 8 ra 12.5 chứ không phải 12.',
              'Python trả lời ngay dòng dưới, không cần em ra lệnh gì thêm.',
            ],
          },
        ),
        playground(
          'Sân chơi: hỏi gì Python cũng tính',
          [
            'Đây là REPL thật, chạy ngay trong trình duyệt. Hãy thử:',
            '',
            '- Tính xem một năm có bao nhiêu phút',
            '- Tính tuổi của em tính theo tháng',
            '- Thử một phép chia bất kỳ và xem kết quả có phần thập phân không',
            '',
            'Không có gì hỏng được cả — cứ thử thoải mái.',
          ].join('\n'),
          ['# Gõ một phép tính rồi chạy thử.', '# Ví dụ: số phút trong một ngày', '24 * 60'].join('\n'),
          'Chạy được ít nhất ba phép tính khác nhau và đọc hiểu kết quả.',
        ),
        quizBlock({
          slug: 'q-b01-tong-quan-python',
          title: 'Kiểm tra nhanh: Python và môi trường',
          tier: 'CO_BAN',
          passingScore: 60,
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Dấu `>>>` trong chế độ tương tác có ý nghĩa gì?',
              explanation:
                'Đó là lời mời của Python. Em gõ câu lệnh sau dấu này, không gõ lại chính dấu này.',
              choices: [
                { text: 'Python đang mời em gõ câu lệnh tiếp theo', isCorrect: true },
                { text: 'Chương trình đã bị lỗi' },
                { text: 'Em phải gõ đúng ba dấu lớn hơn trước mỗi câu lệnh' },
                { text: 'Máy tính đang tải dữ liệu' },
              ],
            },
            {
              type: 'TRUE_FALSE',
              prompt: 'Trong chế độ tương tác, gõ `5 * 5` rồi nhấn Enter sẽ thấy ngay kết quả 25.',
              explanation: 'Đúng. REPL tự hiển thị giá trị của biểu thức mà em vừa gõ.',
              choices: [
                { text: 'Đúng', isCorrect: true },
                { text: 'Sai' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Vì sao khoá học chọn Python làm ngôn ngữ đầu tiên?',
              explanation:
                'Python dễ đọc và cho kết quả ngay, nên phù hợp với người mới bắt đầu.',
              choices: [
                { text: 'Vì cú pháp dễ đọc và chạy ra kết quả ngay lập tức', isCorrect: true },
                { text: 'Vì Python là ngôn ngữ duy nhất làm được game' },
                { text: 'Vì Python chạy nhanh hơn mọi ngôn ngữ khác' },
                { text: 'Vì Python không bao giờ báo lỗi' },
              ],
            },
          ],
        }),
        /*
         * Two practice banks, and note what is NOT here: coding tasks.
         *
         * Teacher note 1 keeps sessions 1–2 free of heavy syntax and of
         * `print()`, and `assertPythonBasicNotes` fails the build over it. A
         * graded IO_MATCH task has to write to stdout to be judged, so a coding
         * ladder is genuinely impossible in this session rather than merely
         * omitted. The ladder for this module lives in Buổi 3, the first session
         * where output is on the syllabus.
         *
         * What session 1 CAN carry is exactly this: recall and vocabulary, which
         * is what these twenty questions are.
         */
        mcqBlock(
          {
            slug: 'tn-b01-tong-quan-python',
            title: 'Trắc nghiệm: Python và môi trường lập trình',
            description: 'Mười câu ôn lại buổi đầu tiên. Sai thì làm lại ngay được.',
            tier: 'CO_BAN',
            passingScore: 60,
            questions: [
              mcq(
                'Lập trình là gì?',
                'Là cách ra lệnh cho máy tính theo đúng thứ tự bằng một ngôn ngữ máy hiểu được',
                [
                  'Là sửa chữa máy tính khi bị hỏng',
                  'Là gõ chữ thật nhanh trên bàn phím',
                  'Là thiết kế vỏ ngoài cho máy tính',
                ],
                {
                  explanation:
                    'Máy tính rất nhanh nhưng không tự nghĩ ra việc. Người lập trình là người nói cho nó biết làm gì, theo thứ tự nào.',
                },
              ),
              mcq(
                'Dấu `>>>` trong chế độ tương tác nghĩa là gì?',
                'Python đang mời em gõ câu lệnh tiếp theo',
                [
                  'Chương trình đã bị lỗi',
                  'Em phải gõ đúng ba dấu lớn hơn trước mỗi câu lệnh',
                  'Máy tính đang tải dữ liệu về',
                ],
                {
                  explanation: 'Đó là lời mời của Python. Em gõ câu lệnh SAU dấu này, không gõ lại chính nó.',
                  hint: 'Thử nghĩ xem dấu này xuất hiện lúc nào: trước hay sau khi em gõ?',
                },
              ),
              mcq(
                'Trong chế độ tương tác, em gõ `7 * 6` rồi nhấn Enter. Chuyện gì xảy ra?',
                'Python hiện ngay 42 ở dòng dưới',
                [
                  'Không có gì xảy ra cho tới khi em lưu tệp',
                  'Python báo lỗi vì thiếu câu lệnh hiển thị',
                  'Python hỏi em muốn lưu kết quả vào đâu',
                ],
                {
                  explanation:
                    'Chế độ tương tác tự hiện giá trị của biểu thức em vừa gõ — đó là điểm khác biệt lớn nhất so với chạy từ tệp.',
                },
              ),
              mcq(
                'Vì sao khoá học chọn Python làm ngôn ngữ đầu tiên?',
                'Vì cú pháp gần với tiếng Anh thường ngày và cho kết quả ngay lập tức',
                [
                  'Vì Python là ngôn ngữ duy nhất làm được game',
                  'Vì Python chạy nhanh hơn mọi ngôn ngữ khác',
                  'Vì Python không bao giờ báo lỗi',
                ],
                {
                  explanation:
                    'Dễ đọc và chạy ngay là hai lý do khiến Python hợp với người mới. Nó không phải ngôn ngữ nhanh nhất, và nó vẫn báo lỗi như mọi ngôn ngữ khác.',
                },
              ),
              mcq(
                '"Python là ngôn ngữ thông dịch" nghĩa là gì?',
                'Máy đọc và chạy từng dòng lệnh, không cần bước biên dịch cả chương trình trước',
                [
                  'Python dịch chương trình sang tiếng Việt cho em đọc',
                  'Python chỉ chạy được khi có kết nối mạng',
                  'Python phải được dịch sang ngôn ngữ khác trước khi chạy',
                ],
                {
                  explanation:
                    'Thông dịch nghĩa là gõ tới đâu chạy tới đó. Đó là lý do chế độ tương tác dùng được ngay.',
                },
              ),
              mcq(
                'Hai cách chạy Python là gì?',
                'Chế độ tương tác, và chạy từ một tệp `.py`',
                [
                  'Chạy trên điện thoại, và chạy trên máy tính',
                  'Chạy có mạng, và chạy không có mạng',
                  'Chạy nhanh, và chạy chậm',
                ],
                {
                  explanation:
                    'Buổi này dùng cách thứ nhất. Cách thứ hai — viết nhiều dòng vào một tệp rồi chạy cả tệp — sẽ học ở các buổi sau.',
                },
              ),
              mcq(
                'Trong chế độ tương tác, `100 / 8` cho kết quả là bao nhiêu?',
                '12.5',
                ['12', '13', '12,5 — Python dùng dấu phẩy'],
                {
                  explanation:
                    'Phép chia `/` luôn cho kết quả có phần thập phân. Python dùng dấu CHẤM để ngăn phần thập phân, không dùng dấu phẩy.',
                  hint: 'Thử nhẩm 100 chia 8 xem có chia hết không.',
                },
              ),
              mcq(
                'Khung "Sân chơi Code" trong bài học của DYE LMS thực chất là gì?',
                'Một chế độ tương tác chạy ngay trong trình duyệt, không cần cài gì cả',
                [
                  'Một video hướng dẫn',
                  'Một bài kiểm tra có tính điểm',
                  'Một trò chơi để giải lao giữa giờ',
                ],
                {
                  explanation:
                    'Đó là lý do em bắt đầu học được ngay từ buổi 1 mà chưa cần cài Python ở nhà.',
                },
              ),
              mcq(
                'Nếu muốn cài Python trên máy ở nhà, em cần tải những gì?',
                'Bản Python từ python.org, và một trình soạn thảo như VS Code',
                [
                  'Chỉ cần một trình duyệt web',
                  'Một chiếc máy tính mới hoàn toàn',
                  'Không cài được ở nhà, chỉ dùng được ở trường',
                ],
                {
                  explanation:
                    'Hai thứ đó là đủ. Thầy cô sẽ hướng dẫn riêng phần cài đặt — buổi này em cứ dùng Sân chơi Code trong trình duyệt.',
                },
              ),
              mcq(
                'Khoá học Python Cơ Bản kéo dài bao nhiêu buổi?',
                '30 buổi',
                ['10 buổi', '15 buổi', '50 buổi'],
                {
                  explanation:
                    'Ba mươi buổi, đi từ những phép tính đơn giản đến chỗ em tự viết được một chương trình hoàn chỉnh.',
                },
              ),
            ],
          },
          {
            title: 'Trắc nghiệm: em nhớ được bao nhiêu?',
            markdown: [
              'Mười câu về những gì em vừa đọc.',
              '',
              'Sai cũng **không sao cả** — em thấy ngay lời giải thích rồi làm lại câu đó.',
              'Phần này không tính vào điểm tổng kết; nó ở đây để em tự kiểm tra mình.',
            ].join('\n'),
          },
        ),

        fillBlankBlock(
          {
            slug: 'dk-b01-tong-quan-python',
            title: 'Điền khuyết: từ khoá của buổi 1',
            description: 'Mười chỗ trống. Gõ không dấu cũng được, hoa thường đều tính là đúng.',
            tier: 'CO_BAN',
            passingScore: 60,
            questions: [
              dienKhuyet(
                'Điền ba ký tự.',
                'Dấu nhắc của chế độ tương tác Python là `___`',
                ['>>>', '>>> '],
                { explanation: 'Ba dấu lớn hơn. Em gõ câu lệnh sau nó, không gõ lại chính nó.', matchMode: 'exact' },
              ),
              dienKhuyet(
                'Điền tên ngôn ngữ.',
                'Ngôn ngữ lập trình em học trong khoá này tên là ___ .',
                ['Python', 'python'],
                { explanation: 'Tên này lấy từ nhóm hài Monty Python, không phải từ con trăn.' },
              ),
              dienKhuyet(
                'Điền một từ.',
                'Python là ngôn ngữ ___ : gõ tới đâu, máy chạy tới đó, không cần biên dịch trước.',
                ['thông dịch', 'thong dich', 'interpreted'],
                { explanation: 'Thông dịch — đối lập với biên dịch, nơi cả chương trình phải được dịch trước khi chạy.' },
              ),
              dienKhuyet(
                'Điền số.',
                'Khoá Python Cơ Bản gồm ___ buổi.',
                ['30', 'ba mươi', 'ba muoi'],
                { explanation: 'Ba mươi buổi, trong đó 19 buổi đầu là phần nền tảng bắt buộc.' },
              ),
              dienKhuyet(
                'Điền đuôi tệp.',
                'Tệp chương trình Python có đuôi là `.___`',
                ['py', '.py'],
                { explanation: 'Ví dụ `bai_tap_1.py`. Cách chạy từ tệp sẽ học ở các buổi sau.' },
              ),
              dienKhuyet(
                'Điền kết quả.',
                'Trong chế độ tương tác, gõ `2 + 3` rồi nhấn Enter sẽ thấy ___ .',
                ['5', 'năm', 'nam'],
                { explanation: 'Chế độ tương tác tự hiện giá trị của biểu thức — em không cần ra lệnh gì thêm.' },
              ),
              dienKhuyet(
                'Điền dấu phép tính.',
                'Muốn nhân hai số trong Python, em dùng dấu `___`',
                ['*', 'dấu sao', 'dau sao'],
                { explanation: 'Dấu sao `*`, không phải dấu `x` như trong vở Toán.', matchMode: 'exact' },
              ),
              dienKhuyet(
                'Điền dấu ngăn phần thập phân.',
                'Python viết mười hai phẩy năm là `12___5`',
                ['.', 'dấu chấm', 'dau cham'],
                {
                  explanation: 'Python dùng dấu CHẤM, không dùng dấu phẩy. `12.5` chứ không phải `12,5`.',
                  matchMode: 'exact',
                  hint: 'Khác với cách viết trong vở Toán tiếng Việt.',
                },
              ),
              dienKhuyet(
                'Điền tên trình soạn thảo.',
                'Trình soạn thảo phổ biến để viết Python trên máy ở nhà là VS ___ .',
                ['Code', 'code'],
                { explanation: 'Visual Studio Code, thường gọi tắt là VS Code.' },
              ),
              dienKhuyet(
                'Điền tên trang web.',
                'Bản Python để cài trên máy được tải từ trang ___ .',
                ['python.org', 'python org'],
                { explanation: 'Đây là trang chính thức. Tránh tải Python từ các trang khác.' },
              ),
            ],
          },
          {
            title: 'Điền khuyết: nhớ lại từ khoá',
            markdown: [
              'Điền từ còn thiếu vào chỗ trống.',
              '',
              'Phần lớn câu **không phân biệt hoa thường** và **gõ không dấu vẫn tính đúng** —',
              'máy ở trường nhiều khi không gõ được tiếng Việt, và bài này kiểm tra em hiểu gì,',
              'không kiểm tra bàn phím của em.',
              '',
              'Vài câu hỏi về ký hiệu (như `>>>` hay dấu chấm) thì phải gõ chính xác,',
              'vì trong lập trình những ký hiệu đó không thay thế cho nhau được.',
            ].join('\n'),
          },
        ),

        reflection(
          'Ghi lại một câu',
          'Em muốn tự làm được điều gì sau khoá học này? Viết một câu ngắn — cuối khoá chúng ta sẽ đọc lại.',
        ),
      ],
    },

    {
      order: 2,
      slug: 'b02-lam-quen-moi-truong-lap-trinh',
      title: 'Làm quen môi trường lập trình & chạy chương trình đầu tiên',
      summary:
        'Đi sâu hơn vào chế độ tương tác: thứ tự thực hiện phép tính, các loại phép chia, ' +
        'và cách viết ghi chú cho chính mình.',
      objectives: [
        'Sử dụng thành thạo chế độ tương tác để tính toán',
        'Giải thích được thứ tự ưu tiên của các phép toán và vai trò của dấu ngoặc',
        'Phân biệt được ba phép chia: `/`, `//` và `%`',
        'Viết được ghi chú (comment) bằng dấu `#`',
      ],
      difficulty: 1,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Buổi mở rộng của Lesson 1 (⟨derived⟩). Vẫn giữ nguyên tinh thần buổi 1: chưa dùng print(), ' +
        'chưa dạy cú pháp nặng. Mục tiêu là học sinh tự tin thao tác với môi trường.',
      isDerived: true,
      blocks: [
        theory(
          'Thứ tự thực hiện phép tính',
          [
            'Python tính toán theo đúng quy tắc em đã học ở môn Toán:',
            '',
            '1. Trong ngoặc `( )` trước',
            '2. Luỹ thừa `**`',
            '3. Nhân `*`, chia `/`, chia lấy nguyên `//`, chia lấy dư `%`',
            '4. Cộng `+`, trừ `-`',
            '',
            'Khi không chắc, cứ thêm ngoặc. Ngoặc thừa không làm sai kết quả, nhưng ngoặc thiếu thì có.',
          ].join('\n'),
          [
            'Ngoặc → luỹ thừa → nhân/chia → cộng/trừ',
            '`**` là luỹ thừa: `2 ** 10` bằng 1024',
            'Khi phân vân, thêm ngoặc cho rõ ràng',
          ],
        ),
        theory(
          'Ba kiểu chia và dấu ghi chú',
          [
            'Python có ba phép chia, và chúng khác nhau thật sự:',
            '',
            '| Phép | Ý nghĩa | Ví dụ | Kết quả |',
            '|---|---|---|---|',
            '| `/` | Chia thường | `17 / 5` | `3.4` |',
            '| `//` | Chia lấy phần nguyên | `17 // 5` | `3` |',
            '| `%` | Chia lấy phần dư | `17 % 5` | `2` |',
            '',
            'Phép `%` sẽ rất hữu ích về sau, ví dụ để kiểm tra một số có chẵn hay không.',
            '',
            '**Ghi chú (comment):** mọi thứ sau dấu `#` trên một dòng đều được Python bỏ qua. ' +
              'Ghi chú là để cho *người đọc*, không phải cho máy.',
          ],
          [
            '`/` cho số thập phân, `//` cho phần nguyên, `%` cho phần dư',
            'Dấu `#` bắt đầu một ghi chú — Python bỏ qua phần còn lại của dòng',
          ],
          { minutes: 15 },
        ),
        example(
          'Ba phép chia đứng cạnh nhau',
          'Cùng một cặp số, ba phép chia cho ba kết quả rất khác nhau. Hãy đọc kỹ từng dòng.',
          [
            '>>> 17 / 5      # chia thường',
            '3.4',
            '>>> 17 // 5     # lấy phần nguyên',
            '3',
            '>>> 17 % 5      # lấy phần dư',
            '2',
            '>>> (2 + 3) * 4 # ngoặc được tính trước',
            '20',
            '>>> 2 + 3 * 4   # không có ngoặc: nhân trước',
            '14',
            '>>> 2 ** 10     # luỹ thừa',
            '1024',
          ].join('\n'),
          {
            notes: [
              '17 = 5 × 3 + 2, nên `17 // 5` là 3 và `17 % 5` là 2.',
              'Hai dòng cuối cùng chỉ khác nhau ở cặp ngoặc, mà kết quả lệch tới 6 đơn vị.',
            ],
          },
        ),
        playground(
          'Sân chơi: 100 giây là bao nhiêu phút mấy giây?',
          [
            'Dùng `//` và `%` để tách 100 giây thành phút và giây.',
            '',
            'Gợi ý: số phút là `100 // 60`, số giây còn lại là `100 % 60`.',
            '',
            'Thử tiếp với 500 giây, 3671 giây.',
          ].join('\n'),
          ['# Tách 100 giây thành phút và giây', '100 // 60', '100 % 60'].join('\n'),
          'Tách đúng một số giây bất kỳ thành phút và giây bằng `//` và `%`.',
        ),
        quizBlock({
          slug: 'q-b02-moi-truong-va-phep-chia',
          title: 'Kiểm tra nhanh: phép toán và ghi chú',
          tier: 'CO_BAN',
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Kết quả của `23 % 4` là bao nhiêu?',
              explanation: '23 = 4 × 5 + 3, nên phần dư là 3.',
              choices: [
                { text: '3', isCorrect: true },
                { text: '5' },
                { text: '5.75' },
                { text: '4' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Biểu thức `2 + 3 * 4` cho kết quả nào?',
              explanation: 'Nhân được thực hiện trước phép cộng: 3 × 4 = 12, rồi 2 + 12 = 14.',
              choices: [
                { text: '14', isCorrect: true },
                { text: '20' },
                { text: '24' },
                { text: '9' },
              ],
            },
            {
              type: 'FILL_BLANK',
              prompt: 'Ký tự nào bắt đầu một dòng ghi chú trong Python?',
              explanation: 'Dấu thăng `#`. Python bỏ qua toàn bộ phần sau dấu này trên cùng dòng.',
              acceptedAnswers: ['#', 'dấu #', 'dau #', 'thăng', 'dấu thăng'],
              matchMode: 'normalised',
            },
          ],
        }),
      ],
    },

    {
      order: 3,
      slug: 'b03-bien-va-kieu-du-lieu',
      title: 'Biến và Kiểu dữ liệu: int, float, string, boolean',
      summary:
        'Học cách đặt tên và cất giữ dữ liệu bằng biến, và làm quen bốn kiểu dữ liệu cơ bản ' +
        'mà em sẽ dùng suốt khoá học.',
      objectives: [
        'Tạo được biến và gán giá trị cho biến',
        'Nhận biết bốn kiểu dữ liệu: số nguyên, số thực, chuỗi và luận lý',
        'Dùng được hàm `type()` để hỏi Python về kiểu của một giá trị',
        'Đặt tên biến theo quy tắc hợp lệ và dễ hiểu',
      ],
      difficulty: 2,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Lesson 2. Chỉ dạy bốn kiểu: int, float, string, boolean. KHÔNG đưa số phức vào chương trình — ' +
        'không phù hợp với lứa tuổi trung học cơ sở.',
      blocks: [
        theory(
          'Biến — chiếc hộp có dán nhãn',
          [
            'Một **biến** là một cái tên trỏ tới một giá trị. Hãy hình dung một chiếc hộp có dán nhãn: ' +
              'nhãn là tên biến, thứ bên trong là giá trị.',
            '',
            '```python',
            'diem_toan = 8.5',
            '```',
            '',
            'Dấu `=` ở đây **không phải** dấu bằng của Toán học. Nó có nghĩa là *"gán giá trị bên phải ' +
              'vào cái tên bên trái"*. Đọc là "diem_toan **nhận** 8.5".',
            '',
            '**Quy tắc đặt tên biến:**',
            '',
            '- Chỉ gồm chữ cái, chữ số và dấu gạch dưới `_`',
            '- Không được bắt đầu bằng chữ số',
            '- Không có dấu cách, không dấu tiếng Việt',
            '- Phân biệt chữ hoa chữ thường: `Diem` và `diem` là hai biến khác nhau',
            '',
            'Tên tốt là tên đọc lên hiểu ngay: `so_hoc_sinh` tốt hơn `x`.',
          ].join('\n'),
          [
            '`=` là phép gán, không phải phép so sánh',
            'Tên biến không có dấu cách và không bắt đầu bằng số',
            'Đặt tên có nghĩa để chính em đọc lại còn hiểu',
          ],
        ),
        theory(
          'Bốn kiểu dữ liệu cơ bản',
          [
            '| Kiểu | Tên trong Python | Dùng để | Ví dụ |',
            '|---|---|---|---|',
            '| Số nguyên | `int` | Đếm, số lượng | `12`, `-5`, `0` |',
            '| Số thực | `float` | Điểm số, chiều cao | `8.5`, `-0.25` |',
            '| Chuỗi | `str` | Chữ, tên, câu | `"Lan"`, `"Đà Lạt"` |',
            '| Luận lý | `bool` | Đúng hoặc sai | `True`, `False` |',
            '',
            'Chuỗi phải đặt trong dấu nháy — nháy đơn `\'...\'` hay nháy kép `"..."` đều được, ' +
              'miễn là mở và đóng cùng loại.',
            '',
            '`True` và `False` viết hoa chữ cái đầu. Đây là hai giá trị duy nhất của kiểu `bool`.',
            '',
            'Muốn hỏi Python một giá trị thuộc kiểu nào, dùng `type()`.',
          ],
          [
            'int cho số nguyên, float cho số thực',
            'str luôn nằm trong cặp nháy',
            'bool chỉ có hai giá trị: True và False',
            '`type(x)` cho biết x thuộc kiểu nào',
          ],
          { minutes: 15 },
        ),
        example(
          'Bốn kiểu dữ liệu trong REPL',
          'Gán giá trị cho biến, rồi hỏi Python xem mỗi biến thuộc kiểu nào.',
          [
            '>>> so_hoc_sinh = 24',
            '>>> so_hoc_sinh',
            '24',
            '>>> type(so_hoc_sinh)',
            "<class 'int'>",
            '',
            '>>> diem_toan = 8.5',
            '>>> type(diem_toan)',
            "<class 'float'>",
            '',
            '>>> ten_lop = "7A1"',
            '>>> type(ten_lop)',
            "<class 'str'>",
            '',
            '>>> da_nop_bai = True',
            '>>> type(da_nop_bai)',
            "<class 'bool'>",
            '',
            '>>> so_hoc_sinh = 25   # gán lại: biến nhận giá trị mới',
            '>>> so_hoc_sinh',
            '25',
          ].join('\n'),
          {
            notes: [
              'Hai dòng cuối cho thấy biến có thể đổi giá trị bất cứ lúc nào — giá trị cũ bị thay thế.',
              '`"7A1"` là chuỗi chứ không phải số, vì nó nằm trong dấu nháy.',
            ],
          },
        ),
        playground(
          'Sân chơi: hồ sơ của em',
          [
            'Tạo bốn biến mô tả chính em, mỗi biến một kiểu dữ liệu khác nhau:',
            '',
            '- `ho_ten` — chuỗi',
            '- `tuoi` — số nguyên',
            '- `chieu_cao` — số thực (mét)',
            '- `thich_lap_trinh` — luận lý',
            '',
            'Sau đó dùng `type()` để kiểm tra từng biến.',
          ].join('\n'),
          [
            'ho_ten = "..."',
            'tuoi = 0',
            'chieu_cao = 0.0',
            'thich_lap_trinh = True',
            '',
            '# Kiểm tra kiểu của từng biến',
            'type(ho_ten)',
          ].join('\n'),
          'Tạo đủ bốn biến với bốn kiểu dữ liệu khác nhau và kiểm tra được kiểu của chúng.',
        ),
        quizBlock({
          slug: 'q-b03-bien-va-kieu-du-lieu',
          title: 'Kiểm tra nhanh: biến và kiểu dữ liệu',
          tier: 'CO_BAN',
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Tên biến nào sau đây **không hợp lệ** trong Python?',
              explanation:
                'Tên biến không được bắt đầu bằng chữ số. `2diem` sai; `diem2` thì hợp lệ.',
              choices: [
                { text: '2diem', isCorrect: true },
                { text: 'diem_2' },
                { text: 'diemToan' },
                { text: '_diem' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Giá trị `"18"` (có dấu nháy) thuộc kiểu dữ liệu nào?',
              explanation:
                'Có dấu nháy nghĩa là chuỗi `str`, dù bên trong trông giống một con số.',
              choices: [
                { text: 'str — chuỗi', isCorrect: true },
                { text: 'int — số nguyên' },
                { text: 'float — số thực' },
                { text: 'bool — luận lý' },
              ],
            },
            {
              type: 'TRUE_FALSE',
              prompt: 'Trong Python, `diem` và `Diem` là cùng một biến.',
              explanation:
                'Sai. Python phân biệt chữ hoa và chữ thường, nên đây là hai biến khác nhau.',
              choices: [
                { text: 'Đúng' },
                { text: 'Sai', isCorrect: true },
              ],
            },
            {
              type: 'FILL_BLANK',
              prompt: 'Kiểu dữ liệu nào chỉ có đúng hai giá trị `True` và `False`?',
              explanation: 'Kiểu luận lý, viết tắt là `bool`.',
              acceptedAnswers: ['bool', 'boolean', 'luận lý', 'luan ly', 'kiểu luận lý'],
              matchMode: 'normalised',
            },
          ],
        }),
      ],
    },

    {
      order: 4,
      slug: 'b04-ep-kieu-va-thuc-hanh-bien',
      title: 'Ép kiểu & Thực hành với biến',
      summary:
        'Chuyển đổi qua lại giữa các kiểu dữ liệu bằng `int()`, `float()`, `str()` — ' +
        'và hiểu vì sao `"5" + "3"` không ra 8.',
      objectives: [
        'Chuyển đổi được giữa các kiểu `int`, `float` và `str`',
        'Giải thích được vì sao cộng hai chuỗi số lại ra kết quả nối chuỗi',
        'Dự đoán được kết quả của `int()` khi ép từ số thực',
        'Nhận ra lỗi khi ép kiểu không hợp lệ',
      ],
      difficulty: 2,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Buổi mở rộng của Lesson 2 (⟨derived⟩). Đây là chỗ học sinh hay nhầm nhất, nên tách riêng ' +
        'một buổi để luyện kỹ trước khi vào toán tử.',
      blocks: [
        theory(
          'Ép kiểu — đổi hộp đựng cho dữ liệu',
          [
            'Đôi khi dữ liệu đang ở kiểu này nhưng em cần nó ở kiểu khác. Việc đổi kiểu gọi là **ép kiểu**.',
            '',
            '| Hàm | Đổi thành | Ví dụ | Kết quả |',
            '|---|---|---|---|',
            '| `int(x)` | Số nguyên | `int("42")` | `42` |',
            '| `float(x)` | Số thực | `float("3.14")` | `3.14` |',
            '| `str(x)` | Chuỗi | `str(2026)` | `"2026"` |',
            '',
            '**Điều quan trọng nhất của buổi này:** dấu `+` làm hai việc khác nhau tuỳ kiểu dữ liệu.',
            '',
            '- Với số: `5 + 3` là phép **cộng** → `8`',
            '- Với chuỗi: `"5" + "3"` là phép **nối** → `"53"`',
            '',
            'Đây là nguồn gốc của rất nhiều lỗi ở người mới học. Khi kết quả lạ, việc đầu tiên nên làm ' +
              'là kiểm tra `type()`.',
          ].join('\n'),
          [
            '`int()`, `float()`, `str()` để đổi kiểu',
            '`+` giữa hai số là cộng, giữa hai chuỗi là nối',
            '`int(9.9)` cho 9 — cắt bỏ phần thập phân chứ không làm tròn',
            'Kết quả lạ → kiểm tra `type()` trước tiên',
          ],
        ),
        example(
          'Cùng dấu cộng, hai kết quả khác nhau',
          'Hãy so sánh thật kỹ hai nhóm dòng dưới đây. Chỉ khác cặp dấu nháy thôi.',
          [
            '>>> 5 + 3',
            '8',
            '>>> "5" + "3"',
            "'53'",
            '',
            '>>> int("5") + int("3")   # ép về số trước rồi mới cộng',
            '8',
            '>>> str(5) + str(3)       # ép về chuỗi trước rồi mới nối',
            "'53'",
            '',
            '>>> int(9.9)              # cắt phần thập phân, KHÔNG làm tròn',
            '9',
            '>>> float(7)',
            '7.0',
            '',
            '>>> int("ba muoi")        # không đổi được',
            "ValueError: invalid literal for int() with base 10: 'ba muoi'",
          ].join('\n'),
          {
            notes: [
              '`int(9.9)` ra 9 chứ không phải 10. Python cắt phần thập phân đi.',
              'Dòng cuối là một lỗi thật. Đọc dòng lỗi cũng là một kỹ năng cần luyện.',
            ],
          },
        ),
        playground(
          'Sân chơi: đoán trước rồi hãy chạy',
          [
            'Với mỗi dòng dưới đây, hãy **đoán kết quả trước**, rồi chạy để kiểm tra.',
            '',
            'Đoán sai không sao — chỗ nào đoán sai chính là chỗ em vừa học được điều mới.',
          ].join('\n'),
          [
            '# Đoán trước, rồi chạy từng dòng',
            '"7" + "7"',
            'int("7") + int("7")',
            'int(4.99)',
            'float("2.5") * 2',
            'str(100) + " điểm"',
          ].join('\n'),
          'Giải thích được vì sao mỗi dòng cho ra kết quả như vậy.',
        ),
        quizBlock({
          slug: 'q-b04-ep-kieu',
          title: 'Kiểm tra nhanh: ép kiểu',
          tier: 'CO_BAN',
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Kết quả của `"12" + "8"` là gì?',
              explanation:
                'Cả hai đều là chuỗi, nên `+` nối chúng lại thành `"128"` chứ không cộng thành 20.',
              choices: [
                { text: '"128"', isCorrect: true },
                { text: '20' },
                { text: '"20"' },
                { text: 'Báo lỗi' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: '`int(7.8)` cho kết quả nào?',
              explanation: '`int()` cắt bỏ phần thập phân, không làm tròn. Vậy kết quả là 7.',
              choices: [
                { text: '7', isCorrect: true },
                { text: '8' },
                { text: '7.8' },
                { text: 'Báo lỗi' },
              ],
            },
            {
              type: 'TRUE_FALSE',
              prompt: '`int("mười")` sẽ chạy được và cho kết quả 10.',
              explanation:
                'Sai. `int()` chỉ đọc được chuỗi chứa chữ số, ví dụ `"10"`. Chữ tiếng Việt sẽ gây lỗi ValueError.',
              choices: [
                { text: 'Đúng' },
                { text: 'Sai', isCorrect: true },
              ],
            },
          ],
        }),
      ],
    },
  ],
};

export const module2: ModuleSpec = {
  slug: 'toan-tu-va-giao-tiep',
  title: 'Toán tử & Giao tiếp với người dùng',
  description:
    'Từ buổi này chương trình bắt đầu biết nói chuyện: nhận dữ liệu từ người dùng bằng `input()` ' +
    'và hiển thị kết quả bằng `print()` với f-string.',
  lessons: [
    {
      order: 5,
      slug: 'b05-toan-tu-so-hoc-so-sanh-logic',
      title: 'Toán tử số học, so sánh và logic',
      summary:
        'Ba nhóm toán tử làm nên mọi quyết định trong chương trình: tính toán, so sánh, và kết hợp điều kiện.',
      objectives: [
        'Sử dụng đầy đủ các toán tử số học, kể cả `//`, `%` và `**`',
        'Dùng toán tử so sánh để tạo ra giá trị `True` / `False`',
        'Kết hợp điều kiện bằng `and`, `or`, `not`',
        'Phân biệt rõ `=` (gán) và `==` (so sánh)',
      ],
      difficulty: 2,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes: 'Lesson 3, phần toán tử. Nhấn mạnh sự khác nhau giữa `=` và `==`.',
      blocks: [
        theory(
          'Ba nhóm toán tử',
          [
            '**Nhóm 1 — Số học:** `+`, `-`, `*`, `/`, `//`, `%`, `**`. Kết quả là một con số.',
            '',
            '**Nhóm 2 — So sánh:** kết quả luôn là `True` hoặc `False`.',
            '',
            '| Toán tử | Ý nghĩa |',
            '|---|---|',
            '| `==` | Bằng nhau |',
            '| `!=` | Khác nhau |',
            '| `>` `<` | Lớn hơn, nhỏ hơn |',
            '| `>=` `<=` | Lớn hơn hoặc bằng, nhỏ hơn hoặc bằng |',
            '',
            '⚠️ **`=` và `==` hoàn toàn khác nhau.** `diem = 8` nghĩa là *gán* 8 cho diem. ' +
              '`diem == 8` nghĩa là *hỏi* xem diem có bằng 8 không.',
            '',
            '**Nhóm 3 — Logic:** kết hợp nhiều điều kiện.',
            '',
            '- `and` — đúng khi **cả hai** vế đều đúng',
            '- `or` — đúng khi **ít nhất một** vế đúng',
            '- `not` — đảo ngược đúng thành sai và ngược lại',
          ].join('\n'),
          [
            '`=` là gán, `==` là so sánh — nhầm chỗ này là lỗi phổ biến nhất',
            'Toán tử so sánh luôn trả về True hoặc False',
            '`and` cần cả hai đúng, `or` chỉ cần một đúng',
          ],
        ),
        example(
          'So sánh và logic trong REPL',
          'Mỗi dòng dưới đây là một câu hỏi, và Python trả lời bằng True hoặc False.',
          [
            '>>> diem = 8',
            '>>> diem == 8',
            'True',
            '>>> diem > 9',
            'False',
            '>>> diem != 5',
            'True',
            '',
            '>>> diem >= 5 and diem <= 10   # nằm trong khoảng 5..10',
            'True',
            '>>> diem < 5 or diem > 9',
            'False',
            '>>> not (diem == 8)',
            'False',
            '',
            '>>> 5 <= diem <= 10            # Python cho phép viết gọn như Toán',
            'True',
          ].join('\n'),
          {
            notes: [
              'Dòng cuối là một điểm mạnh của Python: viết `5 <= diem <= 10` được, giống hệt cách viết trong Toán.',
              '`not (diem == 8)` cho False vì `diem == 8` vốn là True.',
            ],
          },
        ),
        playground(
          'Sân chơi: điều kiện đỗ học bổng',
          [
            'Giả sử điều kiện nhận học bổng là: điểm Toán **và** điểm Văn đều từ 8 trở lên.',
            '',
            'Hãy thử thay đổi hai biến rồi kiểm tra biểu thức điều kiện.',
            '',
            'Sau đó thử đổi `and` thành `or` và quan sát kết quả thay đổi thế nào.',
          ].join('\n'),
          [
            'diem_toan = 8.5',
            'diem_van = 7.0',
            '',
            '# Cả hai đều phải từ 8 trở lên',
            'diem_toan >= 8 and diem_van >= 8',
          ].join('\n'),
          'Dự đoán đúng kết quả True/False trước khi chạy, với ít nhất ba cặp điểm khác nhau.',
        ),
        quizBlock({
          slug: 'q-b05-toan-tu',
          title: 'Kiểm tra nhanh: toán tử',
          tier: 'CO_BAN',
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Biểu thức nào dùng để **hỏi** xem `tuoi` có bằng 15 hay không?',
              explanation: '`==` là so sánh. `=` chỉ dùng để gán giá trị.',
              choices: [
                { text: 'tuoi == 15', isCorrect: true },
                { text: 'tuoi = 15' },
                { text: 'tuoi := 15' },
                { text: 'tuoi equals 15' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Với `a = 5`, biểu thức `a > 3 and a > 10` cho kết quả nào?',
              explanation: '`a > 3` là True nhưng `a > 10` là False. `and` cần cả hai đúng, nên kết quả False.',
              choices: [
                { text: 'False', isCorrect: true },
                { text: 'True' },
                { text: '5' },
                { text: 'Báo lỗi' },
              ],
            },
            {
              type: 'MULTIPLE_CHOICE',
              prompt: 'Với `a = 5`, biểu thức `a > 3 or a > 10` cho kết quả nào?',
              explanation: '`or` chỉ cần một vế đúng. `a > 3` đúng nên cả biểu thức là True.',
              choices: [
                { text: 'True', isCorrect: true },
                { text: 'False' },
                { text: '5' },
                { text: 'Báo lỗi' },
              ],
            },
            {
              type: 'TRUE_FALSE',
              prompt: 'Biểu thức `10 % 2 == 0` cho kết quả True.',
              explanation: '10 chia 2 dư 0, và `0 == 0` là True. Đây là cách kiểm tra số chẵn.',
              choices: [
                { text: 'Đúng', isCorrect: true },
                { text: 'Sai' },
              ],
            },
          ],
        }),
      ],
    },

    {
      order: 6,
      slug: 'b06-print-input-va-format-string',
      title: '`print()`, `input()` và Format String',
      summary:
        'Buổi bản lề: chương trình bắt đầu hiển thị kết quả ra màn hình và nhận dữ liệu từ người dùng. ' +
        'F-string là công cụ chính để trình bày kết quả cho đẹp.',
      objectives: [
        'Hiển thị dữ liệu ra màn hình bằng `print()`',
        'Nhận dữ liệu từ người dùng bằng `input()` và ép về đúng kiểu',
        'Viết được f-string để ghép chữ và giá trị biến',
        'Định dạng số thực với f-string, ví dụ `{diem:.2f}`',
        'Định dạng số nguyên có đủ chữ số, ví dụ `{gio:02d}`',
        'Giải được bài tập có chấm điểm tự động, khớp đúng từng ký tự đầu ra',
      ],
      difficulty: 2,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Lesson 3, phần print/input. GHI CHÚ QUAN TRỌNG: lồng ghép bài tập về format-string ở buổi này. ' +
        'Đây cũng là buổi đầu tiên học sinh viết chương trình chạy từ tệp thay vì REPL. ' +
        'THANG 10 BÀI CHẤM TỰ ĐỘNG: đây là buổi sớm nhất có thể chấm tự động, vì trước buổi 6 ' +
        'chương trình chưa in ra gì để so sánh. Không kỳ vọng em nào làm hết 10 bậc trong 90 phút — ' +
        'bậc 1–5 là CƠ BẢN và đủ để đạt buổi này; bậc 6–7 THỬ THÁCH, bậc 8–9 NÂNG CAO, bậc 10 MỞ RỘNG, ' +
        'nên với em đang ở nhánh Cơ bản thì bậc 6 trở lên hiện ra dưới dạng khám phá thêm và KHÔNG ' +
        'tính vào tiến độ. Bậc 9 và 10 cố ý không dùng if/for (buổi 8 và 12 mới học): bậc 9 tách số ' +
        'bằng // và %, bậc 10 thay if bằng biểu thức lôgic cộng với int(True) = 1. ' +
        'Lỗi hay gặp nhất ở bậc 5 là quên int() nên "3" + "5" ra "35".',
      blocks: [
        theory(
          'Nói và nghe: `print()` và `input()`',
          [
            'Từ buổi này, chương trình của em chạy từ **tệp** chứ không chỉ trong REPL nữa. ' +
              'Trong tệp, giá trị không tự hiện ra — em phải yêu cầu hiển thị bằng `print()`.',
            '',
            '```python',
            'print("Xin chào Đà Lạt!")',
            '```',
            '',
            'Chiều ngược lại, `input()` dừng chương trình để chờ người dùng gõ vào:',
            '',
            '```python',
            'ten = input("Tên em là gì? ")',
            '```',
            '',
            '⚠️ **`input()` LUÔN trả về chuỗi**, kể cả khi người dùng gõ số. Muốn tính toán, phải ép kiểu:',
            '',
            '```python',
            'tuoi = int(input("Em bao nhiêu tuổi? "))',
            '```',
          ].join('\n'),
          [
            '`print()` để hiển thị, `input()` để nhận dữ liệu',
            '`input()` luôn cho chuỗi — nhớ ép kiểu khi cần tính toán',
            'Trong tệp `.py`, không có `print()` thì không thấy gì cả',
          ],
        ),
        theory(
          'F-string — cách trình bày kết quả đẹp nhất',
          [
            'Ghép chữ với biến bằng dấu `+` rất phiền: phải ép kiểu, phải nhớ thêm dấu cách. ' +
              '**F-string** giải quyết tất cả.',
            '',
            'Chỉ cần thêm chữ `f` trước dấu nháy, rồi đặt tên biến trong cặp ngoặc nhọn `{}`:',
            '',
            '```python',
            'ten = "Lan"',
            'diem = 8.5',
            'print(f"Bạn {ten} được {diem} điểm")',
            '# → Bạn Lan được 8.5 điểm',
            '```',
            '',
            '**Định dạng số** — thêm dấu hai chấm và quy tắc sau tên biến:',
            '',
            '| Cú pháp | Ý nghĩa | Ví dụ kết quả |',
            '|---|---|---|',
            '| `{x:.2f}` | Số thực, 2 chữ số thập phân | `8.50` |',
            '| `{x:.0f}` | Làm tròn về số nguyên | `9` |',
            '| `{x:>8}` | Căn phải trong 8 ô | `     8.5` |',
            '| `{x:,}` | Có dấu phân cách hàng nghìn | `1,000,000` |',
            '',
            'Bên trong `{}` em còn có thể đặt cả phép tính: `f"Tổng: {a + b}"`.',
          ],
          [
            'F-string bắt đầu bằng `f` trước dấu nháy',
            'Đặt biến trong `{}` — không cần ép kiểu, không cần dấu `+`',
            '`{diem:.2f}` để hiện đúng hai chữ số thập phân',
          ],
          { minutes: 15 },
        ),
        example(
          'Ba cách ghép chuỗi, một cách tốt nhất',
          'Cùng một kết quả, nhưng cách viết khác hẳn nhau về độ dễ đọc.',
          [
            'ten = "Minh"',
            'diem = 9.456',
            '',
            '# Cách 1: dùng dấu + — phải ép kiểu, dễ quên dấu cách',
            'print("Bạn " + ten + " được " + str(diem) + " điểm")',
            '',
            '# Cách 2: print nhiều phần — tự thêm dấu cách, khó kiểm soát',
            'print("Bạn", ten, "được", diem, "điểm")',
            '',
            '# Cách 3: f-string — rõ ràng nhất, lại định dạng được số',
            'print(f"Bạn {ten} được {diem:.2f} điểm")',
            '',
            '# Tính toán ngay trong f-string',
            'a = 7',
            'b = 5',
            'print(f"{a} + {b} = {a + b}")',
          ].join('\n'),
          {
            output: [
              'Bạn Minh được 9.456 điểm',
              'Bạn Minh được 9.456 điểm',
              'Bạn Minh được 9.46 điểm',
              '7 + 5 = 12',
            ].join('\n'),
            notes: [
              'Chỉ cách 3 hiển thị điểm gọn thành 9.46 — đó là sức mạnh của `:.2f`.',
              'Cách 1 bắt buộc phải có `str(diem)`, nếu quên sẽ báo lỗi ngay.',
            ],
          },
        ),
        playground(
          'Sân chơi: thẻ giới thiệu bản thân',
          [
            'Dùng f-string để in ra một thẻ giới thiệu gọn gàng về em.',
            '',
            'Thử dùng `{...:.1f}` cho chiều cao, và thử cả `{...:>10}` để căn phải xem sao.',
          ].join('\n'),
          [
            'ho_ten = "Nguyễn Văn A"',
            'lop = "7A1"',
            'chieu_cao = 1.523',
            '',
            'print(f"Họ tên : {ho_ten}")',
            'print(f"Lớp    : {lop}")',
            'print(f"Chiều cao: {chieu_cao:.2f} m")',
          ].join('\n'),
          'In được thẻ giới thiệu có ít nhất một số được định dạng bằng `:.2f`.',
        ),
        challenge(
          {
            slug: 'p-b06-chao-hoi-f-string',
            title: 'Lời chào có định dạng',
            statement: [
              'Viết chương trình đọc **hai dòng** dữ liệu từ bàn phím:',
              '',
              '1. Dòng 1: tên của bạn (chuỗi)',
              '2. Dòng 2: điểm trung bình (số thực)',
              '',
              'Sau đó in ra **đúng một dòng** theo mẫu:',
              '',
              '```',
              'Chao <ten>, diem trung binh cua ban la <diem> !',
              '```',
              '',
              'Trong đó `<diem>` phải hiển thị **đúng 2 chữ số thập phân**.',
              '',
              '**Bắt buộc dùng f-string.**',
            ].join('\n'),
            hints: [
              'Đọc hai dòng bằng hai lệnh `input()` riêng biệt.',
              'Điểm là số thực, nên cần `float(input())`.',
              'Định dạng hai chữ số thập phân là `{diem:.2f}`.',
            ],
            starterCode: [
              '# Đọc tên và điểm trung bình rồi in lời chào',
              'ten = input()',
              'diem = float(input())',
              '',
              '# Viết lệnh print với f-string ở đây',
            ].join('\n'),
            solutionCode: [
              'ten = input()',
              'diem = float(input())',
              'print(f"Chao {ten}, diem trung binh cua ban la {diem:.2f} !")',
            ].join('\n'),
            tier: 'CO_BAN',
            judgeMode: 'IO_MATCH',
            totalPoints: 100,
            tests: [
              sample(
                'Lan\n8.5\n',
                'Chao Lan, diem trung binh cua ban la 8.50 !\n',
                'Chú ý 8.5 phải hiện thành 8.50 vì yêu cầu đúng 2 chữ số thập phân.',
              ),
              sample(
                'Minh\n7.256\n',
                'Chao Minh, diem trung binh cua ban la 7.26 !\n',
                '7.256 được làm tròn thành 7.26.',
              ),
              hidden('Hoa\n10\n', 'Chao Hoa, diem trung binh cua ban la 10.00 !\n', 20),
              hidden('Nam Anh\n6\n', 'Chao Nam Anh, diem trung binh cua ban la 6.00 !\n', 20),
              hidden('Bao\n9.999\n', 'Chao Bao, diem trung binh cua ban la 10.00 !\n', 30),
              hidden('Kien\n0\n', 'Chao Kien, diem trung binh cua ban la 0.00 !\n', 30),
            ],
          },
          { markdown: 'Bài đầu tiên có chấm điểm tự động. Hãy đọc kỹ mẫu đầu ra trước khi viết.' },
        ),

        /*
         * The ten-rung ladder, spread in at the END of the block list.
         *
         * Order matters for the pedagogical-flow rule: theory → example →
         * playground → challenge already sits above, so the mandated sequence is
         * satisfied before any of these appear. Rungs climb CO_BAN → MO_RONG, so
         * a student on Cơ bản has 1–5 as required work and meets 6–10 as
         * exploration rather than as a wall.
         */
        ...thangBaiTapB06,
      ],
    },

    {
      order: 7,
      slug: 'b07-luyen-tap-may-tinh-bo-tui',
      title: 'Luyện tập tổng hợp: Máy tính bỏ túi mini',
      summary:
        'Ghép tất cả những gì đã học từ buổi 1 đến buổi 6 thành một chương trình hoàn chỉnh có ích.',
      objectives: [
        'Kết hợp `input()`, ép kiểu, toán tử và f-string trong một chương trình',
        'Trình bày kết quả nhiều dòng gọn gàng',
        'Tự kiểm tra chương trình với nhiều bộ dữ liệu khác nhau',
      ],
      difficulty: 2,
      estimatedMinutes: 90,
      status: 'REQUIRED',
      teacherNotes:
        'Buổi luyện tập tổng hợp (⟨derived⟩), chốt lại Lesson 3 trước khi sang cấu trúc điều khiển.',
      blocks: [
        theory(
          'Một chương trình hoàn chỉnh gồm ba phần',
          [
            'Hầu hết chương trình nhỏ đều có cùng một bộ xương:',
            '',
            '1. **Nhập** — lấy dữ liệu vào (`input()`, nhớ ép kiểu)',
            '2. **Xử lý** — tính toán, so sánh',
            '3. **Xuất** — hiển thị kết quả (`print()` với f-string)',
            '',
            'Viết theo đúng ba phần này giúp chương trình dễ đọc và dễ sửa. Khi chương trình sai, ' +
              'em cũng biết ngay nên tìm lỗi ở phần nào.',
          ].join('\n'),
          ['Nhập → Xử lý → Xuất', 'Tách ba phần rõ ràng giúp tìm lỗi nhanh hơn'],
        ),
        example(
          'Máy tính hai số hoàn chỉnh',
          'Đây là mẫu để em dựa vào cho phần thử thách phía dưới.',
          [
            '# --- 1. NHẬP ---',
            'a = float(input("Nhap so thu nhat: "))',
            'b = float(input("Nhap so thu hai: "))',
            '',
            '# --- 2. XU LY ---',
            'tong = a + b',
            'hieu = a - b',
            'tich = a * b',
            '',
            '# --- 3. XUAT ---',
            'print(f"Tong  : {tong:.2f}")',
            'print(f"Hieu  : {hieu:.2f}")',
            'print(f"Tich  : {tich:.2f}")',
          ].join('\n'),
          {
            output: ['Tong  : 12.00', 'Hieu  : 2.00', 'Tich  : 35.00'].join('\n'),
            notes: [
              'Ví dụ trên tương ứng với a = 7 và b = 5.',
              'Phép chia chưa có ở đây vì còn phải xử lý trường hợp chia cho 0 — em sẽ học ở buổi 8.',
            ],
          },
        ),
        playground(
          'Sân chơi: đổi đơn vị',
          [
            'Viết chương trình đổi một số đo từ centimet sang mét và sang inch.',
            '',
            '1 inch = 2.54 cm.',
          ].join('\n'),
          [
            'cm = float(input("Nhap so cm: "))',
            '',
            'met = cm / 100',
            'inch = cm / 2.54',
            '',
            'print(f"{cm} cm = {met:.2f} m")',
            '# Thêm dòng in ra số inch',
          ].join('\n'),
          'Chương trình đổi đúng cm sang cả mét và inch, có định dạng 2 chữ số thập phân.',
        ),
        challenge(
          {
            slug: 'p-b07-chu-vi-dien-tich-hcn',
            title: 'Chu vi và diện tích hình chữ nhật',
            statement: [
              'Đọc **hai dòng**: chiều dài và chiều rộng của một hình chữ nhật (số thực).',
              '',
              'In ra **hai dòng** theo đúng mẫu sau:',
              '',
              '```',
              'Chu vi: <chu_vi>',
              'Dien tich: <dien_tich>',
              '```',
              '',
              'Cả hai kết quả đều hiển thị **đúng 2 chữ số thập phân**.',
              '',
              'Nhắc lại: chu vi = (dài + rộng) × 2, diện tích = dài × rộng.',
            ].join('\n'),
            hints: [
              'Nhớ đặt ngoặc cho phép cộng: `(dai + rong) * 2`.',
              'Dùng `{gia_tri:.2f}` trong f-string cho cả hai dòng.',
            ],
            starterCode: [
              'dai = float(input())',
              'rong = float(input())',
              '',
              '# Tính chu vi và diện tích, rồi in ra hai dòng',
            ].join('\n'),
            solutionCode: [
              'dai = float(input())',
              'rong = float(input())',
              'chu_vi = (dai + rong) * 2',
              'dien_tich = dai * rong',
              'print(f"Chu vi: {chu_vi:.2f}")',
              'print(f"Dien tich: {dien_tich:.2f}")',
            ].join('\n'),
            tier: 'CO_BAN',
            judgeMode: 'IO_MATCH',
            tests: [
              sample(
                '5\n3\n',
                'Chu vi: 16.00\nDien tich: 15.00\n',
                '(5 + 3) × 2 = 16 và 5 × 3 = 15.',
              ),
              sample('2.5\n4\n', 'Chu vi: 13.00\nDien tich: 10.00\n'),
              hidden('10\n10\n', 'Chu vi: 40.00\nDien tich: 100.00\n', 25),
              // Deliberately NOT 1.25 × 0.5. That product is exactly 0.625, and
              // Python's `.2f` rounds half to EVEN, giving 0.62 where a hand
              // calculation says 0.63 — so the natural correct solution was
              // being marked wrong. Buổi 7 teaches rectangles, not IEEE-754.
              hidden('1.25\n0.4\n', 'Chu vi: 3.30\nDien tich: 0.50\n', 25),
              hidden('100\n0.01\n', 'Chu vi: 200.02\nDien tich: 1.00\n', 25),
              hidden('7.777\n3.333\n', 'Chu vi: 22.22\nDien tich: 25.92\n', 25),
            ],
          },
        ),
        challenge(
          {
            slug: 'p-b07-doi-giay-sang-gio-phut-giay',
            title: 'Đổi giây sang giờ : phút : giây',
            statement: [
              'Đọc **một số nguyên** là tổng số giây, rồi đổi thành dạng giờ, phút, giây.',
              '',
              'In ra đúng một dòng theo mẫu:',
              '',
              '```',
              '<gio> gio <phut> phut <giay> giay',
              '```',
              '',
              'Ví dụ 3671 giây = 1 giờ 1 phút 11 giây.',
              '',
              'Gợi ý: đây chính là chỗ dùng `//` và `%` đã học ở buổi 2.',
            ].join('\n'),
            hints: [
              'Số giờ = tổng giây `//` 3600.',
              'Phần còn lại sau khi lấy giờ = tổng giây `%` 3600.',
              'Từ phần còn lại đó, tiếp tục `// 60` và `% 60`.',
            ],
            starterCode: [
              'tong_giay = int(input())',
              '',
              '# Tách thành giờ, phút, giây bằng // và %',
            ].join('\n'),
            solutionCode: [
              'tong_giay = int(input())',
              'gio = tong_giay // 3600',
              'con_lai = tong_giay % 3600',
              'phut = con_lai // 60',
              'giay = con_lai % 60',
              'print(f"{gio} gio {phut} phut {giay} giay")',
            ].join('\n'),
            tier: 'THU_THACH',
            judgeMode: 'IO_MATCH',
            tests: [
              sample('3671\n', '1 gio 1 phut 11 giay\n', '3671 = 3600 + 60 + 11.'),
              sample('59\n', '0 gio 0 phut 59 giay\n', 'Chưa đủ một phút nên giờ và phút đều là 0.'),
              hidden('0\n', '0 gio 0 phut 0 giay\n', 20),
              hidden('3600\n', '1 gio 0 phut 0 giay\n', 20),
              hidden('86399\n', '23 gio 59 phut 59 giay\n', 30),
              hidden('7325\n', '2 gio 2 phut 5 giay\n', 30),
            ],
          },
          { markdown: 'Thử thách nâng nhẹ độ khó — kết hợp `//` và `%` hai lần liên tiếp.' },
        ),
      ],
    },
  ],
};
