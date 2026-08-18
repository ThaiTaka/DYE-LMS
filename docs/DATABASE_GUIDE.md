# 🗄 Hướng dẫn cơ sở dữ liệu DYE LMS

> Tài liệu này giải thích cách **xem**, **hiểu** và **thao tác** với cơ sở dữ liệu của DYE LMS — dành cho lập trình viên cần debug, giáo viên kỹ thuật muốn kiểm tra dữ liệu, và bất kỳ ai cần biết một con số trên giao diện thật ra đến từ đâu.

---

## 📋 Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Cách 1 — Prisma Studio (khuyên dùng)](#2-cách-1--prisma-studio-khuyên-dùng)
3. [Cách 2 — pgAdmin / DBeaver / TablePlus](#3-cách-2--pgadmin--dbeaver--tableplus)
4. [Cách 3 — psql trong container](#4-cách-3--psql-trong-container)
5. [Bản đồ các bảng cốt lõi](#5-bản-đồ-các-bảng-cốt-lõi)
6. [Cơ chế phiên đăng nhập bằng token mờ](#6-cơ-chế-phiên-đăng-nhập-bằng-token-mờ)
7. [Câu truy vấn hữu ích](#7-câu-truy-vấn-hữu-ích)
8. [Sửa đổi schema an toàn](#8-sửa-đổi-schema-an-toàn)
9. [Những điều tuyệt đối không làm](#9-những-điều-tuyệt-đối-không-làm)

---

## 1. Tổng quan

| Thông số | Giá trị |
|---|---|
| **Hệ quản trị** | PostgreSQL 16 (Alpine) |
| **ORM** | Prisma 6 |
| **Số model** | 30 |
| **Số enum** | 13 |
| **Cổng (host)** | `5442` — lệch khỏi 5432 để tránh đụng Postgres cài sẵn |
| **Tên database** | `dye_lms` |
| **Người dùng** | `dye` |
| **Schema** | `public` |

Chuỗi kết nối nằm trong `.env`:

```env
DATABASE_URL=postgresql://dye:dye_dev_password_change_me@localhost:5442/dye_lms?schema=public
```

> Có **hai** chuỗi kết nối trong `.env` và chúng khác nhau có chủ đích:
> - `DATABASE_URL` — dùng từ **máy host** (`localhost:5442`), cho `npm run db:*`
> - `DATABASE_URL_DOCKER` — dùng từ **bên trong mạng Docker** (`postgres:5432`), cho service `db-migrate`
>
> Dùng nhầm chuỗi là nguyên nhân phổ biến nhất của lỗi "không kết nối được database".

---

## 2. Cách 1 — Prisma Studio (khuyên dùng)

Đây là cách nhanh nhất và an toàn nhất. Không cần cài thêm gì.

```bash
npm run db:studio
```

Trình duyệt tự mở tại **http://localhost:5555**.

### Vì sao nên dùng Prisma Studio

| Ưu điểm | Ý nghĩa thực tế |
|---|---|
| **Hiểu quan hệ** | Bấm vào `Enrollment` là nhảy thẳng sang `User` và `Class` liên quan |
| **Đúng kiểu dữ liệu** | Enum hiện thành dropdown, không phải chuỗi tự do gõ sai được |
| **Tôn trọng ràng buộc** | Không cho tạo dòng vi phạm khoá ngoại |
| **Không cần cài đặt** | Đã nằm sẵn trong dependency của dự án |

### Thao tác thường dùng

**Xem một học sinh và toàn bộ tiến độ:**
1. Chọn model `User` ở cột trái
2. Lọc `username` = `hs.dung`
3. Bấm vào ô `lessonProgress` để mở danh sách tiến độ của em đó

**Kiểm tra nhánh phân hoá của cả lớp:**
1. Chọn model `TrackAssignment`
2. Sắp xếp theo `tier` — thấy ngay ai đang ở nhánh nào

**Xem một buổi học kèm ghi chú giáo án:**
1. Chọn model `Lesson`
2. Lọc `order` = `17`
3. Cột `teacherNotes` chứa ghi chú nguyên văn từ giáo án gốc — **đây là dữ liệu học sinh không bao giờ nhìn thấy**

> ⚠️ Prisma Studio **ghi thẳng vào database thật**. Không có nút hoàn tác. Cân nhắc trước khi sửa.

Dừng Studio bằng `Ctrl+C` trong terminal đang chạy nó.

---

## 3. Cách 2 — pgAdmin / DBeaver / TablePlus

Dùng khi bạn cần viết SQL thật, xem `EXPLAIN ANALYZE`, hoặc xuất dữ liệu.

### Thông số kết nối

| Trường | Giá trị |
|---|---|
| **Host** | `localhost` |
| **Port** | `5442` |
| **Database** | `dye_lms` |
| **Username** | `dye` |
| **Password** | `dye_dev_password_change_me` |
| **SSL Mode** | `disable` (chỉ môi trường phát triển) |

> Nếu bạn đã đổi `POSTGRES_PORT` hoặc `POSTGRES_PASSWORD` trong `.env`, dùng giá trị bạn đã đặt.

### DBeaver

1. **Database** → **New Database Connection** → chọn **PostgreSQL**
2. Điền thông số ở bảng trên
3. Tab **PostgreSQL** → tích **Show all databases** (tiện khi cần nhìn sang db khác)
4. Bấm **Test Connection** → nếu DBeaver đề nghị tải driver, đồng ý
5. **Finish**

### pgAdmin 4

1. Chuột phải **Servers** → **Register** → **Server**
2. Tab **General**: đặt Name là `DYE LMS`
3. Tab **Connection**: điền thông số ở bảng trên
4. **Save**

Bảng nằm ở: `Servers` → `DYE LMS` → `Databases` → `dye_lms` → `Schemas` → `public` → `Tables`

### TablePlus

**Create a new connection** → **PostgreSQL** → điền thông số → **Connect**

---

## 4. Cách 3 — psql trong container

Không cần cài client nào trên máy:

```bash
docker compose exec postgres psql -U dye -d dye_lms
```

### Lệnh psql cơ bản

| Lệnh | Việc nó làm |
|---|---|
| `\dt` | Liệt kê tất cả bảng |
| `\d "User"` | Mô tả cấu trúc bảng `User` |
| `\d+ "Lesson"` | Mô tả chi tiết kèm kích thước và index |
| `\dn` | Liệt kê schema |
| `\x` | Bật/tắt chế độ hiển thị dọc (rất hữu ích cho bảng nhiều cột) |
| `\q` | Thoát |

> ⚠️ **Tên bảng phải để trong dấu nháy kép.** Prisma đặt tên bảng theo PascalCase (`"User"`, `"LessonProgress"`), còn PostgreSQL mặc định chuyển mọi định danh không nháy về chữ thường. Gõ `SELECT * FROM User` sẽ báo lỗi; phải là `SELECT * FROM "User"`.

Chạy một câu lệnh rồi thoát luôn:

```bash
docker compose exec postgres psql -U dye -d dye_lms -c 'SELECT COUNT(*) FROM "Lesson";'
```

---

## 5. Bản đồ các bảng cốt lõi

30 model chia thành sáu nhóm. Đây là những bảng bạn sẽ chạm tới nhiều nhất.

### 👤 Nhóm 1 — Con người & lớp học

#### `User`
Mọi người trong hệ thống dùng chung một bảng, phân biệt bằng cột `role`.

| Cột | Ghi chú |
|---|---|
| `username` | Định danh đăng nhập. **Học sinh cấp 2 có thể chưa có email**, nên username mới là khoá chính về mặt nghiệp vụ |
| `email` | Tuỳ chọn (`String?`) — chỉ giáo viên và admin có |
| `passwordHash` | **Argon2id**. Không bao giờ là mật khẩu thô |
| `role` | `STUDENT` · `TEACHER` · `ADMIN` |
| `isActive` | **Cột quan trọng nhất về bảo mật.** Đặt `false` là chặn truy cập ngay lập tức — xem [mục 6](#6-cơ-chế-phiên-đăng-nhập-bằng-token-mờ) |
| `mustChangePassword` | Tài khoản do giáo viên tạo bắt đầu với `true`, buộc đổi mật khẩu trước khi làm gì khác |

**Dữ liệu seed:** 1 admin (`admin`), 2 giáo viên (`co.lan`, `thay.minh`), 12 học sinh (`hs.an` … `hs.phuc`).

#### `Class` và `Enrollment`
`Class` thuộc về **đúng một** giáo viên qua `teacherId`. `Enrollment` là bảng nối nhiều-nhiều giữa lớp và học sinh.

Hai bảng này là **xương sống của toàn bộ hệ thống phân quyền**:

```
Class.teacherId = tôi  →  Enrollment(classId, studentId)  →  học sinh
```

Giáo viên chạm được dữ liệu học sinh **chỉ khi** chuỗi quan hệ này tồn tại, và `Enrollment.isActive` phải là `true`. Một học sinh đã rời lớp thì giáo viên cũ không còn đọc được dữ liệu của em nữa — quyền truy cập kết thúc khi quan hệ kết thúc.

**Dữ liệu seed:** `DYE-PY-K7-2026A` (cô Lan · 12 học sinh) và `DYE-GAME-K8-2026A` (thầy Minh · 7 học sinh).

#### `ClassCourse`
Lớp nào đang dạy khoá nào. Một lớp có thể học nhiều khoá.

---

### 📚 Nhóm 2 — Giáo trình

Cấu trúc bốn tầng: **Course → Module → Lesson → LessonBlock**

#### `Course`
Ba dòng, cố định:

| `slug` | `title` | `totalSessions` |
|---|---|---|
| `python-co-ban` | Python Cơ Bản | 30 |
| `lap-trinh-game-pygame` | Lập Trình Game Python | 30 |
| `python-nang-cao` | Python Nâng Cao & Cấu Trúc Dữ Liệu | 30 |

#### `Module`
Nhóm các buổi học. Cột `sessionFrom` / `sessionTo` cho phép hiển thị "Buổi 9–16" mà không phải đếm.

#### `Lesson`
**90 dòng** — 30 buổi × 3 khoá.

| Cột | Ghi chú |
|---|---|
| `order` | Số buổi trong khoá: 1–30 |
| `objectives` | Mảng chuỗi, hiển thị thành checklist _"Sau bài này em sẽ…"_ |
| `status` | `REQUIRED` · `RECOMMENDED` · `OPTIONAL` · `ADVANCED` — **quyết định mẫu số tiến độ** |
| `difficulty` | 1–5. **Công cụ lập kế hoạch cho giáo viên. Không bao giờ hiện ra cho học sinh dưới dạng nhãn** |
| `teacherNotes` | Ghi chú nguyên văn từ giáo án gốc. **Chỉ giáo viên** |
| `isDerived` | `true` khi buổi học được dựng thêm để đủ 30 buổi thay vì được liệt kê rõ trong giáo án gốc |

#### `LessonBlock`
Đây là nơi **phân hoá thật sự** diễn ra.

| Cột | Ghi chú |
|---|---|
| `type` | `THEORY` · `INTERACTIVE_EXAMPLE` · `CODE_PLAYGROUND` · `QUIZ` · `MINI_CHALLENGE` … |
| `tier` | 🌱 `CO_BAN` · ⚡ `THU_THACH` · 🚀 `NANG_CAO` · 🌟 `MO_RONG` |
| `content` | JSONB, cấu trúc khác nhau tuỳ `type` |
| `isOptional` | **Luôn thắng.** Một khối `isOptional = true` không bao giờ trở thành bắt buộc, dù học sinh ở nhánh nào |

> **Một URL phục vụ bốn đối tượng.** Một học sinh nhánh Cơ bản mở Buổi 17 sẽ thấy các khối lượng giác dưới dạng _"🌟 Khám phá thêm"_; học sinh nhánh Nâng cao thấy chính các khối đó là phần bắt buộc. **Không ai bị chuyển sang trang khác, và không có gì bị giấu đi.**

#### `LessonPrerequisite`
Bảng nối tự tham chiếu: buổi nào phải xong trước buổi nào.

> Điều kiện tiên quyết **vẫn chặn ngay cả khi buổi tiên quyết là tuỳ chọn** với em học sinh đó. Nếu không, buổi 30 sẽ mở toang cho học sinh Cơ bản vì buổi 20–29 đều tuỳ chọn với các em. _"Tuỳ chọn"_ nghĩa là _"em không bắt buộc phải làm"_, không phải _"em được nhảy qua"_.

---

### 🎯 Nhóm 3 — Phân hoá & quyền can thiệp của giáo viên

Hai bảng này là công cụ điều khiển của giáo viên.

#### `TrackAssignment`
_"Học sinh A hiện đang làm việc ở nhánh Cơ bản trong khoá Python Cơ Bản."_

| Cột | Ghi chú |
|---|---|
| `studentId` + `courseId` | Khoá duy nhất — một nhánh cho mỗi học sinh mỗi khoá |
| `tier` | Nhánh hiện tại |
| `assignedBy` | Giáo viên đã quyết định. **Khoá ngoại `RESTRICT`** — xem [mục 9](#9-những-điều-tuyệt-đối-không-làm) |
| `note` | Ghi chú riêng của giáo viên, ví dụ _"đang tăng tốc, thử NÂNG CAO tuần sau"_ |

Có thể đảo ngược bất cứ lúc nào. **Học sinh không nhìn thấy nhánh của bạn cùng lớp.**

#### `LessonOverride`
Cửa thoát hiểm của giáo viên: mở khoá, khoá lại, đổi trạng thái, hoặc miễn điều kiện tiên quyết.

| Cột | Ý nghĩa |
|---|---|
| `classId` | Áp cho cả lớp (khi `studentId` là `null`) |
| `studentId` | Áp cho riêng một em — **thắng override cấp lớp** |
| `forceStatus` | Ép trạng thái buổi học |
| `isUnlocked` | `true` = mở thẳng · `false` = khoá lại · `null` = để hệ thống tự quyết theo tiên quyết |
| `waivePrerequisites` | Bỏ qua yêu cầu tiên quyết |
| `reason` | Lý do, cho nhật ký kiểm toán |

**Thứ tự ưu tiên khi xác định trạng thái:**

```
LessonOverride(học sinh)  →  LessonOverride(lớp)  →  Lesson.status
```

---

### 📊 Nhóm 4 — Tiến độ

#### `LessonProgress`
Một dòng cho mỗi cặp (học sinh, buổi học).

| Cột | Ghi chú |
|---|---|
| `state` | `NOT_STARTED` · `IN_PROGRESS` · `COMPLETED` |
| `score` / `maxScore` | Điểm bài học |
| `timeSpentSec` | Thời gian đã dành |
| `completedAt` | Mốc thời gian hoàn thành |

> ⚠️ **Cột `state` là kết quả tính ra, không phải nguồn sự thật.** Nó được tính lại từ `BlockProgress` bởi hàm `syncLessonCompletion()` trong `@dye/core`. Sửa tay cột này sẽ bị ghi đè ở lần hoạt động tiếp theo của học sinh.

#### `BlockProgress`
Chi tiết đến từng khối trong buổi học. **Đây mới là nguồn sự thật.**

Một buổi học được đánh dấu hoàn thành khi **mọi khối `REQUIRED` đối với em học sinh đó** đã xong — khối tuỳ chọn và khối khám phá bị bỏ qua có chủ đích. Một em nhánh Cơ bản phải hoàn thành được buổi học mà không cần chạm vào các thử thách Nâng cao bên trong nó.

#### `Streak` · `XpEvent` · `Badge` · `StudentBadge`
Phần trò chơi hoá. Nhỏ và mang tính khích lệ, không bao giờ mang tính trừng phạt.

---

### 💻 Nhóm 5 — Bài tập & chấm bài

| Bảng | Nội dung |
|---|---|
| `Problem` | Đề bài, gợi ý tăng dần, mã khởi tạo, **`solutionCode` (chỉ giáo viên)** |
| `TestCase` | Ca kiểm thử. `isHidden = false` là ví dụ dạy học; `true` là ca chấm điểm, **không bao giờ gửi về trình duyệt** |
| `PerformanceScenario` | Kịch bản đo hiệu năng cho thử thách Big-O |
| `Submission` | Bài nộp + kết quả chấm |
| `SubmissionTestResult` | Kết quả từng ca kiểm thử |
| `Quiz` · `Question` · `Choice` | Trắc nghiệm. **`Choice.isCorrect` không bao giờ rời khỏi server** |
| `QuizAttempt` · `Answer` | Lượt làm bài của học sinh |

> **Ranh giới an toàn:** tầng dữ liệu trong `apps/web/src/lib/` cố ý loại bỏ `Choice.isCorrect`, `Problem.solutionCode`, các dòng `TestCase` ẩn và `Lesson.teacherNotes` khỏi mọi kiểu dữ liệu trả về. Việc kiểm tra đáp án chạy trong **server action**, không bao giờ ở phía trình duyệt. Có test khẳng định mỗi lựa chọn gửi đi chỉ chứa đúng hai trường `id` và `text`.

---

### 🔐 Nhóm 6 — Phiên & kiểm toán

| Bảng | Nội dung |
|---|---|
| `Session` | Phiên đăng nhập — xem [mục 6](#6-cơ-chế-phiên-đăng-nhập-bằng-token-mờ) |
| `Account` | Bảng chuẩn của Auth.js cho OAuth (chưa dùng) |
| `AuditLog` | Nhật ký hành động: đăng nhập, đổi mật khẩu, đổi nhánh, tạo override |
| `Notification` · `Announcement` | Thông báo hệ thống và thông báo lớp |

---

## 6. Cơ chế phiên đăng nhập bằng token mờ

Đây là phần thiết kế đáng hiểu nhất trong toàn bộ database, vì nó khác hẳn cách JWT thông thường hoạt động.

### Vấn đề cần giải quyết

Yêu cầu của đề bài: **giáo viên vô hiệu hoá một tài khoản học sinh thì truy cập phải bị chặn ngay lập tức.**

JWT tự chứa không làm được điều này. Một JWT đã ký vẫn hợp lệ cho đến khi hết hạn, **bất kể database nói gì**. Đặt `isActive = false` cũng không ảnh hưởng đến token đang nằm trong trình duyệt của học sinh đó.

### Cách DYE LMS giải quyết

```
┌─────────────────────────────────────────────────────────────────┐
│  Cookie trình duyệt                                             │
│  authjs.session-token = "8f3a...c7e1"                           │
│                                                                 │
│  ← Chỉ là 32 byte ngẫu nhiên. KHÔNG chứa thông tin người dùng.  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │  băm SHA-256
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bảng Session                                                   │
│  sessionToken = "a9c2...4f8b"   ← BẢN BĂM, không phải token gốc │
│  userId       = "clx7..."                                       │
│  expires      = 2026-08-25                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │  tra cứu User
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bảng User                                                      │
│  isActive = true   ← KIỂM TRA LẠI Ở MỖI LẦN GỌI                 │
└─────────────────────────────────────────────────────────────────┘
```

### Ba tính chất đạt được

**1. Vô hiệu hoá tức thì.**
`validateSession()` đọc lại `User.isActive` **mỗi lần được gọi**. Đặt `isActive = false` là request kế tiếp bị từ chối — không cần chờ token hết hạn, không cần danh sách đen.

**2. Rò rỉ database không kéo theo chiếm phiên.**
Cột `Session.sessionToken` chứa **bản băm SHA-256** của token, không phải token gốc. Token thật chỉ tồn tại trong cookie của người dùng. Kẻ đọc được toàn bộ bảng `Session` vẫn không dựng lại được cookie hợp lệ nào.

**3. Cookie không tiết lộ gì.**
Cookie chỉ là một khoá tra bảng. Nó không mang tên, vai trò, hay quyền hạn — không có gì để đọc, và không có gì để giả mạo mà không có dòng tương ứng trong database.

> Vì lý do này, các phương thức session của `PrismaAdapter` (Auth.js) **không được dùng** — chúng tra cứu bằng token thô. Tầng này do dự án tự viết: xem `packages/core/src/session.ts` và `apps/web/src/auth.ts`.

### Thao tác thực tế

**Buộc một học sinh đăng xuất khỏi mọi thiết bị:**

```sql
DELETE FROM "Session" WHERE "userId" = '<id-học-sinh>';
```

**Vô hiệu hoá tài khoản (khuyên dùng cách này hơn):**

```sql
UPDATE "User" SET "isActive" = false WHERE username = 'hs.dung';
```

Cách thứ hai tốt hơn: nó chặn cả các phiên đang mở **và** chặn luôn việc đăng nhập lại.

**Xem ai đang có phiên hoạt động:**

```sql
SELECT u.username, u."displayName", s."createdAt", s.expires
FROM "Session" s
JOIN "User" u ON u.id = s."userId"
WHERE s.expires > NOW()
ORDER BY s."createdAt" DESC;
```

---

## 7. Câu truy vấn hữu ích

### Toàn cảnh tiến độ một lớp

```sql
SELECT
  u.username,
  u."displayName",
  COUNT(*) FILTER (WHERE lp.state = 'COMPLETED') AS da_xong,
  MAX(l."order") FILTER (WHERE lp.state = 'COMPLETED') AS buoi_cao_nhat,
  t.tier AS nhanh
FROM "User" u
JOIN "Enrollment" e   ON e."studentId" = u.id AND e."isActive"
JOIN "Class" c        ON c.id = e."classId"
LEFT JOIN "LessonProgress" lp ON lp."studentId" = u.id
LEFT JOIN "Lesson" l          ON l.id = lp."lessonId"
LEFT JOIN "TrackAssignment" t ON t."studentId" = u.id AND t."courseId" = l."courseId"
WHERE c.code = 'DYE-PY-K7-2026A'
GROUP BY u.username, u."displayName", t.tier
ORDER BY da_xong DESC;
```

### Phân bố nhánh trong một khoá

```sql
SELECT t.tier, COUNT(*) AS so_hoc_sinh
FROM "TrackAssignment" t
JOIN "Course" co ON co.id = t."courseId"
WHERE co.slug = 'python-co-ban'
GROUP BY t.tier
ORDER BY
  CASE t.tier
    WHEN 'CO_BAN'    THEN 1
    WHEN 'THU_THACH' THEN 2
    WHEN 'NANG_CAO'  THEN 3
    WHEN 'MO_RONG'   THEN 4
  END;
```

### Buổi học có nhiều nội dung nâng cao nhất

```sql
SELECT
  l."order" AS buoi,
  l.title,
  COUNT(*) FILTER (WHERE b.tier = 'CO_BAN')    AS co_ban,
  COUNT(*) FILTER (WHERE b.tier = 'THU_THACH') AS thu_thach,
  COUNT(*) FILTER (WHERE b.tier = 'NANG_CAO')  AS nang_cao,
  COUNT(*) FILTER (WHERE b.tier = 'MO_RONG')   AS mo_rong
FROM "Lesson" l
JOIN "LessonBlock" b ON b."lessonId" = l.id
JOIN "Course" c      ON c.id = l."courseId"
WHERE c.slug = 'python-co-ban'
GROUP BY l."order", l.title
HAVING COUNT(*) FILTER (WHERE b.tier <> 'CO_BAN') > 0
ORDER BY l."order";
```

### Mọi can thiệp của giáo viên

```sql
SELECT
  l."order" AS buoi,
  l.title,
  COALESCE(s."displayName", '(cả lớp ' || c.code || ')') AS ap_dung_cho,
  o."isUnlocked",
  o."forceStatus",
  o."waivePrerequisites",
  o.reason,
  a."displayName" AS nguoi_tao,
  o."createdAt"
FROM "LessonOverride" o
JOIN "Lesson" l      ON l.id = o."lessonId"
JOIN "User" a        ON a.id = o."createdBy"
LEFT JOIN "User" s   ON s.id = o."studentId"
LEFT JOIN "Class" c  ON c.id = o."classId"
ORDER BY o."createdAt" DESC;
```

### Kiểm tra seed đã chạy đủ

```sql
SELECT
  (SELECT COUNT(*) FROM "Course")      AS khoa_hoc,   -- kỳ vọng 3
  (SELECT COUNT(*) FROM "Lesson")      AS buoi_hoc,   -- kỳ vọng 90
  (SELECT COUNT(*) FROM "LessonBlock") AS khoi,
  (SELECT COUNT(*) FROM "User")        AS nguoi_dung; -- kỳ vọng 15
```

---

## 8. Sửa đổi schema an toàn

### Quy trình chuẩn

**1. Sửa `packages/db/prisma/schema.prisma`**

**2. Tạo migration:**
```bash
npm run db:migrate:dev
```
Prisma hỏi tên migration, sinh file SQL, và áp dụng luôn.

**3. Sinh lại client:**
```bash
npm run db:generate
```

**4. Kiểm tra:**
```bash
npm run typecheck
npm run test
```

### Sửa nội dung giáo án

Nội dung giáo án **không** sửa qua Prisma Studio. Nó sống trong code, ở `packages/db/prisma/seed/courses/`.

```bash
# 1. Sửa file .ts của khoá học tương ứng
# 2. Nạp lại — an toàn, dùng upsert
npm run db:seed
```

> Seed chạy **18 quy tắc kiểm tra tuân thủ giáo án trước khi ghi bất kỳ dòng nào**. Nếu nội dung mới vi phạm — ví dụ đưa `print()` vào buổi 1 của Python Cơ Bản — seed ném `CurriculumViolation` và **không có gì được ghi vào database**. Thông báo lỗi chỉ rõ quy tắc nào và buổi nào.

### Dựng lại database từ đầu

> ⚠️ Xoá toàn bộ dữ liệu.

```bash
npm run db:reset
```

---

## 9. Những điều tuyệt đối không làm

### ❌ Đừng sửa `LessonProgress.state` bằng tay

Cột này được tính lại từ `BlockProgress`. Sửa tay sẽ bị ghi đè ở lần hoạt động tiếp theo của học sinh, và trong lúc đó thanh tiến độ hiển thị sai.

Muốn đánh dấu một buổi đã xong, hãy sửa các dòng `BlockProgress` tương ứng.

### ❌ Đừng xoá `User` của giáo viên bằng `DELETE` trực tiếp

`TrackAssignment.assignedBy` và `LessonOverride.createdBy` trỏ tới `User` với ràng buộc **`RESTRICT`**, không phải `CASCADE`. Đây là chủ ý: một quyết định sư phạm không được biến mất chỉ vì người ra quyết định rời hệ thống.

```sql
-- ❌ Thất bại với lỗi khoá ngoại
DELETE FROM "User" WHERE username = 'co.lan';
```

Dùng luồng xoá an toàn trong giao diện giáo viên (`/giao-vien/tai-khoan`), hoặc **vô hiệu hoá thay vì xoá**:

```sql
-- ✅ Cách nên dùng
UPDATE "User" SET "isActive" = false WHERE username = 'co.lan';
```

### ❌ Đừng sửa `passwordHash` bằng tay

Chuỗi băm Argon2id có định dạng chặt chẽ. Một giá trị không hợp lệ sẽ khoá tài khoản đó vĩnh viễn.

Đặt lại mật khẩu qua giao diện, hoặc sinh chuỗi băm hợp lệ bằng `hashPassword()` trong `@dye/core`.

### ❌ Đừng chạy seed với `NODE_ENV=production`

Seed từ chối chạy trong môi trường production trừ khi `SEED_ALLOW_PRODUCTION=yes`. Đây là chốt chặn cố ý — nó tồn tại để ngăn việc ghi đè dữ liệu học sinh thật bằng tài khoản demo.

### ❌ Đừng commit file `.env`

Nó chứa `AUTH_SECRET` và mật khẩu database. `.gitignore` đã chặn sẵn. Đừng dùng `git add -f` để ép nó vào.

---

<div align="center">

**Xem thêm**
[`02-DATABASE.md`](02-DATABASE.md) — thiết kế schema chi tiết ·
[`01-ARCHITECTURE.md`](01-ARCHITECTURE.md) — quyết định kiến trúc ·
[`SETUP_GUIDE.md`](SETUP_GUIDE.md) — cài đặt & khởi động

</div>
