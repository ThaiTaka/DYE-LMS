# Hướng dẫn triển khai DYE LMS lên VPS Ubuntu

> **Tài liệu này dành cho cách chạy nào?**
>
> Có hai cách triển khai DYE LMS, và bạn chỉ cần chọn một:
>
> |                          | Tài liệu này                                   | [`docs/DEPLOYMENT_GUIDE.md`](docs/DEPLOYMENT_GUIDE.md) |
> | ------------------------ | ---------------------------------------------- | ------------------------------------------------------ |
> | Postgres / Redis / MinIO | Docker                                         | Docker                                                 |
> | Web + bộ chấm bài        | Chạy thẳng bằng Node trên máy chủ              | Cũng đóng gói trong Docker                             |
> | Hợp với                  | Một máy chủ, một người quản trị, cần sửa nhanh | Nhiều máy, CI/CD, muốn mọi thứ bất biến                |
> | Độ phức tạp              | Thấp hơn                                       | Cao hơn nhưng gọn gàng hơn về lâu dài                  |
>
> Tài liệu này đi theo **cách thứ nhất** — đúng như tình huống bạn đang chạy:
> dịch vụ nền trong Docker, còn `apps/web` và `apps/judge-worker` chạy bằng Node
> trên chính máy chủ.

---

## Mục lục

1. [Yêu cầu máy chủ](#1-yêu-cầu-máy-chủ)
2. [Chuẩn bị VPS và mạng](#2-chuẩn-bị-vps-và-mạng)
3. [Cài đặt môi trường trên Ubuntu](#3-cài-đặt-môi-trường-trên-ubuntu)
4. [Kéo mã nguồn](#4-kéo-mã-nguồn)
5. [Cấu hình tệp .env](#5-cấu-hình-tệp-env)
6. [Khởi động dịch vụ nền bằng Docker](#6-khởi-động-dịch-vụ-nền-bằng-docker)
7. [Cài thư viện, migration và nạp dữ liệu](#7-cài-thư-viện-migration-và-nạp-dữ-liệu)
8. [Kiểm tra bằng npm run doctor](#8-kiểm-tra-bằng-npm-run-doctor)
9. [Ảnh hộp cát cho bộ chấm bài](#9-ảnh-hộp-cát-cho-bộ-chấm-bài)
10. [Chạy thử ở chế độ production](#10-chạy-thử-ở-chế-độ-production)
11. [Cài dịch vụ systemd để chạy nền](#11-cài-dịch-vụ-systemd-để-chạy-nền)
12. [Nginx và HTTPS (khuyến nghị)](#12-nginx-và-https-khuyến-nghị)
13. [Cập nhật phiên bản mới](#13-cập-nhật-phiên-bản-mới)
14. [Sao lưu](#14-sao-lưu)
15. [Khắc phục sự cố](#15-khắc-phục-sự-cố)
16. [Danh sách kiểm tra trước khi mở cho học sinh](#16-danh-sách-kiểm-tra-trước-khi-mở-cho-học-sinh)

---

## 1. Yêu cầu máy chủ

| Thành phần   | Tối thiểu    | Khuyến nghị      | Vì sao                                                    |
| ------------ | ------------ | ---------------- | --------------------------------------------------------- |
| CPU          | 2 nhân       | 4 nhân           | Mỗi bài nộp chạy trong một container riêng                |
| RAM          | 4 GB         | 8 GB             | Postgres + Redis + MinIO + Next.js + 4 container chấm bài |
| Ổ cứng       | 20 GB        | 40 GB            | Ảnh Docker, dữ liệu, tệp học sinh nộp                     |
| Hệ điều hành | Ubuntu 22.04 | Ubuntu 24.04 LTS | Đã kiểm chứng trên cả hai                                 |

> ⚠️ **Bộ chấm bài bắt buộc phải có Docker.** Nó chạy code của học sinh trong
> container cách ly. Không có Docker, worker **từ chối khởi động** thay vì nhận
> bài rồi chấm sai tất cả — vì một worker báo lỗi mọi bài còn tệ hơn là không có
> worker nào, do bài nộp trông như đã được chấm.

### Các cổng hệ thống dùng

| Cổng máy chủ | Dịch vụ                   | Ra Internet?                               |
| ------------ | ------------------------- | ------------------------------------------ |
| `22`         | SSH                       | Có (nên giới hạn IP)                       |
| `3000`       | Next.js (web)             | Có — hoặc chỉ mở `80`/`443` nếu dùng Nginx |
| `5442`       | PostgreSQL (trong Docker) | **KHÔNG**                                  |
| `6389`       | Redis (trong Docker)      | **KHÔNG**                                  |
| `9010`       | MinIO API                 | **KHÔNG**                                  |
| `9011`       | MinIO Console             | **KHÔNG**                                  |

Ba cổng `5442`, `6389`, `9010` cố ý **lệch khỏi mặc định** (5432, 6379, 9000) để
không đụng với dịch vụ có sẵn trên máy. Con số này xuất hiện ở hai nơi —
`POSTGRES_PORT` trong `.env` và cổng trong `DATABASE_URL` — nên hai chỗ đó phải
luôn khớp nhau. Mục [8](#8-kiểm-tra-bằng-npm-run-doctor) có công cụ tự kiểm tra.

---

## 2. Chuẩn bị VPS và mạng

### 2.1. Firewall của nhà cung cấp (Security Group)

Làm bước này **trên trang quản trị của nhà cung cấp** (Vultr, DigitalOcean,
AWS, Azure, Vietnix, TinoHost…), trước khi động vào máy chủ.

| Loại             | Giao thức | Cổng   | Nguồn cho phép                                          |
| ---------------- | --------- | ------ | ------------------------------------------------------- |
| SSH              | TCP       | `22`   | **Chỉ IP của bạn** nếu được. Nếu không thì `0.0.0.0/0`. |
| Web (cách nhanh) | TCP       | `3000` | `0.0.0.0/0`                                             |
| HTTP             | TCP       | `80`   | `0.0.0.0/0` — chỉ khi dùng Nginx                        |
| HTTPS            | TCP       | `443`  | `0.0.0.0/0` — chỉ khi dùng Nginx                        |

> **Đừng mở `5442`, `6389`, `9010`, `9011` ra Internet.** Cơ sở dữ liệu của học
> sinh nằm sau ba cổng đó. Chúng chỉ cần truy cập được từ chính máy chủ.

### 2.2. Firewall trên máy chủ (UFW)

Security Group của nhà cung cấp và UFW là **hai lớp khác nhau**. Nên bật cả hai:
nếu một lớp bị cấu hình sai, lớp còn lại vẫn giữ.

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

sudo ufw allow 22/tcp          # SSH — làm TRƯỚC khi bật ufw, nếu không sẽ tự khoá mình ra ngoài
sudo ufw allow 3000/tcp        # Web. Bỏ dòng này nếu dùng Nginx.
# sudo ufw allow 80/tcp        # Bật hai dòng này nếu dùng Nginx
# sudo ufw allow 443/tcp

sudo ufw enable
sudo ufw status verbose
```

> ⚠️ **Luôn mở cổng 22 trước khi gõ `ufw enable`.** Bật firewall khi chưa cho
> phép SSH sẽ ngắt ngay phiên đang dùng và bạn mất quyền vào máy.

> **Docker và UFW.** Docker tự ghi luật vào iptables, nên một cổng đã
> `-p 0.0.0.0:...` trong compose **có thể ra Internet dù UFW chặn**. Trong dự án
> này điều đó không xảy ra, vì `docker-compose.yml` chỉ dùng cho Postgres/Redis/
> MinIO và bạn không mở chúng ở Security Group. Nhưng hãy nhớ điều này nếu về sau
> thêm dịch vụ mới.

---

## 3. Cài đặt môi trường trên Ubuntu

Đăng nhập SSH rồi chạy lần lượt.

### 3.1. Cập nhật hệ điều hành

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2. Công cụ cơ bản

```bash
sudo apt install -y git curl ca-certificates ufw
```

### 3.3. Docker và Docker Compose

```bash
curl -fsSL https://get.docker.com | sh
```

Script này cài cả `docker` lẫn plugin `docker compose` (viết rời, không phải
`docker-compose` có gạch nối).

Cho tài khoản hiện tại dùng Docker mà không cần `sudo`:

```bash
sudo usermod -aG docker $USER
```

> ⚠️ **Phải đăng xuất rồi đăng nhập lại** thì nhóm mới có hiệu lực. Nếu bỏ qua
> bước này, bộ chấm bài sẽ không nói chuyện được với Docker và **từ chối khởi
> động**. Kiểm tra bằng lệnh sau, phải chạy được mà không cần `sudo`:

```bash
exit          # thoát SSH
# đăng nhập lại rồi:
docker ps
```

### 3.4. Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Kiểm tra:

```bash
node -v      # phải >= v20.11.0
npm -v
```

Dự án yêu cầu `node >= 20.11.0`. Node 22 hoặc 24 cũng chạy được nếu bạn thích
bản mới hơn.

---

## 4. Kéo mã nguồn

```bash
sudo mkdir -p /opt/dye-lms
sudo chown "$USER":"$USER" /opt/dye-lms

git clone https://github.com/ThaiTaka/DYE-LMS.git /opt/dye-lms
cd /opt/dye-lms
```

Từ đây trở đi, **mọi lệnh đều chạy trong `/opt/dye-lms`**.

---

## 5. Cấu hình tệp .env

```bash
cp .env.example .env
nano .env
```

### 5.1. Những giá trị BẮT BUỘC phải đổi

```env
# ── Mật khẩu cơ sở dữ liệu ────────────────────────────────────────────────
POSTGRES_USER=dye
POSTGRES_PASSWORD=<mật-khẩu-mạnh-tự-đặt>
POSTGRES_DB=dye_lms

# Cổng phải khớp với POSTGRES_PORT ở dưới.
DATABASE_URL=postgresql://dye:<mật-khẩu-mạnh-tự-đặt>@localhost:5442/dye_lms?schema=public

# ── Khoá ký phiên đăng nhập ───────────────────────────────────────────────
AUTH_SECRET=<sinh bằng: openssl rand -base64 32>

# ── Địa chỉ công khai của trang ───────────────────────────────────────────
# Đọc kỹ mục 5.3 trước khi đặt AUTH_URL — có trường hợp phải BỎ TRỐNG.
AUTH_URL=http://<IP_VPS>:3000
AUTH_TRUST_HOST=true

# ── Tài khoản quản trị gốc, dùng cho lần đăng nhập đầu tiên ───────────────
ADMIN_USERNAME=quantri
ADMIN_PASSWORD=<ít nhất 12 ký tự>
ADMIN_DISPLAY_NAME=Quản trị viên

# ── MinIO ─────────────────────────────────────────────────────────────────
S3_ACCESS_KEY=<tự đặt>
S3_SECRET_KEY=<tự đặt>
```

Sinh khoá ký:

```bash
openssl rand -base64 32
```

### 5.2. Những giá trị giữ nguyên

Các cổng đã được đặt sẵn và **khớp với `docker-compose.yml`**, đừng đổi trừ khi
cổng đó đã bị chiếm:

```env
POSTGRES_PORT=5442
REDIS_PORT=6389
MINIO_PORT=9010
MINIO_CONSOLE_PORT=9011

REDIS_URL=redis://localhost:6389
S3_ENDPOINT=http://localhost:9010
S3_BUCKET=dye-projects
```

> **Nếu bạn buộc phải đổi một cổng**, hãy nhớ nó nằm ở **hai chỗ**. Đổi
> `POSTGRES_PORT=5500` thì cũng phải đổi cổng trong `DATABASE_URL` thành `5500`.
> Quên một chỗ là gặp `P1001: Can't reach database server`. `npm run doctor` ở
> mục 8 phát hiện đúng lỗi này.

### 5.3. AUTH_URL — khi nào đặt, khi nào bỏ trống

Đây là biến dễ đặt sai nhất, vì **đặt đúng hay sai phụ thuộc vào cách bạn mở
trang ra Internet**.

Auth.js đọc `AUTH_URL` **trước** khi nhìn tới bất kỳ header nào:

```js
const envUrl = envObject.AUTH_URL ?? envObject.NEXTAUTH_URL;
if (envUrl) {
  url = new URL(envUrl);
} // thắng tuyệt đối
else {
  detectedHost = x - forwarded - host ?? host;
}
```

Nghĩa là **khi `AUTH_URL` có giá trị thì `AUTH_TRUST_HOST` không còn tác dụng**,
và mọi chuyển hướng đăng nhập đều bị ghim vào đúng tên miền đó.

| Cách bạn mở trang                                   | Đặt `AUTH_URL`?                          | Vì sao                                 |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------------- |
| IP tĩnh của VPS, ví dụ `http://103.x.x.x:3000`      | **Có**                                   | Địa chỉ không đổi, ghim vào là đúng    |
| Tên miền + Nginx + HTTPS                            | **Có** — `https://lms.truong-cua-ban.vn` | Như trên                               |
| Cloudflare **quick tunnel** (`*.trycloudflare.com`) | **KHÔNG — để trống**                     | Tên miền đổi sau mỗi lần khởi động lại |
| Ngrok miễn phí, hoặc bất kỳ tunnel tạm nào          | **KHÔNG — để trống**                     | Như trên                               |

Khi để trống, origin được lấy từ chính request, nên trang chạy đúng trên
localhost, sau tunnel, và sau proxy mà không phải cấu hình lại lần nào. Lúc đó
`AUTH_TRUST_HOST=true` mới là thứ có tác dụng — và nó **bắt buộc** phải bật khi
có proxy đứng trước.

```env
# VPS có IP tĩnh hoặc tên miền:
AUTH_URL=http://103.x.x.x:3000
AUTH_TRUST_HOST=true

# Dùng Cloudflare quick tunnel — bỏ trống, chỉ giữ dòng dưới:
# AUTH_URL=
AUTH_TRUST_HOST=true
```

> Đặt `AUTH_URL` bằng một địa chỉ tunnel tạm là lỗi âm thầm khó chịu nhất: trang
> vẫn mở được, nhưng sau khi đăng nhập người dùng bị đẩy sang một tên miền đã
> không còn tồn tại.

### 5.4. Ba cái bẫy hay gặp khi dán giá trị

**1. Dán URL từ cửa sổ chat.** Nhiều nơi copy ra dạng liên kết Markdown:

```env
# SAI — đây là liên kết Markdown, không phải URL
AUTH_URL=[http://1.2.3.4:3000](http://1.2.3.4:3000)

# ĐÚNG
AUTH_URL=http://1.2.3.4:3000
```

Bộ nạp môi trường **tự gỡ được** dạng này để trang không sập, nhưng
`npm run doctor` vẫn cảnh báo cho tới khi bạn sửa hẳn trong tệp — vì
`docker compose` đọc `.env` trực tiếp và không đi qua bộ nạp đó.

**2. Đừng bọc giá trị trong dấu nháy nếu không cần.** `.env` không phải shell.

**3. `NODE_ENV` trong `.env` bị cố tình bỏ qua.** Giá trị đó thuộc về công cụ
đang chạy: `next build` tự đặt `production`. Nếu tệp áp được `development` lên
một bản build thật thì trang sẽ nhận Content-Security-Policy dành cho môi trường
phát triển (có `unsafe-eval`) — nên bộ nạp không bao giờ đọc `NODE_ENV` từ tệp.

### 5.5. Bảo vệ tệp .env

```bash
chmod 600 .env
```

Tệp này chứa mật khẩu cơ sở dữ liệu và khoá ký phiên. Nó đã nằm trong
`.gitignore`, nên **sẽ không bao giờ được đẩy lên GitHub** — đồng thời cũng có
nghĩa là sửa `.env` trên máy chủ này không lan sang máy nào khác.

---

## 6. Khởi động dịch vụ nền bằng Docker

```bash
npm run infra:up
```

Lệnh này chạy `docker compose up -d postgres redis minio minio-init`, tức là
**chỉ** dựng ba dịch vụ nền. Web và bộ chấm bài sẽ chạy bằng Node ở mục sau.

Kiểm tra:

```bash
docker ps
```

Phải thấy đúng ánh xạ cổng như sau:

```
dye-lms-postgres-1   Up (healthy)   0.0.0.0:5442->5432/tcp
dye-lms-redis-1      Up (healthy)   0.0.0.0:6389->6379/tcp
dye-lms-minio-1      Up (healthy)   0.0.0.0:9010->9000/tcp, 0.0.0.0:9011->9001/tcp
```

Cột bên phải đọc là `cổng_máy_chủ -> cổng_trong_container`. Số bên **trái** là số
phải xuất hiện trong `DATABASE_URL`.

---

## 7. Cài thư viện, migration và nạp dữ liệu

### 7.1. Cài thư viện

```bash
npm install
```

Bước `postinstall` tự chạy `prisma generate`. Nếu vì lý do nào đó nó bị bỏ qua,
chạy tay:

```bash
npm run db:generate
```

### 7.2. Tạo bảng

```bash
npm run db:migrate
```

Lệnh này chạy `prisma migrate deploy` — chỉ áp dụng các migration đã có sẵn,
**không bao giờ xoá dữ liệu**. Đây là lệnh đúng cho máy chủ thật.

> 🚫 **Không dùng `npm run db:reset` trên máy chủ thật.** Lệnh đó **xoá sạch toàn
> bộ cơ sở dữ liệu** rồi dựng lại từ đầu — mất hết tài khoản, lớp, bài nộp và
> tiến độ của học sinh. Nó chỉ dành cho máy phát triển.

### 7.3. Nạp chương trình học và tài khoản quản trị

```bash
npm run db:seed
```

Kết quả mong đợi:

```
  1/4  Kiểm tra tuân thủ chương trình học ... OK
  2/4  Nạp chương trình học
         · python-co-ban            30 bài · 170 khối · 39 bài tập
         · lap-trinh-game-pygame    30 bài · 159 khối · 26 bài tập
         · python-nang-cao          30 bài · 160 khối · 25 bài tập
         · microbit-co-ban          30 bài ·  85 khối · 13 bài tập
  3/4  Huy hiệu ... 12 huy hiệu
  4/4  Tài khoản quản trị gốc ... quantri (mới tạo)
  ✓ Hoàn tất — 120 bài học, 574 khối nội dung, 103 bài lập trình, 26 bài trắc nghiệm
```

Seed **an toàn khi chạy lại nhiều lần**: mọi thao tác đều là upsert theo khoá tự
nhiên, nên chạy lần hai không tạo bản sao và không đụng tới tiến độ học sinh.

Seed **chỉ tạo đúng một tài khoản** — quản trị viên gốc. Giáo viên, học sinh và
lớp đều được tạo qua giao diện web, để tên người thao tác nằm trong nhật ký kiểm
toán.

> 🚫 **Đừng chạy `npm run db:demo` trên máy chủ thật.** Nó tạo 15 tài khoản dùng
> chung một mật khẩu đã công bố trong kho mã. Seed tự từ chối khi
> `NODE_ENV=production`, nhưng đừng dựa vào đó.

---

## 8. Kiểm tra bằng npm run doctor

Trước khi chạy ứng dụng, hãy để máy tự đối chiếu cấu hình:

```bash
npm run doctor
```

Khi mọi thứ đúng:

```
  PostgreSQL
    OK    POSTGRES_PORT và DATABASE_URL cùng dùng cổng 5442.
    OK    Container dye-lms-postgres-1 công bố 5442->5432.
    OK    localhost:5442 có phản hồi.
  …
  Migration cơ sở dữ liệu
    OK    Lược đồ đã cập nhật, không còn migration nào chờ.

  ✓ Môi trường khớp với các dịch vụ đang chạy.
```

Công cụ này kiểm tra bốn thứ, và quan trọng nhất là nó **phân biệt được các lỗi
mà Prisma gộp chung thành một câu vô dụng** (`P1001: Can't reach database
server`):

| Nó phát hiện                      | Ví dụ thông báo                                           |
| --------------------------------- | --------------------------------------------------------- |
| Cổng khai báo lệch với URL        | `POSTGRES_PORT=5442 nhưng DATABASE_URL trỏ tới cổng 5432` |
| Container đang chạy ở cổng **cũ** | `Container … đang công bố cổng 5442, không phải 5500`     |
| Không ai trả lời ở cổng đó        | `localhost:5442 không ai trả lời`                         |
| Còn migration chưa chạy           | `Còn 2 migration chưa chạy. Chạy: npm run db:migrate`     |
| Giá trị URL hỏng                  | `AUTH_URL … đây là một liên kết Markdown`                 |

Trường hợp thứ hai là loại khó nhất: `.env` và `docker-compose.yml` khớp nhau
hoàn hảo, container thì đang chạy thật, nên đọc tệp không tìm ra gì. Chỉ có đối
chiếu với cổng Docker **thực sự đang công bố** mới thấy. Cách sửa:

```bash
docker compose up -d --force-recreate postgres
```

`npm run doctor` trả về mã thoát khác 0 khi có lỗi, nên dùng được trong script
triển khai tự động.

---

## 9. Ảnh hộp cát cho bộ chấm bài

Bộ chấm bài chạy code Python của học sinh trong một container **không có mạng**.
Ảnh đó phải được dựng sẵn trên máy chủ:

```bash
npm run judge:images
```

Kiểm tra:

```bash
docker images | grep dye-judge
# dye-judge-pytest   3.12   ...
```

> Thiếu ảnh này thì bài nộp sẽ báo lỗi nội bộ chứ không được chấm. Đây là bước
> hay bị quên nhất khi dựng máy chủ mới.

Muốn chắc chắn hơn, chạy toàn bộ lời giải mẫu qua bộ chấm thật:

```bash
npm run judge:verify
```

---

## 10. Chạy thử ở chế độ production

### 10.1. Dựng bản production

```bash
npm run build
```

### 10.2. Chạy thử

```bash
npm start
```

Lệnh này chạy `turbo run start`, tức là chạy **cả hai**: web (`next start`) và bộ
chấm bài. Kết quả mong đợi:

```
@dye/judge-worker:start: [judge] san sang · 4 viec song song · hang "dye-cham-bai"
@dye/web:start:   ▲ Next.js 15.x
@dye/web:start:   - Local:        http://localhost:3000
@dye/web:start:   - Network:      http://0.0.0.0:3000
```

Dòng `Network: http://0.0.0.0:3000` nghĩa là đã lắng nghe trên mọi giao diện
mạng, nên truy cập được từ ngoài. Mở trình duyệt:

```
http://<IP_VPS>:3000/dang-nhap
```

Đăng nhập bằng `ADMIN_USERNAME` / `ADMIN_PASSWORD` đã đặt trong `.env`.

Nhấn `Ctrl+C` để dừng, rồi sang mục 11 để chạy nền cho đàng hoàng.

> 🚫 **Đừng dùng `npm run dev` trên máy chủ thật.** Chế độ phát triển chậm hơn
> nhiều lần, tốn RAM, và ship Content-Security-Policy lỏng hơn (có `unsafe-eval`)
> để phục vụ Fast Refresh.
>
> Nếu vì lý do nào đó bạn vẫn cần chạy `dev` trên VPS và mở bằng IP công khai,
> phải khai báo origin đó, nếu không Next 15 sẽ chặn `/_next/*` và trang hiện ra
> không có CSS:
>
> ```env
> DEV_ORIGINS=<IP_VPS>:3000
> ```

---

## 11. Cài dịch vụ systemd để chạy nền

Chạy bằng `npm start` trong terminal sẽ tắt ngay khi bạn thoát SSH. Dùng systemd
để hai tiến trình tự khởi động cùng máy và tự bật lại khi lỗi.

### 11.1. Dịch vụ web

```bash
sudo nano /etc/systemd/system/dye-web.service
```

```ini
[Unit]
Description=DYE LMS web (Next.js)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=dye
WorkingDirectory=/opt/dye-lms
ExecStart=/usr/bin/npm run web:start
Restart=always
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 11.2. Dịch vụ bộ chấm bài

```bash
sudo nano /etc/systemd/system/dye-judge.service
```

```ini
[Unit]
Description=DYE LMS judge worker
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=dye
WorkingDirectory=/opt/dye-lms
ExecStart=/usr/bin/npm run judge:start
Restart=always
RestartSec=5
# Bộ chấm bài cần thời gian kết thúc bài đang chấm dở. Mặc định 10 giây sẽ
# SIGKILL giữa chừng và bỏ rơi bài của học sinh mỗi lần triển khai.
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

> Tài khoản chạy dịch vụ (`User=dye`) phải nằm trong nhóm `docker`, nếu không bộ
> chấm bài sẽ không tạo được container:
>
> ```bash
> sudo usermod -aG docker dye
> ```

### 11.3. Bật cả hai

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dye-web dye-judge

sudo systemctl status dye-web dye-judge
```

Xem nhật ký:

```bash
sudo journalctl -u dye-judge -f
sudo journalctl -u dye-web -f
```

Bộ chấm bài khởi động đúng sẽ in **đúng một dòng**:

```
[judge] san sang · 4 viec song song · hang "dye-cham-bai"
```

Nếu thay vào đó là `✗ Thiếu biến môi trường: DATABASE_URL`, thông báo sẽ nói rõ
nó đã tìm trong thư mục nào và đọc được tệp nào — làm theo đúng dòng đó.

---

## 12. Nginx và HTTPS (khuyến nghị)

Mở thẳng cổng 3000 chạy được, nhưng không có HTTPS. Mật khẩu học sinh sẽ đi qua
Internet ở dạng chữ thường. Với một trang có tài khoản trẻ em, nên đặt Nginx phía
trước.

### 12.1. Cài Nginx

```bash
sudo apt install -y nginx
```

### 12.2. Cấu hình

```bash
sudo nano /etc/nginx/sites-available/dye-lms
```

```nginx
server {
    listen 80;
    server_name lms.truong-cua-ban.vn;   # hoặc IP nếu chưa có tên miền

    # Học sinh nộp dự án game, có thể vài MB.
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dye-lms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 12.3. Chứng chỉ HTTPS miễn phí

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lms.truong-cua-ban.vn
```

### 12.4. Sau khi có Nginx

Cập nhật `.env` rồi khởi động lại web:

```env
AUTH_URL=https://lms.truong-cua-ban.vn
AUTH_TRUST_HOST=true
```

```bash
sudo systemctl restart dye-web
```

Và đóng cổng 3000 lại, vì giờ chỉ Nginx cần nói chuyện với nó:

```bash
sudo ufw delete allow 3000/tcp
```

Nhớ đóng cả ở Security Group của nhà cung cấp.

---

## 13. Cập nhật phiên bản mới

```bash
cd /opt/dye-lms

# 1. Sao lưu TRƯỚC (xem mục 14)
./sao-luu.sh

# 2. Lấy mã mới
git pull

# 3. Cài thư viện và sinh lại Prisma client
npm install

# 4. Chạy migration mới, nếu có
npm run db:migrate

# 5. Nạp lại chương trình học (an toàn, chỉ upsert)
npm run db:seed

# 6. Dựng lại
npm run build

# 7. Kiểm tra rồi khởi động lại
npm run doctor
sudo systemctl restart dye-web dye-judge
```

---

## 14. Sao lưu

Tạo `/opt/dye-lms/sao-luu.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

THU_MUC=/opt/dye-lms-sao-luu
NGAY=$(date +%F-%H%M)
mkdir -p "$THU_MUC"

cd /opt/dye-lms

# Cơ sở dữ liệu
docker exec dye-lms-postgres-1 pg_dump -U dye dye_lms \
  | gzip > "$THU_MUC/dye_lms-$NGAY.sql.gz"

# Tệp học sinh nộp (volume MinIO)
docker run --rm \
  -v dye-lms_minio-data:/data:ro \
  -v "$THU_MUC":/sao-luu \
  alpine tar czf "/sao-luu/minio-$NGAY.tar.gz" -C /data .

# Giữ 14 ngày gần nhất
find "$THU_MUC" -name '*.gz' -mtime +14 -delete

echo "Đã sao lưu: $NGAY"
```

```bash
chmod +x /opt/dye-lms/sao-luu.sh
```

Chạy tự động lúc 2 giờ sáng:

```bash
sudo crontab -e
# thêm dòng:
0 2 * * * /opt/dye-lms/sao-luu.sh >> /var/log/dye-sao-luu.log 2>&1
```

Phục hồi:

```bash
gunzip -c /opt/dye-lms-sao-luu/dye_lms-2026-08-26-0200.sql.gz \
  | docker exec -i dye-lms-postgres-1 psql -U dye -d dye_lms
```

---

## 15. Khắc phục sự cố

### `P1001: Can't reach database server`

```bash
npm run doctor
```

Công cụ này nói rõ nguyên nhân là cổng lệch, container chưa chạy, hay stack đang
chạy ở ánh xạ cũ. Xem mục [8](#8-kiểm-tra-bằng-npm-run-doctor).

### Bộ chấm bài không khởi động

```bash
sudo journalctl -u dye-judge -n 50 --no-pager
```

| Dòng nhật ký                            | Nguyên nhân                        | Cách sửa                                    |
| --------------------------------------- | ---------------------------------- | ------------------------------------------- |
| `✗ Thiếu biến môi trường: DATABASE_URL` | Không tìm thấy `.env`              | Kiểm tra `WorkingDirectory` trong unit file |
| `Khong ket noi duoc Docker daemon`      | Tài khoản chưa thuộc nhóm `docker` | `sudo usermod -aG docker dye` rồi restart   |
| Bài nộp luôn báo lỗi nội bộ             | Thiếu ảnh hộp cát                  | `npm run judge:images`                      |

### Trang trắng, hoặc mọi trang trả về lỗi 500

Xem nhật ký web:

```bash
sudo journalctl -u dye-web -n 50 --no-pager
```

`TypeError: Invalid URL` thường là `AUTH_URL` bị hỏng — hay gặp nhất là dán nhầm
dạng liên kết Markdown. `npm run doctor` chỉ ra ngay.

### Không mở được trang từ ngoài

Kiểm tra theo thứ tự từ trong ra ngoài:

```bash
curl -I http://127.0.0.1:3000/dang-nhap   # 1. Ứng dụng có chạy không?
sudo ss -tlnp | grep 3000                 # 2. Có lắng nghe trên 0.0.0.0 không?
sudo ufw status                           # 3. UFW có mở cổng không?
# 4. Security Group của nhà cung cấp có mở cổng không?
```

### Xem lại trạng thái tổng thể

```bash
npm run doctor            # môi trường và cổng
npm run db:status         # migration
docker ps                 # dịch vụ nền
sudo systemctl status dye-web dye-judge
```

---

## 16. Danh sách kiểm tra trước khi mở cho học sinh

- [ ] Firewall nhà cung cấp: chỉ mở `22`, và `3000` (hoặc `80`/`443`)
- [ ] UFW bật, đã cho phép SSH **trước khi** enable
- [ ] `5442`, `6389`, `9010`, `9011` **không** ra Internet
- [ ] `.env` đã đổi `POSTGRES_PASSWORD`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `S3_*`
- [ ] `chmod 600 .env`
- [ ] `AUTH_URL` đúng địa chỉ thật, không phải liên kết Markdown
- [ ] `npm run doctor` → `✓ Môi trường khớp với các dịch vụ đang chạy`
- [ ] `docker images | grep dye-judge` → có `dye-judge-pytest:3.12`
- [ ] `npm run db:migrate` đã chạy, `npm run db:status` báo up to date
- [ ] `npm run db:seed` đã nạp đủ 4 khoá học / 120 bài
- [ ] **Chưa** chạy `db:demo` trên máy chủ thật
- [ ] `systemctl status dye-web dye-judge` → cả hai `active (running)`
- [ ] Đăng nhập được bằng tài khoản quản trị gốc
- [ ] Đã đổi mật khẩu quản trị gốc sau lần đăng nhập đầu
- [ ] Nộp thử một bài Python và thấy được chấm
- [ ] `sao-luu.sh` đã chạy được và có trong crontab
- [ ] (Nếu có tên miền) HTTPS hoạt động, đã đóng cổng 3000

---

## Phụ lục: các lệnh hay dùng

| Việc cần làm             | Lệnh                                       |
| ------------------------ | ------------------------------------------ |
| Kiểm tra môi trường      | `npm run doctor`                           |
| Trạng thái migration     | `npm run db:status`                        |
| Chạy migration           | `npm run db:migrate`                       |
| Nạp lại chương trình học | `npm run db:seed`                          |
| Tạo thêm quản trị viên   | `npm run db:admin`                         |
| Dựng ảnh hộp cát         | `npm run judge:images`                     |
| Kiểm tra lời giải mẫu    | `npm run judge:verify`                     |
| Bật dịch vụ nền          | `npm run infra:up`                         |
| Tắt dịch vụ nền          | `npm run infra:down`                       |
| Xem nhật ký web          | `sudo journalctl -u dye-web -f`            |
| Xem nhật ký chấm bài     | `sudo journalctl -u dye-judge -f`          |
| Khởi động lại tất cả     | `sudo systemctl restart dye-web dye-judge` |
