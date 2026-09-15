/**
 * Buổi 5, phần bổ sung cho lớp 5: robot và phép so sánh.
 *
 * ── Two tracks, one lesson ───────────────────────────────────────────────────
 * The blocks here are added to Buổi 5 after its existing content. The first
 * three are CO_BAN — short theory, one example, one fill-in-the-blank — and
 * every student gets them. The last is THU_THACH: under STRICT branching a
 * Cơ bản student never sees it, and a student on a higher track sees it once,
 * at the end, after everything core.
 *
 * ── Written for a ten-year-old ───────────────────────────────────────────────
 * Sentences are short. Every idea has a robot in it — a battery, a light, a
 * clear path — because "pin dưới 20%" is a thing a child has felt, and
 * "biểu thức boolean" is not. The challenge asks for exactly ONE character to
 * change: the function, the variables and the whole program are given, and
 * the student replaces `???` with a comparison sign.
 */
import { challenge, dienKhuyet, example, fillBlankBlock, hidden, sample, theory } from '../builders.ts';

import type { BlockSpec } from '../types.ts';

export const khoiRobotB05: BlockSpec[] = [
  // ── Cơ bản ────────────────────────────────────────────────────────────────
  theory(
    'Robot quyết định bằng phép so sánh',
    [
      'Robot có **pin**. Trước khi chạy, robot phải hỏi một câu:',
      '',
      '> *"Pin của mình có ít hơn 20% không?"*',
      '',
      'Trong Python, câu hỏi đó viết là `pin < 20`. Máy trả lời bằng **một trong hai chữ**: ' +
        '`True` (đúng) hoặc `False` (sai).',
      '',
      'Ba dấu so sánh em dùng nhiều nhất:',
      '',
      '| Dấu | Đọc là | Ví dụ với `pin = 35` | Máy trả lời |',
      '|---|---|---|---|',
      '| `<` | nhỏ hơn | `pin < 20` | `False` |',
      '| `>` | lớn hơn | `pin > 20` | `True` |',
      '| `==` | bằng | `pin == 35` | `True` |',
      '',
      '**Cẩn thận:** `=` là *gán* (cho pin bằng 35). `==` mới là *hỏi* (pin có bằng 35 không?).',
      '',
      'Đôi khi robot phải hỏi **hai câu** cùng lúc. Robot băng qua đường khi ' +
        '**đèn xanh VÀ đường trống**:',
      '',
      '- `and` — **cả hai** phải đúng. `den_xanh and duong_trong`',
      '- `or` — **một trong hai** đúng là được. `co_pin or dang_sac`',
    ],
    [
      'Dấu so sánh (`<`, `>`, `==`) cho ra `True` hoặc `False`.',
      '`=` là gán, `==` là hỏi bằng nhau.',
      '`and` cần cả hai đúng; `or` chỉ cần một.',
    ],
    { tier: 'CO_BAN', minutes: 8 },
  ),

  example(
    'Robot đọc pin rồi tự trả lời',
    'Chạy thử đoạn này. Em đoán trước xem máy in `True` hay `False` ở mỗi dòng nhé.',
    [
      'pin = 35',
      '',
      'print(pin < 20)                 # pin có ít hơn 20 không?',
      'print(pin > 20)                 # pin có nhiều hơn 20 không?',
      'print(pin == 35)                # pin có đúng bằng 35 không?',
      'print(pin >= 20 and pin <= 50)  # pin có nằm trong khoảng 20–50 không?',
    ].join('\n'),
    {
      output: ['False', 'True', 'True', 'True'].join('\n'),
      notes: [
        'Dòng cuối hỏi hai câu bằng `and`: pin ≥ 20 **và** pin ≤ 50. Cả hai đúng nên máy in `True`.',
        'Thử đổi `pin = 35` thành `pin = 10` rồi chạy lại — dòng nào đổi kết quả?',
      ],
      tier: 'CO_BAN',
      minutes: 7,
    },
  ),

  fillBlankBlock(
    {
      slug: 'dk-b05-robot-so-sanh',
      title: 'Điền khuyết: robot và phép so sánh',
      description: 'Năm chỗ trống. Gõ không dấu cũng được.',
      tier: 'CO_BAN',
      passingScore: 60,
      questions: [
        dienKhuyet(
          'Điền True hoặc False.',
          'Robot có `pin = 15`. Câu hỏi `pin < 20` được máy trả lời là ___ .',
          ['True', 'true', 'đúng', 'dung'],
          { explanation: '15 nhỏ hơn 20, nên câu hỏi "pin có nhỏ hơn 20 không?" là đúng → `True`.' },
        ),
        dienKhuyet(
          'Điền một dấu.',
          'Muốn HỎI hai số có bằng nhau không, em dùng dấu ___ .',
          ['==', '= ='],
          { explanation: 'Hai dấu bằng liền nhau. Một dấu `=` là gán, không phải hỏi.', matchMode: 'exact' },
        ),
        dienKhuyet(
          'Điền một số.',
          'Robot có 7 viên pin, chia đều cho 2 ngăn. `7 % 2` cho biết số pin còn dư là ___ .',
          ['1', 'một', 'mot'],
          { explanation: '`%` là phép chia lấy DƯ. 7 chia 2 được 3 ngăn đầy, dư 1 viên.' },
        ),
        dienKhuyet(
          'Điền True hoặc False.',
          'Đèn xanh (`True`) nhưng đường KHÔNG trống (`False`). `True and False` cho kết quả ___ .',
          ['False', 'false', 'sai'],
          { explanation: '`and` cần CẢ HAI đúng. Đường không trống, nên robot chưa được đi.' },
        ),
        dienKhuyet(
          'Điền True hoặc False.',
          'Robot chạy được khi có pin HOẶC đang cắm sạc. Có pin (`True`), chưa cắm sạc (`False`). ' +
            '`True or False` cho kết quả ___ .',
          ['True', 'true', 'đúng', 'dung'],
          { explanation: '`or` chỉ cần MỘT vế đúng. Có pin là đủ để chạy.' },
        ),
      ],
    },
    { minutes: 10 },
  ),

  // ── Thử thách ─────────────────────────────────────────────────────────────
  challenge(
    {
      slug: 'p-b05-robot-kiem-tra-pin',
      title: 'Robot kiểm tra pin',
      statement: [
        'Robot đọc mức pin từ cảm biến — một số nguyên từ `0` đến `100`.',
        '',
        'Nếu pin **dưới 20**, robot phải quay về trạm và in `SAC`. Ngược lại, robot tiếp tục ' +
          'làm việc và in `CHAY`.',
        '',
        '**Đầu vào.** Một dòng chứa mức pin.',
        '',
        '**Đầu ra.** Một dòng: `SAC` hoặc `CHAY`.',
        '',
        'Chương trình đã viết gần xong. Em chỉ cần sửa **đúng một chỗ**: thay `???` trong hàm ' +
          '`can_sac` bằng dấu so sánh phù hợp.',
      ].join('\n'),
      hints: [
        '"Dưới 20" nghĩa là **nhỏ hơn** 20.',
        'Ba dấu em có thể chọn: `<`, `>`, `==`. Chỉ một dấu đúng.',
        'Bấm **Chạy thử** với đầu vào `15` — nếu in `SAC` là đúng rồi.',
      ],
      starterCode: [
        'def can_sac(pin):',
        '    """',
        '    Robot cần sạc khi pin DƯỚI 20%.',
        '    Trả về True nếu cần sạc, False nếu chưa cần.',
        '',
        '    Em chỉ cần sửa MỘT chỗ: thay ??? bằng dấu so sánh đúng (<, > hoặc ==).',
        '    """',
        '    return pin ??? 20',
        '',
        '',
        '# ── Phần dưới đã viết sẵn, em không cần sửa ──────────────────────',
        'pin = int(input())',
        '',
        'if can_sac(pin):',
        '    print("SAC")',
        'else:',
        '    print("CHAY")',
      ].join('\n'),
      solutionCode: [
        'def can_sac(pin):',
        '    return pin < 20',
        '',
        '',
        'pin = int(input())',
        '',
        'if can_sac(pin):',
        '    print("SAC")',
        'else:',
        '    print("CHAY")',
      ].join('\n'),
      tier: 'THU_THACH',
      judgeMode: 'IO_MATCH',
      totalPoints: 100,
      tests: [
        sample('15\n', 'SAC\n', 'Pin 15 là dưới 20 → robot phải về sạc.'),
        sample('35\n', 'CHAY\n', 'Pin 35 không dưới 20 → robot chạy tiếp.'),
        hidden('19\n', 'SAC\n', 20),
        hidden('20\n', 'CHAY\n', 30),
        hidden('0\n', 'SAC\n', 20),
        hidden('100\n', 'CHAY\n', 30),
      ],
    },
    {
      title: 'Thử thách: Robot kiểm tra pin',
      markdown:
        'Bài này dành cho lộ trình **Thử thách**. Cả chương trình đã có sẵn — em chỉ đổi một dấu.',
      minutes: 12,
    },
  ),
];
