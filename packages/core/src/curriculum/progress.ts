/**
 * Progress calculation.
 *
 * The rule the brief makes non-negotiable: the denominator is the work required
 * of THIS student, not everything that exists in the course.
 *
 * Python Cơ Bản has 30 sessions, but the lesson plan says some students will max
 * out around Loops. Sessions 1–19 form the guaranteed floor; 20–30 are optional.
 * A student who finishes session 19 must see **100%**, not a bar stuck at 63%.
 * A progress bar that can never fill is a progress bar that teaches a child they
 * are behind.
 *
 * Optional and exploration work still gets counted — separately, as a bonus —
 * so effort beyond the requirement is visible without ever diluting the main bar.
 */
import { loadCourseGating, resolveGating, type LessonAccess } from './gating';
import { resolveBlockAccess, type BlockAccess } from './tiers';

import type { BlockType, PrismaClient, ProgressState, Tier } from '@prisma/client';

export interface ProgressCounts {
  total: number;
  completed: number;
  /** 0–100, rounded. */
  percent: number;
}

export interface ModuleProgress {
  moduleId: string;
  title: string;
  order: number;
  required: ProgressCounts;
  optional: ProgressCounts;
  isComplete: boolean;
}

export interface CourseProgress {
  courseId: string;
  tier: Tier;

  required: ProgressCounts;
  optional: ProgressCounts;

  /**
   * False when nothing is required of this student — e.g. a teacher moved every
   * lesson to optional. Without this flag the UI cannot tell "finished" from
   * "nothing assigned", and both would render as 100%.
   */
  hasRequiredWork: boolean;
  isComplete: boolean;

  modules: ModuleProgress[];

  /** Answers "What's next?" — the first unlocked, unfinished lesson. */
  nextLesson: { lessonId: string; slug: string; title: string; order: number } | null;

  /** Lessons the student may open right now. */
  unlockedCount: number;
  lockedCount: number;
}

function counts(total: number, completed: number): ProgressCounts {
  return {
    total,
    completed,
    // No required work means the required bar is trivially satisfied; callers
    // use `hasRequiredWork` to distinguish that from genuine completion.
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
  };
}

/** Summarise already-resolved lesson access. Pure — no database. */
export function summariseProgress(
  courseId: string,
  tier: Tier,
  access: readonly LessonAccess[],
  modules: ReadonlyMap<string, { title: string; order: number }>,
): CourseProgress {
  const required = access.filter((a) => a.isRequired);
  const optional = access.filter((a) => !a.isRequired);

  const requiredCounts = counts(required.length, required.filter((a) => a.completed).length);
  const optionalCounts = counts(optional.length, optional.filter((a) => a.completed).length);

  // Group by module, preserving the course's own module ordering.
  const byModule = new Map<string, LessonAccess[]>();
  for (const item of access) {
    const list = byModule.get(item.moduleId);
    if (list) list.push(item);
    else byModule.set(item.moduleId, [item]);
  }

  const moduleProgress: ModuleProgress[] = [...byModule.entries()]
    .map(([moduleId, lessons]) => {
      const req = lessons.filter((l) => l.isRequired);
      const opt = lessons.filter((l) => !l.isRequired);
      const reqCounts = counts(req.length, req.filter((l) => l.completed).length);

      const meta = modules.get(moduleId);
      return {
        moduleId,
        title: meta?.title ?? '',
        order: meta?.order ?? Math.min(...lessons.map((l) => l.order)),
        required: reqCounts,
        optional: counts(opt.length, opt.filter((l) => l.completed).length),
        isComplete: req.length > 0 && reqCounts.completed === req.length,
      };
    })
    .sort((a, b) => a.order - b.order);

  // "What's next?" — prefer required work, fall back to optional so a student
  // who has finished their track still has somewhere to go.
  const nextRequired = access.find((a) => a.isRequired && a.unlocked && !a.completed);
  const nextOptional = access.find((a) => !a.isRequired && a.unlocked && !a.completed);
  const next = nextRequired ?? nextOptional ?? null;

  return {
    courseId,
    tier,
    required: requiredCounts,
    optional: optionalCounts,
    hasRequiredWork: required.length > 0,
    isComplete: required.length > 0 && requiredCounts.completed === required.length,
    modules: moduleProgress,
    nextLesson: next
      ? { lessonId: next.lessonId, slug: next.slug, title: next.title, order: next.order }
      : null,
    unlockedCount: access.filter((a) => a.unlocked).length,
    lockedCount: access.filter((a) => !a.unlocked).length,
  };
}

/** Course progress for one student, loaded and resolved. */
export async function courseProgress(
  db: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<CourseProgress> {
  const input = await loadCourseGating(db, studentId, courseId);
  const access = resolveGating(input);

  const modules = await db.module.findMany({
    where: { courseId },
    select: { id: true, title: true, order: true },
  });

  return summariseProgress(
    courseId,
    input.tier,
    access,
    new Map(modules.map((m) => [m.id, { title: m.title, order: m.order }])),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Block-level progress inside one lesson
// ═══════════════════════════════════════════════════════════════════════════

export interface BlockView {
  blockId: string;
  order: number;
  type: BlockType;
  title: string;
  tier: Tier;
  access: BlockAccess;
  state: ProgressState;
  completed: boolean;
}

export interface LessonView {
  lessonId: string;
  tier: Tier;
  blocks: BlockView[];
  required: ProgressCounts;
  /** Blocks above the student's tier — visible, encouraged, never counted. */
  explorationTotal: number;
  explorationCompleted: number;
  isComplete: boolean;
}

/**
 * The blocks of one lesson, classified against the student's tier.
 *
 * This is the tier-routing engine: the same lesson serves four audiences from
 * one URL. A Cơ bản student sees the trigonometry blocks of session 17 as
 * EXPLORATION; a Nâng cao student sees them as REQUIRED. Neither is shown a
 * different page, and nothing is hidden.
 */
export async function lessonView(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<LessonView | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true },
  });
  if (!lesson) return null;

  const [blocks, track, progress] = await Promise.all([
    db.lessonBlock.findMany({
      where: { lessonId },
      select: { id: true, order: true, type: true, title: true, tier: true, isOptional: true },
      orderBy: { order: 'asc' },
    }),
    db.trackAssignment.findUnique({
      where: { studentId_courseId: { studentId, courseId: lesson.courseId } },
      select: { tier: true },
    }),
    db.blockProgress.findMany({
      where: { studentId, block: { lessonId } },
      select: { blockId: true, state: true },
    }),
  ]);

  const tier: Tier = track?.tier ?? 'CO_BAN';
  const stateOf = new Map(progress.map((p) => [p.blockId, p.state]));

  const views: BlockView[] = blocks.map((b) => {
    const access = resolveBlockAccess(b.tier, b.isOptional, tier);
    const state = stateOf.get(b.id) ?? 'NOT_STARTED';
    return {
      blockId: b.id,
      order: b.order,
      type: b.type,
      title: b.title,
      tier: b.tier,
      access,
      state,
      completed: state === 'COMPLETED',
    };
  });

  const required = views.filter((v) => v.access === 'REQUIRED');
  const exploration = views.filter((v) => v.access === 'EXPLORATION');
  const requiredCounts = counts(required.length, required.filter((v) => v.completed).length);

  return {
    lessonId,
    tier,
    blocks: views,
    required: requiredCounts,
    explorationTotal: exploration.length,
    explorationCompleted: exploration.filter((v) => v.completed).length,
    isComplete: required.length > 0 && requiredCounts.completed === required.length,
  };
}

/**
 * Mark a lesson complete when every REQUIRED block in it is done.
 *
 * Deliberately ignores optional and exploration blocks: a Cơ bản student must
 * be able to finish a lesson without touching the Nâng cao challenges inside it.
 */
export async function syncLessonCompletion(
  db: PrismaClient,
  studentId: string,
  lessonId: string,
): Promise<boolean> {
  const view = await lessonView(db, studentId, lessonId);
  if (!view) return false;

  const state: ProgressState = view.isComplete
    ? 'COMPLETED'
    : view.required.completed > 0
      ? 'IN_PROGRESS'
      : 'NOT_STARTED';

  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId, lessonId } },
    create: {
      studentId,
      lessonId,
      state,
      startedAt: new Date(),
      completedAt: view.isComplete ? new Date() : null,
    },
    update: {
      state,
      completedAt: view.isComplete ? new Date() : null,
    },
  });

  return view.isComplete;
}
