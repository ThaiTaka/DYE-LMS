# Hướng dẫn khởi động DYE LMS

Dành cho lúc vừa bật máy tính lên và muốn chạy hệ thống để dạy hoặc để thử.

> **Chỉ còn 3 bước.** Trước đây phải làm 5 bước — hai bước cuối là sửa `AUTH_URL`
> trong `.env` rồi khởi động lại server mỗi khi đường hầm đổi tên miền. Hai bước đó
> **không cần nữa**, và lý do nằm ở [mục 5](#5-vì-sao-không-cần-sửa-auth_url-nữa).

---

## Mục lục

1. [Bật Docker Desktop](#1-bật-docker-desktop)
2. [Bật server](#2-bật-server)
3. [Mở đường hầm ra Internet](#3-mở-đường-hầm-ra-internet)
4. [Đăng nhập](#4-đăng-nhập)
5. [Vì sao không cần sửa AUTH_URL nữa](#5-vì-sao-không-cần-sửa-auth_url-nữa)
6. [Tắt hệ thống](#6-tắt-hệ-thống)
7. [Khắc phục sự cố](#7-khắc-phục-sự-cố)
8. [Làm sạch cơ sở dữ liệu](#8-làm-sạch-cơ-sở-dữ-liệu)

---

## 1. Bật Docker Desktop

Mở **Docker Desktop** và đợi đến khi biểu tượng con cá voi ở khay hệ thống hết
quay, hiện chữ **Running**.

Đây là bước dễ quên nhất, và nếu quên thì mọi bước sau đều báo lỗi khó hiểu.
Docker đang chạy ba thứ mà hệ thống không thể thiếu:

| Thành phần | Vai trò |
| --- | --- |
| PostgreSQL | Toàn bộ dữ liệu: tài khoản, lớp, bài học, tiến độ của từng em |
| Redis | Hàng đợi chấm bài |
| Docker engine | Mỗi bài nộp của học sinh chạy trong một container riêng, bị khoá mạng |

Sau khi Docker đã chạy, mở **VS Code**, mở thư mục dự án, rồi mở Terminal
(phím tắt: Ctrl + dấu backtick) và chạy:

```bash
npm run infra:up
```

Lệnh này bật PostgreSQL và Redis. Chỉ mất vài giây, và chạy lại nhiều lần cũng
không sao.

Kiểm tra nhanh xem đã lên chưa:

```bash
docker compose ps
```

Cột `STATUS` của `postgres` và `redis` phải ghi `Up`.

---

## 2. Bật server

Trong Terminal thứ nhất, chạy:

```bash
npm run dev
```

Đợi đến khi thấy dòng:

```
✓ Ready in ...
- Local: http://localhost:3000
```

Lệnh này bật cùng lúc **hai** thứ: trang web (cổng 3000) và **bộ chấm bài**. Nếu
tắt Terminal này thì học sinh nộp bài sẽ không được chấm.

> **Để nguyên Terminal này chạy.** Đừng đóng, đừng bấm `Ctrl + C`, trừ khi muốn
> tắt hệ thống.

Mở thử `http://localhost:3000` trên trình duyệt. Nếu trang đăng nhập hiện ra thì
server đã chạy đúng.

---

## 3. Mở đường hầm ra Internet

Bước này chỉ cần khi muốn **người khác** (học sinh, phụ huynh) vào được từ máy của
họ. Nếu chỉ dùng một mình trên máy này thì bỏ qua, dùng thẳng
`http://localhost:3000`.

Mở **Terminal thứ hai** trong VS Code — bấm dấu `+` ở góc phải khung Terminal,
đừng đóng Terminal thứ nhất — rồi chạy:

```powershell
.\cloudflared.exe tunnel --url http://localhost:3000
```

Sau vài giây sẽ hiện một khung như thế này:

```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:                                          |
|  https://random-words-here.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
```

**Chép đường link `https://....trycloudflare.com` đó và gửi cho học sinh.** Xong.

Không cần sửa gì trong `.env`, không cần khởi động lại server.

> **Đường hầm miễn phí đổi tên mỗi lần chạy lại.** Mỗi buổi học sẽ là một link
> khác nhau — đó là chuyện bình thường của bản miễn phí, không phải lỗi. Muốn giữ
> một tên miền cố định thì cần tài khoản Cloudflare và một tên miền thật; xem
> [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md).

> **Để nguyên Terminal thứ hai chạy.** Đóng nó là đường hầm sập, học sinh mất kết nối.

---

## 4. Đăng nhập

Vào link (hoặc `http://localhost:3000`) và đăng nhập bằng tài khoản quản trị:

| | |
| --- | --- |
| Tên đăng nhập | `ThaiTaka` — gõ hoa hay thường đều được |
| Mật khẩu | lấy từ `ADMIN_PASSWORD` trong tệp `.env` |

Từ trang quản trị, tạo mọi thứ theo thứ tự này:

1. **Lớp học** → `/giao-vien/lop` — tạo lớp trước, vì học sinh phải được xếp vào lớp
2. **Nhân sự** → `/giao-vien/nhan-su` — tạo tài khoản giáo viên, rồi bấm
   *Phân công lớp* để giao lớp cho họ
3. **Học sinh** → `/giao-vien/hoc-sinh` — tạo tài khoản cho các em và xếp vào lớp

Giáo viên đã được giao lớp thì tự thêm học sinh cho lớp của mình được, không cần
nhờ quản trị viên.

---

## 5. Vì sao không cần sửa `AUTH_URL` nữa

Trước đây, quy trình có thêm hai bước: chép link đường hầm vào `AUTH_URL` trong
`.env`, rồi tắt server bằng `Ctrl + C` và bật lại.

Hai bước đó không những phiền mà còn **chính là nguyên nhân gây lỗi đăng nhập**.

Thư viện xác thực (Auth.js) đọc `AUTH_URL` **trước** khi nhìn vào yêu cầu thật của
trình duyệt:

```js
const envUrl = envObject.AUTH_URL ?? envObject.NEXTAUTH_URL;
if (envUrl) { url = new URL(envUrl) }        // ← có giá trị là dùng luôn
else { detectedHost = x-forwarded-host ?? host }
```

Nghĩa là hễ `AUTH_URL` có giá trị, mọi lần chuyển trang sau khi đăng nhập đều bị
ghim vào tên miền ghi trong đó. Đường hầm miễn phí đổi tên mỗi lần chạy lại, nên
chỉ cần quên cập nhật một lần là đăng nhập xong bị đẩy sang một tên miền đã chết —
trang trắng, không báo lỗi gì rõ ràng.

Hệ thống bây giờ **không hỏi mình đang chạy ở tên miền nào**:

- `AUTH_URL` để trống trong `.env`.
- Sau khi đăng nhập, hệ thống chuyển sang **đường dẫn tương đối** (`/giao-vien`)
  chứ không phải một địa chỉ đầy đủ, nên trình duyệt ở đâu thì ở nguyên đó.
- Đăng xuất và các trang bị khoá cũng làm y như vậy.

Đã kiểm chứng bằng cách cố tình chạy server với `AUTH_URL` trỏ vào một tên miền
không tồn tại: đăng nhập, đăng xuất, nhập sai mật khẩu — tất cả đều ở đúng chỗ.

> **Khi nào mới nên đặt `AUTH_URL`?** Chỉ khi đã có tên miền thật cố định
> (ví dụ `https://lms.truonghoc.edu.vn`). Tuyệt đối không trỏ nó vào link
> `.trycloudflare.com`.

---

## 6. Tắt hệ thống

1. Terminal thứ hai (đường hầm): bấm `Ctrl + C`
2. Terminal thứ nhất (server): bấm `Ctrl + C`
3. Tắt cơ sở dữ liệu nếu muốn:

   ```bash
   docker compose stop
   ```

Dữ liệu **không mất** khi tắt — nó nằm trong volume của Docker.

---

## 7. Khắc phục sự cố

### `Can't reach database server at localhost:5442`

Docker chưa chạy, hoặc chưa chạy `npm run infra:up`. Quay lại [bước 1](#1-bật-docker-desktop).

### Trang trắng, mở Console thấy `EvalError ... unsafe-eval`

Đang chạy bản build cũ. Dừng server, xoá thư mục build rồi chạy lại:

```powershell
Remove-Item -Recurse -Force apps\web\.next
npm run dev
```

### Đăng nhập xong bị đẩy sang một tên miền lạ

Trong `.env` vẫn còn dòng `AUTH_URL=...` chưa bị chú thích. Xoá hoặc thêm dấu `#`
vào đầu dòng đó, rồi khởi động lại server. Xem [mục 5](#5-vì-sao-không-cần-sửa-auth_url-nữa).

### `Port 3000 is already in use`

Còn một server cũ đang chạy nền. Tìm và tắt nó:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Học sinh nộp bài mà mãi không thấy chấm

Bộ chấm bài chạy chung với `npm run dev`, nên hãy kiểm tra Terminal thứ nhất còn
sống không. Nó phải in ra dòng:

```
[judge] san sang · 4 viec song song · hang "dye-cham-bai"
```

Nếu không có, Docker chưa chạy — bộ chấm cần Docker để tạo container cho từng bài nộp.

### `Could not find Prisma Schema`

Chạy lệnh `npx prisma ...` ở thư mục gốc thì Prisma không tìm ra schema, vì schema
nằm trong `packages/db`. Xem [mục 8](#8-làm-sạch-cơ-sở-dữ-liệu).

---

## 8. Làm sạch cơ sở dữ liệu

> ⚠️ **Xoá sạch toàn bộ dữ liệu và không khôi phục được.** Mọi tài khoản, lớp học,
> bài nộp và tiến độ của học sinh đều mất. Chỉ dùng trên máy cá nhân, **tuyệt đối
> không dùng trên máy chủ thật**.

Ở thư mục gốc, chạy:

```bash
npm run db:reset
```

Đừng chạy `npx prisma migrate reset` ở thư mục gốc — sẽ báo
`Could not find Prisma Schema`, vì schema nằm ở `packages/db/prisma/schema.prisma`
chứ không phải ở gốc. Lệnh `npm run db:reset` đã trỏ sẵn đường dẫn đó và tự nạp
`DATABASE_URL` từ `.env`.

Nếu vẫn muốn gọi thẳng Prisma thì phải chỉ rõ schema:

```bash
npx prisma migrate reset --force --schema=packages/db/prisma/schema.prisma
```

### Sau khi reset sẽ còn gì?

Bộ seed chạy tự động ngay sau đó và tạo:

- 4 khoá học · 94 bài học · 84 bài lập trình · 12 huy hiệu
- **Đúng một tài khoản**: `thaitaka` · Quản Trị Viên

Không có giáo viên, học sinh, lớp học hay bài nộp nào. Đó là trạng thái sạch để
bắt đầu một năm học mới — tạo lại mọi thứ qua giao diện web như ở
[mục 4](#4-đăng-nhập).

### Muốn có dữ liệu mẫu để thử

```bash
npm run db:demo
```

Lệnh này thêm 15 tài khoản demo, 2 lớp và tiến độ mẫu. **Bộ kiểm thử
(`npm run test`, `npm run e2e`) cần dữ liệu này** — chạy trên database sạch sẽ báo
thiếu dữ liệu mẫu và nhắc chạy lệnh trên.

Các tài khoản demo dùng chung một mật khẩu đã ghi công khai trong kho mã, nên lệnh
này bị từ chối khi `NODE_ENV=production`.

### Quên mật khẩu quản trị

Không cần reset. Sửa `ADMIN_PASSWORD` trong `.env` rồi chạy:

```bash
npm run db:admin
```

Lệnh này đặt lại mật khẩu của tài khoản đang có, không tạo thêm tài khoản thứ hai.

---

## Tóm tắt một trang

```bash
# 1. Bật Docker Desktop, đợi hiện "Running"
npm run infra:up

# 2. Terminal 1 — server + bộ chấm bài, để nguyên chạy
npm run dev

# 3. Terminal 2 — đường hầm, để nguyên chạy (bỏ qua nếu chỉ dùng một mình)
.\cloudflared.exe tunnel --url http://localhost:3000

# 4. Chép link .trycloudflare.com gửi cho học sinh — KHÔNG cần sửa .env
```
