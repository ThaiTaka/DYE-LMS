/**
 * Expansion pack — Python Nâng Cao, sessions 11–15 (the networking chapter).
 *
 * Sessions 1–10 are the OOP chapter and live in ./nang-cao-oop.ts, because
 * curriculum.test.ts requires every problem there to be UNIT_TEST rather than
 * IO_MATCH.
 *
 * ── Two rules shape every exercise in the networking half ────────────────────
 * `assertPythonAdvancedNotes` checks the reference solutions themselves:
 *
 *   • note 16 — a solution calling `requests.get/post` must run on the PY_WEB
 *     image AND ship `mockFixtures`, because the sandbox has no egress and
 *     grading must never depend on someone else's API being up.
 *   • note 15 — a solution opening `socket.socket` must stay on loopback under
 *     a NONE or LOOPBACK_ONLY policy.
 *
 * Rather than satisfy those conditions for a dozen new exercises, these avoid
 * both APIs entirely: the exercises are about PARSING and DECIDING — splitting a
 * URL, reading a status line, framing a message, choosing TCP or UDP — which is
 * the part a student gets wrong, and which is judgeable with plain stdin/stdout.
 */
import { challenge, hidden, sample } from '../../builders.ts';

import type { BoSungKhoaHoc } from './ap-dung.ts';

export const boSungNangCao1: BoSungKhoaHoc = {
  'nc-b11-mang-may-tinh-can-ban': {
    khoi: [
      challenge({
        slug: 'p-bs-nc-b11-tach-dia-chi',
        title: 'Tách địa chỉ IP và cổng',
        statement: [
          'Đọc một chuỗi dạng `<ip>:<port>`.',
          '',
          'In ra hai dòng: `IP: <ip>` rồi `Port: <port>`.',
        ].join('\n'),
        hints: ['`chuoi.split(":")` tách thành hai phần.'],
        starterCode: ['dia_chi = input()', '', '# Tách ra'].join('\n'),
        solutionCode: [
          'dia_chi = input()',
          'ip, port = dia_chi.split(":")',
          'print(f"IP: {ip}")',
          'print(f"Port: {port}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('192.168.1.10:8080\n', 'IP: 192.168.1.10\nPort: 8080\n', 'Tách ở dấu hai chấm.'),
          hidden('127.0.0.1:80\n', 'IP: 127.0.0.1\nPort: 80\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-nc-b11-ip-hop-le',
        title: 'Địa chỉ IPv4 có hợp lệ không',
        statement: [
          'Đọc một chuỗi và in ra `Hop le` nếu đó là địa chỉ IPv4 đúng:',
          '',
          '- đúng **bốn** phần cách nhau bởi dấu chấm',
          '- mỗi phần chỉ gồm chữ số và nằm trong khoảng 0–255',
          '',
          'Ngược lại in ra `Khong hop le`.',
        ].join('\n'),
        hints: ['`phan.isdigit()` kiểm tra toàn chữ số.', 'Nhớ kiểm tra đủ bốn phần trước khi đổi sang số.'],
        starterCode: ['s = input()', '', '# Kiểm tra IPv4'].join('\n'),
        solutionCode: [
          's = input()',
          'phan = s.split(".")',
          'ok = len(phan) == 4',
          'if ok:',
          '    for p in phan:',
          '        if not p.isdigit() or int(p) > 255:',
          '            ok = False',
          'if ok:',
          '    print("Hop le")',
          'else:',
          '    print("Khong hop le")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('192.168.1.1\n', 'Hop le\n', 'Bốn phần, mỗi phần trong khoảng cho phép.'),
          sample('256.1.1.1\n', 'Khong hop le\n', '256 vượt quá 255.'),
          hidden('1.2.3\n', 'Khong hop le\n', 25),
          hidden('0.0.0.0\n', 'Hop le\n', 25),
        ],
      }),
    ],
  },

  'nc-b12-http-va-client-server': {
    khoi: [
      challenge({
        slug: 'p-bs-nc-b12-phan-loai-status',
        title: 'Mã trạng thái nói gì',
        statement: [
          'Đọc số lượng `n` rồi `n` mã trạng thái HTTP.',
          '',
          'In ra nhóm của từng mã, mỗi dòng một nhóm:',
          '`Thanh cong` (2xx), `Chuyen huong` (3xx), `Loi phia client` (4xx),',
          '`Loi phia server` (5xx), `Khac` cho mọi giá trị còn lại.',
        ].join('\n'),
        hints: ['Chia cho 100 lấy phần nguyên để biết nhóm.'],
        starterCode: ['n = int(input())', '', '# Phân loại từng mã'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'for _ in range(n):',
          '    ma = int(input())',
          '    nhom = ma // 100',
          '    if nhom == 2:',
          '        print("Thanh cong")',
          '    elif nhom == 3:',
          '        print("Chuyen huong")',
          '    elif nhom == 4:',
          '        print("Loi phia client")',
          '    elif nhom == 5:',
          '        print("Loi phia server")',
          '    else:',
          '        print("Khac")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample(
            '4\n200\n301\n404\n500\n',
            'Thanh cong\nChuyen huong\nLoi phia client\nLoi phia server\n',
            'Mỗi mã rơi vào một nhóm theo chữ số đầu.',
          ),
          hidden('2\n204\n100\n', 'Thanh cong\nKhac\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-nc-b12-tach-url',
        title: 'Tách các phần của URL',
        statement: [
          'Đọc một URL dạng `http://<host>/<duong-dan>?<query>`.',
          '',
          'In ra ba dòng: `Host: <host>`, `Duong dan: /<duong-dan>`, `Query: <query>`.',
          '',
          'Nếu URL không có phần `?query`, in `Query: khong co`.',
        ].join('\n'),
        hints: ['Bỏ tiền tố `http://` trước rồi mới tách.', '`partition` hoặc `split` với `maxsplit` đều dùng được.'],
        starterCode: ['url = input()', '', '# Tách URL'].join('\n'),
        solutionCode: [
          'url = input()',
          'con_lai = url[len("http://"):]',
          'host, _, phan_sau = con_lai.partition("/")',
          'duong_dan, dau_hoi, query = phan_sau.partition("?")',
          'print(f"Host: {host}")',
          'print(f"Duong dan: /{duong_dan}")',
          'if dau_hoi == "":',
          '    print("Query: khong co")',
          'else:',
          '    print(f"Query: {query}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample(
            'http://dyelms.vn/lop/7a1?sap_xep=ten\n',
            'Host: dyelms.vn\nDuong dan: /lop/7a1\nQuery: sap_xep=ten\n',
            'Ba phần tách ở dấu / đầu tiên và dấu ?.',
          ),
          hidden('http://a.vn/b\n', 'Host: a.vn\nDuong dan: /b\nQuery: khong co\n', 30),
        ],
      }),
    ],
  },

  'nc-b13-tcp-vs-udp': {
    khoi: [
      challenge({
        slug: 'p-bs-nc-b13-chon-giao-thuc',
        title: 'Chọn TCP hay UDP',
        statement: [
          'Đọc số lượng `n` rồi `n` tình huống, mỗi dòng một từ khoá:',
          '',
          '`FILE`, `CHAT`, `VIDEO`, `GAME`, `EMAIL`, `DNS`.',
          '',
          'In `TCP` cho những việc cần **đủ và đúng thứ tự** (FILE, CHAT, EMAIL),',
          'in `UDP` cho những việc ưu tiên **nhanh** (VIDEO, GAME, DNS).',
        ].join('\n'),
        hints: ['Một danh sách các từ khoá thuộc nhóm TCP là đủ.'],
        starterCode: ['n = int(input())', '', '# Chọn giao thức'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'nhom_tcp = ["FILE", "CHAT", "EMAIL"]',
          'for _ in range(n):',
          '    t = input()',
          '    if t in nhom_tcp:',
          '        print("TCP")',
          '    else:',
          '        print("UDP")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('3\nFILE\nVIDEO\nCHAT\n', 'TCP\nUDP\nTCP\n', 'Truyền tệp cần đủ; video chấp nhận mất gói.'),
          hidden('3\nDNS\nGAME\nEMAIL\n', 'UDP\nUDP\nTCP\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-nc-b13-mat-goi-tin',
        title: 'Mất gói thì còn lại bao nhiêu',
        statement: [
          'Đọc **tổng số gói** và số lượng `n`, rồi `n` số hiệu gói bị mất.',
          '',
          'In ra hai dòng: `UDP: <số gói tới nơi>` và `TCP: <tổng>` —',
          'vì TCP gửi lại gói mất nên cuối cùng vẫn đủ.',
          '',
          'Một số hiệu có thể lặp lại; chỉ tính mất một lần.',
        ].join('\n'),
        hints: ['`set` loại bỏ trùng lặp.'],
        starterCode: ['tong = int(input())', 'n = int(input())', '', '# Đếm gói mất'].join('\n'),
        solutionCode: [
          'tong = int(input())',
          'n = int(input())',
          'mat = set()',
          'for _ in range(n):',
          '    mat.add(int(input()))',
          'print(f"UDP: {tong - len(mat)}")',
          'print(f"TCP: {tong}")',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('10\n3\n2\n5\n2\n', 'UDP: 8\nTCP: 10\n', 'Gói số 2 bị đếm một lần dù xuất hiện hai lần.'),
          hidden('5\n0\n', 'UDP: 5\nTCP: 5\n', 30),
        ],
      }),
    ],
  },

  'nc-b14-socket-tcp-server-client': {
    khoi: [
      challenge({
        slug: 'p-bs-nc-b14-dong-goi-ban-tin',
        title: 'Đóng gói bản tin có độ dài',
        statement: [
          'TCP là **dòng byte**: bên nhận không tự biết một bản tin kết thúc ở đâu.',
          'Cách thường dùng là gắn độ dài lên đầu.',
          '',
          'Đọc số lượng `n` rồi `n` bản tin. In ra từng bản tin đã đóng gói',
          'theo dạng `<độ dài>:<nội dung>`, mỗi gói một dòng.',
        ].join('\n'),
        hints: ['`len(s)` cho số ký tự.'],
        starterCode: ['n = int(input())', '', '# Đóng gói từng bản tin'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'for _ in range(n):',
          '    s = input()',
          '    print(f"{len(s)}:{s}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2\nxin chao\nok\n', '8:xin chao\n2:ok\n', 'Độ dài tính cả dấu cách.'),
          hidden('1\na\n', '1:a\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-nc-b14-go-goi-tu-dong-byte',
        title: 'Gỡ bản tin ra khỏi dòng byte',
        statement: [
          'Đọc một dòng là chuỗi đã nối nhiều gói dạng `<độ dài>:<nội dung>` liên tiếp.',
          '',
          'In ra từng bản tin gốc, mỗi bản tin một dòng.',
          '',
          'Ví dụ `5:hello2:hi` cho `hello` rồi `hi`.',
        ].join('\n'),
        hints: ['Đọc tới dấu hai chấm để lấy độ dài, rồi cắt đúng bấy nhiêu ký tự.', 'Lặp cho tới khi hết chuỗi.'],
        starterCode: ['dong = input()', 'i = 0', '', '# Gỡ từng gói'].join('\n'),
        solutionCode: [
          'dong = input()',
          'i = 0',
          'while i < len(dong):',
          '    j = dong.index(":", i)',
          '    do_dai = int(dong[i:j])',
          '    print(dong[j + 1:j + 1 + do_dai])',
          '    i = j + 1 + do_dai',
        ].join('\n'),
        tier: 'NANG_CAO',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('5:hello2:hi\n', 'hello\nhi\n', 'Độ dài cho biết cắt tới đâu.'),
          hidden('1:a1:b1:c\n', 'a\nb\nc\n', 30),
          hidden('8:xin chao\n', 'xin chao\n', 30),
        ],
      }),
    ],
  },

  'nc-b15-du-an-chat-server-client': {
    khoi: [
      challenge({
        slug: 'p-bs-nc-b15-dinh-dang-tin-chat',
        title: 'Định dạng tin nhắn chat',
        statement: [
          'Đọc số lượng `n` rồi `n` dòng dạng `<gio>|<ten>|<noi dung>`.',
          '',
          'In ra mỗi tin theo mẫu `[<gio>] <ten>: <noi dung>`.',
        ].join('\n'),
        hints: ['`split("|")` tách đúng ba phần.'],
        starterCode: ['n = int(input())', '', '# Định dạng lại'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'for _ in range(n):',
          '    gio, ten, noi_dung = input().split("|")',
          '    print(f"[{gio}] {ten}: {noi_dung}")',
        ].join('\n'),
        tier: 'CO_BAN',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('2\n08:00|Lan|chao ca lop\n08:01|Minh|chao Lan\n', '[08:00] Lan: chao ca lop\n[08:01] Minh: chao Lan\n', 'Ba phần ghép lại theo mẫu mới.'),
          hidden('1\n12:30|An|ok\n', '[12:30] An: ok\n', 30),
        ],
      }),
      challenge({
        slug: 'p-bs-nc-b15-lenh-chat',
        title: 'Xử lý lệnh trong phòng chat',
        statement: [
          'Đọc số lượng `n` rồi `n` dòng. Dòng bắt đầu bằng `/` là **lệnh**:',
          '',
          '- `/join <ten>`: thêm người vào phòng',
          '- `/leave <ten>`: bỏ người khỏi phòng (nếu có)',
          '',
          'Mọi dòng khác là tin nhắn thường, bỏ qua.',
          '',
          'In ra số người còn trong phòng, rồi danh sách tên theo thứ tự vào, mỗi tên một dòng.',
        ].join('\n'),
        hints: ['Một list giữ thứ tự vào phòng.', 'Vào hai lần thì chỉ tính một.'],
        starterCode: ['n = int(input())', 'phong = []', '', '# Xử lý từng dòng'].join('\n'),
        solutionCode: [
          'n = int(input())',
          'phong = []',
          'for _ in range(n):',
          '    dong = input()',
          '    if dong.startswith("/join "):',
          '        ten = dong[6:]',
          '        if ten not in phong:',
          '            phong.append(ten)',
          '    elif dong.startswith("/leave "):',
          '        ten = dong[7:]',
          '        if ten in phong:',
          '            phong.remove(ten)',
          'print(len(phong))',
          'for t in phong:',
          '    print(t)',
        ].join('\n'),
        tier: 'THU_THACH',
        judgeMode: 'IO_MATCH',
        tests: [
          sample('4\n/join Lan\n/join Minh\nxin chao\n/leave Lan\n', '1\nMinh\n', 'Tin nhắn thường không đổi danh sách.'),
          hidden('3\n/join a\n/join a\n/leave b\n', '1\na\n', 30),
        ],
      }),
    ],
  },
};
