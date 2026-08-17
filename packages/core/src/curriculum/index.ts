/**
 * Curriculum engine — gating, tier routing, progress and flow validation.
 *
 * Consumed by the web app (Phases 5–6) and, for problem tiering, by the judge
 * worker (Phase 8). Nothing here imports Next.js; every function takes a
 * `PrismaClient`, which is what makes the rules testable against a real
 * database without a web server in the loop.
 */

export {
  countsTowardProgress,
  DEFAULT_TIER,
  isBlockVisible,
  nextTier,
  resolveBlockAccess,
  TIER_LABEL,
  TIER_ORDER,
  tierRank,
  tierWithinScope,
  type BlockAccess,
} from './tiers';

export {
  STAGE_LABEL,
  stageOf,
  validateLessonFlow,
  type FlowBlock,
  type FlowResult,
  type FlowStage,
  type FlowViolation,
} from './flow';

export {
  assertLessonUnlocked,
  isStatusRequiredForTier,
  loadCourseGating,
  resolveCourseAccess,
  resolveGating,
  resolveLessonAccess,
  studentTier,
  type GatingInput,
  type GatingLesson,
  type GatingOverride,
  type LessonAccess,
  type StatusSource,
} from './gating';

export {
  courseProgress,
  lessonView,
  summariseProgress,
  syncLessonCompletion,
  type BlockView,
  type CourseProgress,
  type LessonView,
  type ModuleProgress,
  type ProgressCounts,
} from './progress';
