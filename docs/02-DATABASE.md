# DYE LMS — Database Plan

PostgreSQL 16 · Prisma 6 · `packages/db`

Design goals, in order: **encode the teacher notes as data** (not prose), make authorisation checks
relationship-based, keep analytics answerable in one query, and never store a deficit label about a child.

---

## 1. Domain map

```
                     ┌────────┐
                     │  User  │  ADMIN | TEACHER | STUDENT
                     └───┬────┘
          ┌──────────────┼───────────────────┐
          │              │                   │
    ┌─────▼─────┐  ┌─────▼──────┐      ┌─────▼──────┐
    │   Class   │  │ Enrollment │      │  Session   │
    │ (teacher) │◄─┤ (student)  │      │  (Auth.js) │
    └─────┬─────┘  └────────────┘      └────────────┘
          │ classCourse
    ┌─────▼──────────────────────────────────────────────┐
    │ Course → Module → Lesson → LessonBlock             │
    │                     │            │                  │
    │        LessonPrerequisite   Problem / Quiz          │
    │        LessonOverride         │        │            │
    │        TrackAssignment    TestCase  Question        │
    └────────────────────┬────────────────┬───────────────┘
                         │                │
                 ┌───────▼──────┐  ┌──────▼───────┐
                 │  Submission  │  │  QuizAttempt │
                 │  + TestResult│  │  + Answer    │
                 └──────────────┘  └──────────────┘
                         │
         ┌───────────────┴───────────────┐
   ┌─────▼──────┐                 ┌──────▼──────┐
   │ LessonProg │                 │ GameProject │→ Milestone
   │ BlockProg  │                 │  → Version  │→ File
   └────────────┘                 └─────────────┘   → Feedback
```

---

## 2. Enumerations (the curriculum rules, as types)

```prisma
enum Role            { ADMIN TEACHER STUDENT }

enum LessonStatus    { REQUIRED RECOMMENDED OPTIONAL ADVANCED }
// L7–L11 of Python Basic seed as OPTIONAL — "some students may max out at Lesson 5"

enum Tier            { CO_BAN THU_THACH NANG_CAO MO_RONG }
// Basic → Challenge → Advanced → Extended. Positive scale only.
// There is deliberately NO enum value expressing deficiency.

enum BlockType       { THEORY INTERACTIVE_EXAMPLE PLAYGROUND MINI_CHALLENGE
                       VIDEO QUIZ CODING PROJECT REFLECTION RESOURCE }

enum JudgeMode       { IO_MATCH UNIT_TEST PERFORMANCE PROJECT_UPLOAD }

enum NetworkPolicy   { NONE LOOPBACK_ONLY EGRESS_ALLOWLIST }
// default NONE, per the security policy

enum RuntimeImage    { PY_BASE PY_TEST PY_WEB }

enum Verdict         { PENDING RUNNING ACCEPTED WRONG_ANSWER
                       TIME_LIMIT_EXCEEDED MEMORY_LIMIT_EXCEEDED
                       OUTPUT_LIMIT_EXCEEDED RUNTIME_ERROR COMPILE_ERROR
                       INTERNAL_ERROR SKIPPED }

enum QuestionType    { MULTIPLE_CHOICE TRUE_FALSE FILL_BLANK SHORT_ANSWER }

enum ProgressState   { NOT_STARTED IN_PROGRESS COMPLETED }

enum ProjectTemplate { SPACE_INVADERS PLATFORMER PONG MAZE QUIZ_GUI CUSTOM }
enum ProjectStatus   { DRAFT SUBMITTED IN_REVIEW CHANGES_REQUESTED APPROVED }
enum PreviewStatus   { NOT_BUILT BUILDING READY UNAVAILABLE }
```

---

## 3. Core tables

### 3.1 Identity & cohorts

| Table | Key columns | Notes |
|---|---|---|
| `User` | `id`, `username @unique`, `email?`, `passwordHash`, `role`, `displayName`, `avatarUrl`, `locale='vi'`, `isActive`, `mustChangePassword` | Students are teacher-provisioned; `email` nullable because minors may not have one |
| `Session` | `sessionToken @unique`, `userId`, `expires` | DB sessions ⇒ instant revocation when `isActive=false` |
| `Class` | `id`, `name`, `code @unique`, `teacherId`, `term`, `isArchived` | e.g. "DYE-PY-K7-2026A" |
| `ClassCourse` | `classId`, `courseId`, `startsAt`, `endsAt` | a class may run more than one course |
| `Enrollment` | `classId`, `studentId`, `enrolledAt`, `isActive` | `@@unique([classId, studentId])` |

**Authorisation invariant:** a teacher may touch a student's data *only* through
`Class.teacherId = me AND Enrollment.studentId = them`. Never by role alone. Every query
helper in `packages/core/authz.ts` takes the actor and enforces this join.

### 3.2 Curriculum

```prisma
model Course {
  id           String   @id @default(cuid())
  slug         String   @unique          // python-co-ban | lap-trinh-game-pygame | python-nang-cao
  title        String                     // Vietnamese, as taught
  subtitle     String?
  description  String
  totalSessions Int                       // 30 for all three
  order        Int
  isPublished  Boolean  @default(false)
  modules      Module[]
}

model Module {
  id          String  @id @default(cuid())
  courseId    String
  order       Int
  title       String
  description String
  lessons     Lesson[]
  @@unique([courseId, order])
}

model Lesson {
  id              String       @id @default(cuid())
  moduleId        String
  order           Int          // global session number 1..30 within the course
  slug            String
  title           String
  summary         String
  objectives      String[]     // shown as the "What did I learn?" checklist
  difficulty      Int          // 1..5, for teacher planning only — never shown as a student label
  estimatedMinutes Int
  status          LessonStatus @default(REQUIRED)
  teacherNotes    String?      // the source lesson-plan note, verbatim, teacher-only
  isDerived       Boolean      @default(false)  // ⟨derived⟩ session, not in the source plan
  isPublished     Boolean      @default(true)
  blocks          LessonBlock[]
  prerequisites   LessonPrerequisite[] @relation("dependent")
  @@unique([courseId_order_via_module])   // enforced with a composite index + check
}

model LessonPrerequisite {
  lessonId    String   // dependent
  requiredId  String   // must be completed first
  @@id([lessonId, requiredId])
}
```

`LessonBlock` is where the mandated flow lives:

```prisma
model LessonBlock {
  id        String    @id @default(cuid())
  lessonId  String
  order     Int
  type      BlockType
  tier      Tier      @default(CO_BAN)   // one lesson serves four audiences
  title     String
  content   Json                          // typed per BlockType by zod in packages/core
  isOptional Boolean  @default(false)
  problemId String?                       // CODING / MINI_CHALLENGE
  quizId    String?                       // QUIZ
  @@unique([lessonId, order])
}
```

`content` is JSONB with a discriminated-union zod schema per `type` — validated on write, so a
malformed block can never reach a student. Ordering is validated by
`assertPedagogicalFlow(blocks)`: a lesson containing `THEORY` may not present `QUIZ` or
`MINI_CHALLENGE` before an `INTERACTIVE_EXAMPLE` or `PLAYGROUND` exists. This is the
"no PDF → Next → Quiz" rule as a database-write invariant.

### 3.3 Differentiation & teacher control

```prisma
model TrackAssignment {                 // "Student A works in Cơ bản on Course 1"
  studentId String
  courseId  String
  tier      Tier
  assignedBy String                     // teacher id
  note      String?                     // teacher-only, e.g. "đang tăng tốc, thử NANG_CAO tuần sau"
  @@id([studentId, courseId])
}

model LessonOverride {                  // teacher force-unlock / lock / restatus
  id          String        @id @default(cuid())
  lessonId    String
  classId     String?                   // class-wide …
  studentId   String?                   // … or one student (student wins)
  forceStatus LessonStatus?
  isUnlocked  Boolean?                  // null = inherit
  waivePrerequisites Boolean @default(false)
  reason      String?
  createdBy   String
  @@index([lessonId, classId, studentId])
}
```

Resolution precedence (implemented once, in `packages/core/gating.ts`, unit-tested in Phase 10):

```
student override  ►  class override  ►  Lesson.status seed default
```

Completion % for a student = completed ÷ **resolved-required** lessons for *that* student.
A student on the Cơ bản track who finishes L1–L6 shows **100%**, not 45%.

### 3.4 Problems, tests, sandbox policy

```prisma
model Problem {
  id            String       @id @default(cuid())
  slug          String       @unique
  title         String
  statement     String        // markdown, Vietnamese
  hints         String[]      // progressive, cost XP not score
  starterCode   String
  solutionCode  String        // teacher-only
  tier          Tier
  judgeMode     JudgeMode
  runtimeImage  RuntimeImage  @default(PY_BASE)
  networkPolicy NetworkPolicy @default(NONE)      // ← security policy default
  timeLimitMs   Int           @default(2000)
  memoryLimitMb Int           @default(256)
  totalPoints   Int           @default(100)
  unitTestCode  String?       // UNIT_TEST mode: hidden pytest suite
  mockFixtures  Json?         // PY_WEB mode: routes served on 127.0.0.1:8000
  testCases     TestCase[]
  perfScenarios PerformanceScenario[]
}

model TestCase {
  id           String  @id @default(cuid())
  problemId    String
  order        Int
  input        String
  expectedOutput String
  isHidden     Boolean @default(false)   // visible samples teach; hidden ones assess
  isSample     Boolean @default(false)
  points       Int     @default(10)
  timeLimitMs  Int?                       // per-test override
  comparison   Json    @default("{\"trimTrailing\":true,\"floatTolerance\":null}")
  explanation  String?                    // shown on failure for SAMPLE tests only
}

model PerformanceScenario {               // the Big-O challenge
  id          String @id @default(cuid())
  problemId   String
  label       String                      // "N = 100 000"
  n           Int
  generator   String                      // named, seeded generator in the runner
  seed        Int
  maxTimeMs   Int
  expectedComplexity String               // "O(n log n)" — shown after the run, for teaching
}
```

`networkPolicy != NONE` requires `authorizedBy` + an `AuditLog` row; the worker refuses to honour
a non-`NONE` policy that lacks one.

### 3.5 Submissions

```prisma
model Submission {
  id           String   @id @default(cuid())
  studentId    String
  problemId    String
  lessonId     String?
  code         String
  verdict      Verdict  @default(PENDING)
  score        Int      @default(0)
  passedTests  Int      @default(0)
  totalTests   Int      @default(0)
  maxTimeMs    Int?
  maxMemoryKb  Int?
  compileError String?
  runnerError  String?              // internal; never shown raw to students
  attemptNo    Int
  createdAt    DateTime @default(now())
  judgedAt     DateTime?
  results      SubmissionTestResult[]
  @@index([studentId, problemId, createdAt])
  @@index([problemId, verdict])     // analytics: most-failed problems
}

model SubmissionTestResult {
  submissionId String
  testCaseId   String
  verdict      Verdict
  timeMs       Int
  memoryKb     Int
  stdout       String?   // truncated to 4 KB, only for non-hidden tests
  stderr       String?   // sanitised: absolute paths and image internals stripped
  @@id([submissionId, testCaseId])
  @@index([testCaseId, verdict])    // analytics: most-failed test cases
}
```

Stderr sanitisation is mandatory: a raw traceback leaks container paths and Python internals that
confuse a 13-year-old. The runner maps common exceptions to friendly Vietnamese explanations while
preserving the original for teachers.

### 3.6 Quizzes

`Quiz` → `Question` (`type`, `prompt`, `explanation`, `points`, `tier`) → `Choice`
(`text`, `isCorrect`) for MCQ/TF; `acceptedAnswers String[]` + `matchMode` (exact /
case-insensitive / normalised / regex) for FILL_BLANK; SHORT_ANSWER is teacher-graded with an
optional keyword rubric.
`QuizAttempt` → `Answer` (`questionId`, `response Json`, `isCorrect`, `pointsAwarded`).

`@@index([questionId, isCorrect])` on `Answer` powers **"most failed questions"** directly.

### 3.7 Progress & gamification

`LessonProgress(studentId, lessonId, state, score, startedAt, completedAt, timeSpentSec)`
`BlockProgress(studentId, blockId, state, completedAt)` — drives the step rail.
`XpEvent(studentId, amount, reason, refId)`, `Badge(slug, name, icon, criteria Json)`,
`StudentBadge`, `Streak(studentId, current, longest, lastActiveDate)`.

Bounded on purpose: no public ranking by name, no loss-framing, no countdowns.

### 3.8 Pygame workspace

`GameProject(studentId, courseId, template, title, description, status, previewStatus)`
`ProjectMilestone(projectId, order, title, dueAt, state)`
`ProjectVersion(projectId, version, note, submittedAt, previewArtifactKey?, buildLog?)`
`ProjectFile(versionId, path, sizeBytes, sniffedMime, sha256, storageKey)`
`Feedback(authorId, targetType, targetId, rubricScores Json, comment, createdAt)`

Versions are immutable once submitted — a teacher's feedback always refers to a fixed snapshot.
`storageKey` is content-addressed; `path` is the sanitised display path only.

### 3.9 Operations

`AuditLog(actorId, action, entityType, entityId, meta Json, ip, userAgent, createdAt)` —
every submission, override, policy change, role change, upload and login attempt.
`Notification(userId, type, title, body, linkUrl, readAt)`.
`Announcement(classId, authorId, title, body, pinnedUntil)`.

---

## 4. Indexing & analytics strategy

| Question the teacher asks | Answered by |
|---|---|
| Course / lesson completion rate | `LessonProgress(lessonId, state)` index + window function |
| Average & median score per lesson | `LessonProgress(lessonId, score)`, `percentile_cont` |
| **Most-failed quiz questions** | `Answer(questionId, isCorrect)` index |
| **Most-failed coding challenges** | `Submission(problemId, verdict)` + `SubmissionTestResult(testCaseId, verdict)` |
| Students falling behind | completed-required-lessons vs class median, over a 14-day window |
| Students progressing quickly | same metric, upper quartile → suggest `NANG_CAO` promotion |

Phase 6 starts with plain SQL/CTE views. If p95 exceeds 300 ms on seeded volume, a nightly
`ClassAnalyticsSnapshot` materialised table is added — measured, not assumed.

---

## 5. Seeding (`packages/db/seed`)

`docker compose up` runs `prisma migrate deploy && prisma db seed`. The seed is **idempotent**
(upsert by stable slug) so a restart never duplicates the curriculum.

Seeded content, per the "no Lorem Ipsum" directive:

1. **3 real courses**, 30 sessions each, with the exact Vietnamese titles from the lesson plans.
2. **Real modules**: Pygame's 5 modules with their true lesson ranges; Advanced's 4 chapters; Basic's 7 grouped modules.
3. **Real lesson titles and objectives** derived from the plan topics — no placeholder text anywhere.
4. **`teacherNotes` verbatim** from the source plans (no `complex` numbers; Tuple/Set theory-only; trig as advanced; CSV deprecated; etc.).
5. **Correct `status`**: Basic L1–L6 `REQUIRED`, L7–L11 `OPTIONAL`; Pygame Module 5 and Advanced Ch. 4 tail `RECOMMENDED`/`ADVANCED` where the plans indicate.
6. **Working problems with real test cases** across all four judge modes — including a genuine
   Big-O performance problem (linear vs binary search at N = 100 → 100 000).
7. **Demo accounts**: 1 admin, 2 teachers, 1 class of 12 students with *varied, realistic* progress
   so teacher analytics has something to show on first login. Credentials in `.env.example`,
   dev-only, and the seed refuses to run against `NODE_ENV=production` without an explicit flag.

Every `⟨derived⟩` session (see `03-CURRICULUM-MAP.md`) carries `isDerived = true`, so the real
breakdown can be swapped in later with a targeted migration rather than a rewrite.

---

## 6. Migration discipline

- One Prisma migration per phase; never edit an applied migration.
- Every migration verified against a fresh volume *and* an existing volume before the phase closes.
- `prisma migrate diff` in CI blocks schema drift between `schema.prisma` and the migration history.
- Seed data changes ship as seed edits, never as data migrations, so a reset is always clean.
