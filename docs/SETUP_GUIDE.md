# 🚀 Hướng dẫn cài đặt & khởi động DYE LMS

> Tài liệu này viết cho tình huống **máy tính vừa mới bật lên**. Làm lần lượt từ trên xuống, không bỏ bước nào, bạn sẽ có một hệ thống chạy được với đầy đủ 90 buổi học thật trong khoảng **10 phút**.

---

## 📋 Mục lục

1. [Chuẩn bị: những thứ cần cài sẵn](#1-chuẩn-bị-những-thứ-cần-cài-sẵn)
2. [Lấy mã nguồn](#2-lấy-mã-nguồn)
3. [Tạo file cấu hình `.env`](#3-tạo-file-cấu-hình-env)
4. [Khởi động Docker](#4-khởi-động-docker)
5. [Dựng hạ tầng và nạp giáo án](#5-dựng-hạ-tầng-và-nạp-giáo-án)
6. [Cài package Node](#6-cài-package-node)
7. [Chạy ứng dụng](#7-chạy-ứng-dụng)
8. [Đăng nhập thử](#8-đăng-nhập-thử)
9. [Quy trình hằng ngày](#9-quy-trình-hằng-ngày)
10. [Bảng lệnh tra cứu nhanh](#10-bảng-lệnh-tra-cứu-nhanh)
11. [Xử lý sự cố](#11-xử-lý-sự-cố)

---

## 1. Chuẩn bị: những thứ cần cài sẵn

Cần đúng ba thứ. Kiểm tra bằng cách mở terminal và gõ từng lệnh:

### Node.js 24 trở lên

```bash
node --version
```

Kết quả mong đợi: `v24.x.x` hoặc cao hơn.

Nếu chưa có, tải tại **https://nodejs.org** (chọn bản LTS). Sau khi cài, **đóng terminal và mở lại** — biến môi trường `PATH` chỉ được nạp khi terminal khởi động.

> Dự án khai báo tối thiểu Node 20.11, nhưng đang được phát triển và kiểm thử trên **Node 24**. Cứ dùng 24 cho khớp.

### npm 11 trở lên

```bash
npm --version
```

Kết quả mong đợi: `11.x.x`. npm đi kèm Node nên thường bạn không phải làm gì thêm.

### Docker Desktop

```bash
docker --version
```

Kết quả mong đợi: `Docker version 29.x.x` hoặc tương đương.

Nếu chưa có, tải tại **https://www.docker.com/products/docker-desktop**.

> **Windows:** Docker Desktop cần bật WSL 2. Trình cài đặt thường tự làm việc này, nhưng nếu bị báo lỗi thì mở PowerShell với quyền Administrator và chạy `wsl --install`, sau đó khởi động lại máy.

---

## 2. Lấy mã nguồn

```bash
git clone https://github.com/ThaiTaka/DYE-LMS.git
cd DYE-LMS
```

Nếu bạn đã có thư mục dự án sẵn trên máy, chỉ cần mở terminal **tại thư mục gốc** của dự án — nơi có file `package.json` và `docker-compose.yml`.

Kiểm tra bạn đang đứng đúng chỗ:

```bash
ls
```

Bạn phải nhìn thấy: `apps/`, `packages/`, `docs/`, `docker-compose.yml`, `package.json`.

---

## 3. Tạo file cấu hình `.env`

Dự án cần một file `.env` ở **thư mục gốc**. File này không có trong Git (cố ý — nó chứa mật khẩu), nên bạn phải tự tạo từ file mẫu.

### Bước 3.1 — Sao chép file mẫu

**macOS / Linux / Git Bash:**
```bash
cp .env.example .env
```

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

### Bước 3.2 — Sinh khoá bí mật cho phiên đăng nhập

Ứng dụng sẽ **từ chối khởi động** nếu thiếu `AUTH_SECRET`. Sinh một chuỗi ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Lệnh này in ra một chuỗi kiểu:

```
kR7xN2mQ8vP1wL5zT9aB3cD6eF4gH0jK2lM8nO5pQ7s=
```

Mở file `.env` bằng trình soạn thảo bất kỳ, tìm dòng:

```env
AUTH_SECRET=replace_me_with_a_32_byte_base64_secret
```

và thay bằng chuỗi vừa sinh:

```env
AUTH_SECRET=kR7xN2mQ8vP1wL5zT9aB3cD6eF4gH0jK2lM8nO5pQ7s=
```

> ⚠️ **Mỗi máy nên có một `AUTH_SECRET` riêng.** Đừng chia sẻ chuỗi này, và tuyệt đối đừng commit file `.env` lên Git — `.gitignore` đã chặn sẵn, nhưng đừng dùng `git add -f` để ép nó vào.

### Bước 3.3 — Các giá trị còn lại

Phần còn lại của `.env` đã có sẵn giá trị dùng được cho môi trường phát triển. Bạn **không cần sửa gì thêm** trừ khi các cổng bên dưới đang bị chương trình khác chiếm:

| Biến | Mặc định | Dùng cho |
|---|---|---|
| `POSTGRES_PORT` | `5442` | PostgreSQL (lệch khỏi 5432 để tránh đụng Postgres bạn đã cài sẵn) |
| `REDIS_PORT` | `6389` | Redis |
| `MINIO_PORT` | `9010` | MinIO API |
| `MINIO_CONSOLE_PORT` | `9011` | MinIO web console |
| `WEB_PORT` | `3000` | Ứng dụng Next.js |

---

## 4. Khởi động Docker

Docker phải **đang chạy** trước khi sang bước tiếp theo.

### Windows / macOS

Mở **Docker Desktop** từ menu Start hoặc Applications. Chờ đến khi biểu tượng con cá voi 🐳 ở khay hệ thống chuyển sang trạng thái ổn định và ghi **"Docker Desktop is running"**.

> Lần khởi động đầu tiên sau khi bật máy thường mất **30–60 giây**. Đừng vội chạy lệnh tiếp theo khi cá voi còn đang động đậy.

### Linux

```bash
sudo systemctl start docker
```

### Xác nhận Docker đã sẵn sàng

```bash
docker ps
```

Nếu Docker đã chạy, bạn thấy một bảng trống có tiêu đề `CONTAINER ID   IMAGE   ...`.
Nếu thấy lỗi `Cannot connect to the Docker daemon`, Docker **chưa** chạy — quay lại chờ thêm.

---

## 5. Dựng hạ tầng và nạp giáo án

Đây là bước quan trọng nhất. Một lệnh duy nhất:

```bash
docker compose up -d
```

### Lệnh này làm gì

| Service | Việc nó làm |
|---|---|
| `postgres` | Dựng PostgreSQL 16, chờ đến khi thật sự nhận kết nối |
| `redis` | Dựng Redis 7 cho hàng đợi và giới hạn tần suất |
| `minio` | Dựng object storage cho tài nguyên dự án Pygame |
| `minio-init` | Tạo bucket và **khoá quyền truy cập công khai** |
| `db-migrate` | Chạy `prisma migrate deploy`, rồi **nạp toàn bộ 90 buổi học thật** |

Lần chạy đầu tiên phải tải image về nên mất **2–5 phút** tuỳ đường truyền. Những lần sau chỉ vài giây.

### Theo dõi quá trình nạp giáo án

```bash
docker compose logs -f db-migrate
```

Bạn sẽ thấy kiểm tra tuân thủ giáo án chạy **trước** khi ghi dữ liệu, rồi tiến trình nạp từng khoá học. Khi thấy dòng tổng kết cuối cùng là xong. Nhấn `Ctrl+C` để thoát chế độ theo dõi (việc này **không** tắt container).

### Kiểm tra tất cả đã chạy

```bash
docker compose ps
```

`postgres`, `redis`, `minio` phải ở trạng thái `running` (và `healthy`).
`db-migrate` và `minio-init` ở trạng thái `exited (0)` — **đúng như vậy**: chúng là tác vụ chạy một lần rồi kết thúc.

> **Vì sao seed chạy được nhiều lần mà không hỏng dữ liệu?**
> Toàn bộ seed dùng `upsert` với id cố định, nên chạy lại chỉ cập nhật chứ không nhân bản. Cứ yên tâm `docker compose up -d` bao nhiêu lần cũng được.

---

## 6. Cài package Node

```bash
npm install
```

Lệnh này cài package cho **cả ba workspace** (`apps/web`, `packages/core`, `packages/db`) trong một lần.

Mất khoảng **1–3 phút** lần đầu.

### Sinh Prisma Client

```bash
npm run db:generate
```

Bước này đọc `schema.prisma` và sinh ra client TypeScript có kiểu đầy đủ. **Bắt buộc** — thiếu nó thì TypeScript sẽ báo không tìm thấy `@prisma/client`.

> Chạy lại lệnh này **mỗi khi `schema.prisma` thay đổi**.

---

## 7. Chạy ứng dụng

```bash
npm run dev
```

Chờ đến khi terminal in ra:

```
▲ Next.js 15.x.x
- Local:   http://localhost:3000
✓ Ready in 2.3s
```

Mở trình duyệt tại **http://localhost:3000**.

> Để dừng server: nhấn `Ctrl+C` trong terminal đang chạy.

---

## 8. Đăng nhập thử

Mật khẩu cho **mọi** tài khoản demo: **`DyeLms#2026`**

Thử lần lượt ba góc nhìn để thấy hệ thống hoạt động:

### 👨‍🎓 Góc nhìn học sinh

Đăng nhập `hs.dung` — em này đã học xong 16/30 buổi, đang ở nhánh 🌱 Cơ bản.

Việc nên thử:
- Bấm nút **"Học tiếp"** trên trang chính → hệ thống đưa thẳng tới đúng buổi tiếp theo, không phải chọn gì
- Vào **Buổi 17** → tìm các khối viền vàng nét đứt ghi _"🌟 Khám phá thêm"_. Đó là nội dung Nâng cao — hiện ra như phần thưởng, không phải cánh cửa khoá
- Làm một câu trắc nghiệm và **cố tình trả lời sai** → phản hồi hiện màu hổ phách kèm _"Thử lại nhé"_, không phải màu đỏ

### 👩‍🏫 Góc nhìn giáo viên

Đăng nhập `co.lan` — chủ nhiệm lớp `DYE-PY-K7-2026A` với 12 học sinh.

Việc nên thử:
- Xem bảng phân tích lớp: tỉ lệ hoàn thành, danh sách cần hỗ trợ, danh sách đi nhanh
- Vào một học sinh cụ thể → đổi nhánh của em đó, hoặc **mở khoá một bài học** đang bị chặn
- Xem giáo trình ở chế độ giáo viên → có phần **Ghi chú giáo án** mà học sinh không nhìn thấy

### 🔒 Thử ranh giới dữ liệu

Đăng nhập `thay.minh` — giáo viên của lớp Pygame, **không** dạy lớp của cô Lan.

Thầy Minh sẽ không thấy học sinh nào của lớp `DYE-PY-K7-2026A`. Đây không phải chuyện ẩn nút trên giao diện: chính tầng phân quyền từ chối, và có test tích hợp chứng minh điều đó.

---

## 9. Quy trình hằng ngày

Sau lần cài đặt đầu tiên, mỗi khi bật máy làm việc bạn chỉ cần **ba bước**:

```bash
# 1. Bật Docker Desktop (chờ cá voi 🐳 ổn định)

# 2. Dựng lại hạ tầng — dữ liệu vẫn còn nguyên trong volume
docker compose up -d

# 3. Chạy ứng dụng
npm run dev
```

Không cần `npm install` lại, không cần seed lại. Dữ liệu PostgreSQL nằm trong Docker volume nên nó **sống sót qua việc tắt máy**.

Khi xong việc:

```bash
docker compose down     # Tắt container, GIỮ dữ liệu
```

---

## 10. Bảng lệnh tra cứu nhanh

### Hạ tầng

| Lệnh | Việc nó làm |
|---|---|
| `docker compose up -d` | Dựng tất cả + migrate + seed |
| `npm run infra:up` | Chỉ dựng Postgres/Redis/MinIO, **không** migrate |
| `docker compose down` | Tắt container, **giữ** dữ liệu |
| `docker compose down -v` | Tắt container và **xoá sạch dữ liệu** ⚠️ |
| `docker compose ps` | Xem service nào đang chạy |
| `docker compose logs -f postgres` | Xem log của một service |

### Cơ sở dữ liệu

| Lệnh | Việc nó làm |
|---|---|
| `npm run db:generate` | Sinh lại Prisma Client (sau khi đổi schema) |
| `npm run db:migrate` | Áp dụng migration đang chờ |
| `npm run db:migrate:dev` | Tạo migration mới từ thay đổi schema |
| `npm run db:seed` | Nạp lại giáo án (an toàn, dùng upsert) |
| `npm run db:studio` | Mở Prisma Studio để xem dữ liệu |
| `npm run db:reset` | **Xoá sạch** rồi dựng lại từ đầu ⚠️ |

### Phát triển

| Lệnh | Việc nó làm |
|---|---|
| `npm run dev` | Chạy dev server |
| `npm run build` | Build bản production |
| `npm run typecheck` | Kiểm tra TypeScript toàn workspace |
| `npm run lint` | Chạy ESLint |
| `npm run test` | Chạy toàn bộ test |
| `npm run format` | Định dạng lại code bằng Prettier |

---

## 11. Xử lý sự cố

### ❌ `Cannot connect to the Docker daemon`

Docker Desktop chưa chạy. Mở nó lên và chờ biểu tượng cá voi ổn định, rồi thử lại.

---

### ❌ `port is already allocated` hoặc `bind: address already in use`

Có chương trình khác đang giữ cổng đó.

**Cách 1 — đổi cổng (khuyên dùng).** Mở `.env`, đổi số cổng bị đụng, ví dụ:

```env
POSTGRES_PORT=5443
```

Nhớ cập nhật `DATABASE_URL` cho khớp:

```env
DATABASE_URL=postgresql://dye:dye_dev_password_change_me@localhost:5443/dye_lms?schema=public
```

Rồi chạy lại `docker compose up -d`.

**Cách 2 — tìm và tắt chương trình đang giữ cổng:**

```bash
# Windows PowerShell
Get-NetTCPConnection -LocalPort 5442 | Select-Object OwningProcess

# macOS / Linux
lsof -i :5442
```

---

### ❌ `MissingSecret` hoặc lỗi 500 ở trang đăng nhập

Thiếu `AUTH_SECRET` trong `.env`. Quay lại [bước 3.2](#bước-32--sinh-khoá-bí-mật-cho-phiên-đăng-nhập).

Nếu đã điền rồi mà vẫn lỗi: **khởi động lại dev server**. Next.js chỉ đọc biến môi trường lúc khởi động, sửa `.env` khi server đang chạy không có tác dụng.

---

### ❌ `Cannot find module '@prisma/client'`

Chưa sinh Prisma Client:

```bash
npm run db:generate
```

---

### ❌ `Can't reach database server at localhost:5442`

Kiểm tra theo thứ tự:

```bash
# 1. Postgres có chạy không?
docker compose ps

# 2. Nếu không thấy postgres đang running:
docker compose up -d postgres

# 3. Nếu đang running nhưng vẫn không kết nối được, xem log:
docker compose logs postgres
```

Cũng kiểm tra `DATABASE_URL` trong `.env` có đúng cổng bạn đang dùng không.

---

### ❌ Đăng nhập báo sai mật khẩu dù gõ đúng

Nhiều khả năng seed chưa chạy. Kiểm tra:

```bash
docker compose logs db-migrate
```

Nếu không thấy log nạp dữ liệu, chạy lại:

```bash
npm run db:seed
```

Cũng nên kiểm tra biến `SEED_DEMO_PASSWORD` trong `.env` — mật khẩu đăng nhập chính là giá trị của biến này (mặc định `DyeLms#2026`).

---

### ❌ Trang trắng hoặc mất hoàn toàn định dạng CSS

Xoá cache build của Next.js:

```bash
# macOS / Linux / Git Bash
rm -rf apps/web/.next

# Windows PowerShell
Remove-Item -Recurse -Force apps/web/.next
```

Rồi chạy lại `npm run dev`.

---

### ❌ Seed báo `CurriculumViolation`

Đây là **tính năng, không phải lỗi**. Seed kiểm tra 18 quy tắc tuân thủ giáo án trước khi ghi bất kỳ dòng dữ liệu nào, và nó vừa từ chối nội dung vi phạm.

Thông báo lỗi ghi rõ quy tắc nào bị vi phạm và ở buổi học nào. Sửa nội dung trong `packages/db/prisma/seed/courses/` cho đúng giáo án, đừng sửa quy tắc kiểm tra.

---

### 🔄 Phương án cuối: dựng lại hoàn toàn từ đầu

> ⚠️ **Lệnh này xoá sạch toàn bộ dữ liệu** — mọi tiến độ học sinh, mọi tài khoản. Chỉ dùng trên máy phát triển.

```bash
docker compose down -v          # Xoá container và volume
rm -rf node_modules             # (PowerShell: Remove-Item -Recurse -Force node_modules)
rm -rf apps/web/.next

npm install
docker compose up -d
npm run db:generate
npm run dev
```

---

## ✅ Danh sách kiểm tra cuối

Trước khi báo là "chạy được", xác nhận đủ những điều sau:

- [ ] `docker compose ps` — postgres, redis, minio đều `running (healthy)`
- [ ] `npm run typecheck` — không lỗi
- [ ] `npm run test` — toàn bộ test xanh
- [ ] http://localhost:3000 mở được trang đăng nhập
- [ ] Đăng nhập `hs.dung` / `DyeLms#2026` vào được trang chính học sinh
- [ ] Nút **"Học tiếp"** đưa đến đúng một buổi học cụ thể
- [ ] Đăng nhập `co.lan` / `DyeLms#2026` thấy được bảng phân tích lớp

Đủ bảy dấu tích là hệ thống đang chạy đúng.

---

<div align="center">

**Vẫn kẹt?** Mở [`docs/04-ROADMAP.md`](04-ROADMAP.md) để xem nhật ký các lỗi đã gặp và cách đã xử lý.

</div>
