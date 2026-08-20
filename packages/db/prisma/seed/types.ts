/**
 * Authoring types for the DYE curriculum seed.
 *
 * The curriculum files under ./courses are written against these types so they
 * read like a lesson plan rather than like database rows. `upsert.ts` is the only
 * place that knows about Prisma.
 */
import type {
  BlockType,
  JudgeMode,
  LessonStatus,
  NetworkPolicy,
  ProjectTemplate,
  QuestionType,
  RuntimeImage,
  Tier,
} from '@prisma/client';

export interface CourseSpec {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  totalSessions: number;
  order: number;
  colorToken: string;
  iconEmoji: string;
  modules: ModuleSpec[];
}

export interface ModuleSpec {
  slug: string;
  title: string;
  description: string;
  lessons: LessonSpec[];
}

export interface LessonSpec {
  /** Global session number within the course: 1..30. */
  order: number;
  slug: string;
  title: string;
  summary: string;
  objectives: string[];
  /** 1..5, teacher planning aid only — never rendered as a student label. */
  difficulty: number;
  estimatedMinutes?: number;
  status: LessonStatus;
  /** Verbatim note from the source lesson plan. Teacher-only. */
  teacherNotes?: string;
  /**
   * True when the session was reconstructed to fill the 30-session count rather
   * than being enumerated in the source brief. See docs/03-CURRICULUM-MAP.md.
   */
  isDerived?: boolean;
  /** Lesson slugs that must be completed first. Teachers may waive these. */
  prerequisites?: string[];
  blocks: BlockSpec[];
}

export interface BlockSpec {
  type: BlockType;
  tier?: Tier;
  title: string;
  content: BlockContent;
  isOptional?: boolean;
  estimatedMinutes?: number;
  problem?: ProblemSpec;
  quiz?: QuizSpec;
}

export type BlockContent =
  | { kind: 'theory'; markdown: string; keyPoints?: string[] }
  | { kind: 'example'; markdown: string; code: string; output?: string; notes?: string[] }
  | { kind: 'playground'; markdown: string; starterCode: string; goal: string }
  | { kind: 'challenge'; markdown: string }
  | {
      /**
       * Micro:bit block workspace. `blocksXml` seeds the MakeCode editor with a
       * starting arrangement; omit it to open an empty workspace.
       */
      kind: 'microbit';
      markdown: string;
      goal: string;
      blocksXml?: string;
      /** MakeCode blocks this task is about, shown as a reference strip. */
      khoiLenh?: string[];
    }
  | { kind: 'quiz'; markdown: string }
  | {
      /**
       * Trắc nghiệm — a multiple-choice practice bank.
       *
       * Carries no answers of its own: the questions live in the attached
       * `quiz`, so `Choice.isCorrect` stays server-side and the block content
       * that ships to the browser holds only the framing prose.
       */
      kind: 'mcq';
      markdown: string;
      /** Illustration shown above the questions. */
      imageUrl?: string;
    }
  | {
      /** Điền khuyết — fill-in-the-blank practice. Same arrangement as `mcq`. */
      kind: 'fill-blank';
      markdown: string;
      imageUrl?: string;
    }
  | { kind: 'video'; url: string; durationSec: number; markdown?: string }
  | { kind: 'reflection'; prompt: string }
  | { kind: 'resource'; links: Array<{ label: string; url: string }> }
  | {
      kind: 'project';
      markdown: string;
      template: ProjectTemplate;
      milestones: string[];
    };

export interface ProblemSpec {
  slug: string;
  title: string;
  statement: string;
  hints?: string[];
  starterCode?: string;
  solutionCode: string;
  tier?: Tier;
  judgeMode?: JudgeMode;
  runtimeImage?: RuntimeImage;
  networkPolicy?: NetworkPolicy;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  totalPoints?: number;
  /** UNIT_TEST mode: hidden pytest suite executed against the student module. */
  unitTestCode?: string;
  /** PY_WEB runtime: routes served on 127.0.0.1:8000 with zero egress. */
  mockFixtures?: Record<string, unknown>;
  tests?: TestCaseSpec[];
  perfScenarios?: PerfScenarioSpec[];
}

export interface TestCaseSpec {
  input?: string;
  expectedOutput: string;
  isSample?: boolean;
  isHidden?: boolean;
  points?: number;
  explanation?: string;
  comparison?: {
    trimTrailing?: boolean;
    ignoreCase?: boolean;
    floatTolerance?: number | null;
  };
}

export interface PerfScenarioSpec {
  label: string;
  n: number;
  generator: string;
  seed?: number;
  maxTimeMs: number;
  expectedComplexity: string;
}

export interface QuizSpec {
  slug: string;
  title: string;
  description?: string;
  tier?: Tier;
  passingScore?: number;
  questions: QuestionSpec[];
}

export interface QuestionSpec {
  type: QuestionType;
  prompt: string;
  explanation?: string;
  points?: number;
  tier?: Tier;
  /** MULTIPLE_CHOICE / TRUE_FALSE */
  choices?: Array<{ text: string; isCorrect?: boolean }>;
  /** FILL_BLANK / SHORT_ANSWER */
  acceptedAnswers?: string[];
  matchMode?: 'exact' | 'insensitive' | 'normalised';
  /**
   * FILL_BLANK: the sentence the student completes, with the gap written `___`.
   * Kept apart from `prompt` so the prompt can stay an instruction while the
   * template is the thing being filled in.
   */
  template?: string;
  /** Illustration for this question. A URL — never markup. */
  mediaUrl?: string;
  /** Offered before answering. Costs nothing; this is practice, not an exam. */
  hint?: string;
}
