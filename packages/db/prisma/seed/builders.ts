/**
 * Small builders so the curriculum files stay readable.
 *
 * The mandated lesson flow is Theory -> Interactive Example -> Playground ->
 * Mini Challenge. These helpers make that the path of least resistance;
 * assertions.ts makes any other ordering a build failure.
 */
import type { BlockSpec, ProblemSpec, QuizSpec, TestCaseSpec } from './types.ts';

/**
 * Curriculum prose is authored as an array of lines so the source files stay
 * diff-friendly and never depend on a template literal's leading whitespace.
 * A plain string is accepted too, for short one-liners.
 */
export type Markdown = string | readonly string[];

const md = (value: Markdown): string => (typeof value === 'string' ? value : value.join('\n'));

export function theory(
  title: string,
  markdown: Markdown,
  keyPoints?: string[],
  opts: { tier?: BlockSpec['tier']; minutes?: number } = {},
): BlockSpec {
  return {
    type: 'THEORY',
    title,
    tier: opts.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 12,
    content: keyPoints
      ? { kind: 'theory', markdown: md(markdown), keyPoints }
      : { kind: 'theory', markdown: md(markdown) },
  };
}

export function example(
  title: string,
  markdown: Markdown,
  code: Markdown,
  opts: { output?: Markdown; notes?: string[]; tier?: BlockSpec['tier']; minutes?: number } = {},
): BlockSpec {
  return {
    type: 'INTERACTIVE_EXAMPLE',
    title,
    tier: opts.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 10,
    content: {
      kind: 'example',
      markdown: md(markdown),
      code: md(code),
      ...(opts.output !== undefined ? { output: md(opts.output) } : {}),
      ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
    },
  };
}

export function playground(
  title: string,
  markdown: Markdown,
  starterCode: Markdown,
  goal: string,
  opts: { tier?: BlockSpec['tier']; minutes?: number } = {},
): BlockSpec {
  return {
    type: 'PLAYGROUND',
    title,
    tier: opts.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 15,
    content: { kind: 'playground', markdown: md(markdown), starterCode: md(starterCode), goal },
  };
}

export function challenge(
  problem: ProblemSpec,
  opts: { title?: string; markdown?: Markdown; minutes?: number; isOptional?: boolean } = {},
): BlockSpec {
  return {
    type: 'MINI_CHALLENGE',
    title: opts.title ?? `Thử thách: ${problem.title}`,
    tier: problem.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 20,
    isOptional: opts.isOptional ?? false,
    content: {
      kind: 'challenge',
      markdown: opts.markdown
        ? md(opts.markdown)
        : 'Vận dụng những gì vừa học để giải bài tập dưới đây.',
    },
    problem,
  };
}

export function codingTask(
  problem: ProblemSpec,
  opts: { title?: string; markdown?: Markdown; minutes?: number; isOptional?: boolean } = {},
): BlockSpec {
  return {
    type: 'CODING',
    title: opts.title ?? problem.title,
    tier: problem.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 25,
    isOptional: opts.isOptional ?? false,
    content: {
      kind: 'challenge',
      markdown: opts.markdown ? md(opts.markdown) : 'Bài luyện tập có chấm điểm tự động.',
    },
    problem,
  };
}

export function quizBlock(
  quiz: QuizSpec,
  opts: { title?: string; markdown?: Markdown; minutes?: number } = {},
): BlockSpec {
  return {
    type: 'QUIZ',
    title: opts.title ?? quiz.title,
    tier: quiz.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 10,
    content: {
      kind: 'quiz',
      markdown: opts.markdown ? md(opts.markdown) : 'Kiểm tra nhanh phần vừa học.',
    },
    quiz,
  };
}

export function reflection(title: string, prompt: string): BlockSpec {
  return {
    type: 'REFLECTION',
    title,
    tier: 'CO_BAN',
    estimatedMinutes: 5,
    content: { kind: 'reflection', prompt },
  };
}

export function projectBlock(
  title: string,
  markdown: Markdown,
  template: NonNullable<Extract<BlockSpec['content'], { kind: 'project' }>>['template'],
  milestones: string[],
  opts: { minutes?: number } = {},
): BlockSpec {
  return {
    type: 'PROJECT',
    title,
    tier: 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 45,
    content: { kind: 'project', markdown: md(markdown), template, milestones },
  };
}

/** Reference/resource list. Rendered as a link list, never as an iframe. */
export function resources(title: string, links: Array<{ label: string; url: string }>): BlockSpec {
  return {
    type: 'RESOURCE',
    title,
    tier: 'CO_BAN',
    estimatedMinutes: 3,
    content: { kind: 'resource', links },
  };
}

/** Shorthand for a visible sample test with a teaching explanation. */
export function sample(
  input: string,
  expectedOutput: string,
  explanation?: string,
): TestCaseSpec {
  return {
    input,
    expectedOutput,
    isSample: true,
    isHidden: false,
    points: 0,
    ...(explanation !== undefined ? { explanation } : {}),
  };
}

/** Shorthand for a hidden assessment test. */
export function hidden(input: string, expectedOutput: string, points = 10): TestCaseSpec {
  return { input, expectedOutput, isSample: false, isHidden: true, points };
}
