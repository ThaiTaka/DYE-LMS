# DYE LMS — Architecture Plan

> Da Lat Young Beginners Learning Management System
> Phase 0 (repo analysis) complete · Phase 1 deliverable
> Priority order: **Correctness → Security → Maintainability → UX → Performance → Visual Polish**

---

## 0. Phase 0 findings (repository analysis)

| Item | Result |
|---|---|
| `d:\DYE LMS` file count | **0** — greenfield, nothing to preserve or migrate |
| Git repository | Not initialised locally |
| Remote `github.com/ThaiTaka/DYE-LMS.git` | Exists, **bare/empty**, reachable (exit 0) |
| Node / npm | 24.18.0 / 11.16.0 |
| Docker CLI / Compose | 29.5.3 / v5.1.4 |
| Docker **daemon** | ❌ **not running** — required from Phase 2 onward |
| Python (host) | 3.12.10 (dev convenience only; judge uses containers) |
| pnpm / yarn | absent → **npm workspaces** chosen (no global install needed) |

**Consequence:** no legacy constraints. Every decision below is a free choice justified on merit.

---

## 1. Service topology

```
                            ┌──────────────────────────────┐
      Browser (student)     │  Pyodide (WASM)              │  practice only,
      ───────────────────►  │  instant "Run" — UNTRUSTED    │  NEVER graded
                            └──────────────────────────────┘
             │
             │ HTTPS
             ▼
   ┌───────────────────────┐        ┌──────────────┐
   │  web (Next.js 15)     │◄──────►│  Postgres 16 │   curriculum, users, progress,
   │  App Router + RSC     │        └──────────────┘   submissions, analytics
   │  Auth.js v5 · RBAC    │
   │  REST route handlers  │        ┌──────────────┐
   │  NO docker socket     │◄──────►│  Redis 7     │   BullMQ queues, rate limits,
   └───────────┬───────────┘        └──────────────┘   session cache
               │ enqueue                    ▲
               │                            │ consume
               ▼                            │
   ┌───────────────────────────────────────┴────────┐
   │  judge-worker (Node 24, TypeScript)            │
   │  ONLY service with /var/run/docker.sock        │
   │  spawns ephemeral, locked-down containers      │
   └───────────┬────────────────────────────────────┘
               │ docker run --rm --network=none ...
               ▼
   ┌────────────────────────────────────────────────┐
   │  ephemeral judge sandboxes (pinned images)     │
   │  dye-judge-py-base / -test / -web              │
   └────────────────────────────────────────────────┘

   ┌──────────────┐   Pygame project assets, pygbag WASM builds,
   │  MinIO (S3)  │   served from a SEPARATE origin, attachment-only
   └──────────────┘
```

**Six containers total** in `docker-compose.yml`: `web`, `judge-worker`, `postgres`, `redis`, `minio`, `minio-init`.

### Why Next.js full-stack + one worker (not Next + NestJS + worker)

- The judge is the only genuinely long-running, privileged workload. It *must* be its own process regardless of framework choice — so a third HTTP service buys nothing but a second auth implementation and a serialisation boundary.
- RSC lets teacher analytics and student dashboards query Postgres directly, server-side, with no API round-trip — fewer places for an authorisation check to be forgotten.
- Types are shared through `packages/*` at compile time instead of an OpenAPI codegen step.
- Trade-off accepted: if a mobile app is ever needed, the `/api/v1/*` route handlers already form a REST surface it can consume.

---

## 2. Monorepo layout

```
dye-lms/
├── apps/
│   ├── web/                    Next.js 15 · App Router · React 19 · TS strict
│   └── judge-worker/           BullMQ consumer · Dockerode · verdict engine
├── packages/
│   ├── db/                     Prisma schema, migrations, seed (curriculum lives here)
│   ├── core/                   curriculum engine, gating rules, scoring, tier routing
│   ├── judge-contract/         zod schemas shared by web ⇄ worker (single source of truth)
│   └── ui/                     design system (shadcn/ui + Radix), tokens, a11y primitives
├── sandbox/
│   ├── images/                 Dockerfiles for the 3 judge images
│   ├── seccomp/judge.json      syscall allowlist
│   └── runner/                 Python-side harness (io_match, pytest, perf) copied into images
├── docs/                       these plans + ADRs + security audit
├── e2e/                        Playwright — full acceptance-criteria lifecycle
└── docker-compose.yml / .prod.yml
```

Task orchestration: **Turborepo** (dev dependency only) for `typecheck`, `lint`, `test`, `build` fan-out.

---

## 3. Technology decisions

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | RSC for authz-safe data access; mature Docker story |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess` | Correctness first |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) | Accessible primitives out of the box; large-text, high-contrast theming is trivial |
| ORM | Prisma 6 | Best-in-class migrate + **seed**, which the brief mandates |
| DB | PostgreSQL 16 | JSONB for lesson block content, CTEs for prerequisite DAG, window functions for analytics |
| Auth | Auth.js v5, **database sessions**, Argon2id | DB sessions let a teacher disable an account and kill it instantly; JWT cannot |
| Queue | BullMQ + Redis 7 | Backpressure, retries, per-student concurrency caps |
| Editor | CodeMirror 6 (`@codemirror/lang-python`) | ~10× lighter than Monaco; matters on school Chromebooks |
| Client Python | Pyodide 0.28 | Instant untrusted playground feedback |
| Grading | Docker-in-worker, pinned images | Trusted, isolated, resource-capped |
| Pygame preview | pygbag → WASM, async build | Best effort, with an honest fallback (§5.4) |
| Objects | MinIO (S3 API) | Local parity with any future S3/R2 deploy |
| i18n | `next-intl`, **vi-VN default**, en fallback | The curriculum, teacher notes and audience are Vietnamese |
| Charts | Recharts | Big-O performance visualisation, teacher analytics |
| Tests | Vitest (unit), Testcontainers (integration), Playwright (E2E) | Phase 10 |

---

## 4. Curriculum engine

### 4.1 Content hierarchy

`Course → Module → Lesson → LessonBlock`

The brief forbids "PDF → Next → Quiz". `LessonBlock.type` therefore encodes the mandated pedagogical flow, and the engine **validates block ordering at seed time and on teacher edit**:

```
THEORY → INTERACTIVE_EXAMPLE → PLAYGROUND → MINI_CHALLENGE   (canonical)
             + optional VIDEO / QUIZ / CODING / PROJECT / REFLECTION
```

A lesson that has a `THEORY` block and jumps straight to `QUIZ` fails validation with an explicit error. This is the "UX/UI Engine Rule" expressed as a schema invariant rather than a style guide nobody reads.

### 4.2 Lesson status — the "Lesson 7+ becomes optional" rule

`LessonStatus = REQUIRED | RECOMMENDED | OPTIONAL | ADVANCED`

The teacher note *"some students may max out at Lesson 5"* is modelled as data, not prose:

- Python Basic **L1–L6** → `REQUIRED` (the guaranteed floor for every student)
- Python Basic **L7–L11** → seeded `OPTIONAL`, per-class overridable to `REQUIRED`/`ADVANCED`
- Resolution order at read time:
  `LessonOverride(student)` → `LessonOverride(class)` → `Lesson.status` (seed default)

A student who stops at Loops sees a **complete, celebrated course** — not a progress bar stuck at 45%. Completion percentage is computed over *resolved-required* lessons for that specific student, so the finish line moves with the assigned track.

### 4.3 Gating

Prerequisites form a DAG (`LessonPrerequisite`). `packages/core/gating.ts` resolves, in order:

1. Is the lesson published?
2. Is the student enrolled in a class carrying this course?
3. Explicit `LessonOverride` (teacher force-unlock / force-lock) — **wins over everything**
4. Are all prerequisites satisfied, ignoring any prerequisite the teacher waived?
5. Otherwise → locked, with a human-readable Vietnamese reason string returned to the UI

Teachers get bulk actions: unlock a lesson for a whole class, waive a prerequisite, assign a tier.

### 4.4 Differentiation — positive semantic scale only

```ts
enum Tier { CO_BAN, THU_THACH, NANG_CAO, MO_RONG }
//          Basic     Challenge  Advanced   Extended
```

Hard rules enforced in code and in the design system:

- **No `Weak` / `Average` / `Below grade` label may exist anywhere** — not in the DB, not in an enum, not in an admin-only view, not in a CSV export. A lint rule (`packages/ui/eslint-local/no-deficit-language`) fails the build on a banned-term allowlist (`yếu`, `kém`, `trung bình`, `weak`, `poor`, `failing`, …) in user-facing strings.
- Tier is a property of the **assigned work**, never of the student record. `TrackAssignment` says "Student A is working in Cơ bản on Course 1", which is reversible and invisible to peers.
- `Problem` and `LessonBlock` both carry `tier`, so one lesson serves four audiences from one page. Student A sees the Cơ bản challenge; Student B sees Nâng cao. Same URL, same lesson, no separate "remedial" section to be seen entering.
- Lesson 6's trigonometry (sin/cos) is seeded as `NANG_CAO` blocks — present for those who want them, absent for those who don't, per the teacher note.

---

## 5. Code Judge architecture

### 5.1 Two clearly separated execution paths

| | Pyodide (browser) | Docker judge (server) |
|---|---|---|
| Purpose | Playground, instant feedback, "try it" | Grading, verdicts, scores |
| Trust | **Zero** — student controls it entirely | Trusted |
| Writes to DB | Never | Yes |
| Latency | ~0 ms after warm-up | 0.5–5 s queued |

Any result that touches a grade is produced server-side. The client can never submit a verdict.

### 5.2 Sandbox hardening (per submission)

```
docker run --rm
  --network=none                 # no egress; loopback `lo` still exists — see §5.5
  --memory=256m --memory-swap=256m --memory-swappiness=0
  --cpus=0.5 --pids-limit=64
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m
  --cap-drop=ALL --security-opt=no-new-privileges
  --security-opt=seccomp=sandbox/seccomp/judge.json
  --user 65534:65534             # nobody; code owned by root, unwritable
  --ulimit nofile=64:64 --ulimit fsize=8388608 --ulimit nproc=64
  --oom-kill-disable=false
  dye-judge-py-base@sha256:<pinned>
```

Additional controls:

- **No bind mounts.** Student code is streamed into the container as a tar over the Docker API — the host filesystem is never exposed.
- **Wall-clock watchdog** in the worker independent of the container's own limit; on expiry `container.kill()` then `force remove`. A hung container can never leak.
- **Output cap** 256 KB/test → `OLE` verdict (blocks fork-bomb-by-print log flooding).
- **Images are `pip`-less at runtime** and pinned by digest. No dependency resolution inside a sandbox, ever.
- **Concurrency:** global worker cap + per-student cap of 1 in-flight submission + Redis rate limit (per-minute and per-hour) — the queue itself is a DoS surface.
- **`AuditLog`** row for every submission, every teacher override, every sandbox-policy change.

Documented residual risk: `docker.sock` in `judge-worker` is root-equivalent on the host. Mitigations recorded in Phase 11 — dedicated user namespace, and `--runtime=runsc` (gVisor) as the production recommendation. **Not available on Docker Desktop for Windows**, so it will be documented as a production-Linux deployment step rather than silently claimed.

### 5.3 Judge modes

| Mode | Course | How it works |
|---|---|---|
| `IO_MATCH` | Python Basic | stdin fed, stdout compared. Normalisation is per-test configurable (trailing whitespace, float tolerance) so beginners aren't failed by a stray space |
| `UNIT_TEST` | Python Advanced (OOP) | Student module imported by a hidden `pytest` suite. Tests classes, constructors, inheritance, polymorphism — things I/O matching cannot check |
| `PERFORMANCE` | Algorithms | Hidden tests + strict time/memory limits + `PerformanceScenario` runs at N = 100 / 1 000 / 10 000 / 100 000, charted client-side to make Big-O *visible* |
| `PROJECT_UPLOAD` | Pygame | No automated verdict; teacher rubric review (§5.4) |

### 5.4 Pygame in the browser — stated honestly

pygbag compiles Python + pygame-ce to WebAssembly. It works, but: builds take 20–90 s, it is version-sensitive, and the output needs `COOP`/`COEP` headers to run.

**Therefore it is implemented as a best-effort async preview, never as the grading path:**

1. Student submits a project version → worker attempts a pygbag build in a sandboxed container.
2. Success → artifact to MinIO, served on a separate origin inside a `sandbox`ed iframe with strict CSP + COOP/COEP. Student and teacher get an in-browser playable preview.
3. Failure or timeout → project is marked `PREVIEW_UNAVAILABLE` with the build log attached, and the flow falls back to **Project Upload + teacher review**, which is the *primary, always-available* path from day one.

The upload path is built **first** in Phase 9; the pygbag preview is additive. If it proves unstable it can be disabled by a feature flag with zero loss of function. This satisfies the directive to state the limitation and implement the fallback rather than fake it.

### 5.5 Networking chapter under `network = disabled` — the key insight

The brief mandates `network = disabled` by default, yet Chapter 2 requires socket programming and Chapter 3 requires `requests`. Both are solved **without ever granting egress**:

- **Sockets (Ch. 2):** `--network=none` still provisions a loopback interface. A TCP/UDP chat server and its client both run **inside the same container** over `127.0.0.1`. Fully functional socket exercises, zero external reachability.
- **`requests` / Web API (Ch. 3):** the `dye-judge-py-web` image ships a **local mock API server** bound to `127.0.0.1:8000`, started before the student's code, serving deterministic JSON fixtures authored by the teacher. `requests.get("http://localhost:8000/api/students")` works, results are reproducible, and grading never depends on a third-party API being up.

`SandboxPolicy` remains in the schema (`NONE | LOOPBACK_ONLY | EGRESS_ALLOWLIST`) with `EGRESS_ALLOWLIST` gated behind an explicit teacher authorisation + audit-log entry, per the security policy. In practice the seeded curriculum never needs it.

---

## 6. Pygame Project Workspace — upload security

Threat: a student uploads a malicious file that later executes on the host or in another user's browser.

- **Allowlist** extensions *and* magic-byte sniffing: `.py .png .jpg .jpeg .wav .ogg .mp3 .ttf .json .md .txt`. Declared MIME is ignored.
- Per-file 5 MB, per-version 50 MB, ≤ 200 files, ≤ 8 path segments.
- Path normalisation rejects `..`, absolute paths, drive letters, NTFS ADS (`:`), symlinks, and zip-slip on archive upload.
- Content-addressed storage keys (`sha256`) — the student's filename never becomes a filesystem path.
- **Nothing uploaded is ever executed on the host.** Execution only happens inside a judge sandbox, or as WASM in the browser.
- Served from a separate MinIO origin with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and a CSP that blocks script execution — so an uploaded `.py` or crafted image cannot become stored XSS.
- `.py` files are rendered in a read-only CodeMirror viewer with syntax highlighting, never `dangerouslySetInnerHTML`.

Workspace features: create project from template (Space Invaders / Platformer / Pong / Maze / Quiz GUI / Custom), asset + code upload, file tree viewer, immutable **versioned** submissions with notes, milestone tracker, teacher rubric feedback threaded per version.

---

## 7. Security model (summary — full audit in Phase 11)

- **RBAC:** `ADMIN | TEACHER | STUDENT`, enforced in a single `authorize()` guard used by every route handler and server action. Ownership checks are relationship-based (teacher ↔ class ↔ enrollment ↔ student), never role-only — a teacher cannot read another teacher's class.
- **Passwords:** Argon2id. Students are teacher-provisioned (username + password, no email required — appropriate for minors); no self-registration.
- **Sessions:** database-backed, httpOnly + SameSite=Lax + Secure, rotation on privilege change, instant revocation.
- **Input:** every boundary validated with zod. Prisma parameterises all SQL.
- **Headers:** strict CSP (no `unsafe-eval` on the app origin — Pyodide is confined to a dedicated worker origin), HSTS, `X-Frame-Options`, Referrer-Policy.
- **Rate limits:** login, submission, upload, password reset.
- **Minors' data:** no analytics/telemetry to third parties, no public student profiles, no leaderboard exposing rankings by name (opt-in class-level only), full data-export/delete path.

---

## 8. UX principles (Phases 5–6)

Every student page answers the four mandated questions above the fold:

| Question | UI element |
|---|---|
| Where am I? | Course → Module → Lesson breadcrumb + step rail through the block sequence |
| What did I learn? | Objectives checklist, ticked as blocks complete |
| What's next? | One primary CTA — "Tiếp tục: Bài 6 · Vòng lặp for" |
| What's my score? | Score chip on the lesson, XP + badges on the dashboard |

Constraints: base font ≥ 16 px (18 px body in student views), tap targets ≥ 44 px, WCAG 2.1 AA contrast, keyboard-navigable, one primary action per screen, never more than 5 top-level nav items. Gamification is bounded to XP, streaks, badges and per-lesson celebration — no public shaming mechanics, no timers that induce panic.

Teacher analytics: course/lesson completion, average and median scores, **most-failed quiz questions and test cases**, students falling behind (velocity below cohort median), students progressing quickly (candidates for `NANG_CAO` / `MO_RONG` promotion) — each with a one-click action to adjust that student's track.

---

## 9. Open assumption carried into Phase 2

The brief enumerates **11 lesson topics** for Python Basic and **4 chapters** for Python Advanced, but specifies **30 sessions** for each. Pygame is fully enumerated (4+4+8+10+4 = 30). The mapping from topics to 30 sessions for Courses 1 and 3 is therefore *derived* — see `03-CURRICULUM-MAP.md`, where every derived session is marked `⟨derived⟩`. If the source lesson-plan documents exist, dropping them into `docs/source/` will let the seed be corrected to the real breakdown before Phase 2 locks it in.
