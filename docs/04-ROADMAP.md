# DYE LMS — Implementation Roadmap

12 phases, as mandated. **Every phase ends with the same QA gate** and is not marked complete
until that gate is green.

---

## The QA gate (runs after every phase, no exceptions)

```bash
npm run typecheck      # tsc --noEmit, strict, all workspaces
npm run lint           # eslint + the no-deficit-language rule
npm run test           # vitest unit + integration
npm run db:migrate     # prisma migrate deploy against a FRESH volume and an EXISTING volume
npm run db:seed        # idempotent — running twice must not duplicate
docker compose build   # all images build
npm run test:a11y      # axe-core on changed routes
npm run check:responsive  # Playwright 360 / 768 / 1280 / 1920 px
```

**Bug protocol:** Detect → Reproduce (write the failing test first) → Root-cause → Fix →
Re-run → Verify no regression. `// TODO fix later` is forbidden for anything affecting current
functionality. A feature is not complete until it has been observed working.

---

## Phase 0 — Repository analysis ✅ COMPLETE

Findings in `01-ARCHITECTURE.md §0`. Empty repo, empty remote, Node 24 / Docker 29 available,
**Docker daemon not currently running**.

---

## Phase 1 — Architecture ✅ COMPLETE

**Deliverables:** these four documents. Stack, judge design and curriculum expansion confirmed:
Next.js 15 full-stack + judge-worker; derived breakdown for Courses 1 and 3; continuous execution
reporting at each gate.

---

## Phase 2 — Database: schema & seed ✅ COMPLETE

Delivered and verified against a real PostgreSQL 16 instance.

| Item | Result |
|---|---|
| Monorepo | npm workspaces + Turborepo, TS `strict` + `noUncheckedIndexedAccess` |
| `schema.prisma` | 30 models, 13 enums, migration `20260816000000_init` (756 lines SQL) |
| Curriculum seeded | **3 courses · 90 lessons · 476 blocks · 80 problems · 417 test cases · 21 quizzes · 88 questions · 25 performance scenarios** |
| Demo data | 15 accounts, 2 classes, 19 enrolments, 226 progress rows, 77 submissions |
| Compliance engine | 18 teacher-note rules in `assertions.ts`, run **before** the first write |
| `dye/no-deficit-language` | Custom ESLint rule; verified firing on a real violation |
| Tests | 31 curriculum-invariant tests, all passing |

**Verified in the database, not just in code:**

- Python Cơ Bản: 19 `REQUIRED` (sessions 1–19), **0** `REQUIRED` from session 20 onward — the
  guaranteed-completion floor the lesson plan calls for.
- All 80 problems carry `networkPolicy = NONE`. Socket exercises use loopback; Web API exercises
  use `PY_WEB` + local fixtures.
- Tuple/Set lesson has **0** coding blocks; trigonometry blocks are tier `NANG_CAO`.
- Performance scenarios span **N = 100 → 100 000**.
- Judge/runtime mapping: `IO_MATCH`→`PY_BASE` (60), `UNIT_TEST`→`PY_TEST` (10) / `PY_WEB` (3),
  `PERFORMANCE`→`PY_BASE` (7).

**Gate results:** `typecheck` ✅ · `lint` ✅ · `test` 31/31 ✅ · migration on fresh volume ✅ ·
**`docker compose up` from empty volumes → fully seeded DB, `db-migrate` exit 0** ✅ ·
seed run twice → identical row counts ✅

**Two bugs found and fixed by the gate** (not shipped):
1. `migrate diff` output carried a UTF-8 BOM that Postgres would have rejected on the first
   statement — stripped.
2. `badges.ts` typed `criteria` as `Record<string, unknown>`, which Prisma's `InputJsonValue`
   rejects — the files written after the previous manual `tsc` run had never been checked.

**Known cosmetic item deferred to Phase 12:** Prisma warns that `package.json#prisma` is
deprecated in favour of `prisma.config.ts`. It works correctly today; migrating it now would risk
the verified migrate+seed pipeline for no functional gain.

---

## Phase 3 — Authentication & RBAC ✅ COMPLETE

Delivered in two layers so the security guarantees do not depend on Auth.js internals:

| Layer | Location | Next.js? | Tested how |
|---|---|---|---|
| Auth core — Argon2id, DB sessions, `authorize()` | `packages/core` | No | 66 integration tests against real PostgreSQL |
| Auth.js v5 wiring — cookies, CSRF, routes | `apps/web` | Yes | Verified end to end over real HTTP |

**Key design decision.** Auth.js v5 does not support `session: { strategy: 'database' }` with the
Credentials provider — the adapter's `createSession` is never called. We keep `strategy: 'jwt'` and
override the JWT codec: `encode` emits the **opaque** session token minted by `@dye/core`, and
`decode` resolves it through `validateSession`, which re-checks `user.isActive` on every request.
The cookie therefore carries a 256-bit reference, not a self-contained claim set.

**Sessions are stored hashed.** `Session.sessionToken` holds SHA-256 of the token; the raw value
exists only in the user's cookie. Verified: querying the DB by the raw cookie value returns 0 rows,
by its digest returns 1. A database leak cannot be replayed as a session.

**Relational authorization.** `authorize()` reaches a student only through
`Class.teacherId = me → Enrollment → student`, never through `role === 'TEACHER'`. The request union
is exhaustiveness-checked, so adding a resource without a rule is a compile error, not a silent allow.
Access requires an **active** enrollment — a withdrawn student is no longer reachable by that teacher.

**Verified end to end over HTTP** (not just unit-tested):

| Step | Result |
|---|---|
| Login as `co.lan`, request dashboard | **200**, teacher's own 12 students listed |
| Cookie contents | 43 chars, no dots — opaque token, not a JWT |
| Disable account in DB, cookie untouched | **307 → /dang-nhap** — blocked on the next request |
| Session rows remaining | **0** — purged on detection |
| Re-enable account, reuse old token | **307** — the old token stays dead |

**Gate results:** `typecheck` 4/4 ✅ · `lint` 3/3 ✅ · `test` 97/97 ✅ (31 curriculum + 66 auth) ·
`next build` ✅

**Test quality was proven, not assumed.** Two deliberate mutations were introduced and confirmed
caught before being reverted:
1. `authorize()` downgraded to a role-only check → 4 tests failed, including the withdrawn-student case.
2. `validateSession` with the `isActive` check removed → 6 tests failed, including the exact
   "flag alone must block" assertion.

**Three bugs found and fixed during the phase:**
1. `packages/core` used `.ts` import extensions — valid under its own tsconfig, but broke every
   consumer that compiles across package boundaries. Extensions removed.
2. `tsconfig.base.json` inherits `declaration: true`; Auth.js's inferred types then trip TS2742.
   Disabled for the Next.js app, which never emits declarations.
3. **Next.js only reads `.env` from the app directory**, so the monorepo-root file was invisible and
   Auth.js failed at runtime with `MissingSecret`. `next.config.mjs` now loads the root file, with
   existing process env always winning. This affected `npm run dev` too, not only the test.

**Known follow-ups (recorded, not bypassed):**
- `eslint-config-next` is not installed, so Next-specific lint rules (e.g. `<img>` vs `next/image`)
  are not enforced. Deferred to Phase 5, where real UI makes them meaningful.
- `middleware.ts` checks only for cookie *presence*; Prisma cannot run on the edge runtime. It is a
  UX redirect, documented as such in the file. The security boundary is `authorize()` server-side.

---

## Phase 4 — LMS / Curriculum Engine ✅ COMPLETE

Backend engines only — no UI, per scope. All in `packages/core/src/curriculum/`.

| Module | Responsibility |
|---|---|
| `tiers.ts` | Tier ordering, cumulative scope, block access classification |
| `flow.ts` | Runtime lesson-flow validation + step-rail staging |
| `gating.ts` | Status resolution, unlock resolution, batched loading |
| `progress.ts` | Course / module / block progress, tier-aware completion |

**Four design decisions, each changing what a student actually sees:**

1. **Status resolution order** — `LessonOverride(student)` → `LessonOverride(class)` →
   `Lesson.status`. Narrower scope wins regardless of recency; within one scope, most recent wins.

2. **Tier decides whether ADVANCED counts.** `REQUIRED` is required for everyone;
   `ADVANCED` is required only from Nâng cao up; `OPTIONAL`/`RECOMMENDED` never. That is what makes
   Python Cơ Bản have **19 required lessons on Cơ bản and 20 on Nâng cao**.

3. **Block tiers are cumulative, and nothing is hidden.** A student at tier T gets every block at
   tier ≤ T. Higher blocks surface as `EXPLORATION` — visible, encouraged, never counted. The
   trigonometry blocks of session 17 are `EXPLORATION` for a Cơ bản student and `REQUIRED` for a
   Nâng cao one; both see the same page with the same number of blocks.

4. **Prerequisites always gate, even when the prerequisite is optional.** The alternative would
   unlock session 30 immediately for a Cơ bản student, since sessions 20–29 are all optional for
   them. "Optional" means "you need not do it", not "you may skip past it". Teachers waive it
   explicitly.

**Performance:** `resolveCourseAccess` loads a whole 30-session course in **5 queries** and resolves
in memory. A regression test fails the build if that exceeds 6.

**The three required proofs, on real seeded data:**

| Proof | Result |
|---|---|
| Different required path per tier | Cơ bản **19** required · Nâng cao **20** — the `ADVANCED` lesson is in one path, not the other |
| Locked lesson refuses direct access | Session 5 throws `ForbiddenError` with *"Em cần hoàn thành trước: Buổi 4 · …"*; a teacher override opens it immediately; a class-scoped override opens it for the whole class but **not** for another teacher's class |
| 100% on the student's own track | Cơ bản student finishing session 19 → `required 19/19`, **100%**, `isComplete: true`, with 11 optional lessons untouched. The **same** progress for a Nâng cao student is **95%** — one `ADVANCED` lesson still outstanding |

**Gate results:** `typecheck` 4/4 ✅ · `lint` 3/3 ✅ · `test` **152/152** ✅
(31 curriculum-seed + 121 core: 66 auth + 55 curriculum engine) · zero regressions in Phase 3 tests.

**Test quality proven by mutation.** `summariseProgress` was temporarily changed to count every
lesson instead of only the student's required ones → **10 tests failed**, including the central
"Cơ bản finishing session 19 is 100%" assertion. Reverted after confirmation.

**One finding worth recording.** A test initially asserted that *all* `NANG_CAO` blocks are
`REQUIRED` for a `NANG_CAO` student. It failed — correctly. Session 17's trigonometry challenge
carries `isOptional: true`, set in Phase 2 with the note *"Không làm bài này cũng không ảnh hưởng
đến tiến độ của em."* The engine is right: **`isOptional` always wins**, so an explicitly optional
block never becomes mandatory just because a student is on a higher tier. The over-broad assertion
was narrowed and a dedicated test now pins that interaction down.

**Deliberately not built yet** (belongs to Phases 5–6, not deferred work): HTTP handlers and server
actions over these engines, and the XP / badge award rules — `Badge.criteria` is seeded as data but
no evaluator consumes it yet.

---

## Phase 5 — Student UI ✅ COMPLETE

Tailwind CSS v4 with hand-authored design tokens. shadcn/ui was skipped: Phase 5 needs no Radix
primitives, and the brief's hard numbers (18px base, 44px targets, WCAG AA) are clearer expressed
as tokens than inherited from a component library.

| Delivered | Route / module |
|---|---|
| Student shell, skip link, breadcrumbs | `components/hoc-sinh/vo.tsx`, `duong-dan.tsx` |
| Dashboard + "Học tiếp" CTA | `/bang-dieu-khien` |
| Course map with lock reasons | `/khoa-hoc/[slug]` |
| Lesson player, step rail, block renderers | `/bai-hoc/[slug]` |
| Quiz runner (MCQ + fill-blank) | `components/hoc-sinh/bai-trac-nghiem.tsx` |
| Code playground shell | `san-choi-code.tsx` — real textarea, run button visibly disabled |

**Four decisions that shape what a student sees:**

1. **Markdown renders to React nodes, never to an HTML string.** Lesson content is teacher-authored
   from Phase 6, so any path ending in `dangerouslySetInnerHTML` is one sanitiser bug away from
   stored XSS on a page children log into. Injected markup can only ever become text — a structural
   guarantee, not a filtering one. `javascript:` links are dropped, keeping the words.

2. **Answers never reach the browser.** `Choice.isCorrect`, `Problem.solutionCode` and hidden test
   cases stay server-side; checking runs in a server action. A test asserts each choice object has
   exactly `['id','text']`.

3. **A wrong answer is amber, not red**, and says *"Thử lại nhé"*. Red reads as punishment to a
   12-year-old. Red is reserved for genuine system errors. The explanation shows either way.

4. **EXPLORATION blocks are bonus quests.** Gold dashed border, star, *"Không làm cũng không sao
   cả"*. A test asserts the rendered output contains no lock/forbidden vocabulary at all.

**Verified over real HTTP, not only in tests.** Logged in as the seeded `hs.dung` (16 sessions
done, Cơ bản track): dashboard 200 with a working "Học tiếp" pointing at session 17; that lesson
renders **4 exploration blocks** with dashed borders and zero locked/forbidden wording — the
Phase 4 tier decision made visible end to end.

**Gate results:** `typecheck` 4/4 ✅ · `lint` 3/3 ✅ · `test` **209/209** ✅
(31 seed + 121 core + 57 web) · `next build` ✅

Accessibility and responsiveness are checked rather than asserted:
- **axe-core** on every rendered component — zero violations.
- **Contrast computed from the tokens** in `globals.css`, not eyeballed: every text colour ≥ 4.5:1
  on its background, all four tier colours included. jsdom cannot measure contrast, so the WCAG
  relative-luminance formula is implemented in the test instead of trusting axe here.
- Keyboard traversal of a quiz asserted with real `Tab` presses.
- Wide tables and code blocks scroll inside their own container, so a 768px tablet never scrolls
  the page sideways.

**A real bug found by running the app, invisible to the test suite.** A locked lesson returned
**HTTP 500** with Next.js's internal error shell. Root cause: I had used an `error.tsx` boundary for
an *expected* outcome. In the App Router a server-component throw is only picked up by the boundary
after client hydration, so the first paint is a crash page and the status says the server broke when
nothing did. Fixed at the source — `duLieuBaiHoc` now returns a discriminated
`{ trangThai: 'ok' | 'khoa' | 'khong-thay' }` and the page renders a real locked page (HTTP 200,
breadcrumbs, the reason, a way back). Locked lessons also no longer read their blocks out of the
database at all. `assertLessonUnlocked` still throws for route handlers, where throwing is correct.

**A latent test flake found and fixed.** `TrackAssignment.assignedBy` and `LessonOverride.createdBy`
reference a teacher with RESTRICT, so fixture cleanup only succeeded when Postgres happened to
delete students before teachers. Both `packages/core` and `apps/web` fixtures now clear those rows
explicitly. Worth noting for Phase 6: deleting a teacher account needs a deliberate flow, since
their pedagogical decisions correctly block a naive delete.

**Known cosmetic item:** lock reasons interpolate the raw lesson title, so markdown backticks show
through — *"Buổi 19 · \`calendar\` & Luyện tập"*. Readable, but should strip inline markdown when
titles are surfaced outside prose. Deferred, not forgotten.

**Deliberately not built (Phase boundaries, not debt):** CodeMirror and Pyodide (Phase 7), the judge
and submission results (Phase 8), project upload (Phase 9). Each is a visible, honest shell rather
than a button that silently does nothing.

---

## Phase 6 — Teacher UI & Analytics

Class management, student provisioning, enrollment, curriculum editor (with flow validation
surfaced as inline errors), problem/test-case authoring, override & track assignment with bulk
actions, analytics dashboards (completion, average/median, **most-failed questions and test cases**,
falling-behind and fast-progressing lists with one-click track adjustment), feedback authoring.

**Gate additions:** analytics query p95 < 300 ms on seeded volume, measured; if it fails, add the
snapshot table before closing the phase.

---

## Phase 7 — Code editor

CodeMirror 6 Python setup, autocomplete, error squiggles, run/reset/submit, hint reveal, split
statement/editor/console layout, mobile-tolerant layout, autosave drafts, submission history diff.
Pyodide isolated to its own worker origin so the app CSP keeps `unsafe-eval` off.

---

## Phase 8 — Judge engine (Docker sandbox)

1. `sandbox/images`: three Dockerfiles, pinned base digests, no runtime `pip`.
2. `sandbox/seccomp/judge.json`: syscall allowlist.
3. `sandbox/runner`: Python harness for `io_match`, `unit_test`, `performance`; deterministic
   generators; resource accounting; stderr sanitiser.
4. `apps/judge-worker`: BullMQ consumer, Dockerode driver, wall-clock watchdog, forced cleanup,
   output caps, concurrency + per-student limits, retry/backoff, dead-letter handling.
5. `packages/judge-contract`: zod job/result schemas shared with `web`.

**Gate additions — adversarial suite, all must produce a clean verdict and a reaped container:**
infinite loop · fork bomb · `while True: print()` · 2 GB allocation · `open('/etc/passwd')` ·
`os.system('rm -rf /')` · `socket` to a public IP · `import ctypes` · 100 MB source file ·
non-UTF8 bytes · `sys.setrecursionlimit` overflow · zip bomb via `zipfile`.
Plus: every seeded reference solution is executed through the real judge and must return `ACCEPTED`.

---

## Phase 9 — Pygame project workspace

Project creation from the 5 templates, upload pipeline with magic-byte sniffing + path
normalisation + size/count caps, content-addressed storage, file-tree viewer, read-only code
viewer, immutable versioned submissions, milestone tracker, teacher rubric feedback threads.
Then, additively: pygbag build job → MinIO artifact → sandboxed cross-origin iframe preview with
COOP/COEP, behind a feature flag, with `PREVIEW_UNAVAILABLE` + build log as the honest fallback.

**Gate additions:** upload fuzzing — `..%2f` traversal, zip-slip, polyglot GIF/JS, `.py.png`
double extension, 0-byte and oversized files, 500-file archive, NTFS ADS names. Nothing uploaded
is ever executed on the host.

---

## Phase 10 — Testing

Unit (`packages/core` gating, scoring, tier routing, flow validation), integration with
Testcontainers (real Postgres + Redis + Docker judge), and **the full acceptance-criteria E2E in
Playwright**:

> Teacher login → create course/lesson/problem/tests → student login → enroll → learn →
> run code → submit → judge → result → progress update → teacher feedback

Plus explicit E2E coverage of every failure mode the brief names: syntax error, runtime error,
wrong answer, timeout, memory limit, malicious code. Coverage target ≥ 80 % on `packages/core`
and the judge worker.

---

## Phase 11 — Security audit

Threat model, dependency audit, CSP/headers verification, authz matrix test (every role × every
route), secrets handling, minors'-data review (no third-party telemetry, no public profiles,
export/delete path), sandbox escape review, rate-limit verification, `docker.sock` residual-risk
write-up with the gVisor production recommendation stated plainly as **not available on Docker
Desktop for Windows**.

**Output:** `docs/05-SECURITY-AUDIT.md` — findings, severity, fix or accepted-risk rationale.

---

## Phase 12 — Deployment prep & GitHub push

Multi-stage production Dockerfiles, `docker-compose.prod.yml`, `.env.example` with every variable
documented, healthchecks, backup/restore scripts, GitHub Actions CI running the full QA gate,
`README.md` (Vietnamese + English quickstart), `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`.

Then `git init` → branch → commit → push to `https://github.com/ThaiTaka/DYE-LMS.git`
(remote confirmed reachable and empty). **I will not push until you explicitly approve it.**

---

## Resolved decisions

1. **Source lesson plans** — proceeding with the derived breakdown. 13 of 90 lessons are
   reconstructions (7 in Python Cơ Bản, 0 in Pygame, 6 in Python Nâng Cao); each carries
   `isDerived = true` in the database. If the original plan documents appear later, only those
   rows need correcting — no schema or code change.
2. **Docker daemon** — running. Full stack verified end to end.

## Open items

- **Judge sandbox generators.** `PerformanceScenario.generator` names
  (`mang_ngau_nhien`, `mang_sap_xep_va_truy_van`, `mang_gan_nhu_sap_xep`,
  `mang_da_sap_xep`, `mang_ngau_nhien_va_truy_van_tong`) are referenced by the seed and must be
  implemented in `sandbox/runner` during Phase 8. The seed deliberately names them rather than
  embedding 100 000-element fixtures in the database.
