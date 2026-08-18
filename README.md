<div align="center">

# 🐍 DYE LMS

**Da Lat Young Beginners — Learning Management System**

_Nền tảng dạy lập trình Python dành riêng cho học sinh trung học cơ sở._

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)

</div>

---

## Dự án này là gì?

DYE LMS là hệ thống quản lý học tập được viết riêng cho một bài toán cụ thể: **dạy Python cho học sinh lớp 6–9 ở Đà Lạt**, theo đúng ba giáo án Python đã được biên soạn sẵn, cộng thêm phần lập trình phần cứng Micro:bit — tổng cộng 94 buổi học nội dung thật.

Đây không phải là một LMS đa dụng được cấu hình lại. Từng quyết định kỹ thuật trong repo này — từ cách tính thanh tiến độ đến việc chọn màu hổ phách thay vì màu đỏ — đều bắt nguồn từ một ràng buộc sư phạm cụ thể, và được ghi chú lại ngay cạnh dòng code tạo ra nó.

### Người dùng cuối là ai

| Vai trò | Họ cần gì |
|---|---|
| **Học sinh** (11–15 tuổi) | Biết mình đang ở đâu, học được gì, làm gì tiếp theo — không cần hỏi ai |
| **Giáo viên** | Nhìn ra ai đang đi chậm, ai đang đi nhanh, và can thiệp được ngay trong một cú nhấp |
| **Quản trị viên** | Vận hành nhiều lớp, nhiều khoá, nhiều giáo viên mà không phá vỡ ranh giới dữ liệu |

---

## 🌱 Triết lý cốt lõi: thang đo tích cực

Đây là ràng buộc quan trọng nhất của toàn bộ dự án, và nó được **thực thi bằng code**, không chỉ nằm trong tài liệu.

> **Hệ thống không bao giờ được gọi một học sinh là "Yếu", "Trung bình", hay bất kỳ nhãn thiếu hụt nào.**

Thay vào đó, DYE LMS mô tả **công việc được giao**, chứ không mô tả **con người**:

<div align="center">

| 🌱 **Cơ bản** | ⚡ **Thử thách** | 🚀 **Nâng cao** | 🌟 **Mở rộng** |
|:---:|:---:|:---:|:---:|
| Nền tảng vững | Đẩy thêm một bậc | Đi sâu hơn | Vượt ra ngoài giáo án |

</div>

Bốn nhánh này **có thể đảo ngược bất cứ lúc nào**, do giáo viên quyết định, và **học sinh không nhìn thấy nhánh của bạn cùng lớp**. Một em ở nhánh Cơ bản không hề biết mình "ở nhánh thấp hơn" — em chỉ đơn giản thấy bài học của mình.

### Ba nguyên tắc được cài vào hệ thống

**1. Thanh tiến độ phải đầy được.**
Mẫu số của thanh tiến độ chỉ tính **phần bắt buộc của riêng em học sinh đó**, không phải toàn bộ khoá học. Python Cơ Bản có 30 buổi, nhưng giáo án ghi rõ nhiều em sẽ dừng quanh phần Vòng lặp. Buổi 1–19 là nền tảng bắt buộc; buổi 20–30 là tuỳ chọn.

> Một em hoàn thành buổi 19 phải thấy **100%**, không phải một thanh mắc kẹt ở 63%.
> Một thanh tiến độ không bao giờ đầy được là một thanh tiến độ dạy đứa trẻ rằng nó đang tụt lại phía sau.

**2. Nội dung nâng cao là phần thưởng, không phải cánh cửa khoá.**
Khi một khối nội dung nằm trên nhánh của học sinh, hệ thống **không giấu nó đi**. Nó hiện ra với viền vàng nét đứt và dòng chữ _"🌟 Khám phá thêm — Không làm cũng không sao cả."_ Nhiệm vụ thưởng, không phải biển cấm.

**3. Trả lời sai không bao giờ có màu đỏ.**
Màu đỏ trong hệ thống được dành riêng cho **lỗi kỹ thuật thật sự**. Một câu trả lời sai trong bài học là một bước của quá trình học, nên nó hiện màu hổ phách kèm dòng chữ _"↻ Thử lại nhé"_. Trên màn hình của một đứa trẻ 12 tuổi, màu đỏ đọc ra thành sự trừng phạt.

---

## 📚 Bốn khoá học

Toàn bộ nội dung được seed sẵn vào cơ sở dữ liệu — **94 buổi học thật, không có một dòng Lorem Ipsum nào**.

### 🐍 Python Cơ Bản
> _30 buổi · Từ phép tính đầu tiên đến chương trình hoàn chỉnh_

Nền móng. Bắt đầu từ việc dùng Python như một chiếc máy tính bỏ túi — **buổi 1 cố ý chưa dạy `print()`**, đúng theo ghi chú của giáo án, để học sinh làm quen với biểu thức trước khi làm quen với cú pháp. Kết thúc ở chương trình hoàn chỉnh có xử lý file và ngoại lệ.

Buổi 1–19 là phần nền tảng đảm bảo. Buổi 20–30 mở rộng cho những em đi nhanh hơn.

### 🎮 Lập Trình Game Python
> _30 buổi · Từ cửa sổ trống đến trò chơi người khác chơi được_

Pygame. Vòng lặp game, va chạm, tài nguyên, âm thanh, màn hình menu (**đã được xếp lại thứ tự theo yêu cầu của giáo án**), và một dự án hoàn chỉnh mà học sinh có thể đưa cho bạn mình chơi thử.

Module 4 thay phần multiplayer bằng các buổi tổng hợp — quyết định này đến từ giáo án, không phải từ giới hạn kỹ thuật.

### ⚡ Python Nâng Cao & Cấu Trúc Dữ Liệu
> _30 buổi · OOP, Mạng, Web API và Thuật toán_

Lập trình hướng đối tượng, giao tiếp mạng, Web API, và cấu trúc dữ liệu. Bao gồm phần **thử thách hiệu năng Big-O** mà giáo án yêu cầu bắt buộc: học sinh phải tự đo được sự khác biệt giữa hai thuật toán, không chỉ đọc về nó.

### 🤖 Lập trình Micro:bit Cơ Bản
> _Module 1 · Từ khối lệnh đầu tiên đến board mạch nhấp nháy trong tay em_

Phần cứng và IoT. Học sinh **kéo thả khối lệnh** trong MakeCode — không gõ cú pháp, không lo thiếu
dấu hai chấm — rồi tải tệp `.hex` về và thả vào board Micro:bit thật.

Module 1 dạy năm khối nền tảng: `forever`, `show string`, `show icon`, `pause`, `clearScreen`.

Bài Micro:bit **không chấm tự động**: chương trình chạy trên board thật, không có đầu ra nào để máy
so sánh. Thầy cô đọc khối lệnh rồi chấm — đó là câu trả lời trung thực, không phải cách làm tạm.

> **Phạm vi hiện tại:** chỉ Module 1 được viết, đúng theo phần đề bài đã đặc tả. Các module sau
> **cố ý chưa bịa ra** — nội dung bịa sẽ trông y hệt nội dung thật trong cơ sở dữ liệu.

> **Về việc tuân thủ giáo án:** ghi chú của người soạn giáo án được xử lý như **ràng buộc kỹ thuật bắt buộc**, không phải gợi ý. Chúng được kiểm tra tự động bởi các quy tắc thực thi được trong [`packages/db/prisma/seed/assertions.ts`](packages/db/prisma/seed/assertions.ts), chạy **trước** khi bất kỳ dòng dữ liệu nào được ghi vào database. Seed sẽ từ chối chạy nếu nội dung vi phạm giáo án.

---

## 🛠 Công nghệ

### Ứng dụng

| Lớp | Lựa chọn | Vì sao |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Server Components giữ đáp án quiz và mã lời giải ở lại phía server |
| **UI** | React 19 + Tailwind CSS v4 | Token thiết kế khai báo bằng cú pháp `@theme`, không cần file config |
| **Ngôn ngữ** | TypeScript `strict` + `noUncheckedIndexedAccess` | Mọi truy cập mảng đều phải xử lý trường hợp `undefined` |
| **Monorepo** | npm workspaces + Turborepo | Các package chia sẻ một `tsconfig.base.json` |

### Dữ liệu & hạ tầng

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| **Database** | PostgreSQL 16 | 30 model · 13 enum |
| **Phần cứng** | BBC Micro:bit + MakeCode | Nhúng qua iframe, chấm thủ công bởi giáo viên |
| **ORM** | Prisma 6 | Migration đầy đủ, seed idempotent |
| **Queue / cache** | Redis 7 | BullMQ cho judge engine (Phase 8) |
| **Object storage** | MinIO (S3-compatible) | Tài nguyên dự án Pygame, bucket private |
| **Container** | Docker Compose | `docker compose up` là đủ để có một hệ thống chạy được với dữ liệu thật |

### Xác thực

**Auth.js v5** với Credentials provider và **phiên đăng nhập lưu trong database bằng token mờ (opaque token)**.

Đây là một lựa chọn có chủ đích và đáng giải thích. Auth.js v5 không hỗ trợ chiến lược `database` session cùng Credentials provider, nên hệ thống ghi đè `jwt.encode` / `jwt.decode`:

```
Cookie của trình duyệt  →  chuỗi ngẫu nhiên vô nghĩa (opaque token)
                              ↓
                        băm SHA-256
                              ↓
                    tra cứu bảng Session trong DB
                              ↓
                  kiểm tra User.isActive MỖI LẦN gọi
```

Kết quả đạt được là điều mà JWT tự chứa không làm được: **vô hiệu hoá một tài khoản sẽ chặn truy cập ngay lập tức**, không phải chờ token hết hạn. Cookie không mang theo bất kỳ thông tin nào về người dùng — nó chỉ là một cái khoá tra bảng.

Mật khẩu băm bằng **Argon2id** (`memoryCost` 19456, `timeCost` 2, `parallelism` 1).

### Phân quyền quan hệ, không phải phân quyền theo vai trò

Đây là quy tắc không thể thoả hiệp trong [`packages/core/src/authz.ts`](packages/core/src/authz.ts):

```
Giáo viên chạm được dữ liệu học sinh CHỈ QUA quan hệ có thật trong database:

    Class.teacherId = tôi  →  Enrollment(classId, studentId)  →  học sinh

KHÔNG BAO GIỜ vì  role === 'TEACHER'
```

Một kiểm tra vai trò đơn thuần sẽ cho phép **bất kỳ giáo viên nào trong hệ thống đọc bài nộp của bất kỳ đứa trẻ nào** — đó chính là kịch bản mà module này tồn tại để ngăn chặn. Bộ test tích hợp chứng minh Giáo viên A không chạm được lớp của Giáo viên B, và học sinh không chạm được bài nộp của bạn cùng lớp.

---

## 🏗 Kiến trúc

```
dye-lms/
├── apps/
│   └── web/                    Next.js 15 · giao diện học sinh & giáo viên
│       └── src/
│           ├── app/            App Router · route theo tiếng Việt
│           ├── components/     React component
│           └── lib/            Tầng dữ liệu server-only
├── packages/
│   ├── core/                   Logic nghiệp vụ · KHÔNG phụ thuộc UI
│   │   └── src/
│   │       ├── authz.ts        Phân quyền quan hệ
│   │       ├── session.ts      Phiên opaque token
│   │       └── curriculum/     Engine gating · tier · tiến độ
│   └── db/                     Prisma schema + seed giáo án thật
│       └── prisma/
│           ├── schema.prisma   30 model · 13 enum
│           └── seed/           90 buổi học · 18 quy tắc kiểm tra giáo án
└── docs/                       Tài liệu kiến trúc & vận hành
```

**Nguyên tắc phân tầng:** `@dye/core` không biết gì về React, và `apps/web` không chứa một dòng logic phân quyền nào. Chỉ có **đúng một chỗ** quyết định "người này có được làm việc này không", và chỗ đó được phủ bởi test tích hợp.

---

## 🚀 Bắt đầu nhanh

```bash
# 1. Sao chép cấu hình
cp .env.example .env

# 2. Sinh AUTH_SECRET và dán vào .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Dựng hạ tầng + migrate + seed giáo án thật
docker compose up -d

# 4. Cài package và chạy
npm install
npm run dev
```

Mở http://localhost:3000 và đăng nhập bằng tài khoản demo.

📖 **Hướng dẫn đầy đủ từ máy tính mới tinh:** [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md)
🗄 **Xem và thao tác với database:** [`docs/DATABASE_GUIDE.md`](docs/DATABASE_GUIDE.md)

### Tài khoản demo

Mật khẩu mặc định cho **tất cả** tài khoản demo: `DyeLms#2026` (đổi bằng biến `SEED_DEMO_PASSWORD`).

| Tài khoản | Vai trò | Bối cảnh |
|---|---|---|
| `admin` | Quản trị viên | Toàn quyền hệ thống |
| `co.lan` | Giáo viên | Lớp `DYE-PY-K7-2026A` · 12 học sinh |
| `thay.minh` | Giáo viên | Lớp `DYE-GAME-K8-2026A` · dùng để kiểm chứng ranh giới dữ liệu |
| `hs.an` | Học sinh | Đi nhanh · 24/30 buổi · nhánh 🚀 Nâng cao |
| `hs.dung` | Học sinh | Đúng mốc nền tảng · 16/30 buổi · nhánh 🌱 Cơ bản |
| `hs.phuc` | Học sinh | Mới bắt đầu · 4/30 buổi · nhánh 🌱 Cơ bản |

> Dữ liệu demo được thiết kế có **độ phân tán thật** để phần phân tích của giáo viên có gì đó thật để hiển thị ngay lần đăng nhập đầu tiên. Tất cả đều tất định — không dùng `Math.random`, nên chạy seed hai lần cho ra dữ liệu giống hệt nhau.

---

## 🧪 Kiểm thử & chất lượng

```bash
npm run typecheck     # TypeScript strict, toàn bộ workspace
npm run lint          # ESLint, --max-warnings 0
npm run test          # Vitest: unit + integration trên Postgres thật
npm run build         # Production build
```

Các cổng chất lượng phải **xanh 100%** trước khi bất kỳ phase nào được coi là hoàn thành. Không có ngoại lệ, không có `// TODO fix later` cho lỗi chức năng.

### Test kiểm tra những gì

- **Bất biến giáo án** — 18 quy tắc chạy trước mỗi lần seed, ví dụ: buổi 1 của Python Cơ Bản không được chứa `print()`
- **Ranh giới phân quyền** — Giáo viên A không đọc được lớp của Giáo viên B; vô hiệu hoá tài khoản chặn truy cập tức thì
- **Phân hoá theo nhánh** — Học sinh Cơ bản và học sinh Nâng cao có **mẫu số tiến độ khác nhau** trên cùng một khoá học
- **An toàn nội dung** — đáp án quiz không bao giờ xuất hiện trong HTML gửi về trình duyệt; markdown chèn thẻ `<script>` chỉ hiện ra thành chữ
- **Khả năng tiếp cận** — axe-core 0 vi phạm; tương phản màu **được tính từ token CSS thật** bằng công thức độ sáng tương đối WCAG, không ước lượng bằng mắt

### ESLint quy tắc riêng: `dye/no-deficit-language`

Repo có một quy tắc lint tự viết chặn từ vựng mang nghĩa thiếu hụt trong code và nội dung. Triết lý sư phạm ở trên không chỉ là lời hứa trong tài liệu — nó **làm hỏng build** nếu bị vi phạm.

---

## 🗺 Lộ trình

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 0–1 | Phân tích & kiến trúc | ✅ Xong |
| 2 | Database + seed giáo án thật | ✅ Xong |
| 3 | Xác thực & phân quyền quan hệ | ✅ Xong |
| 4 | Engine giáo trình: gating · tier · tiến độ | ✅ Xong |
| 5 | Giao diện học sinh | ✅ Xong |
| 6 | Giao diện giáo viên & phân tích | ✅ Xong |
| 7 | Trình soạn code (CodeMirror) | ✅ Xong |
| 8 | Judge engine (Docker sandbox) | ✅ Xong |
| 9 | Workspace dự án Pygame | ✅ Xong |
| 11 | Tích hợp Micro:bit (MakeCode) | ✅ Xong |
| 10 · 12 | Kiểm thử · rà soát bảo mật · triển khai | ⬜ Kế tiếp |

Chi tiết từng phase kèm kết quả kiểm chứng thật: [`docs/04-ROADMAP.md`](docs/04-ROADMAP.md)

---

## 📖 Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md) | Chạy dự án từ máy tính mới khởi động |
| [`docs/DATABASE_GUIDE.md`](docs/DATABASE_GUIDE.md) | Xem, sửa và hiểu cơ sở dữ liệu |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | Quyết định kiến trúc và lý do |
| [`docs/02-DATABASE.md`](docs/02-DATABASE.md) | Thiết kế schema chi tiết |
| [`docs/03-CURRICULUM-MAP.md`](docs/03-CURRICULUM-MAP.md) | Bản đồ 90 buổi học |
| [`docs/04-ROADMAP.md`](docs/04-ROADMAP.md) | Nhật ký phát triển từng phase |
| [`docs/05-NOI-DUNG-CAN-RA-SOAT.md`](docs/05-NOI-DUNG-CAN-RA-SOAT.md) | Bài tập có lời giải mẫu chưa qua được chính nó |

---

## 🔒 Bảo mật

- **Judge engine mặc định tắt mạng.** Chỉ bật khi có chính sách sandbox do giáo viên uỷ quyền tường minh.
- **Đáp án không bao giờ rời khỏi server.** `Choice.isCorrect`, `Problem.solutionCode` và test case ẩn không nằm trong bất kỳ payload nào gửi về trình duyệt.
- **Markdown render thẳng thành React node**, không đi qua chuỗi HTML. Không có `dangerouslySetInnerHTML` trên bất kỳ đường đi nào của nội dung do người dùng soạn.
- **Bucket MinIO là private.** Tài nguyên tải lên được phục vụ qua URL ký sẵn có thời hạn ngắn.

Phát hiện lỗ hổng? Vui lòng báo riêng cho người bảo trì thay vì mở issue công khai.

---

<div align="center">

**DYE LMS** · Học lập trình Python cùng nhau 🐍

_Đà Lạt · 2026_

</div>
