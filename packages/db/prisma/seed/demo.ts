/**
 * Demo accounts, classes and progress.
 *
 * The brief requires teacher analytics to have something real to show on first
 * login, so this seeds a class with a genuinely varied spread: students who are
 * racing ahead, students sitting exactly at the guaranteed floor (session 16),
 * and students still early in the course.
 *
 * Everything is deterministic (no Math.random) so two runs produce identical
 * data, and every row uses a stable id so re-seeding never duplicates.
 */
import { hash } from '@node-rs/argon2';
import type { PrismaClient, Tier, Verdict } from '@prisma/client';

const DEMO_PASSWORD = process.env['SEED_DEMO_PASSWORD'] ?? 'DyeLms#2026';

/** Argon2id parameters. Kept modest so seeding stays fast; production auth uses stronger settings. */
const ARGON_OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

interface StudentSpec {
  username: string;
  displayName: string;
  /** Sessions completed in Python Cơ Bản. Drives the analytics spread. */
  basicProgress: number;
  /** Sessions completed in Pygame, or 0 if not enrolled. */
  pygameProgress: number;
  tier: Tier;
}

/**
 * A deliberately realistic spread. Note there is NO "weak/average" grouping:
 * `tier` describes the work each student is currently assigned, and it is
 * reversible at any time by the teacher.
 */
const STUDENTS: StudentSpec[] = [
  { username: 'hs.an', displayName: 'Nguyễn Hoài An', basicProgress: 24, pygameProgress: 11, tier: 'NANG_CAO' },
  { username: 'hs.binh', displayName: 'Trần Thanh Bình', basicProgress: 21, pygameProgress: 9, tier: 'THU_THACH' },
  { username: 'hs.chi', displayName: 'Lê Bảo Chi', basicProgress: 19, pygameProgress: 8, tier: 'THU_THACH' },
  { username: 'hs.dung', displayName: 'Phạm Tiến Dũng', basicProgress: 16, pygameProgress: 6, tier: 'CO_BAN' },
  { username: 'hs.giang', displayName: 'Vũ Hương Giang', basicProgress: 16, pygameProgress: 0, tier: 'CO_BAN' },
  { username: 'hs.ha', displayName: 'Đỗ Thu Hà', basicProgress: 15, pygameProgress: 5, tier: 'CO_BAN' },
  { username: 'hs.khanh', displayName: 'Ngô Duy Khánh', basicProgress: 13, pygameProgress: 0, tier: 'CO_BAN' },
  { username: 'hs.lam', displayName: 'Bùi Tùng Lâm', basicProgress: 11, pygameProgress: 4, tier: 'CO_BAN' },
  { username: 'hs.mai', displayName: 'Hoàng Tuyết Mai', basicProgress: 9, pygameProgress: 0, tier: 'CO_BAN' },
  { username: 'hs.nam', displayName: 'Đặng Hoài Nam', basicProgress: 7, pygameProgress: 0, tier: 'CO_BAN' },
  { username: 'hs.oanh', displayName: 'Lý Kim Oanh', basicProgress: 6, pygameProgress: 3, tier: 'CO_BAN' },
  { username: 'hs.phuc', displayName: 'Tạ Gia Phúc', basicProgress: 4, pygameProgress: 0, tier: 'CO_BAN' },
];

/** Deterministic pseudo-random in [0, 1). Same input always gives the same output. */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Days ago -> Date, anchored to midnight so re-runs are stable within a day. */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export interface DemoResult {
  users: number;
  classes: number;
  enrollments: number;
  lessonProgress: number;
  submissions: number;
}

export async function seedDemoData(db: PrismaClient): Promise<DemoResult> {
  // One hash reused for every demo account — hashing 15 times would add seconds
  // to every seed run for no benefit, since they all share the same password.
  const passwordHash = await hash(DEMO_PASSWORD, ARGON_OPTS);

  // ── Staff ────────────────────────────────────────────────────────────────
  const staff = [
    { username: 'admin', displayName: 'Quản trị viên DYE', role: 'ADMIN' as const, email: 'admin@dyelms.vn' },
    { username: 'co.lan', displayName: 'Cô Nguyễn Thị Lan', role: 'TEACHER' as const, email: 'lan@dyelms.vn' },
    { username: 'thay.minh', displayName: 'Thầy Trần Văn Minh', role: 'TEACHER' as const, email: 'minh@dyelms.vn' },
  ];

  const staffIds = new Map<string, string>();
  for (const person of staff) {
    const data = {
      displayName: person.displayName,
      role: person.role,
      email: person.email,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
      locale: 'vi',
    };
    const row = await db.user.upsert({
      where: { username: person.username },
      create: { username: person.username, ...data },
      update: data,
      select: { id: true },
    });
    staffIds.set(person.username, row.id);
  }

  // ── Students ─────────────────────────────────────────────────────────────
  const studentIds = new Map<string, string>();
  for (const student of STUDENTS) {
    const data = {
      displayName: student.displayName,
      role: 'STUDENT' as const,
      passwordHash,
      isActive: true,
      // Teacher-provisioned accounts start by forcing a password change.
      // Demo accounts skip it so the walkthrough is not blocked.
      mustChangePassword: false,
      locale: 'vi',
    };
    const row = await db.user.upsert({
      where: { username: student.username },
      create: { username: student.username, ...data },
      update: data,
      select: { id: true },
    });
    studentIds.set(student.username, row.id);
  }

  // ── Courses (must already be seeded) ─────────────────────────────────────
  const basic = await db.course.findUnique({ where: { slug: 'python-co-ban' }, select: { id: true } });
  const pygame = await db.course.findUnique({
    where: { slug: 'lap-trinh-game-pygame' },
    select: { id: true },
  });
  if (!basic || !pygame) {
    throw new Error('Courses must be seeded before demo data');
  }

  // ── Classes ──────────────────────────────────────────────────────────────
  const classSpecs = [
    {
      code: 'DYE-PY-K7-2026A',
      name: 'Python Cơ Bản · Khối 7 · 2026A',
      teacher: 'co.lan',
      courseId: basic.id,
      students: STUDENTS.map((s) => s.username),
    },
    {
      code: 'DYE-GAME-K8-2026A',
      name: 'Lập Trình Game · Khối 8 · 2026A',
      teacher: 'thay.minh',
      courseId: pygame.id,
      students: STUDENTS.filter((s) => s.pygameProgress > 0).map((s) => s.username),
    },
  ];

  let enrollments = 0;
  for (const spec of classSpecs) {
    const teacherId = staffIds.get(spec.teacher);
    if (!teacherId) continue;

    const classData = { name: spec.name, teacherId, term: 'Học kỳ I · 2026–2027', isArchived: false };
    const klass = await db.class.upsert({
      where: { code: spec.code },
      create: { code: spec.code, ...classData },
      update: classData,
      select: { id: true },
    });

    await db.classCourse.upsert({
      where: { classId_courseId: { classId: klass.id, courseId: spec.courseId } },
      create: { classId: klass.id, courseId: spec.courseId, startsAt: daysAgo(60) },
      update: { startsAt: daysAgo(60) },
    });

    for (const username of spec.students) {
      const studentId = studentIds.get(username);
      if (!studentId) continue;
      await db.enrollment.upsert({
        where: { classId_studentId: { classId: klass.id, studentId } },
        create: { classId: klass.id, studentId, enrolledAt: daysAgo(60), isActive: true },
        update: { isActive: true },
      });
      enrollments += 1;
    }
  }

  // ── Track assignments ────────────────────────────────────────────────────
  const teacherId = staffIds.get('co.lan');
  if (teacherId) {
    for (const student of STUDENTS) {
      const studentId = studentIds.get(student.username);
      if (!studentId) continue;
      const data = { tier: student.tier, assignedBy: teacherId, note: null };
      await db.trackAssignment.upsert({
        where: { studentId_courseId: { studentId, courseId: basic.id } },
        create: { studentId, courseId: basic.id, ...data },
        update: data,
      });
    }
  }

  // ── Lesson progress ──────────────────────────────────────────────────────
  const basicLessons = await db.lesson.findMany({
    where: { courseId: basic.id },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  });
  const pygameLessons = await db.lesson.findMany({
    where: { courseId: pygame.id },
    orderBy: { order: 'asc' },
    select: { id: true, order: true },
  });

  let progressRows = 0;

  async function writeProgress(
    studentId: string,
    lessons: Array<{ id: string; order: number }>,
    completed: number,
    seedBase: number,
  ): Promise<void> {
    for (const lesson of lessons) {
      if (lesson.order > completed + 1) break;

      const isDone = lesson.order <= completed;
      const noise = jitter(seedBase + lesson.order);
      const score = isDone ? Math.round(62 + noise * 38) : 0;

      const data = {
        state: isDone ? ('COMPLETED' as const) : ('IN_PROGRESS' as const),
        score,
        maxScore: 100,
        timeSpentSec: Math.round(1800 + noise * 3600),
        startedAt: daysAgo(60 - lesson.order * 2),
        completedAt: isDone ? daysAgo(59 - lesson.order * 2) : null,
      };

      await db.lessonProgress.upsert({
        where: { studentId_lessonId: { studentId, lessonId: lesson.id } },
        create: { studentId, lessonId: lesson.id, ...data },
        update: data,
      });
      progressRows += 1;
    }
  }

  for (const [index, student] of STUDENTS.entries()) {
    const studentId = studentIds.get(student.username);
    if (!studentId) continue;

    await writeProgress(studentId, basicLessons, student.basicProgress, index * 100 + 1);
    if (student.pygameProgress > 0) {
      await writeProgress(studentId, pygameLessons, student.pygameProgress, index * 100 + 51);
    }

    // Streak — small and encouraging, never punitive.
    const current = Math.round(1 + jitter(index * 7 + 3) * 6);
    await db.streak.upsert({
      where: { studentId },
      create: { studentId, current, longest: current + 2, lastActiveDate: daysAgo(1) },
      update: { current, longest: current + 2, lastActiveDate: daysAgo(1) },
    });
  }

  // ── Submissions ──────────────────────────────────────────────────────────
  // A realistic mix of verdicts so "most-failed challenges" analytics has data.
  const problems = await db.problem.findMany({
    where: { judgeMode: 'IO_MATCH' },
    orderBy: { slug: 'asc' },
    take: 24,
    select: { id: true, totalPoints: true },
  });

  const VERDICT_MIX: Verdict[] = [
    'ACCEPTED',
    'ACCEPTED',
    'ACCEPTED',
    'WRONG_ANSWER',
    'WRONG_ANSWER',
    'RUNTIME_ERROR',
    'TIME_LIMIT_EXCEEDED',
    'ACCEPTED',
  ];

  let submissions = 0;
  for (const [studentIndex, student] of STUDENTS.entries()) {
    const studentId = studentIds.get(student.username);
    if (!studentId) continue;

    // Students further along have attempted more problems.
    const attempts = Math.min(problems.length, Math.max(1, Math.floor(student.basicProgress / 2)));

    for (let n = 0; n < attempts; n += 1) {
      const problem = problems[n];
      if (!problem) continue;

      const pick = Math.floor(jitter(studentIndex * 31 + n * 7) * VERDICT_MIX.length);
      const verdict = VERDICT_MIX[pick] ?? 'ACCEPTED';
      const accepted = verdict === 'ACCEPTED';

      const id = `demo-sub-${studentIndex.toString().padStart(2, '0')}-${n.toString().padStart(2, '0')}`;
      const data = {
        studentId,
        problemId: problem.id,
        code: '# Bài nộp mẫu cho dữ liệu demo\n',
        verdict,
        score: accepted ? problem.totalPoints : Math.round(problem.totalPoints * 0.4),
        passedTests: accepted ? 6 : 2,
        totalTests: 6,
        maxTimeMs: Math.round(40 + jitter(studentIndex + n) * 400),
        maxMemoryKb: Math.round(9000 + jitter(n) * 4000),
        attemptNo: 1,
        createdAt: daysAgo(30 - Math.min(29, n)),
        judgedAt: daysAgo(30 - Math.min(29, n)),
      };

      await db.submission.upsert({ where: { id }, create: { id, ...data }, update: data });
      submissions += 1;
    }
  }

  // ── Badges earned ────────────────────────────────────────────────────────
  const firstStep = await db.badge.findUnique({ where: { slug: 'buoc-dau-tien' }, select: { id: true } });
  const persistent = await db.badge.findUnique({ where: { slug: 'kien-tri' }, select: { id: true } });

  for (const student of STUDENTS) {
    const studentId = studentIds.get(student.username);
    if (!studentId) continue;

    const earned = [
      ...(firstStep && student.basicProgress >= 1 ? [firstStep.id] : []),
      ...(persistent && student.basicProgress >= 5 ? [persistent.id] : []),
    ];

    for (const badgeId of earned) {
      await db.studentBadge.upsert({
        where: { studentId_badgeId: { studentId, badgeId } },
        create: { studentId, badgeId, earnedAt: daysAgo(20) },
        update: {},
      });
    }
  }

  // ── Announcement ─────────────────────────────────────────────────────────
  const mainClass = await db.class.findUnique({
    where: { code: 'DYE-PY-K7-2026A' },
    select: { id: true },
  });
  if (mainClass && teacherId) {
    const id = 'demo-announcement-01';
    const data = {
      classId: mainClass.id,
      authorId: teacherId,
      title: 'Chào mừng các em đến với DYE LMS',
      body:
        'Các em hãy bắt đầu từ Buổi 1 nhé. Mười chín buổi đầu là phần nền tảng — hoàn thành hết ' +
        'là em đã nắm trọn bộ công cụ cốt lõi của Python. Từ buổi 20 trở đi là phần tuỳ chọn, ' +
        'em có thể đi tiếp hoặc quay lại luyện thêm phần mình muốn vững hơn. Cả hai đều tốt.',
      pinnedUntil: daysAgo(-30),
      createdAt: daysAgo(45),
    };
    await db.announcement.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  return {
    users: staff.length + STUDENTS.length,
    classes: classSpecs.length,
    enrollments,
    lessonProgress: progressRows,
    submissions,
  };
}
