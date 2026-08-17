/**
 * Spec -> database writer. The only module in the seed that knows about Prisma.
 *
 * Every write is an upsert on a NATURAL key (slug, or an (parent, order) pair),
 * so running the seed twice produces identical row counts and never orphans
 * student progress. Nothing here deletes.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  BlockSpec,
  CourseSpec,
  LessonSpec,
  ProblemSpec,
  QuizSpec,
} from './types.ts';

const toJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function upsertProblem(db: PrismaClient, spec: ProblemSpec): Promise<string> {
  const data = {
    title: spec.title,
    statement: spec.statement,
    hints: spec.hints ?? [],
    starterCode: spec.starterCode ?? '',
    solutionCode: spec.solutionCode,
    tier: spec.tier ?? 'CO_BAN',
    judgeMode: spec.judgeMode ?? 'IO_MATCH',
    runtimeImage: spec.runtimeImage ?? 'PY_BASE',
    networkPolicy: spec.networkPolicy ?? 'NONE',
    timeLimitMs: spec.timeLimitMs ?? 2000,
    memoryLimitMb: spec.memoryLimitMb ?? 256,
    totalPoints: spec.totalPoints ?? 100,
    unitTestCode: spec.unitTestCode ?? null,
    mockFixtures: spec.mockFixtures ? toJson(spec.mockFixtures) : Prisma.DbNull,
  } as const;

  const problem = await db.problem.upsert({
    where: { slug: spec.slug },
    create: { slug: spec.slug, ...data },
    update: data,
    select: { id: true },
  });

  const tests = spec.tests ?? [];
  for (const [index, test] of tests.entries()) {
    const testData = {
      input: test.input ?? '',
      expectedOutput: test.expectedOutput,
      isHidden: test.isHidden ?? false,
      isSample: test.isSample ?? false,
      points: test.points ?? 10,
      timeLimitMs: null,
      comparison: toJson({
        trimTrailing: test.comparison?.trimTrailing ?? true,
        ignoreCase: test.comparison?.ignoreCase ?? false,
        floatTolerance: test.comparison?.floatTolerance ?? null,
      }),
      explanation: test.explanation ?? null,
    };
    await db.testCase.upsert({
      where: { problemId_order: { problemId: problem.id, order: index } },
      create: { problemId: problem.id, order: index, ...testData },
      update: testData,
    });
  }

  for (const [index, scenario] of (spec.perfScenarios ?? []).entries()) {
    const scenarioData = {
      label: scenario.label,
      n: scenario.n,
      generator: scenario.generator,
      seed: scenario.seed ?? 42,
      maxTimeMs: scenario.maxTimeMs,
      expectedComplexity: scenario.expectedComplexity,
    };
    await db.performanceScenario.upsert({
      where: { problemId_order: { problemId: problem.id, order: index } },
      create: { problemId: problem.id, order: index, ...scenarioData },
      update: scenarioData,
    });
  }

  return problem.id;
}

async function upsertQuiz(db: PrismaClient, spec: QuizSpec): Promise<string> {
  const data = {
    title: spec.title,
    description: spec.description ?? null,
    tier: spec.tier ?? 'CO_BAN',
    passingScore: spec.passingScore ?? 60,
    shuffleQuestions: false,
  } as const;

  const quiz = await db.quiz.upsert({
    where: { slug: spec.slug },
    create: { slug: spec.slug, ...data },
    update: data,
    select: { id: true },
  });

  for (const [index, question] of spec.questions.entries()) {
    const questionData = {
      type: question.type,
      prompt: question.prompt,
      explanation: question.explanation ?? null,
      points: question.points ?? 10,
      tier: question.tier ?? spec.tier ?? 'CO_BAN',
      acceptedAnswers: question.acceptedAnswers ?? [],
      matchMode: question.matchMode ?? 'insensitive',
    };
    const row = await db.question.upsert({
      where: { quizId_order: { quizId: quiz.id, order: index } },
      create: { quizId: quiz.id, order: index, ...questionData },
      update: questionData,
      select: { id: true },
    });

    for (const [choiceIndex, choice] of (question.choices ?? []).entries()) {
      const choiceData = { text: choice.text, isCorrect: choice.isCorrect ?? false };
      await db.choice.upsert({
        where: { questionId_order: { questionId: row.id, order: choiceIndex } },
        create: { questionId: row.id, order: choiceIndex, ...choiceData },
        update: choiceData,
      });
    }
  }

  return quiz.id;
}

async function upsertBlock(
  db: PrismaClient,
  lessonId: string,
  order: number,
  spec: BlockSpec,
): Promise<void> {
  // Problems and quizzes must exist before the block that references them.
  const problemId = spec.problem ? await upsertProblem(db, spec.problem) : null;
  const quizId = spec.quiz ? await upsertQuiz(db, spec.quiz) : null;

  const data = {
    type: spec.type,
    tier: spec.tier ?? 'CO_BAN',
    title: spec.title,
    content: toJson(spec.content),
    isOptional: spec.isOptional ?? false,
    estimatedMinutes: spec.estimatedMinutes ?? 10,
    problemId,
    quizId,
  };

  await db.lessonBlock.upsert({
    where: { lessonId_order: { lessonId, order } },
    create: { lessonId, order, ...data },
    update: data,
  });
}

async function upsertLesson(
  db: PrismaClient,
  courseId: string,
  moduleId: string,
  spec: LessonSpec,
): Promise<string> {
  const totalMinutes = spec.blocks.reduce((sum, b) => sum + (b.estimatedMinutes ?? 10), 0);
  const data = {
    moduleId,
    slug: spec.slug,
    title: spec.title,
    summary: spec.summary,
    objectives: spec.objectives,
    difficulty: spec.difficulty,
    estimatedMinutes: spec.estimatedMinutes ?? Math.max(45, totalMinutes),
    status: spec.status,
    teacherNotes: spec.teacherNotes ?? null,
    isDerived: spec.isDerived ?? false,
    isPublished: true,
  };

  const lesson = await db.lesson.upsert({
    where: { courseId_order: { courseId, order: spec.order } },
    create: { courseId, order: spec.order, ...data },
    update: data,
    select: { id: true },
  });

  for (const [index, block] of spec.blocks.entries()) {
    await upsertBlock(db, lesson.id, index, block);
  }

  return lesson.id;
}

export interface SeedCourseResult {
  courseId: string;
  lessons: number;
  blocks: number;
  problems: number;
  quizzes: number;
}

export async function seedCourse(db: PrismaClient, spec: CourseSpec): Promise<SeedCourseResult> {
  const courseData = {
    title: spec.title,
    subtitle: spec.subtitle,
    description: spec.description,
    totalSessions: spec.totalSessions,
    order: spec.order,
    colorToken: spec.colorToken,
    iconEmoji: spec.iconEmoji,
    isPublished: true,
  };

  const course = await db.course.upsert({
    where: { slug: spec.slug },
    create: { slug: spec.slug, ...courseData },
    update: courseData,
    select: { id: true },
  });

  /** lesson slug -> lesson id, for prerequisite wiring after all lessons exist. */
  const lessonIds = new Map<string, string>();
  const orderedLessons: LessonSpec[] = [];

  for (const [moduleIndex, mod] of spec.modules.entries()) {
    const sessions = mod.lessons.map((l) => l.order);
    const moduleData = {
      slug: mod.slug,
      title: mod.title,
      description: mod.description,
      sessionFrom: Math.min(...sessions),
      sessionTo: Math.max(...sessions),
    };

    const row = await db.module.upsert({
      where: { courseId_order: { courseId: course.id, order: moduleIndex } },
      create: { courseId: course.id, order: moduleIndex, ...moduleData },
      update: moduleData,
      select: { id: true },
    });

    for (const lesson of mod.lessons) {
      const id = await upsertLesson(db, course.id, row.id, lesson);
      lessonIds.set(lesson.slug, id);
      orderedLessons.push(lesson);
    }
  }

  // Prerequisites. An explicit list wins; otherwise the default is a linear
  // chain (each session requires the previous one), which teachers can waive
  // per class or per student via LessonOverride.
  orderedLessons.sort((a, b) => a.order - b.order);
  for (const [index, lesson] of orderedLessons.entries()) {
    const explicit = lesson.prerequisites;
    const previous = index > 0 ? orderedLessons[index - 1] : undefined;
    const required = explicit ?? (previous ? [previous.slug] : []);

    for (const requiredSlug of required) {
      const lessonId = lessonIds.get(lesson.slug);
      const requiredId = lessonIds.get(requiredSlug);
      if (!lessonId || !requiredId) continue;

      await db.lessonPrerequisite.upsert({
        where: { lessonId_requiredId: { lessonId, requiredId } },
        create: { lessonId, requiredId },
        update: {},
      });
    }
  }

  const blocks = spec.modules.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + l.blocks.length, 0),
    0,
  );
  const problems = spec.modules.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + l.blocks.filter((b) => b.problem).length, 0),
    0,
  );
  const quizzes = spec.modules.reduce(
    (n, m) => n + m.lessons.reduce((k, l) => k + l.blocks.filter((b) => b.quiz).length, 0),
    0,
  );

  return { courseId: course.id, lessons: orderedLessons.length, blocks, problems, quizzes };
}
