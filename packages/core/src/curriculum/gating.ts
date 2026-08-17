/**
 * Lesson gating — who may open which lesson, and which lessons count as theirs.
 *
 * ── Resolution order ─────────────────────────────────────────────────────────
 *
 *   status:  LessonOverride(student) → LessonOverride(class) → Lesson.status
 *   unlock:  published? → enrolled? → teacher lock/unlock → prerequisites
 *
 * ── Why prerequisites always gate ────────────────────────────────────────────
 * A prerequisite blocks even when the prerequisite lesson is OPTIONAL for this
 * student. The alternative — "optional prerequisites don't gate" — would unlock
 * session 30 immediately for a Cơ bản student, because sessions 20–29 are all
 * optional for them. "Optional" means "you don't have to do it", not "you may
 * skip past it". Teachers waive it explicitly with `waivePrerequisites`.
 *
 * ── Structure ────────────────────────────────────────────────────────────────
 * `resolveGating` is PURE: it takes loaded rows and returns decisions, so the
 * rules can be tested without a database. `loadCourseGating` does the batched
 * I/O — four queries for a whole course, never N+1.
 */
import { ForbiddenError } from '../errors';
import { DEFAULT_TIER, tierRank } from './tiers';

import type { LessonStatus, PrismaClient, ProgressState, Tier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Shapes
// ═══════════════════════════════════════════════════════════════════════════

export interface GatingLesson {
  id: string;
  slug: string;
  title: string;
  order: number;
  moduleId: string;
  status: LessonStatus;
  isPublished: boolean;
}

export interface GatingOverride {
  lessonId: string;
  /** null = class-scoped. */
  studentId: string | null;
  classId: string | null;
  forceStatus: LessonStatus | null;
  isUnlocked: boolean | null;
  waivePrerequisites: boolean;
  createdAt: Date;
}

export interface GatingInput {
  studentId: string;
  tier: Tier;
  /** Is the student enrolled in a class carrying this course? */
  enrolled: boolean;
  lessons: readonly GatingLesson[];
  /** lessonId → ids of lessons that must be completed first. */
  prerequisites: ReadonlyMap<string, readonly string[]>;
  overrides: readonly GatingOverride[];
  /** lessonId → progress state. Missing means NOT_STARTED. */
  progress: ReadonlyMap<string, ProgressState>;
}

export type StatusSource = 'default' | 'class-override' | 'student-override';

export interface LessonAccess {
  lessonId: string;
  slug: string;
  title: string;
  order: number;
  moduleId: string;

  /** Status after overrides. */
  status: LessonStatus;
  statusSource: StatusSource;
  /** Does this lesson count toward THIS student's progress denominator? */
  isRequired: boolean;

  unlocked: boolean;
  /** Vietnamese, shown to the student. Null when unlocked. */
  lockReason: string | null;
  missingPrerequisites: Array<{ id: string; slug: string; title: string; order: number }>;
  prerequisitesWaived: boolean;
  /** True when a teacher explicitly unlocked or locked this lesson. */
  teacherOverridden: boolean;

  state: ProgressState;
  completed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status resolution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Is a resolved status required for a student on this tier?
 *
 * ADVANCED is the tier-sensitive case: it is required work for a student on
 * Nâng cao or above, and optional exploration for everyone else. That is what
 * makes two students on the same course have different denominators.
 */
export function isStatusRequiredForTier(status: LessonStatus, tier: Tier): boolean {
  switch (status) {
    case 'REQUIRED':
      return true;
    case 'ADVANCED':
      return tierRank(tier) >= tierRank('NANG_CAO');
    case 'RECOMMENDED':
    case 'OPTIONAL':
      return false;
    default: {
      const unreachable: never = status;
      void unreachable;
      return false;
    }
  }
}

/** Pick the winning override for a lesson: student scope beats class scope. */
function pickOverride(
  overrides: readonly GatingOverride[],
  lessonId: string,
): { student?: GatingOverride; klass?: GatingOverride } {
  const forLesson = overrides.filter((o) => o.lessonId === lessonId);

  // Most recent wins within a scope, so re-applying an override is predictable.
  const byRecency = (a: GatingOverride, b: GatingOverride): number =>
    b.createdAt.getTime() - a.createdAt.getTime();

  const student = forLesson.filter((o) => o.studentId !== null).sort(byRecency)[0];
  const klass = forLesson.filter((o) => o.studentId === null).sort(byRecency)[0];

  return {
    ...(student ? { student } : {}),
    ...(klass ? { klass } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// The resolver — pure
// ═══════════════════════════════════════════════════════════════════════════

export function resolveGating(input: GatingInput): LessonAccess[] {
  const byId = new Map(input.lessons.map((l) => [l.id, l]));
  const ordered = [...input.lessons].sort((a, b) => a.order - b.order);

  return ordered.map((lesson) => {
    const { student, klass } = pickOverride(input.overrides, lesson.id);

    // ── Status ─────────────────────────────────────────────────────────────
    let status: LessonStatus = lesson.status;
    let statusSource: StatusSource = 'default';

    if (klass?.forceStatus) {
      status = klass.forceStatus;
      statusSource = 'class-override';
    }
    if (student?.forceStatus) {
      status = student.forceStatus;
      statusSource = 'student-override';
    }

    const isRequired = isStatusRequiredForTier(status, input.tier);

    // ── Prerequisites ──────────────────────────────────────────────────────
    const waived = Boolean(student?.waivePrerequisites || klass?.waivePrerequisites);
    const requiredIds = input.prerequisites.get(lesson.id) ?? [];

    const missing = waived
      ? []
      : requiredIds
          .filter((id) => input.progress.get(id) !== 'COMPLETED')
          .map((id) => {
            const pre = byId.get(id);
            return {
              id,
              slug: pre?.slug ?? id,
              title: pre?.title ?? 'Bài học trước',
              order: pre?.order ?? 0,
            };
          })
          .sort((a, b) => a.order - b.order);

    // ── Unlock ─────────────────────────────────────────────────────────────
    // The explicit unlock flag: student scope wins, then class scope.
    const explicitUnlock = student?.isUnlocked ?? klass?.isUnlocked ?? null;

    let unlocked: boolean;
    let lockReason: string | null = null;

    if (!lesson.isPublished) {
      unlocked = false;
      lockReason = 'Bài học này chưa được mở.';
    } else if (!input.enrolled) {
      unlocked = false;
      lockReason = 'Em chưa được ghi danh vào lớp có khoá học này.';
    } else if (explicitUnlock === false) {
      // A teacher deliberately closing a lesson outranks everything else.
      unlocked = false;
      lockReason = 'Thầy cô đang tạm khoá bài học này.';
    } else if (explicitUnlock === true) {
      // A teacher deliberately opening a lesson skips prerequisites entirely.
      unlocked = true;
    } else if (missing.length > 0) {
      unlocked = false;
      const names = missing.map((m) => `Buổi ${m.order} · ${m.title}`).join(', ');
      lockReason = `Em cần hoàn thành trước: ${names}.`;
    } else {
      unlocked = true;
    }

    const state = input.progress.get(lesson.id) ?? 'NOT_STARTED';

    return {
      lessonId: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      order: lesson.order,
      moduleId: lesson.moduleId,
      status,
      statusSource,
      isRequired,
      unlocked,
      lockReason,
      missingPrerequisites: missing,
      prerequisitesWaived: waived,
      teacherOverridden: explicitUnlock !== null,
      state,
      completed: state === 'COMPLETED',
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Loading — batched
// ═══════════════════════════════════════════════════════════════════════════

/** The student's assigned tier for a course, defaulting to Cơ bản. */
export async function studentTier(
  db: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<Tier> {
  const track = await db.trackAssignment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    select: { tier: true },
  });
  return track?.tier ?? DEFAULT_TIER;
}

/**
 * Load everything needed to gate one course for one student.
 *
 * Four queries regardless of course size — resolving 30 lessons must not cost
 * 30 round trips.
 */
export async function loadCourseGating(
  db: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<GatingInput> {
  const [lessons, enrollments, track] = await Promise.all([
    db.lesson.findMany({
      where: { courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        order: true,
        moduleId: true,
        status: true,
        isPublished: true,
        prerequisites: { select: { requiredId: true } },
      },
      orderBy: { order: 'asc' },
    }),
    db.enrollment.findMany({
      where: { studentId, isActive: true, class: { classCourses: { some: { courseId } } } },
      select: { classId: true },
    }),
    db.trackAssignment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      select: { tier: true },
    }),
  ]);

  const lessonIds = lessons.map((l) => l.id);
  const classIds = enrollments.map((e) => e.classId);

  const [overrides, progress] = await Promise.all([
    db.lessonOverride.findMany({
      where: {
        lessonId: { in: lessonIds },
        OR: [{ studentId }, { classId: { in: classIds }, studentId: null }],
      },
      select: {
        lessonId: true,
        studentId: true,
        classId: true,
        forceStatus: true,
        isUnlocked: true,
        waivePrerequisites: true,
        createdAt: true,
      },
    }),
    db.lessonProgress.findMany({
      where: { studentId, lessonId: { in: lessonIds } },
      select: { lessonId: true, state: true },
    }),
  ]);

  return {
    studentId,
    tier: track?.tier ?? DEFAULT_TIER,
    enrolled: enrollments.length > 0,
    lessons: lessons.map(({ prerequisites: _p, ...rest }) => rest),
    prerequisites: new Map(lessons.map((l) => [l.id, l.prerequisites.map((p) => p.requiredId)])),
    overrides,
    progress: new Map(progress.map((p) => [p.lessonId, p.state])),
  };
}

/** Resolved access for every lesson in a course, in session order. */
export async function resolveCourseAccess(
  db: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<LessonAccess[]> {
  return resolveGating(await loadCourseGating(db, studentId, courseId));
}

/** Resolved access for one lesson. */
export async function resolveLessonAccess(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<LessonAccess | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true },
  });
  if (!lesson) return null;

  const all = await resolveCourseAccess(db, studentId, lesson.courseId);
  return all.find((a) => a.lessonId === lessonId) ?? null;
}

/**
 * Refuse unless the student may open this lesson.
 *
 * The API guard: a locked lesson must fail when requested directly, not merely
 * be hidden from the UI. The Vietnamese reason is safe to show — it says what
 * to do next rather than exposing anything about other students.
 */
export async function assertLessonUnlocked(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<LessonAccess> {
  const access = await resolveLessonAccess(db, studentId, lessonId);

  if (!access) throw new ForbiddenError('lesson-not-found');
  if (!access.unlocked) {
    const error = new ForbiddenError(`lesson-locked:${access.slug}`);
    // Overwrite the generic message: for a locked lesson, telling the student
    // what to finish first is useful and leaks nothing.
    Object.defineProperty(error, 'message', {
      value: access.lockReason ?? 'Bài học này chưa mở.',
      enumerable: true,
    });
    throw error;
  }

  return access;
}
