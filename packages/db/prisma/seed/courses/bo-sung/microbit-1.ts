/**
 * Expansion pack — Micro:bit Cơ Bản, sessions 2–16.
 *
 * Every task here is `MICROBIT_WORKSPACE`, and `microbitTask` stamps
 * `judgeMode: 'MAKECODE'` onto each one. Rule M6 in assertions.ts fails the seed
 * if any Micro:bit problem arrives with a different mode: the behaviour of these
 * programs is light on a physical LED matrix, and handing one to the Python
 * judge would mark it wrong for printing nothing to stdout.
 *
 * So these carry a reference solution and no test cases — the solution is what a
 * teacher reads the student's blocks against, and `assertProblemsAreTestable`
 * requires it precisely because a task nobody has solved is a task nobody has
 * checked is solvable.
 */
import { microbitTask } from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungMicrobit1: BoSungKhoaHoc = {
  'mb-b02-show-icon-va-pause': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b02-ba-bieu-tuong',
          title: 'Ba biểu tượng nối tiếp',
          statement: [
            'Hiện lần lượt **ba biểu tượng khác nhau**, mỗi cái dừng **1 giây**,',
            'rồi xoá màn hình.',
            '',
            '**Yêu cầu:**',
            '',
            '1. Hiện `IconNames.Heart`, chờ 1 giây',
            '2. Hiện `IconNames.Happy`, chờ 1 giây',
            '3. Hiện `IconNames.Yes`, chờ 1 giây',
            '4. Xoá màn hình bằng `basic.clearScreen()`',
          ].join('\n'),
          hints: ['1 giây = 1000 mili giây.', 'Các khối chạy lần lượt từ trên xuống.'],
          solutionCode: [
            'basic.showIcon(IconNames.Heart)',
            'basic.pause(1000)',
            'basic.showIcon(IconNames.Happy)',
            'basic.pause(1000)',
            'basic.showIcon(IconNames.Yes)',
            'basic.pause(1000)',
            'basic.clearScreen()',
          ].join('\n'),
          totalPoints: 100,
        },
        {
          goal: 'Ba biểu tượng hiện nối tiếp nhau, mỗi cái 1 giây, rồi màn hình tắt.',
          khoiLenh: ['show icon', 'pause', 'clearScreen'],
        },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b02-hien-ten-em',
          title: 'Hiện tên của em',
          statement: [
            'Dùng khối `show string` để chạy tên em qua màn hình LED,',
            'chờ 1 giây, rồi hiện một biểu tượng em thích.',
            '',
            'Chương trình chạy **một lần**.',
          ].join('\n'),
          hints: ['`basic.showString("...")` chạy chữ từ phải sang trái.', 'Chữ càng dài càng lâu chạy hết.'],
          solutionCode: [
            'basic.showString("Lan")',
            'basic.pause(1000)',
            'basic.showIcon(IconNames.Heart)',
          ].join('\n'),
          totalPoints: 100,
        },
        {
          goal: 'Tên chạy qua màn hình, rồi một biểu tượng hiện lên.',
          khoiLenh: ['show string', 'pause', 'show icon'],
        },
      ),
    ],
  },

  'mb-b03-forever': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b03-den-nhap-nhay',
          title: 'Đèn nhấp nháy không dừng',
          statement: [
            'Cho một biểu tượng **nhấp nháy mãi**: hiện lên 0,5 giây rồi tắt 0,5 giây.',
            '',
            'Dùng khối `forever`.',
          ].join('\n'),
          hints: ['Bên trong forever: hiện → chờ → xoá → chờ.', 'Nửa giây là 500 mili giây.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showIcon(IconNames.Heart)',
            '    basic.pause(500)',
            '    basic.clearScreen()',
            '    basic.pause(500)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Biểu tượng nhấp nháy đều đặn, không bao giờ dừng.', khoiLenh: ['forever', 'show icon', 'pause', 'clearScreen'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b03-dong-ho-dem',
          title: 'Đếm 1, 2, 3 lặp lại',
          statement: [
            'Cho board hiện lần lượt các số **1, 2, 3**, mỗi số 1 giây, rồi lặp lại mãi.',
          ].join('\n'),
          hints: ['`basic.showNumber(1)` hiện một con số.', 'Cả ba số nằm trong cùng một khối forever.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showNumber(1)',
            '    basic.pause(1000)',
            '    basic.showNumber(2)',
            '    basic.pause(1000)',
            '    basic.showNumber(3)',
            '    basic.pause(1000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Ba con số hiện lần lượt và lặp lại không dừng.', khoiLenh: ['forever', 'show number', 'pause'] },
      ),
    ],
  },

  'mb-b04-tong-hop-bang-hieu': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b04-bang-hieu-lop',
          title: 'Bảng hiệu của lớp',
          statement: [
            'Làm một bảng hiệu chạy mãi: hiện tên lớp, rồi một biểu tượng, rồi lặp lại.',
            '',
            '**Yêu cầu:** dùng `forever`, `show string`, `show icon` và `pause`.',
          ].join('\n'),
          hints: ['Đặt tất cả vào trong forever để bảng hiệu không tắt.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showString("7A1")',
            '    basic.showIcon(IconNames.Yes)',
            '    basic.pause(1000)',
            '    basic.clearScreen()',
            '    basic.pause(500)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Bảng hiệu lặp mãi: tên lớp, biểu tượng, nghỉ một nhịp.', khoiLenh: ['forever', 'show string', 'show icon', 'pause'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b04-hoat-anh-trai-tim',
          title: 'Trái tim đập',
          statement: [
            'Cho trái tim **đập** như nhịp tim: đổi qua lại giữa `IconNames.Heart`',
            'và `IconNames.SmallHeart`, mỗi khung 300 mili giây, lặp mãi.',
          ].join('\n'),
          hints: ['Hai khung hình đổi nhanh sẽ trông như đang chuyển động.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showIcon(IconNames.Heart)',
            '    basic.pause(300)',
            '    basic.showIcon(IconNames.SmallHeart)',
            '    basic.pause(300)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Trái tim to nhỏ luân phiên, trông như đang đập.', khoiLenh: ['forever', 'show icon', 'pause'] },
      ),
    ],
  },

  'mb-b05-nut-a-nut-b': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b05-hai-nut-hai-icon',
          title: 'Mỗi nút một biểu tượng',
          statement: [
            'Bấm **nút A** thì hiện mặt cười. Bấm **nút B** thì hiện mặt khóc.',
            '',
            'Dùng hai khối `on button pressed` riêng biệt.',
          ].join('\n'),
          hints: ['`input.onButtonPressed(Button.A, ...)` chờ nút A.', 'Mỗi nút cần một khối riêng.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showIcon(IconNames.Happy)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    basic.showIcon(IconNames.Sad)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Nút A cho mặt cười, nút B cho mặt khóc.', khoiLenh: ['on button pressed', 'show icon'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b05-nut-hien-chu',
          title: 'Nút A chào, nút B tạm biệt',
          statement: [
            'Bấm **nút A** thì chạy chữ `Xin chao`.',
            'Bấm **nút B** thì chạy chữ `Tam biet`, rồi xoá màn hình.',
          ].join('\n'),
          hints: ['`basic.showString` chạy chữ qua màn hình.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showString("Xin chao")',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    basic.showString("Tam biet")',
            '    basic.clearScreen()',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Hai nút cho hai lời nhắn khác nhau.', khoiLenh: ['on button pressed', 'show string', 'clearScreen'] },
      ),
    ],
  },

  'mb-b06-bam-ca-hai-nut': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b06-ba-lua-chon',
          title: 'A, B và cả hai',
          statement: [
            'Ba trường hợp, ba kết quả khác nhau:',
            '',
            '- nút **A**: hiện số `1`',
            '- nút **B**: hiện số `2`',
            '- bấm **cả hai** cùng lúc: hiện `IconNames.Yes`',
          ].join('\n'),
          hints: ['`Button.AB` là khối dành cho việc bấm cả hai nút.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(1)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    basic.showNumber(2)',
            '})',
            'input.onButtonPressed(Button.AB, function () {',
            '    basic.showIcon(IconNames.Yes)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Ba cách bấm cho ba kết quả riêng.', khoiLenh: ['on button pressed', 'show number', 'show icon'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b06-xoa-bang-hai-nut',
          title: 'Bấm cả hai để xoá',
          statement: [
            'Nút **A** hiện trái tim. Nút **B** hiện mặt cười.',
            'Bấm **cả hai** thì xoá sạch màn hình.',
          ].join('\n'),
          hints: ['`basic.clearScreen()` tắt hết đèn LED.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showIcon(IconNames.Heart)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    basic.showIcon(IconNames.Happy)',
            '})',
            'input.onButtonPressed(Button.AB, function () {',
            '    basic.clearScreen()',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Hai nút vẽ, bấm cả hai thì xoá.', khoiLenh: ['on button pressed', 'show icon', 'clearScreen'] },
      ),
    ],
  },

  'mb-b07-lac-va-nghieng': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b07-lac-ra-icon',
          title: 'Lắc là đổi hình',
          statement: [
            'Khi board bị **lắc**, hiện `IconNames.Surprised` trong 1 giây rồi xoá màn hình.',
          ].join('\n'),
          hints: ['`input.onGesture(Gesture.Shake, ...)` bắt cử chỉ lắc.'],
          solutionCode: [
            'input.onGesture(Gesture.Shake, function () {',
            '    basic.showIcon(IconNames.Surprised)',
            '    basic.pause(1000)',
            '    basic.clearScreen()',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Lắc board thì một biểu tượng hiện lên rồi tắt.', khoiLenh: ['on gesture', 'show icon', 'pause', 'clearScreen'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b07-nghieng-trai-phai',
          title: 'Nghiêng trái, nghiêng phải',
          statement: [
            'Nghiêng board **sang trái** thì hiện mũi tên trái.',
            'Nghiêng **sang phải** thì hiện mũi tên phải.',
          ].join('\n'),
          hints: ['`Gesture.TiltLeft` và `Gesture.TiltRight`.', '`basic.showArrow(ArrowNames.West)` là mũi tên sang trái.'],
          solutionCode: [
            'input.onGesture(Gesture.TiltLeft, function () {',
            '    basic.showArrow(ArrowNames.West)',
            '})',
            'input.onGesture(Gesture.TiltRight, function () {',
            '    basic.showArrow(ArrowNames.East)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Mũi tên chỉ đúng hướng em nghiêng board.', khoiLenh: ['on gesture', 'show arrow'] },
      ),
    ],
  },

  'mb-b08-anh-sang-va-nhiet-do': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b08-hien-nhiet-do',
          title: 'Nhiệt kế mini',
          statement: [
            'Cho board hiện **nhiệt độ** hiện tại, cập nhật liên tục.',
            '',
            'Dùng `forever` và `input.temperature()`.',
          ].join('\n'),
          hints: ['`input.temperature()` trả về một số (độ C).', 'Nhớ `pause` để số kịp đọc.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showNumber(input.temperature())',
            '    basic.pause(2000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Nhiệt độ hiện lên và cập nhật đều đặn.', khoiLenh: ['forever', 'temperature', 'show number', 'pause'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b08-do-sang',
          title: 'Đo độ sáng',
          statement: [
            'Bấm **nút A** thì hiện **mức ánh sáng** đang đo được.',
            '',
            'Giá trị nằm trong khoảng 0 đến 255.',
          ].join('\n'),
          hints: ['`input.lightLevel()` trả về mức sáng.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(input.lightLevel())',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Bấm nút là biết phòng đang sáng hay tối.', khoiLenh: ['on button pressed', 'light level', 'show number'] },
      ),
    ],
  },

  'mb-b09-du-an-den-ngu': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b09-den-tu-dong',
          title: 'Đèn tự bật khi trời tối',
          statement: [
            'Khi mức ánh sáng **nhỏ hơn 50**, bật cả màn hình LED cho sáng.',
            'Khi sáng trở lại, tắt màn hình.',
            '',
            'Chương trình chạy liên tục.',
          ].join('\n'),
          hints: ['Dùng `if ... else` bên trong `forever`.', '`basic.showIcon(IconNames.Square)` bật gần hết đèn.'],
          solutionCode: [
            'basic.forever(function () {',
            '    if (input.lightLevel() < 50) {',
            '        basic.showIcon(IconNames.Square)',
            '    } else {',
            '        basic.clearScreen()',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đèn tự bật khi tối và tự tắt khi sáng.', khoiLenh: ['forever', 'light level', 'if', 'show icon', 'clearScreen'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b09-bao-nong',
          title: 'Báo khi trời nóng',
          statement: [
            'Khi nhiệt độ **lớn hơn 30**, hiện `IconNames.Angry`.',
            'Ngược lại hiện `IconNames.Happy`.',
          ].join('\n'),
          hints: ['So sánh `input.temperature() > 30`.'],
          solutionCode: [
            'basic.forever(function () {',
            '    if (input.temperature() > 30) {',
            '        basic.showIcon(IconNames.Angry)',
            '    } else {',
            '        basic.showIcon(IconNames.Happy)',
            '    }',
            '    basic.pause(1000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board đổi mặt theo nhiệt độ trong phòng.', khoiLenh: ['forever', 'temperature', 'if', 'show icon'] },
      ),
    ],
  },

  'mb-b10-bien-dau-tien': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b10-bien-diem',
          title: 'Biến điểm số',
          statement: [
            'Tạo một biến `diem` bắt đầu từ 0.',
            'Mỗi lần bấm **nút A**, cộng thêm 10 rồi hiện giá trị mới.',
          ].join('\n'),
          hints: ['Khai báo biến ở ngoài, trước mọi khối sự kiện.', '`diem = diem + 10` cập nhật giá trị.'],
          solutionCode: [
            'let diem = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    diem = diem + 10',
            '    basic.showNumber(diem)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Điểm tăng thêm 10 sau mỗi lần bấm.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b10-dat-lai-bien',
          title: 'Đặt lại về 0',
          statement: [
            'Giống bài trước, nhưng thêm: bấm **nút B** thì đặt `diem` trở về 0 và hiện lên.',
          ].join('\n'),
          hints: ['Gán thẳng `diem = 0`.'],
          solutionCode: [
            'let diem = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    diem = diem + 10',
            '    basic.showNumber(diem)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    diem = 0',
            '    basic.showNumber(diem)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Nút A cộng điểm, nút B xoá về 0.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
    ],
  },

  'mb-b11-may-dem': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b11-dem-len-xuong',
          title: 'Đếm lên và đếm xuống',
          statement: [
            'Nút **A** cộng 1, nút **B** trừ 1, và luôn hiện giá trị hiện tại.',
          ].join('\n'),
          hints: ['Một biến duy nhất, hai khối sự kiện thay đổi nó.'],
          solutionCode: [
            'let dem = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    dem = dem + 1',
            '    basic.showNumber(dem)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    dem = dem - 1',
            '    basic.showNumber(dem)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Số đếm lên xuống theo nút em bấm.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b11-dem-lac',
          title: 'Đếm số lần lắc',
          statement: [
            'Mỗi lần board bị **lắc**, tăng biến đếm thêm 1 và hiện lên.',
            'Bấm **nút A** để xem tổng số lần đã lắc.',
          ].join('\n'),
          hints: ['`Gesture.Shake` cho sự kiện lắc.'],
          solutionCode: [
            'let solan = 0',
            'input.onGesture(Gesture.Shake, function () {',
            '    solan = solan + 1',
            '    basic.showNumber(solan)',
            '})',
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(solan)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board đếm được số lần em lắc nó.', khoiLenh: ['variable', 'on gesture', 'show number'] },
      ),
    ],
  },

  'mb-b12-phep-tinh': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b12-nhan-doi',
          title: 'Nhân đôi mỗi lần bấm',
          statement: [
            'Biến `so` bắt đầu từ 1. Mỗi lần bấm **nút A**, nhân đôi giá trị rồi hiện lên.',
          ].join('\n'),
          hints: ['`so = so * 2`.'],
          solutionCode: [
            'let so = 1',
            'input.onButtonPressed(Button.A, function () {',
            '    so = so * 2',
            '    basic.showNumber(so)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: '1, 2, 4, 8, 16… mỗi lần bấm một bước.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b12-tinh-trung-binh',
          title: 'Cộng rồi chia',
          statement: [
            'Đặt hai biến `a = 12` và `b = 8`.',
            'Bấm **nút A** thì hiện tổng, bấm **nút B** thì hiện trung bình cộng của hai số.',
          ].join('\n'),
          hints: ['Trung bình cộng là `(a + b) / 2`.'],
          solutionCode: [
            'let a = 12',
            'let b = 8',
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(a + b)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    basic.showNumber((a + b) / 2)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board tính được tổng và trung bình của hai số.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
    ],
  },

  'mb-b13-so-ngau-nhien': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b13-xuc-xac',
          title: 'Con xúc xắc',
          statement: [
            'Khi **lắc** board, hiện một số ngẫu nhiên từ **1 đến 6**.',
          ].join('\n'),
          hints: ['`randint(1, 6)` cho số ngẫu nhiên trong khoảng đó.', 'Bao gồm cả 1 và 6.'],
          solutionCode: [
            'input.onGesture(Gesture.Shake, function () {',
            '    basic.showNumber(randint(1, 6))',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Lắc board là ra một mặt xúc xắc.', khoiLenh: ['on gesture', 'random', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b13-chon-ngau-nhien-icon',
          title: 'Bốc thăm biểu tượng',
          statement: [
            'Bấm **nút A** thì hiện ngẫu nhiên một trong hai biểu tượng:',
            'mặt cười hoặc mặt khóc.',
          ].join('\n'),
          hints: ['Bốc một số 0 hoặc 1 rồi dùng `if ... else`.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    if (randint(0, 1) == 0) {',
            '        basic.showIcon(IconNames.Happy)',
            '    } else {',
            '        basic.showIcon(IconNames.Sad)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Mỗi lần bấm là một kết quả may rủi.', khoiLenh: ['on button pressed', 'random', 'if', 'show icon'] },
      ),
    ],
  },

  'mb-b14-du-an-may-dem-buoc': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b14-dem-buoc',
          title: 'Máy đếm bước chân',
          statement: [
            'Mỗi lần board bị lắc (một bước chân), tăng biến `buoc` thêm 1.',
            'Bấm **nút A** để xem tổng số bước, bấm **nút B** để đặt lại về 0.',
          ].join('\n'),
          hints: ['Ba khối sự kiện cùng dùng chung một biến.'],
          solutionCode: [
            'let buoc = 0',
            'input.onGesture(Gesture.Shake, function () {',
            '    buoc = buoc + 1',
            '})',
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(buoc)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    buoc = 0',
            '    basic.showIcon(IconNames.Yes)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đeo board đi bộ, bấm A là biết đi được bao nhiêu bước.', khoiLenh: ['variable', 'on gesture', 'on button pressed', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b14-muc-tieu-buoc',
          title: 'Báo khi đạt mục tiêu',
          statement: [
            'Giống máy đếm bước, nhưng khi số bước đạt **20**,',
            'board tự hiện `IconNames.Yes` để chúc mừng.',
          ].join('\n'),
          hints: ['Kiểm tra điều kiện ngay sau khi tăng biến.'],
          solutionCode: [
            'let buoc = 0',
            'input.onGesture(Gesture.Shake, function () {',
            '    buoc = buoc + 1',
            '    if (buoc == 20) {',
            '        basic.showIcon(IconNames.Yes)',
            '    }',
            '})',
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showNumber(buoc)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board tự chúc mừng khi em đi đủ 20 bước.', khoiLenh: ['variable', 'on gesture', 'if', 'show icon'] },
      ),
    ],
  },

  'mb-b15-neu-thi': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b15-neu-lon-hon',
          title: 'Nếu lớn hơn thì báo',
          statement: [
            'Biến `diem` tăng thêm 1 mỗi lần bấm **nút A**.',
            'Khi `diem` **lớn hơn 5**, hiện `IconNames.Yes`.',
          ].join('\n'),
          hints: ['Khối `if` không cần `else` nếu chỉ có một việc cần làm.'],
          solutionCode: [
            'let diem = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    diem = diem + 1',
            '    basic.showNumber(diem)',
            '    if (diem > 5) {',
            '        basic.showIcon(IconNames.Yes)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board chỉ chúc mừng khi vượt mốc 5.', khoiLenh: ['variable', 'if', 'on button pressed'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b15-canh-bao-toi',
          title: 'Chỉ báo khi quá tối',
          statement: [
            'Mỗi giây, nếu mức ánh sáng **nhỏ hơn 20**, hiện `IconNames.Asleep`.',
            '',
            'Nếu không tối thì không làm gì cả.',
          ].join('\n'),
          hints: ['Bài này chỉ cần `if`, không cần `else`.'],
          solutionCode: [
            'basic.forever(function () {',
            '    if (input.lightLevel() < 20) {',
            '        basic.showIcon(IconNames.Asleep)',
            '    }',
            '    basic.pause(1000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board chỉ phản ứng khi phòng thật sự tối.', khoiLenh: ['forever', 'if', 'light level', 'show icon'] },
      ),
    ],
  },

  'mb-b16-neu-khong-thi': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b16-chan-le-microbit',
          title: 'Chẵn hay lẻ trên board',
          statement: [
            'Bấm **nút A** để bốc một số ngẫu nhiên từ 1 đến 20.',
            'Nếu số đó chẵn, hiện `IconNames.Yes`; ngược lại hiện `IconNames.No`.',
          ].join('\n'),
          hints: ['`so % 2 == 0` nghĩa là chia hết cho 2.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    let so = randint(1, 20)',
            '    basic.showNumber(so)',
            '    if (so % 2 == 0) {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else {',
            '        basic.showIcon(IconNames.No)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board bốc số rồi nói cho em biết chẵn hay lẻ.', khoiLenh: ['on button pressed', 'random', 'if', 'show icon'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b16-nong-hay-lanh',
          title: 'Nóng hay lạnh',
          statement: [
            'Liên tục kiểm tra nhiệt độ.',
            '',
            'Từ **25 độ trở lên** hiện `IconNames.Angry`, dưới 25 hiện `IconNames.Asleep`.',
          ].join('\n'),
          hints: ['Hai nhánh loại trừ nhau — đúng chỗ dùng `if ... else`.'],
          solutionCode: [
            'basic.forever(function () {',
            '    if (input.temperature() >= 25) {',
            '        basic.showIcon(IconNames.Angry)',
            '    } else {',
            '        basic.showIcon(IconNames.Asleep)',
            '    }',
            '    basic.pause(2000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board luôn cho biết đang nóng hay mát.', khoiLenh: ['forever', 'temperature', 'if', 'show icon'] },
      ),
    ],
  },
};
