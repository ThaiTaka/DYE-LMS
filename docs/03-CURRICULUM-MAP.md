# DYE LMS — Curriculum Mapping

The exact content that `prisma db seed` will insert. **No placeholder text.** Three courses ×
30 sessions = **90 lessons**.

Legend
- `⟨derived⟩` — a session **not** enumerated in the source brief. The brief lists 11 topics for
  Course 1 and 4 chapters for Course 3 but specifies 30 sessions each, so the expansion below is
  my reconstruction. Every such lesson is seeded with `isDerived = true` and can be replaced
  from the real plan without touching schema or code. **Course 2 is fully specified by the brief —
  nothing is derived there.**
- Status: `REQ` = REQUIRED · `REC` = RECOMMENDED · `OPT` = OPTIONAL · `ADV` = ADVANCED

---

## Teacher notes → implementation mechanism

Every instructional note in the brief is a build requirement. This table is the compliance checklist.

| # | Teacher note (source) | How it is enforced |
|---|---|---|
| 1 | L1: no heavy syntax, **no `print()`** — avoid cognitive overload | C1·B1–B2 blocks contain zero `print()`. A seed-time assertion greps C1·B1/B2 content for `print(` and fails the build |
| 2 | L2: **exclude `complex`** numbers | Not in any C1 objective, block, quiz or test case. Same seed-time assertion |
| 3 | L3: integrate **format-string** exercises | C1·B6 is dedicated to f-strings; 3 coding problems use them |
| 4 | L6: **differentiate trigonometry** — advanced challenge only | `sin/cos` blocks in C1·B17 carry `tier = NANG_CAO`; the Cơ bản track never renders them |
| 5 | L7: **Tuple/Set theory only**; heavy practice on **List & Dictionary** | C1·B20–B22 (List, Dict) hold 12 coding problems. C1·B23 Tuple/Set has `THEORY` + `QUIZ` blocks and **zero** `CODING` blocks |
| 6 | L10: practical `try/except`; **no deep custom-exception dive** | C1·B27 covers try/except/else/finally + common built-ins. Custom exception classes appear only in Course 3 OOP |
| 7 | L11: Text + JSON; **deprecate CSV** (feels like Excel/boring) | C1·B28 Text, C1·B29 JSON. The `csv` module appears nowhere in the seed |
| 8 | **L7–L11 configurable OPTIONAL/ADVANCED**; some students max out at L5 | C1·B20–B30 seed as `OPT`/`ADV`. C1·B16 is the guaranteed-completion checkpoint. Completion % is computed over *resolved-required* lessons, so stopping at B16 shows **100%** |
| 9 | Pygame M1: **no continuous dry theory** — visual interaction early | C2·B1 renders a window in session one; B3 = falling objects; B4 = sprite moving left/right. Every M1 lesson ends in something on screen |
| 10 | Pygame M2: combine **image loading with drawing early**; close module with a **moving paddle/tank** | C2·B6 merges drawing + image loading into one session. C2·B8 is the paddle/tank capstone |
| 11 | Pygame M3: **split advanced movement & physics into separate focused sessions** before projects; **reorder the Menu lesson** | C2·B9 basic movement, **B10 advanced movement**, **B11 physics** — three distinct sessions. Menu moved to **B15**, immediately before the B16 project, so game-states exist before a menu needs them |
| 12 | Pygame M4: **replace multiplayer with synthesis sessions** | No multiplayer lesson exists. C2·B24/B25/B26 are three consolidation sessions revisiting Platformer, Space Invaders, Maze/Quiz GUI |
| 13 | Flow must be **Theory → Interactive Example → Playground → Mini Challenge** | `LessonBlock.type` ordering, validated by `assertPedagogicalFlow()` on every write |
| 14 | Advanced Ch1: **real-world modelling + PEP8** | C3·B1 is modelling-first (before syntax); C3·B10 is PEP8 + a Library/Shop modelling project |
| 15 | Advanced Ch2: **`network = disabled` by default** | `Problem.networkPolicy` defaults `NONE`. Socket exercises run client+server over `127.0.0.1` inside one `--network=none` container |
| 16 | Advanced Ch3: judge must support **specific dependency environments** | `RuntimeImage.PY_WEB` ships `requests` + a local mock API on `127.0.0.1:8000` fed by `Problem.mockFixtures`. Still zero egress |
| 17 | Advanced Ch4: **Big-O performance challenge**, 100 vs 100 000 | `PerformanceScenario` rows at N = 100 / 1 000 / 10 000 / 100 000; C3·B30 is the dedicated challenge with a charted result |
| 18 | Never label students Weak/Average | `Tier = CO_BAN/THU_THACH/NANG_CAO/MO_RONG` only; ESLint rule bans deficit vocabulary in user-facing strings |

---

## Course 1 — Python Cơ Bản (`python-co-ban`) · 30 buổi

> Guaranteed floor: **B1–B19 REQUIRED**. From **B20 (Collections / Lesson 7)** the course becomes
> optional-by-default, per the teacher note.

### Module 1 · Khởi động cùng Python (B1–B4)

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 1 | Tổng quan khoá học · Python là gì? · Cài đặt môi trường | L1 | REQ | **Không dạy cú pháp nặng, không dùng `print()`** |
| 2 | Làm quen môi trường lập trình & chạy chương trình đầu tiên ⟨derived⟩ | L1 | REQ | Vẫn chưa dạy `print()` như một khái niệm cú pháp |
| 3 | Biến và Kiểu dữ liệu: int, float, string, boolean | L2 | REQ | **Loại trừ `complex`** |
| 4 | Ép kiểu & Thực hành với biến ⟨derived⟩ | L2 | REQ | `int()`, `float()`, `str()`, `type()` |

### Module 2 · Toán tử & Giao tiếp với người dùng (B5–B7)

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 5 | Toán tử số học, so sánh và logic | L3 | REQ | |
| 6 | `print()`, `input()` và **Format String** | L3 | REQ | f-string là trọng tâm |
| 7 | Luyện tập tổng hợp: Máy tính bỏ túi mini ⟨derived⟩ | L3 | REQ | |

### Module 3 · Cấu trúc điều khiển (B8–B11)

| B | Title | Src | Status |
|---|---|---|---|
| 8 | Câu lệnh `if` / `else` | L4 | REQ |
| 9 | `elif` và điều kiện lồng nhau | L4 | REQ |
| 10 | Luyện tập: Phân loại & Ra quyết định ⟨derived⟩ | L4 | REQ |
| 11 | Dự án nhỏ: Chương trình đoán số ⟨derived⟩ | L4 | REQ |

### Module 4 · Vòng lặp (B12–B16)

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 12 | Vòng lặp `for` và `range()` | L5 | REQ | |
| 13 | Vòng lặp `while` | L5 | REQ | |
| 14 | `break`, `continue` và vòng lặp lồng nhau | L5 | REQ | |
| 15 | Luyện tập: Vẽ hình & Bảng cửu chương ⟨derived⟩ | L5 | REQ | |
| 16 | **Ôn tập & Kiểm tra giữa khoá (B1–B15)** ⟨derived⟩ | L5 | REQ | **Mốc hoàn thành đảm bảo** — a student who stops here is marked complete |

### Module 5 · Thư viện chuẩn hữu ích (B17–B19)

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 17 | Module `math` | L6 | REQ | **`sin`/`cos` blocks tiered `NANG_CAO`** |
| 18 | `datetime` — làm việc với ngày giờ | L6 | REQ | |
| 19 | `calendar` & Luyện tập tổng hợp | L6 | REQ | |

### Module 6 · Cấu trúc dữ liệu Python (B20–B23) — optional from here

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 20 | List — Danh sách | L7 | OPT | **Practice-heavy** (6 problems) |
| 21 | Thực hành nâng cao với List ⟨derived⟩ | L7 | OPT | |
| 22 | Dictionary — Từ điển | L7 | OPT | **Practice-heavy** (6 problems) |
| 23 | Tuple & Set — Tìm hiểu khái niệm | L7 | OPT | **Lý thuyết + quiz only, no coding blocks** |

### Module 7 · Hàm, Module & Package (B24–B26)

| B | Title | Src | Status |
|---|---|---|---|
| 24 | Hàm do người dùng định nghĩa | L8 | OPT |
| 25 | Tham số, giá trị trả về & phạm vi biến ⟨derived⟩ | L8 | OPT |
| 26 | Module và Package | L9 | OPT |

### Module 8 · Xử lý lỗi & Tệp tin (B27–B29)

| B | Title | Src | Status | Key note |
|---|---|---|---|---|
| 27 | Xử lý ngoại lệ `try` / `except` | L10 | OPT | **Practical only — no custom exception classes** |
| 28 | Đọc & ghi tệp văn bản | L11 | OPT | |
| 29 | Làm việc với JSON | L11 | ADV | **CSV deliberately excluded** |

### Module 9 · Tổng kết (B30)

| B | Title | Src | Status |
|---|---|---|---|
| 30 | Dự án cuối khoá & Trình bày ⟨derived⟩ | — | REC |

---

## Course 2 — Lập Trình Game Python / Pygame (`lap-trinh-game-pygame`) · 30 buổi

> **Fully specified by the brief.** Module boundaries and lesson counts (4 / 4 / 8 / 10 / 4) are
> taken directly from it. Nothing here is derived.

### Module 1 · Nền tảng — học qua tương tác (B1–B4)

| B | Title | Status |
|---|---|---|
| 1 | Giới thiệu lập trình game · Cài đặt Pygame · **Cửa sổ game đầu tiên** | REQ |
| 2 | Ôn Python qua game: biến & kiểu dữ liệu điều khiển hình vẽ | REQ |
| 3 | Điều kiện & vòng lặp qua tương tác: **vật thể rơi** | REQ |
| 4 | Hàm & danh sách qua game: **sprite di chuyển trái/phải** | REQ |

*Note 9 applied: every session ends with something visible and interactive on screen.*

### Module 2 · Cửa sổ, Vẽ, Sự kiện, Sprite (B5–B8)

| B | Title | Status |
|---|---|---|
| 5 | Cửa sổ game, Game loop, FPS & hệ toạ độ | REQ |
| 6 | **Vẽ hình kết hợp tải hình ảnh** (gộp sớm theo ghi chú) | REQ |
| 7 | Xử lý sự kiện: bàn phím & chuột | REQ |
| 8 | Sprite & Sprite Group — **kết mô-đun: điều khiển paddle / xe tăng di chuyển** | REQ |

### Module 3 · Chuyển động, Vật lý, Va chạm, Logic (B9–B16)

| B | Title | Status | Note |
|---|---|---|---|
| 9 | Chuyển động cơ bản: vận tốc & giới hạn màn hình | REQ | |
| 10 | **Chuyển động nâng cao**: gia tốc, ma sát, nảy | REQ | Separate focused session (note 11) |
| 11 | **Vật lý game**: trọng lực & cơ chế nhảy | REQ | Separate focused session (note 11) |
| 12 | Phát hiện va chạm: `Rect` & `Mask` | REQ | |
| 13 | Phản hồi va chạm & logic trò chơi | REQ | |
| 14 | Điểm số, mạng sống, HUD & âm thanh | REQ | |
| 15 | **Menu & quản lý trạng thái game** | REQ | **Reordered** to precede the project (note 11) |
| 16 | Dự án Module 3: **Pong hoàn chỉnh** | REQ | |

### Module 4 · Platformer, AI, Power-up & Tổng hợp (B17–B26)

| B | Title | Status | Note |
|---|---|---|---|
| 17 | Tile map & xây dựng màn chơi Platformer | REQ | |
| 18 | Nhân vật Platformer: nhảy, rơi, va chạm nền | REQ | |
| 19 | Camera & cuộn màn hình | REQ | |
| 20 | AI kẻ địch cơ bản: tuần tra & đuổi theo | REQ | |
| 21 | AI nâng cao: máy trạng thái & mẫu di chuyển | REC | |
| 22 | Power-up, vật phẩm & kho đồ đơn giản | REQ | |
| 23 | Nhiều màn chơi, tăng độ khó & lưu tiến độ | REC | |
| 24 | **Buổi tổng hợp 1**: ghép Platformer hoàn chỉnh | REQ | Replaces multiplayer (note 12) |
| 25 | **Buổi tổng hợp 2**: Space Invaders — ôn sprite, va chạm, điểm số | REQ | Replaces multiplayer (note 12) |
| 26 | **Buổi tổng hợp 3**: Maze / Quiz GUI — ôn thuật toán & giao diện | REQ | Replaces multiplayer (note 12) |

### Module 5 · Gỡ lỗi, Hoàn thiện, Trình bày (B27–B30)

| B | Title | Status |
|---|---|---|
| 27 | Gỡ lỗi & tối ưu hiệu năng game | REQ |
| 28 | Hoàn thiện đồ hoạ, âm thanh & trải nghiệm người chơi | REQ |
| 29 | Đóng gói & nộp dự án cá nhân | REQ |
| 30 | Trình bày dự án & tổng kết khoá học | REQ |

**Personal project targets:** Space Invaders · Platformer · Pong · Maze · Quiz GUI.
Every Pygame lesson's assessment is `PROJECT_UPLOAD`; the pygbag WASM preview is additive and
may report `PREVIEW_UNAVAILABLE` without blocking a submission.

---

## Course 3 — Python Nâng Cao & Cấu Trúc Dữ Liệu (`python-nang-cao`) · 30 buổi

### Chương 1 · Lập trình hướng đối tượng (B1–B10)

| B | Title | Status | Note |
|---|---|---|---|
| 1 | Giới thiệu OOP & tư duy **mô hình hoá thế giới thực** | REQ | Modelling before syntax (note 14) |
| 2 | Class & Object — thuộc tính và phương thức | REQ | |
| 3 | Constructor `__init__` & khởi tạo đối tượng | REQ | |
| 4 | Destructor `__del__` & vòng đời đối tượng | REQ | |
| 5 | Đóng gói (Encapsulation): private, getter/setter, `@property` | REQ | |
| 6 | Kế thừa (Inheritance) & `super()` | REQ | |
| 7 | Đa kế thừa & thứ tự phân giải MRO ⟨derived⟩ | ADV | |
| 8 | Đa hình (Polymorphism) & method overriding | REQ | |
| 9 | Trừu tượng (Abstraction) với `ABC` | REQ | |
| 10 | **Chuẩn PEP8** & dự án OOP: mô hình hoá Thư viện / Cửa hàng | REQ | note 14 |

*Judge mode for this chapter: `UNIT_TEST` — hidden pytest suites instantiate the student's classes
and assert on inheritance, overriding and encapsulation. I/O matching cannot verify OOP.*

### Chương 2 · Lập trình mạng (B11–B16)

| B | Title | Status | Sandbox |
|---|---|---|---|
| 11 | Mạng máy tính căn bản: IP, Port, DNS ⟨derived⟩ | REQ | — |
| 12 | Giao thức HTTP & mô hình Client–Server | REQ | — |
| 13 | TCP vs UDP — so sánh & lựa chọn | REQ | — |
| 14 | Lập trình Socket TCP: Server & Client đầu tiên | REQ | `NONE` + loopback |
| 15 | Dự án: **Chat Server / Client** | REQ | `NONE` + loopback |
| 16 | Socket UDP & tổng kết chương ⟨derived⟩ | REC | `NONE` + loopback |

*Both endpoints run inside a single `--network=none` container over `127.0.0.1`. Real socket
programming, zero external reachability.*

### Chương 3 · Regex & Web API (B17–B22)

| B | Title | Status | Runtime |
|---|---|---|---|
| 17 | Biểu thức chính quy: cú pháp `re` cơ bản | REQ | `PY_BASE` |
| 18 | Regex nâng cao: nhóm, lookahead, thay thế ⟨derived⟩ | ADV | `PY_BASE` |
| 19 | `requests` — GET & query params | REQ | `PY_WEB` |
| 20 | POST, headers, status code & xử lý lỗi HTTP ⟨derived⟩ | REQ | `PY_WEB` |
| 21 | Phân tích JSON & mô hình hoá dữ liệu API | REQ | `PY_WEB` |
| 22 | Dự án: ứng dụng tra cứu dữ liệu từ API | REQ | `PY_WEB` |

*`PY_WEB` serves teacher-authored fixtures on `127.0.0.1:8000`, so `requests` works, grading is
deterministic, and no third-party API can break a lesson.*

### Chương 4 · Tìm kiếm & Sắp xếp (B23–B30)

| B | Title | Status | Judge |
|---|---|---|---|
| 23 | Độ phức tạp Big-O & cách đo hiệu năng ⟨derived⟩ | REQ | `IO_MATCH` |
| 24 | Tìm kiếm tuyến tính & tìm kiếm nhị phân | REQ | `PERFORMANCE` |
| 25 | Jump Search, Interpolation Search & Exponential Search | ADV | `PERFORMANCE` |
| 26 | Sắp xếp cơ bản: Bubble, Selection, Insertion | REQ | `PERFORMANCE` |
| 27 | Sắp xếp chia để trị: Merge Sort | REQ | `PERFORMANCE` |
| 28 | Quick Sort & phân tích trường hợp xấu nhất | REQ | `PERFORMANCE` |
| 29 | Heap & Heap Sort | ADV | `PERFORMANCE` |
| 30 | **Thử thách hiệu năng Big-O (100 → 100 000)** & tổng kết khoá học | REQ | `PERFORMANCE` |

**Performance Challenge feature (note 17):** the student's algorithm is executed against
`PerformanceScenario` rows at N = 100 / 1 000 / 10 000 / 100 000 with seeded generators. Wall time
per N is charted against reference O(n), O(n log n) and O(n²) curves — so the difference between
linear and binary search stops being an abstraction and becomes a shape on a graph.

---

## Seeded assessment inventory (target)

| Course | Quizzes | Coding problems | Test cases | Projects |
|---|---|---|---|---|
| Python Cơ Bản | 30 | ~55 (`IO_MATCH`) | ~330 | 2 |
| Pygame | 30 | 8 (`IO_MATCH`, logic-only) | ~40 | 5 templates + milestones |
| Python Nâng Cao | 30 | ~40 (`UNIT_TEST` + `PERFORMANCE`) | ~260 | 3 |

Every problem ships with: Vietnamese statement, ≥ 2 visible sample tests with explanations,
hidden assessment tests, starter code, progressive hints, and a reference solution that the
Phase 10 test suite executes through the real judge to prove the problem is solvable.
