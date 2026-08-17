import 'server-only';

/**
 * View models for the student experience.
 *
 * Everything here runs on the server and funnels through the Phase 4 engines,
 * so a page cannot accidentally show a lesson the gating rules would refuse.
 *
 * ── What is deliberately NOT sent to the browser ─────────────────────────────
 *   • `Choice.isCorrect` — otherwise the answers are one DevTools panel away.
 *   • `Problem.solutionCode` and hidden `TestCase` rows.
 *   • `Lesson.teacherNotes` — those are written for teachers, about pedagogy.
 *
 * Answer checking happens in a server action (see quiz actions), never client-side.
 */
import {
  courseProgress,
  lessonView,
  resolveCourseAccess,
  resolveLessonAccess,
  stageOf,
  type BlockAccess,
  type CourseProgress,
  type FlowStage,
  type LessonAccess,
} from '@dye/core';

import { parseNoiDung, type NoiDungKhoi } from './block-content';
import { db } from './db';

import type { BlockType, QuestionType, Tier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════════

export interface TheKhoaHoc {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  iconEmoji: string;
  colorToken: string;
  tier: Tier;
  progress: CourseProgress;
}

export interface DuLieuBangDieuKhien {
  courses: TheKhoaHoc[];
  /** The single most important thing on the page: where "Học tiếp" goes. */
  tiepTuc: {
    courseSlug: string;
    courseTitle: string;
    lessonSlug: string;
    lessonTitle: string;
    lessonOrder: number;
  } | null;
  tongBaiDaXong: number;
  huyHieu: Array<{ slug: string; name: string; iconEmoji: string }>;
  chuoiNgay: number;
}

/** Courses this student is actually enrolled in, with resolved progress. */
export async function duLieuBangDieuKhien(studentId: string): Promise<DuLieuBangDieuKhien> {
  const enrollments = await db.enrollment.findMany({
    where: { studentId, isActive: true },
    select: {
      class: {
        select: {
          classCourses: {
            select: {
              course: {
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  subtitle: true,
                  iconEmoji: true,
                  colorToken: true,
                  order: true,
                  isPublished: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // A student can be in two classes carrying the same course; show it once.
  const uniqueCourses = new Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      subtitle: string | null;
      iconEmoji: string;
      colorToken: string;
      order: number;
    }
  >();

  for (const enrollment of enrollments) {
    for (const cc of enrollment.class.classCourses) {
      if (cc.course.isPublished) uniqueCourses.set(cc.course.id, cc.course);
    }
  }

  const courses: TheKhoaHoc[] = [];
  for (const course of [...uniqueCourses.values()].sort((a, b) => a.order - b.order)) {
    const progress = await courseProgress(db, studentId, course.id);
    courses.push({
      courseId: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle ?? '',
      iconEmoji: course.iconEmoji,
      colorToken: course.colorToken,
      tier: progress.tier,
      progress,
    });
  }

  // "Học tiếp" points at the first course that still has unfinished required
  // work; only if every course is done does it fall back to optional material.
  const chuaXong = courses.find((c) => !c.progress.isComplete && c.progress.nextLesson);
  const conGoiY = courses.find((c) => c.progress.nextLesson);
  const target = chuaXong ?? conGoiY ?? null;

  const [tongBaiDaXong, badges, streak] = await Promise.all([
    db.lessonProgress.count({ where: { studentId, state: 'COMPLETED' } }),
    db.studentBadge.findMany({
      where: { studentId },
      select: { badge: { select: { slug: true, name: true, iconEmoji: true } } },
      orderBy: { earnedAt: 'desc' },
      take: 6,
    }),
    db.streak.findUnique({ where: { studentId }, select: { current: true } }),
  ]);

  return {
    courses,
    tiepTuc:
      target && target.progress.nextLesson
        ? {
            courseSlug: target.slug,
            courseTitle: target.title,
            lessonSlug: target.progress.nextLesson.slug,
            lessonTitle: target.progress.nextLesson.title,
            lessonOrder: target.progress.nextLesson.order,
          }
        : null,
    tongBaiDaXong,
    huyHieu: badges.map((b) => b.badge),
    chuoiNgay: streak?.current ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Course map
// ═══════════════════════════════════════════════════════════════════════════

export interface MoDunBanDo {
  moduleId: string;
  title: string;
  description: string;
  order: number;
  sessionFrom: number;
  sessionTo: number;
  lessons: LessonAccess[];
  soBatBuoc: number;
  soDaXong: number;
}

export interface DuLieuBanDoKhoaHoc {
  courseId: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  iconEmoji: string;
  progress: CourseProgress;
  modules: MoDunBanDo[];
}

export async function duLieuBanDoKhoaHoc(
  studentId: string,
  courseSlug: string,
): Promise<DuLieuBanDoKhoaHoc | null> {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      iconEmoji: true,
      isPublished: true,
      modules: {
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          sessionFrom: true,
          sessionTo: true,
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!course || !course.isPublished) return null;

  const [access, progress] = await Promise.all([
    resolveCourseAccess(db, studentId, course.id),
    courseProgress(db, studentId, course.id),
  ]);

  const byModule = new Map<string, LessonAccess[]>();
  for (const item of access) {
    const list = byModule.get(item.moduleId);
    if (list) list.push(item);
    else byModule.set(item.moduleId, [item]);
  }

  return {
    courseId: course.id,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle ?? '',
    description: course.description,
    iconEmoji: course.iconEmoji,
    progress,
    modules: course.modules.map((m) => {
      const lessons = (byModule.get(m.id) ?? []).sort((a, b) => a.order - b.order);
      const batBuoc = lessons.filter((l) => l.isRequired);
      return {
        moduleId: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        sessionFrom: m.sessionFrom,
        sessionTo: m.sessionTo,
        lessons,
        soBatBuoc: batBuoc.length,
        soDaXong: batBuoc.filter((l) => l.completed).length,
      };
    }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Lesson player
// ═══════════════════════════════════════════════════════════════════════════

export interface CauHoiHienThi {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  points: number;
  /** Choices WITHOUT `isCorrect`. The answer never reaches the browser. */
  choices: Array<{ id: string; text: string }>;
}

export interface TracNghiemHienThi {
  quizId: string;
  title: string;
  description: string | null;
  passingScore: number;
  questions: CauHoiHienThi[];
}

export interface BaiTapHienThi {
  problemId: string;
  slug: string;
  title: string;
  statement: string;
  starterCode: string;
  hints: string[];
  tier: Tier;
  totalPoints: number;
  /** Sample tests only. Hidden tests stay on the server. */
  viDu: Array<{ input: string; expectedOutput: string; explanation: string | null }>;
}

export interface KhoiHienThi {
  blockId: string;
  order: number;
  type: BlockType;
  stage: FlowStage;
  title: string;
  tier: Tier;
  access: BlockAccess;
  completed: boolean;
  estimatedMinutes: number;
  noiDung: NoiDungKhoi;
  tracNghiem: TracNghiemHienThi | null;
  baiTap: BaiTapHienThi | null;
}

export interface DuLieuBaiHoc {
  lessonId: string;
  slug: string;
  title: string;
  summary: string;
  objectives: string[];
  order: number;
  estimatedMinutes: number;

  course: { id: string; slug: string; title: string; iconEmoji: string };
  module: { id: string; title: string; order: number };

  tier: Tier;
  blocks: KhoiHienThi[];

  soBatBuoc: number;
  soBatBuocXong: number;
  soKhamPha: number;

  truoc: { slug: string; title: string; order: number } | null;
  sau: { slug: string; title: string; order: number; unlocked: boolean } | null;
}

/**
 * The outcome of asking for a lesson.
 *
 * A locked lesson is an EXPECTED state, not an exception, so it is returned
 * rather than thrown. Throwing here would surface as an HTTP 500 with Next.js's
 * internal error shell: a server-component throw is only picked up by
 * `error.tsx` after client hydration, so the first paint is a crash page and
 * the status code says "the server broke" when nothing broke at all.
 *
 * Route handlers and server actions still use `assertLessonUnlocked` from
 * `@dye/core`, where throwing IS the right contract.
 */
export type KetQuaBaiHoc =
  | { trangThai: 'ok'; bai: DuLieuBaiHoc }
  | {
      trangThai: 'khoa';
      lyDo: string;
      tieuDe: string;
      khoaHoc: { slug: string; title: string };
    }
  | { trangThai: 'khong-thay' };

/**
 * Everything the lesson player needs.
 *
 * Access is resolved through the Phase 4 gating engine before any content is
 * loaded, so typing a locked lesson's URL is refused exactly as clicking a
 * hidden link would be. Hiding a link is not access control; this is.
 */
export async function duLieuBaiHoc(
  studentId: string,
  lessonSlug: string,
): Promise<KetQuaBaiHoc> {
  const lesson = await db.lesson.findFirst({
    where: { slug: lessonSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      objectives: true,
      order: true,
      estimatedMinutes: true,
      courseId: true,
      course: { select: { id: true, slug: true, title: true, iconEmoji: true } },
      module: { select: { id: true, title: true, order: true } },
    },
  });

  if (!lesson) return { trangThai: 'khong-thay' };

  // Resolve access BEFORE loading any content, so a locked lesson never has its
  // blocks read out of the database at all.
  const access = await resolveLessonAccess(db, studentId, lesson.id);
  if (!access) return { trangThai: 'khong-thay' };

  if (!access.unlocked) {
    return {
      trangThai: 'khoa',
      // Safe to show: it says what to finish next and reveals nothing about
      // any other student.
      lyDo: access.lockReason ?? 'Bài học này chưa mở.',
      tieuDe: lesson.title,
      khoaHoc: { slug: lesson.course.slug, title: lesson.course.title },
    };
  }

  const [view, blocks, courseAccess] = await Promise.all([
    lessonView(db, studentId, lesson.id),
    db.lessonBlock.findMany({
      where: { lessonId: lesson.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        order: true,
        type: true,
        title: true,
        tier: true,
        isOptional: true,
        estimatedMinutes: true,
        content: true,
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            passingScore: true,
            questions: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                type: true,
                prompt: true,
                points: true,
                // `isCorrect` is intentionally absent.
                choices: { orderBy: { order: 'asc' }, select: { id: true, text: true } },
              },
            },
          },
        },
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            statement: true,
            starterCode: true,
            hints: true,
            tier: true,
            totalPoints: true,
            // Sample tests teach; hidden tests assess and stay server-side.
            testCases: {
              where: { isHidden: false },
              orderBy: { order: 'asc' },
              select: { input: true, expectedOutput: true, explanation: true },
            },
          },
        },
      },
    }),
    resolveCourseAccess(db, studentId, lesson.courseId),
  ]);

  if (!view) return { trangThai: 'khong-thay' };

  const accessOf = new Map(view.blocks.map((b) => [b.blockId, b]));

  const hienThi: KhoiHienThi[] = blocks.map((b) => {
    const resolved = accessOf.get(b.id);
    return {
      blockId: b.id,
      order: b.order,
      type: b.type,
      stage: stageOf(b.type),
      title: b.title,
      tier: b.tier,
      access: resolved?.access ?? 'REQUIRED',
      completed: resolved?.completed ?? false,
      estimatedMinutes: b.estimatedMinutes,
      noiDung: parseNoiDung(b.content),
      tracNghiem: b.quiz
        ? {
            quizId: b.quiz.id,
            title: b.quiz.title,
            description: b.quiz.description,
            passingScore: b.quiz.passingScore,
            questions: b.quiz.questions,
          }
        : null,
      baiTap: b.problem
        ? {
            problemId: b.problem.id,
            slug: b.problem.slug,
            title: b.problem.title,
            statement: b.problem.statement,
            starterCode: b.problem.starterCode,
            hints: b.problem.hints,
            tier: b.problem.tier,
            totalPoints: b.problem.totalPoints,
            viDu: b.problem.testCases,
          }
        : null,
    };
  });

  const truoc = courseAccess.find((a) => a.order === lesson.order - 1) ?? null;
  const sau = courseAccess.find((a) => a.order === lesson.order + 1) ?? null;

  return {
    trangThai: 'ok',
    bai: {
      lessonId: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      objectives: lesson.objectives,
      order: lesson.order,
      estimatedMinutes: lesson.estimatedMinutes,
      course: lesson.course,
      module: lesson.module,
      tier: view.tier,
      blocks: hienThi,
      soBatBuoc: view.required.total,
      soBatBuocXong: view.required.completed,
      soKhamPha: view.explorationTotal,
      truoc: truoc ? { slug: truoc.slug, title: truoc.title, order: truoc.order } : null,
      sau: sau
        ? { slug: sau.slug, title: sau.title, order: sau.order, unlocked: sau.unlocked }
        : null,
    },
  };
}
