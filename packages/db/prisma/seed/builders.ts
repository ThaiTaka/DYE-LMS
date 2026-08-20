/**
 * Small builders so the curriculum files stay readable.
 *
 * The mandated lesson flow is Theory -> Interactive Example -> Playground ->
 * Mini Challenge. These helpers make that the path of least resistance;
 * assertions.ts makes any other ordering a build failure.
 */
import type { BlockSpec, ProblemSpec, QuestionSpec, QuizSpec, TestCaseSpec } from './types.ts';

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

/**
 * Micro:bit block workspace.
 *
 * Carries a `problem` so the submission pipeline, the teacher review queue and
 * the progress engine all work unchanged — a hardware task is a task like any
 * other. What differs is `judgeMode: MAKECODE`, which tells the judge worker to
 * SKIP it: the behaviour of this program lives on a physical board with LEDs, and
 * no container can observe that. A teacher reads the blocks and grades it.
 */
export function microbitTask(
  problem: ProblemSpec,
  opts: {
    title?: string;
    markdown?: Markdown;
    goal: string;
    khoiLenh?: string[];
    blocksXml?: string;
    minutes?: number;
    isOptional?: boolean;
  },
): BlockSpec {
  return {
    type: 'MICROBIT_WORKSPACE',
    title: opts.title ?? problem.title,
    tier: problem.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 25,
    isOptional: opts.isOptional ?? false,
    content: {
      kind: 'microbit',
      markdown: opts.markdown ? md(opts.markdown) : 'Em kéo thả các khối lệnh để hoàn thành yêu cầu.',
      goal: opts.goal,
      ...(opts.blocksXml ? { blocksXml: opts.blocksXml } : {}),
      ...(opts.khoiLenh ? { khoiLenh: opts.khoiLenh } : {}),
    },
    problem: {
      ...problem,
      // Never auto-judged. Stated here so a task cannot be authored into the
      // Python judge by forgetting to set it.
      judgeMode: 'MAKECODE',
    },
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

// ═══════════════════════════════════════════════════════════════════════════
// Trắc nghiệm & Điền khuyết — the two practice-bank block types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Why these are separate block types rather than more `quizBlock`s.
 *
 * `QUIZ` is the end-of-section check a lesson has ONE of, and the student UI
 * frames it as such — a score, a pass mark, a "🎉 em đã làm hết". A practice
 * bank of ten questions is a different thing: a lesson may carry several, they
 * belong in the exercise stage alongside the coding ladder rather than after it,
 * and a wrong answer there is a step rather than a mark.
 *
 * The DATA is identical — both attach a `Quiz` whose `Question` rows hold the
 * answers server-side — so nothing downstream had to learn a new shape. Only
 * the pedagogical slot differs, and that is exactly what `BlockType` is for.
 */
export function mcqBlock(
  quiz: QuizSpec,
  opts: { title?: string; markdown?: Markdown; imageUrl?: string; minutes?: number; isOptional?: boolean } = {},
): BlockSpec {
  return {
    type: 'MULTIPLE_CHOICE',
    title: opts.title ?? quiz.title,
    tier: quiz.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 15,
    isOptional: opts.isOptional ?? false,
    content: {
      kind: 'mcq',
      markdown: opts.markdown
        ? md(opts.markdown)
        : 'Chọn đáp án em cho là đúng. Sai cũng không sao — em làm lại được ngay.',
      ...(opts.imageUrl ? { imageUrl: opts.imageUrl } : {}),
    },
    quiz,
  };
}

/**
 * Fill-in-the-blank practice.
 *
 * Every question here should ship `matchMode: 'normalised'` unless the answer is
 * genuinely case- or accent-sensitive code. School machines frequently have no
 * Vietnamese IME, and marking "hoc sinh" wrong against "học sinh" punishes a
 * student for their keyboard rather than for their understanding.
 */
export function fillBlankBlock(
  quiz: QuizSpec,
  opts: { title?: string; markdown?: Markdown; imageUrl?: string; minutes?: number; isOptional?: boolean } = {},
): BlockSpec {
  return {
    type: 'FILL_IN_BLANK',
    title: opts.title ?? quiz.title,
    tier: quiz.tier ?? 'CO_BAN',
    estimatedMinutes: opts.minutes ?? 15,
    isOptional: opts.isOptional ?? false,
    content: {
      kind: 'fill-blank',
      markdown: opts.markdown
        ? md(opts.markdown)
        : 'Điền từ còn thiếu vào chỗ trống. Không phân biệt hoa thường, và em gõ không dấu cũng được.',
      ...(opts.imageUrl ? { imageUrl: opts.imageUrl } : {}),
    },
    quiz,
  };
}

/** One multiple-choice question. The first choice listed is the correct one. */
export function mcq(
  prompt: string,
  dapAnDung: string,
  dapAnSai: string[],
  opts: { explanation?: string; hint?: string; mediaUrl?: string; points?: number; tier?: QuestionSpec['tier'] } = {},
): QuestionSpec {
  return {
    type: 'MULTIPLE_CHOICE',
    prompt,
    choices: [{ text: dapAnDung, isCorrect: true }, ...dapAnSai.map((text) => ({ text }))],
    points: opts.points ?? 10,
    ...(opts.tier !== undefined ? { tier: opts.tier } : {}),
    ...(opts.explanation !== undefined ? { explanation: opts.explanation } : {}),
    ...(opts.hint !== undefined ? { hint: opts.hint } : {}),
    ...(opts.mediaUrl !== undefined ? { mediaUrl: opts.mediaUrl } : {}),
  };
}

/**
 * One fill-in-the-blank question.
 *
 * `template` is the sentence with the gap; `dapAn` lists every spelling that
 * should be accepted, most canonical first — the first entry is what a student
 * is shown after a wrong attempt.
 */
export function dienKhuyet(
  prompt: string,
  template: string,
  dapAn: string[],
  opts: {
    explanation?: string;
    hint?: string;
    mediaUrl?: string;
    points?: number;
    matchMode?: QuestionSpec['matchMode'];
    tier?: QuestionSpec['tier'];
  } = {},
): QuestionSpec {
  return {
    type: 'FILL_BLANK',
    prompt,
    template,
    acceptedAnswers: dapAn,
    matchMode: opts.matchMode ?? 'normalised',
    points: opts.points ?? 10,
    ...(opts.tier !== undefined ? { tier: opts.tier } : {}),
    ...(opts.explanation !== undefined ? { explanation: opts.explanation } : {}),
    ...(opts.hint !== undefined ? { hint: opts.hint } : {}),
    ...(opts.mediaUrl !== undefined ? { mediaUrl: opts.mediaUrl } : {}),
  };
}
