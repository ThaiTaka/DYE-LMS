/**
 * Expansion pack — Micro:bit Cơ Bản, sessions 17–30.
 *
 * Sessions 28–30 are the final project. The tasks there are deliberately
 * scaffolding rather than new syntax: a checklist program, a self-test routine
 * and a demo mode. A student at session 28 has chosen their own topic, so an
 * exercise that dictates what to build would cut across the thing the sessions
 * are for — what they still need is a way to prove the thing works in front of
 * the class.
 */
import { microbitTask } from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungMicrobit2: BoSungKhoaHoc = {
  'mb-b17-so-sanh': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b17-trong-khoang',
          title: 'Nằm trong khoảng an toàn',
          statement: [
            'Bấm **nút A** để bốc một số ngẫu nhiên từ 0 đến 100.',
            '',
            'Nếu số đó **từ 40 đến 60** thì hiện `IconNames.Yes`, ngược lại hiện `IconNames.No`.',
          ].join('\n'),
          hints: ['Ghép hai điều kiện bằng `&&`.', '“Từ 40 đến 60” là `so >= 40 && so <= 60`.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    let so = randint(0, 100)',
            '    basic.showNumber(so)',
            '    if (so >= 40 && so <= 60) {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else {',
            '        basic.showIcon(IconNames.No)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board nhận ra số có nằm trong khoảng giữa hay không.', khoiLenh: ['on button pressed', 'random', 'if', 'logic'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b17-toi-hoac-nong',
          title: 'Tối hoặc nóng thì báo',
          statement: [
            'Liên tục kiểm tra: nếu **tối** (ánh sáng dưới 30) **hoặc** **nóng** (trên 30 độ)',
            'thì hiện `IconNames.Surprised`. Ngược lại xoá màn hình.',
          ].join('\n'),
          hints: ['`||` là “hoặc” — chỉ cần một vế đúng là đủ.'],
          solutionCode: [
            'basic.forever(function () {',
            '    if (input.lightLevel() < 30 || input.temperature() > 30) {',
            '        basic.showIcon(IconNames.Surprised)',
            '    } else {',
            '        basic.clearScreen()',
            '    }',
            '    basic.pause(1000)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một cảnh báo chung cho hai tình huống khác nhau.', khoiLenh: ['forever', 'if', 'logic', 'light level', 'temperature'] },
      ),
    ],
  },

  'mb-b18-vong-lap-repeat': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b18-nhap-nhay-5-lan',
          title: 'Nhấp nháy đúng 5 lần',
          statement: [
            'Cho trái tim nhấp nháy **đúng 5 lần** rồi dừng hẳn.',
            '',
            'Dùng khối `repeat` chứ không dùng `forever`.',
          ].join('\n'),
          hints: ['`for (let i = 0; i < 5; i++)` lặp đúng 5 lần.', 'Sau vòng lặp, chương trình dừng lại.'],
          solutionCode: [
            'for (let i = 0; i < 5; i++) {',
            '    basic.showIcon(IconNames.Heart)',
            '    basic.pause(300)',
            '    basic.clearScreen()',
            '    basic.pause(300)',
            '}',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đúng 5 nhịp nháy rồi màn hình im lặng.', khoiLenh: ['repeat', 'show icon', 'pause', 'clearScreen'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b18-dem-1-den-10',
          title: 'Đếm từ 1 đến 10',
          statement: [
            'Bấm **nút A** để board hiện lần lượt các số từ **1 đến 10**,',
            'mỗi số dừng nửa giây.',
          ].join('\n'),
          hints: ['Cho biến chạy `i` từ 1 tới 10.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    for (let i = 1; i <= 10; i++) {',
            '        basic.showNumber(i)',
            '        basic.pause(500)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board đếm một mạch từ 1 tới 10.', khoiLenh: ['repeat', 'show number', 'pause'] },
      ),
    ],
  },

  'mb-b19-vong-lap-while': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b19-dem-nguoc-while',
          title: 'Đếm ngược bằng while',
          statement: [
            'Bấm **nút A** để đếm ngược từ **5 về 1**, mỗi số nửa giây,',
            'rồi hiện `IconNames.Yes`.',
            '',
            'Dùng vòng lặp `while`.',
          ].join('\n'),
          hints: ['Bắt đầu với một biến bằng 5 và giảm dần.', 'Điều kiện lặp: còn lớn hơn 0.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    let n = 5',
            '    while (n > 0) {',
            '        basic.showNumber(n)',
            '        basic.pause(500)',
            '        n = n - 1',
            '    }',
            '    basic.showIcon(IconNames.Yes)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đếm ngược rồi báo hiệu hết giờ.', khoiLenh: ['while', 'variable', 'show number', 'show icon'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b19-cho-den-khi-sang',
          title: 'Chờ cho tới khi có ánh sáng',
          statement: [
            'Khi bấm **nút A**, board hiện `IconNames.Asleep` và **chờ trong khi phòng còn tối**',
            '(ánh sáng dưới 50). Khi đủ sáng thì hiện `IconNames.Happy`.',
          ].join('\n'),
          hints: ['`while` lặp chừng nào điều kiện còn đúng.', 'Nhớ `pause` bên trong để board không quay quá nhanh.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showIcon(IconNames.Asleep)',
            '    while (input.lightLevel() < 50) {',
            '        basic.pause(200)',
            '    }',
            '    basic.showIcon(IconNames.Happy)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board ngủ cho tới khi em bật đèn lên.', khoiLenh: ['while', 'light level', 'show icon'] },
      ),
    ],
  },

  'mb-b20-du-an-tro-choi-doan-so': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b20-doan-so-microbit',
          title: 'Trò chơi đoán số',
          statement: [
            'Board bốc một số bí mật từ 1 đến 10.',
            '',
            'Nút **A** tăng số em đoán, nút **B** chốt đáp án:',
            'đúng thì `IconNames.Yes`, sai thì `IconNames.No` rồi hiện số bí mật.',
          ].join('\n'),
          hints: ['Hai biến: số bí mật và số đang đoán.', 'Bốc số bí mật một lần lúc bắt đầu.'],
          solutionCode: [
            'let bimat = randint(1, 10)',
            'let doan = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    doan = doan + 1',
            '    basic.showNumber(doan)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    if (doan == bimat) {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else {',
            '        basic.showIcon(IconNames.No)',
            '        basic.showNumber(bimat)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một ván chơi trọn vẹn ngay trên board.', khoiLenh: ['variable', 'random', 'on button pressed', 'if'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b20-goi-y-cao-thap',
          title: 'Gợi ý cao hay thấp',
          statement: [
            'Nâng cấp trò chơi: khi đoán sai, board hiện mũi tên **lên** nếu số bí mật lớn hơn,',
            'hoặc mũi tên **xuống** nếu nhỏ hơn.',
          ].join('\n'),
          hints: ['`basic.showArrow(ArrowNames.North)` là mũi tên lên.', 'Ba nhánh: bằng, lớn hơn, nhỏ hơn.'],
          solutionCode: [
            'let bimat = randint(1, 10)',
            'let doan = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    doan = doan + 1',
            '    basic.showNumber(doan)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    if (doan == bimat) {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else if (bimat > doan) {',
            '        basic.showArrow(ArrowNames.North)',
            '    } else {',
            '        basic.showArrow(ArrowNames.South)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board gợi ý để người chơi thu hẹp dần.', khoiLenh: ['variable', 'if', 'show arrow'] },
      ),
    ],
  },

  'mb-b21-am-thanh': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b21-nut-ra-tieng',
          title: 'Mỗi nút một nốt',
          statement: [
            'Bấm **nút A** phát nốt Đô, bấm **nút B** phát nốt Sol,',
            'mỗi nốt kéo dài nửa phách.',
          ].join('\n'),
          hints: ['`music.playTone(Note.C, music.beat(BeatFraction.Half))`.', 'Note.C là Đô, Note.G là Sol.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    music.playTone(Note.C, music.beat(BeatFraction.Half))',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    music.playTone(Note.G, music.beat(BeatFraction.Half))',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Hai nút cho hai nốt nhạc khác nhau.', khoiLenh: ['on button pressed', 'play tone'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b21-giai-dieu-ngan',
          title: 'Một giai điệu ngắn',
          statement: [
            'Khi **lắc** board, phát lần lượt năm nốt: Đô, Rê, Mi, Pha, Sol,',
            'mỗi nốt nửa phách.',
          ].join('\n'),
          hints: ['Gọi `music.playTone` năm lần theo thứ tự.'],
          solutionCode: [
            'input.onGesture(Gesture.Shake, function () {',
            '    music.playTone(Note.C, music.beat(BeatFraction.Half))',
            '    music.playTone(Note.D, music.beat(BeatFraction.Half))',
            '    music.playTone(Note.E, music.beat(BeatFraction.Half))',
            '    music.playTone(Note.F, music.beat(BeatFraction.Half))',
            '    music.playTone(Note.G, music.beat(BeatFraction.Half))',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Lắc board là nghe được một câu nhạc.', khoiLenh: ['on gesture', 'play tone'] },
      ),
    ],
  },

  'mb-b22-tu-ve-led': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b22-ve-khung',
          title: 'Vẽ khung viền',
          statement: [
            'Bật các đèn LED ở **bốn góc** của lưới 5×5.',
            '',
            'Toạ độ chạy từ 0 đến 4 theo cả hai chiều.',
          ].join('\n'),
          hints: ['`led.plot(x, y)` bật một đèn.', 'Bốn góc là (0,0), (4,0), (0,4) và (4,4).'],
          solutionCode: [
            'led.plot(0, 0)',
            'led.plot(4, 0)',
            'led.plot(0, 4)',
            'led.plot(4, 4)',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đúng bốn đèn góc sáng lên.', khoiLenh: ['plot'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b22-duong-cheo',
          title: 'Đường chéo sáng dần',
          statement: [
            'Bật lần lượt các đèn trên **đường chéo** từ (0,0) tới (4,4),',
            'mỗi đèn cách nhau 300 mili giây.',
          ].join('\n'),
          hints: ['Trên đường chéo, x và y luôn bằng nhau.', 'Một vòng lặp chạy i từ 0 đến 4 là đủ.'],
          solutionCode: [
            'for (let i = 0; i <= 4; i++) {',
            '    led.plot(i, i)',
            '    basic.pause(300)',
            '}',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Đường chéo sáng dần từ góc này sang góc kia.', khoiLenh: ['repeat', 'plot', 'pause'] },
      ),
    ],
  },

  'mb-b23-hoat-hinh': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b23-mua-roi',
          title: 'Hạt mưa rơi',
          statement: [
            'Cho một đèn LED **rơi từ trên xuống** ở cột giữa (x = 2):',
            'sáng ở y = 0, rồi 1, 2, 3, 4, mỗi bước 200 mili giây, và lặp mãi.',
          ].join('\n'),
          hints: ['`led.unplot(x, y)` tắt đèn cũ trước khi bật đèn mới.'],
          solutionCode: [
            'basic.forever(function () {',
            '    for (let y = 0; y <= 4; y++) {',
            '        led.plot(2, y)',
            '        basic.pause(200)',
            '        led.unplot(2, y)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một chấm sáng rơi xuống liên tục như hạt mưa.', khoiLenh: ['forever', 'repeat', 'plot', 'unplot'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b23-hai-khung-hinh',
          title: 'Hoạt hình hai khung',
          statement: [
            'Đổi qua lại giữa hai biểu tượng bất kỳ, mỗi khung 400 mili giây, lặp mãi.',
            '',
            'Chọn hai biểu tượng **gần giống nhau** thì chuyển động mới mượt.',
          ].join('\n'),
          hints: ['Ví dụ `IconNames.Heart` và `IconNames.SmallHeart`.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showIcon(IconNames.Diamond)',
            '    basic.pause(400)',
            '    basic.showIcon(IconNames.SmallDiamond)',
            '    basic.pause(400)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Hai khung hình nối nhau tạo cảm giác chuyển động.', khoiLenh: ['forever', 'show icon', 'pause'] },
      ),
    ],
  },

  'mb-b24-du-an-nhac-cu': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b24-dan-phim',
          title: 'Cây đàn ba phím',
          statement: [
            'Nút **A** phát nốt Đô, nút **B** phát nốt Mi, **lắc** board phát nốt Sol.',
            '',
            'Mỗi lần phát, hiện một biểu tượng để biết board đã nhận lệnh.',
          ].join('\n'),
          hints: ['Ba khối sự kiện, mỗi khối một nốt.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    music.playTone(Note.C, music.beat(BeatFraction.Half))',
            '    basic.showIcon(IconNames.SmallDiamond)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    music.playTone(Note.E, music.beat(BeatFraction.Half))',
            '    basic.showIcon(IconNames.Diamond)',
            '})',
            'input.onGesture(Gesture.Shake, function () {',
            '    music.playTone(Note.G, music.beat(BeatFraction.Half))',
            '    basic.showIcon(IconNames.Square)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Ba cách điều khiển cho ba nốt nhạc.', khoiLenh: ['on button pressed', 'on gesture', 'play tone', 'show icon'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b24-nhac-theo-anh-sang',
          title: 'Nốt cao thấp theo ánh sáng',
          statement: [
            'Bấm **nút A**: nếu phòng sáng (ánh sáng từ 100 trở lên) phát nốt cao (Note.C5),',
            'nếu tối thì phát nốt thấp (Note.C).',
          ].join('\n'),
          hints: ['Kết hợp cảm biến với `if ... else`.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    if (input.lightLevel() >= 100) {',
            '        music.playTone(Note.C5, music.beat(BeatFraction.Half))',
            '    } else {',
            '        music.playTone(Note.C, music.beat(BeatFraction.Half))',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Cây đàn đổi giọng theo độ sáng của phòng.', khoiLenh: ['on button pressed', 'light level', 'if', 'play tone'] },
      ),
    ],
  },

  'mb-b25-radio-dau-tien': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b25-gui-nhan-so',
          title: 'Gửi và nhận một con số',
          statement: [
            'Đặt nhóm radio là **1**.',
            '',
            'Bấm **nút A** thì gửi số 7. Khi nhận được số, hiện số đó lên màn hình.',
          ].join('\n'),
          hints: ['`radio.setGroup(1)` phải chạy trước.', 'Hai board phải cùng nhóm mới nghe thấy nhau.'],
          solutionCode: [
            'radio.setGroup(1)',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendNumber(7)',
            '})',
            'radio.onReceivedNumber(function (receivedNumber) {',
            '    basic.showNumber(receivedNumber)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một board bấm nút, board kia hiện số.', khoiLenh: ['radio set group', 'send number', 'on received number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b25-den-tu-xa',
          title: 'Bật đèn từ xa',
          statement: [
            'Nhóm radio **2**. Nút **A** gửi số 1, nút **B** gửi số 0.',
            '',
            'Board nhận được 1 thì hiện `IconNames.Yes`, nhận 0 thì xoá màn hình.',
          ].join('\n'),
          hints: ['Xử lý số nhận được bằng `if ... else`.'],
          solutionCode: [
            'radio.setGroup(2)',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendNumber(1)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    radio.sendNumber(0)',
            '})',
            'radio.onReceivedNumber(function (receivedNumber) {',
            '    if (receivedNumber == 1) {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else {',
            '        basic.clearScreen()',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Điều khiển màn hình của board bạn từ board của em.', khoiLenh: ['radio set group', 'send number', 'on received number', 'if'] },
      ),
    ],
  },

  'mb-b26-radio-gui-chu': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b26-gui-chu',
          title: 'Gửi một lời nhắn',
          statement: [
            'Nhóm radio **3**. Bấm **nút A** gửi chuỗi `Chao ban`.',
            '',
            'Khi nhận được chuỗi, chạy chữ đó qua màn hình.',
          ].join('\n'),
          hints: ['`radio.sendString("...")` và `radio.onReceivedString(...)`.'],
          solutionCode: [
            'radio.setGroup(3)',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendString("Chao ban")',
            '})',
            'radio.onReceivedString(function (receivedString) {',
            '    basic.showString(receivedString)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Lời nhắn bay từ board này sang board kia.', khoiLenh: ['radio set group', 'send string', 'on received string'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b26-hai-loi-nhan',
          title: 'Hai lời nhắn khác nhau',
          statement: [
            'Nhóm radio **3**. Nút **A** gửi `OK`, nút **B** gửi `Doi ti`.',
            '',
            'Bên nhận: chuỗi `OK` thì hiện `IconNames.Yes`, còn lại thì chạy chữ nhận được.',
          ].join('\n'),
          hints: ['So sánh chuỗi bằng `==`.'],
          solutionCode: [
            'radio.setGroup(3)',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendString("OK")',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    radio.sendString("Doi ti")',
            '})',
            'radio.onReceivedString(function (receivedString) {',
            '    if (receivedString == "OK") {',
            '        basic.showIcon(IconNames.Yes)',
            '    } else {',
            '        basic.showString(receivedString)',
            '    }',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Bên nhận phản ứng khác nhau tuỳ lời nhắn.', khoiLenh: ['radio set group', 'send string', 'on received string', 'if'] },
      ),
    ],
  },

  'mb-b27-du-an-nhan-tin': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b27-may-nhan-tin',
          title: 'Máy nhắn tin trong lớp',
          statement: [
            'Nhóm radio **4**. Ba lời nhắn sẵn:',
            '',
            '- nút **A**: `Xin chao`',
            '- nút **B**: `Giup minh`',
            '- **lắc**: `Cam on`',
            '',
            'Bên nhận chạy chữ nhận được và kêu một tiếng bíp.',
          ].join('\n'),
          hints: ['Tiếng bíp giúp người nhận biết có tin mới mà không phải nhìn màn hình.'],
          solutionCode: [
            'radio.setGroup(4)',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendString("Xin chao")',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    radio.sendString("Giup minh")',
            '})',
            'input.onGesture(Gesture.Shake, function () {',
            '    radio.sendString("Cam on")',
            '})',
            'radio.onReceivedString(function (receivedString) {',
            '    music.playTone(Note.C, music.beat(BeatFraction.Quarter))',
            '    basic.showString(receivedString)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Ba lời nhắn gửi được và bên kia nghe thấy tiếng báo.', khoiLenh: ['radio set group', 'send string', 'on received string', 'play tone'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b27-dem-tin-nhan',
          title: 'Đếm số tin đã nhận',
          statement: [
            'Giống máy nhắn tin, nhưng thêm một biến đếm **số tin đã nhận**.',
            '',
            'Bấm **nút A và B cùng lúc** để xem con số đó.',
          ].join('\n'),
          hints: ['Tăng biến ngay trong khối nhận tin.'],
          solutionCode: [
            'radio.setGroup(4)',
            'let sotin = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    radio.sendString("Xin chao")',
            '})',
            'radio.onReceivedString(function (receivedString) {',
            '    sotin = sotin + 1',
            '    basic.showString(receivedString)',
            '})',
            'input.onButtonPressed(Button.AB, function () {',
            '    basic.showNumber(sotin)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board nhớ được đã nhận bao nhiêu tin.', khoiLenh: ['radio set group', 'variable', 'on received string', 'show number'] },
      ),
    ],
  },

  'mb-b28-chon-de-tai': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b28-ban-mau-de-tai',
          title: 'Bản mẫu cho đề tài của em',
          statement: [
            'Dựng **khung sườn** cho sản phẩm cuối khoá của em:',
            '',
            '1. Một biến giữ trạng thái chính',
            '2. Một khối sự kiện để người dùng tác động (nút hoặc cử chỉ)',
            '3. Một phản hồi nhìn thấy được (biểu tượng, số hoặc chữ)',
            '',
            'Chưa cần hoàn chỉnh — mục tiêu là chạy được một vòng từ đầu tới cuối.',
          ].join('\n'),
          hints: ['Bắt đầu từ thứ nhỏ nhất mà chạy được, rồi mới thêm.', 'Lời giải mẫu chỉ là một ví dụ; đề tài của em có thể khác hẳn.'],
          solutionCode: [
            'let trangthai = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    trangthai = trangthai + 1',
            '    basic.showNumber(trangthai)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một khung sườn chạy được, sẵn sàng để đắp thêm.', khoiLenh: ['variable', 'on button pressed', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b28-danh-sach-kiem-tra',
          title: 'Chương trình tự kiểm tra',
          statement: [
            'Viết một chương trình ngắn kiểm tra board còn tốt:',
            '',
            'hiện `IconNames.Yes`, phát một tiếng bíp, hiện nhiệt độ, rồi xoá màn hình.',
            '',
            'Chạy khi bấm **nút A**.',
          ].join('\n'),
          hints: ['Bốn bước nối tiếp nhau trong một khối sự kiện.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showIcon(IconNames.Yes)',
            '    music.playTone(Note.C, music.beat(BeatFraction.Quarter))',
            '    basic.showNumber(input.temperature())',
            '    basic.pause(1000)',
            '    basic.clearScreen()',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một nút bấm là biết màn hình, loa và cảm biến đều còn tốt.', khoiLenh: ['on button pressed', 'show icon', 'play tone', 'temperature'] },
      ),
    ],
  },

  'mb-b29-lam-san-pham': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b29-che-do-thu',
          title: 'Chế độ chạy thử',
          statement: [
            'Thêm vào sản phẩm của em một **chế độ chạy thử**: bấm **nút A và B cùng lúc**',
            'thì board tự diễn lại các trạng thái chính, mỗi trạng thái 1 giây.',
            '',
            'Chế độ này để em thử nhanh mà không phải thao tác tay từng bước.',
          ].join('\n'),
          hints: ['Một vòng lặp đi qua các trạng thái là đủ.'],
          solutionCode: [
            'input.onButtonPressed(Button.AB, function () {',
            '    for (let i = 1; i <= 3; i++) {',
            '        basic.showNumber(i)',
            '        basic.pause(1000)',
            '    }',
            '    basic.showIcon(IconNames.Yes)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một nút là xem hết được các trạng thái của sản phẩm.', khoiLenh: ['on button pressed', 'repeat', 'show number'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b29-xu-ly-truong-hop-la',
          title: 'Lo cho trường hợp bất ngờ',
          statement: [
            'Sản phẩm của em nên **không hỏng** khi gặp giá trị lạ.',
            '',
            'Viết một chương trình: biến `muc` tăng theo nút A, nhưng **không bao giờ vượt quá 5**',
            'và không nhỏ hơn 0 khi bấm nút B.',
          ].join('\n'),
          hints: ['Kiểm tra giới hạn trước khi thay đổi giá trị.'],
          solutionCode: [
            'let muc = 0',
            'input.onButtonPressed(Button.A, function () {',
            '    if (muc < 5) {',
            '        muc = muc + 1',
            '    }',
            '    basic.showNumber(muc)',
            '})',
            'input.onButtonPressed(Button.B, function () {',
            '    if (muc > 0) {',
            '        muc = muc - 1',
            '    }',
            '    basic.showNumber(muc)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Giá trị luôn nằm trong khoảng cho phép, bấm kiểu gì cũng vậy.', khoiLenh: ['variable', 'if', 'on button pressed'] },
      ),
    ],
  },

  'mb-b30-trinh-bay': {
    khoi: [
      microbitTask(
        {
          slug: 'mb-p-bs-b30-che-do-gioi-thieu',
          title: 'Chế độ giới thiệu',
          statement: [
            'Viết một đoạn mở đầu cho phần trình bày: chạy **tên sản phẩm**,',
            'hiện một biểu tượng đại diện, rồi phát một tiếng bíp.',
            '',
            'Bấm **nút A** để chạy lại bất cứ lúc nào.',
          ].join('\n'),
          hints: ['Cho phép chạy lại để em không phải nạp lại chương trình giữa buổi.'],
          solutionCode: [
            'input.onButtonPressed(Button.A, function () {',
            '    basic.showString("Den ngu")',
            '    basic.showIcon(IconNames.Asleep)',
            '    music.playTone(Note.G, music.beat(BeatFraction.Quarter))',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Một nút là mở đầu được phần trình bày.', khoiLenh: ['on button pressed', 'show string', 'show icon', 'play tone'] },
      ),
      microbitTask(
        {
          slug: 'mb-p-bs-b30-demo-tu-dong',
          title: 'Bản demo tự chạy',
          statement: [
            'Làm một bản demo **tự chạy vòng tròn** để board diễn lại sản phẩm',
            'trong lúc em nói, không cần ai bấm gì.',
            '',
            'Dùng `forever` với vài trạng thái nối tiếp nhau.',
          ].join('\n'),
          hints: ['Đặt `pause` đủ dài để người xem kịp nhìn.'],
          solutionCode: [
            'basic.forever(function () {',
            '    basic.showString("Demo")',
            '    basic.showIcon(IconNames.Happy)',
            '    basic.pause(1500)',
            '    basic.showIcon(IconNames.Asleep)',
            '    basic.pause(1500)',
            '    basic.clearScreen()',
            '    basic.pause(500)',
            '})',
          ].join('\n'),
          totalPoints: 100,
        },
        { goal: 'Board tự diễn trong lúc em thuyết trình.', khoiLenh: ['forever', 'show string', 'show icon', 'pause'] },
      ),
    ],
  },
};
