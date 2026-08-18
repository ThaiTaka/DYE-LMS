/**
 * Curriculum compliance assertions.
 *
 * The teacher notes in the lesson plans are instructional REQUIREMENTS. These
 * checks run before anything is written to the database, so a curriculum edit
 * that violates a note fails the build instead of quietly reaching a student.
 *
 * Every rule here maps to a numbered row in docs/03-CURRICULUM-MAP.md.
 */
import type { BlockSpec, CourseSpec, LessonSpec, ProblemSpec } from './types.ts';

export class CurriculumViolation extends Error {
  constructor(rule: string, detail: string) {
    super(`[curriculum] ${rule}: ${detail}`);
    this.name = 'CurriculumViolation';
  }
}

/**
 * Deficit vocabulary is banned in student-facing strings (brief §B).
 *
 * The patterns are deliberately scoped to student-DESCRIPTIVE phrasing rather
 * than to bare words. "trung bình" (average) is legitimate and common in this
 * curriculum — "tính điểm trung bình" is a standard beginner exercise — so a
 * blunt word list would produce false positives and get switched off, which is
 * worse than no check at all.
 */
const DEFICIT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /học\s+sinh\s+(yếu|kém|dở|tệ)/iu, label: 'học sinh yếu/kém' },
  { re: /\bhs\s+(yếu|kém)/iu, label: 'hs yếu/kém' },
  { re: /nhóm\s+(yếu|kém)/iu, label: 'nhóm yếu/kém' },
  { re: /trình\s+độ\s+(yếu|kém)/iu, label: 'trình độ yếu/kém' },
  { re: /\b(weak|poor|failing|underperforming|struggling)\s+(student|learner|pupil)s?\b/iu, label: 'weak/poor student' },
  { re: /\bslow\s+learners?\b/iu, label: 'slow learner' },
  { re: /\bremedial\b/iu, label: 'remedial' },
  { re: /\bbelow[-\s]average\s+(student|learner)s?\b/iu, label: 'below-average student' },
  { re: /\blow[-\s]ability\b/iu, label: 'low-ability' },
];

/** Fields a student can actually read. teacherNotes is excluded — it is teacher-only. */
function studentFacingStrings(course: CourseSpec): Array<{ where: string; text: string }> {
  const out: Array<{ where: string; text: string }> = [];
  out.push({ where: `course:${course.slug}.title`, text: course.title });
  out.push({ where: `course:${course.slug}.subtitle`, text: course.subtitle });
  out.push({ where: `course:${course.slug}.description`, text: course.description });

  for (const mod of course.modules) {
    out.push({ where: `module:${mod.slug}.title`, text: mod.title });
    out.push({ where: `module:${mod.slug}.description`, text: mod.description });

    for (const lesson of mod.lessons) {
      out.push({ where: `lesson:${lesson.slug}.title`, text: lesson.title });
      out.push({ where: `lesson:${lesson.slug}.summary`, text: lesson.summary });
      lesson.objectives.forEach((o, i) =>
        out.push({ where: `lesson:${lesson.slug}.objectives[${i}]`, text: o }),
      );

      for (const block of lesson.blocks) {
        out.push({ where: `block:${lesson.slug}#${block.title}`, text: block.title });
        out.push({
          where: `block:${lesson.slug}#${block.title}.content`,
          text: JSON.stringify(block.content),
        });
        if (block.problem) {
          out.push({
            where: `problem:${block.problem.slug}.statement`,
            text: block.problem.statement,
          });
        }
        if (block.quiz) {
          for (const q of block.quiz.questions) {
            out.push({ where: `quiz:${block.quiz.slug}.prompt`, text: q.prompt });
          }
        }
      }
    }
  }
  return out;
}

function allBlocks(course: CourseSpec): Array<{ lesson: LessonSpec; block: BlockSpec }> {
  return course.modules.flatMap((m) =>
    m.lessons.flatMap((lesson) => lesson.blocks.map((block) => ({ lesson, block }))),
  );
}

function allProblems(course: CourseSpec): ProblemSpec[] {
  return allBlocks(course)
    .map(({ block }) => block.problem)
    .filter((p): p is ProblemSpec => p !== undefined);
}

/** Everything a learner could execute or read as code, per lesson. */
function codeSurface(lesson: LessonSpec): string {
  const parts: string[] = [];
  for (const block of lesson.blocks) {
    parts.push(JSON.stringify(block.content));
    if (block.problem) {
      parts.push(block.problem.starterCode ?? '', block.problem.solutionCode, block.problem.statement);
      for (const t of block.problem.tests ?? []) parts.push(t.expectedOutput, t.input ?? '');
    }
    if (block.quiz) {
      for (const q of block.quiz.questions) parts.push(q.prompt, q.explanation ?? '');
    }
  }
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Structural rules — apply to every course
// ═══════════════════════════════════════════════════════════════════════════

function assertStructure(course: CourseSpec): void {
  const lessons = course.modules.flatMap((m) => m.lessons);

  if (lessons.length !== course.totalSessions) {
    throw new CurriculumViolation(
      'session-count',
      `${course.slug} declares ${course.totalSessions} sessions but defines ${lessons.length}`,
    );
  }

  const orders = lessons.map((l) => l.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i += 1) {
    if (orders[i] !== i + 1) {
      throw new CurriculumViolation(
        'session-numbering',
        `${course.slug} session numbers must be a contiguous 1..${course.totalSessions}; got a gap or duplicate at ${orders[i]}`,
      );
    }
  }

  const lessonSlugs = new Set<string>();
  for (const lesson of lessons) {
    if (lessonSlugs.has(lesson.slug)) {
      throw new CurriculumViolation('duplicate-lesson-slug', `${course.slug}/${lesson.slug}`);
    }
    lessonSlugs.add(lesson.slug);

    if (lesson.objectives.length === 0) {
      throw new CurriculumViolation(
        'missing-objectives',
        `${lesson.slug} has no objectives — the "What did I learn?" checklist would be empty`,
      );
    }
    if (lesson.blocks.length === 0) {
      throw new CurriculumViolation('empty-lesson', lesson.slug);
    }
  }

  // Prerequisites must resolve within the same course.
  for (const lesson of lessons) {
    for (const pre of lesson.prerequisites ?? []) {
      if (!lessonSlugs.has(pre)) {
        throw new CurriculumViolation(
          'unresolved-prerequisite',
          `${lesson.slug} requires "${pre}", which does not exist in ${course.slug}`,
        );
      }
      const preLesson = lessons.find((l) => l.slug === pre);
      if (preLesson && preLesson.order >= lesson.order) {
        throw new CurriculumViolation(
          'prerequisite-cycle',
          `${lesson.slug} (session ${lesson.order}) requires ${pre} (session ${preLesson.order}) — a prerequisite must come earlier`,
        );
      }
    }
  }
}

/**
 * Rule 13: the mandated flow. A lesson that teaches theory may not jump straight
 * to assessment — an interactive example or a playground must come first.
 * This is the "no PDF -> Next -> Quiz" directive as an executable check.
 */
function assertPedagogicalFlow(course: CourseSpec): void {
  // MICROBIT_WORKSPACE counts as assessment: it carries a Problem and is graded,
  // so a hardware lesson may not jump from theory straight into it either.
  const ASSESSMENT: ReadonlySet<string> = new Set([
    'QUIZ',
    'MINI_CHALLENGE',
    'CODING',
    'MICROBIT_WORKSPACE',
  ]);
  const HANDS_ON: ReadonlySet<string> = new Set(['INTERACTIVE_EXAMPLE', 'PLAYGROUND', 'PROJECT']);

  for (const { lesson } of course.modules.flatMap((m) => m.lessons.map((lesson) => ({ lesson })))) {
    const hasTheory = lesson.blocks.some((b) => b.type === 'THEORY');
    if (!hasTheory) continue;

    const firstAssessment = lesson.blocks.findIndex((b) => ASSESSMENT.has(b.type));
    if (firstAssessment === -1) continue;

    const handsOnBefore = lesson.blocks
      .slice(0, firstAssessment)
      .some((b) => HANDS_ON.has(b.type));

    if (!handsOnBefore) {
      throw new CurriculumViolation(
        'pedagogical-flow',
        `${lesson.slug} goes THEORY -> ${lesson.blocks[firstAssessment]?.type} with no interactive example or playground in between. ` +
          'Required flow: Theory -> Interactive Example -> Playground -> Mini Challenge.',
      );
    }
  }
}

function assertProblemsAreTestable(course: CourseSpec): void {
  for (const problem of allProblems(course)) {
    const mode = problem.judgeMode ?? 'IO_MATCH';

    if (mode === 'PROJECT_UPLOAD') continue;

    /*
     * MAKECODE carries no test cases, and that is the design rather than an
     * omission: the program's output is light on a physical LED matrix, which
     * nothing in a container can observe. These are graded by a teacher reading
     * the block logic.
     *
     * What IS still required is a reference solution — a task nobody has solved
     * is a task nobody has checked is solvable.
     */
    if (mode === 'MAKECODE') {
      if (!problem.solutionCode || problem.solutionCode.trim().length === 0) {
        throw new CurriculumViolation(
          'makecode-no-solution',
          `${problem.slug} is MAKECODE mode but ships no reference solution for the teacher`,
        );
      }
      continue;
    }

    if (mode === 'UNIT_TEST') {
      if (!problem.unitTestCode || problem.unitTestCode.trim().length === 0) {
        throw new CurriculumViolation(
          'missing-unit-tests',
          `${problem.slug} is UNIT_TEST mode but ships no pytest suite`,
        );
      }
      continue;
    }

    const tests = problem.tests ?? [];
    if (tests.length === 0) {
      throw new CurriculumViolation('no-test-cases', problem.slug);
    }
    if (!tests.some((t) => t.isSample)) {
      throw new CurriculumViolation(
        'no-sample-test',
        `${problem.slug} has no visible sample — a student would be guessing at the expected format`,
      );
    }
    if (mode === 'IO_MATCH' && !tests.some((t) => t.isHidden)) {
      throw new CurriculumViolation(
        'no-hidden-test',
        `${problem.slug} has no hidden test — it could be passed by hard-coding the sample output`,
      );
    }
    if (!problem.solutionCode || problem.solutionCode.trim().length === 0) {
      throw new CurriculumViolation(
        'no-reference-solution',
        `${problem.slug} has no reference solution; Phase 10 could not prove it is solvable`,
      );
    }
  }

  // Rule 15/16: the security policy default.
  for (const problem of allProblems(course)) {
    const policy = problem.networkPolicy ?? 'NONE';
    if (policy === 'EGRESS_ALLOWLIST') {
      throw new CurriculumViolation(
        'network-policy',
        `${problem.slug} requests EGRESS_ALLOWLIST. Seeded problems must run with network disabled; ` +
          'use RuntimeImage.PY_WEB with mockFixtures instead.',
      );
    }
  }
}

function assertNoDeficitLanguage(course: CourseSpec): void {
  for (const { where, text } of studentFacingStrings(course)) {
    for (const { re, label } of DEFICIT_PATTERNS) {
      if (re.test(text)) {
        throw new CurriculumViolation(
          'deficit-language',
          `"${label}" found in ${where}. Students are never labelled by deficiency; ` +
            'use the Cơ bản / Thử thách / Nâng cao / Mở rộng scale instead.',
        );
      }
    }
  }
}

function assertUniqueSlugs(courses: CourseSpec[]): void {
  const problems = new Map<string, string>();
  const quizzes = new Map<string, string>();

  for (const course of courses) {
    for (const { lesson, block } of allBlocks(course)) {
      if (block.problem) {
        const prev = problems.get(block.problem.slug);
        if (prev) {
          throw new CurriculumViolation(
            'duplicate-problem-slug',
            `"${block.problem.slug}" used by both ${prev} and ${lesson.slug}`,
          );
        }
        problems.set(block.problem.slug, lesson.slug);
      }
      if (block.quiz) {
        const prev = quizzes.get(block.quiz.slug);
        if (prev) {
          throw new CurriculumViolation(
            'duplicate-quiz-slug',
            `"${block.quiz.slug}" used by both ${prev} and ${lesson.slug}`,
          );
        }
        quizzes.set(block.quiz.slug, lesson.slug);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Course-specific teacher notes
// ═══════════════════════════════════════════════════════════════════════════

/** Python Cơ Bản — notes 1, 2, 5, 6, 7, 8 from docs/03-CURRICULUM-MAP.md. */
function assertPythonBasicNotes(course: CourseSpec): void {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const bySession = new Map(lessons.map((l) => [l.order, l]));

  // Note 1 — sessions 1 and 2 introduce no heavy syntax and no print().
  for (const session of [1, 2]) {
    const lesson = bySession.get(session);
    if (!lesson) continue;
    if (/\bprint\s*\(/u.test(codeSurface(lesson))) {
      throw new CurriculumViolation(
        'note-1-no-print-in-lesson-1',
        `session ${session} (${lesson.slug}) uses print(). The lesson plan requires the first sessions ` +
          'to avoid heavy syntax so students are not overloaded.',
      );
    }
  }

  // Note 2 — complex numbers are out of scope for middle schoolers.
  for (const lesson of lessons) {
    const surface = codeSurface(lesson);
    if (/\bcomplex\s*\(/u.test(surface) || /số\s+phức/iu.test(surface)) {
      throw new CurriculumViolation(
        'note-2-no-complex-numbers',
        `${lesson.slug} references complex numbers, which the lesson plan explicitly excludes`,
      );
    }
  }

  // Note 7 — CSV is deprecated in favour of Text and JSON.
  for (const lesson of lessons) {
    const surface = codeSurface(lesson);
    if (/\bimport\s+csv\b/u.test(surface) || /\bcsv\.(reader|writer|DictReader|DictWriter)\b/u.test(surface)) {
      throw new CurriculumViolation(
        'note-7-no-csv',
        `${lesson.slug} uses the csv module. The lesson plan deprecates CSV; use Text or JSON.`,
      );
    }
  }

  // Note 5 — Tuple/Set stay theory-only; no coding blocks.
  const tupleSet = lessons.find((l) => l.slug.includes('tuple-set'));
  if (tupleSet) {
    const codingBlocks = tupleSet.blocks.filter(
      (b) => b.type === 'CODING' || b.type === 'MINI_CHALLENGE',
    );
    if (codingBlocks.length > 0) {
      throw new CurriculumViolation(
        'note-5-tuple-set-theory-only',
        `${tupleSet.slug} contains ${codingBlocks.length} coding block(s). The lesson plan keeps ` +
          'Tuple and Set as theory, with practical work concentrated on List and Dictionary.',
      );
    }
  }

  // Note 6 — try/except stays practical; no custom exception classes.
  const exceptions = lessons.find((l) => l.slug.includes('ngoai-le'));
  if (exceptions && /class\s+\w+\s*\(\s*Exception\s*\)/u.test(codeSurface(exceptions))) {
    throw new CurriculumViolation(
      'note-6-no-custom-exceptions',
      `${exceptions.slug} defines a custom exception class. The lesson plan keeps this lesson ` +
        'practical (try/except); custom exceptions belong in the Advanced course.',
    );
  }

  // Note 8 — the guaranteed floor. Sessions 1-19 required, 20-30 not required.
  for (const lesson of lessons) {
    if (lesson.order <= 19 && lesson.status !== 'REQUIRED') {
      throw new CurriculumViolation(
        'note-8-core-must-be-required',
        `session ${lesson.order} (${lesson.slug}) is ${lesson.status}. Sessions 1-19 form the ` +
          'guaranteed floor every student completes and must be REQUIRED.',
      );
    }
    if (lesson.order >= 20 && lesson.status === 'REQUIRED') {
      throw new CurriculumViolation(
        'note-8-collections-onward-optional',
        `session ${lesson.order} (${lesson.slug}) is REQUIRED. From Collections (Lesson 7) onward ` +
          'the lesson plan makes content optional or advanced, because some students max out at Loops.',
      );
    }
  }

  // Note 5 — List and Dictionary carry the practical load.
  const practiceHeavy = lessons.filter(
    (l) => l.slug.includes('list') || l.slug.includes('dictionary'),
  );
  const practiceCount = practiceHeavy.reduce(
    (n, l) => n + l.blocks.filter((b) => b.problem !== undefined).length,
    0,
  );
  if (practiceHeavy.length > 0 && practiceCount < 4) {
    throw new CurriculumViolation(
      'note-5-list-dict-practice-heavy',
      `List/Dictionary lessons define only ${practiceCount} graded exercises. The lesson plan asks ` +
        'for heavy practical work on these two collections.',
    );
  }
}

/** Pygame — notes 9, 10, 11, 12. */
function assertPygameNotes(course: CourseSpec): void {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const bySession = new Map(lessons.map((l) => [l.order, l]));

  // Note 9 — Module 1 must be visual from session one, never dry theory.
  for (const session of [1, 2, 3, 4]) {
    const lesson = bySession.get(session);
    if (!lesson) continue;
    const handsOn = lesson.blocks.filter(
      (b) => b.type === 'INTERACTIVE_EXAMPLE' || b.type === 'PLAYGROUND',
    );
    if (handsOn.length === 0) {
      throw new CurriculumViolation(
        'note-9-visual-from-session-one',
        `session ${session} (${lesson.slug}) has no interactive example or playground. The lesson ` +
          'plan forbids continuous dry theory — every early session must end with something on screen.',
      );
    }
  }

  // Note 12 — multiplayer was replaced by synthesis sessions.
  for (const lesson of lessons) {
    if (/multiplayer|nhiều\s+người\s+chơi\s+qua\s+mạng/iu.test(`${lesson.title} ${lesson.summary}`)) {
      throw new CurriculumViolation(
        'note-12-no-multiplayer',
        `${lesson.slug} reintroduces multiplayer. The lesson plan replaces it with synthesis ` +
          'sessions that consolidate earlier knowledge.',
      );
    }
  }

  // Note 11 — advanced movement and physics are separate focused sessions.
  const movementAdvanced = lessons.find((l) => l.slug.includes('chuyen-dong-nang-cao'));
  const physics = lessons.find((l) => l.slug.includes('vat-ly'));
  if (!movementAdvanced || !physics) {
    throw new CurriculumViolation(
      'note-11-split-movement-and-physics',
      'Module 3 must contain a dedicated advanced-movement session and a dedicated physics session',
    );
  }
  if (movementAdvanced.order === physics.order) {
    throw new CurriculumViolation(
      'note-11-split-movement-and-physics',
      'advanced movement and physics must be two different sessions',
    );
  }

  // Note 11 — the Menu lesson was reordered to sit before the module project.
  const menu = lessons.find((l) => l.slug.includes('menu'));
  const moduleProject = lessons.find((l) => l.slug.includes('du-an-pong'));
  if (menu && moduleProject && menu.order >= moduleProject.order) {
    throw new CurriculumViolation(
      'note-11-menu-order',
      `Menu (session ${menu.order}) must come before the module project (session ${moduleProject.order}) ` +
        'so game states exist before a menu needs them',
    );
  }
}

/** Python Nâng Cao — notes 14, 15, 16, 17. */
function assertPythonAdvancedNotes(course: CourseSpec): void {
  const lessons = course.modules.flatMap((m) => m.lessons);

  // Note 17 — the Big-O performance challenge must actually exist, and must
  // span the range the brief names (100 vs 100 000).
  const perfScenarios = allProblems(course).flatMap((p) => p.perfScenarios ?? []);
  if (perfScenarios.length === 0) {
    throw new CurriculumViolation(
      'note-17-performance-challenge',
      'the Searching & Sorting chapter defines no PerformanceScenario rows',
    );
  }
  const sizes = perfScenarios.map((s) => s.n);
  if (!sizes.includes(100) || Math.max(...sizes) < 100_000) {
    throw new CurriculumViolation(
      'note-17-performance-range',
      `performance scenarios span N=${Math.min(...sizes)}..${Math.max(...sizes)}; the lesson plan ` +
        'asks for the contrast between 100 and 100 000',
    );
  }

  // Note 16 — Web API work runs on the PY_WEB image with local fixtures, never
  // against a live third-party API.
  for (const problem of allProblems(course)) {
    const usesRequests = /\brequests\.(get|post|put|delete)\b/u.test(problem.solutionCode);
    if (usesRequests) {
      if (problem.runtimeImage !== 'PY_WEB') {
        throw new CurriculumViolation(
          'note-16-web-runtime',
          `${problem.slug} uses requests but is not on the PY_WEB runtime image`,
        );
      }
      if (!problem.mockFixtures) {
        throw new CurriculumViolation(
          'note-16-mock-fixtures',
          `${problem.slug} uses requests but defines no mockFixtures. Grading must not depend on ` +
            'a third-party API being reachable, and the sandbox has no egress.',
        );
      }
    }
  }

  // Note 15 — socket work stays on loopback inside a network-disabled sandbox.
  for (const problem of allProblems(course)) {
    if (/\bsocket\.socket\b/u.test(problem.solutionCode)) {
      const policy = problem.networkPolicy ?? 'NONE';
      if (policy !== 'NONE' && policy !== 'LOOPBACK_ONLY') {
        throw new CurriculumViolation(
          'note-15-network-disabled',
          `${problem.slug} opens a socket under policy ${policy}. Socket exercises run client and ` +
            'server together over 127.0.0.1 inside a --network=none container.',
        );
      }
      if (!/127\.0\.0\.1|localhost/u.test(problem.solutionCode)) {
        throw new CurriculumViolation(
          'note-15-loopback-only',
          `${problem.slug} opens a socket to a non-loopback address; the sandbox has no egress`,
        );
      }
    }
  }

  // Note 14 — PEP8 and real-world modelling are explicit, not implied.
  const oopChapter = course.modules[0];
  if (oopChapter) {
    const mentionsPep8 = oopChapter.lessons.some((l) =>
      /pep\s*-?\s*8/iu.test(`${l.title} ${l.summary} ${l.objectives.join(' ')}`),
    );
    if (!mentionsPep8) {
      throw new CurriculumViolation(
        'note-14-pep8',
        'the OOP chapter never mentions PEP8, which the lesson plan asks to be emphasised',
      );
    }
  }
  void lessons;
}


/**
 * Micro:bit Cơ Bản — Module 1, Khởi lệnh BASIC.
 *
 * The instructional requirements name five blocks and two specific challenges.
 * Encoding them here is what stops a later edit from quietly dropping one: a
 * missing `clearScreen` lesson would look like a normal curriculum tweak in a
 * diff and be invisible in the UI.
 */
function assertMicrobitBasicNotes(course: CourseSpec): void {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const allText = JSON.stringify(course);

  // Rule M1: every one of the five Basic blocks is actually taught.
  const KHOI_BAT_BUOC = ['forever', 'show string', 'show icon', 'pause', 'clearScreen'];
  for (const khoi of KHOI_BAT_BUOC) {
    if (!allText.includes(khoi)) {
      throw new CurriculumViolation(
        'microbit-missing-block',
        `Module 1 must teach the "${khoi}" block; it appears nowhere in the course`,
      );
    }
  }

  // Rule M2: pause is taught in MILLISECONDS. A student writing pause(0.5) for
  // half a second is the single most common mistake in this module, and the
  // brief calls the unit out explicitly.
  const dayPause = lessons.some((l) =>
    l.blocks.some(
      (b) =>
        b.content.kind === 'theory' &&
        /pause/i.test(b.content.markdown) &&
        /mili\s*gi[aâ]y/i.test(b.content.markdown) &&
        b.content.markdown.includes('1000'),
    ),
  );
  if (!dayPause) {
    throw new CurriculumViolation(
      'microbit-pause-unit',
      'pause must be taught in milliseconds, stating that 1 second = 1000 ms',
    );
  }

  // Rule M3: challenge 1 — smiley for 0.5s then sad, running ONCE.
  const mot = lessons
    .flatMap((l) => l.blocks)
    .find((b) => b.problem?.slug === 'mb-p-b02-mat-cuoi-mat-khoc-mot-lan');
  if (!mot?.problem) {
    throw new CurriculumViolation(
      'microbit-challenge-1',
      'Challenge 1 (smiley 0.5s then sad, run once) is missing',
    );
  }
  if (!mot.problem.solutionCode.includes('500')) {
    throw new CurriculumViolation(
      'microbit-challenge-1',
      'Challenge 1 must use 500 ms — the brief specifies 0.5 seconds',
    );
  }
  if (/forever/i.test(mot.problem.solutionCode)) {
    throw new CurriculumViolation(
      'microbit-challenge-1',
      'Challenge 1 runs ONCE. Its reference solution must not use forever — ' +
        'that is what challenge 2 adds.',
    );
  }

  // Rule M4: challenge 2 — the same effect, looping forever.
  const hai = lessons
    .flatMap((l) => l.blocks)
    .find((b) => b.problem?.slug === 'mb-p-b03-mat-cuoi-mat-khoc-lap-vo-han');
  if (!hai?.problem) {
    throw new CurriculumViolation(
      'microbit-challenge-2',
      'Challenge 2 (same effect, looping forever) is missing',
    );
  }
  if (!/forever/i.test(hai.problem.solutionCode)) {
    throw new CurriculumViolation(
      'microbit-challenge-2',
      'Challenge 2 must use forever — looping is the whole point of the upgrade',
    );
  }

  // Rule M5: challenge 2 comes AFTER challenge 1. The brief frames it as an
  // upgrade of the previous program, which only reads that way in order.
  const buoiMot = lessons.find((l) =>
    l.blocks.some((b) => b.problem?.slug === 'mb-p-b02-mat-cuoi-mat-khoc-mot-lan'),
  );
  const buoiHai = lessons.find((l) =>
    l.blocks.some((b) => b.problem?.slug === 'mb-p-b03-mat-cuoi-mat-khoc-lap-vo-han'),
  );
  if (buoiMot && buoiHai && buoiHai.order <= buoiMot.order) {
    throw new CurriculumViolation(
      'microbit-challenge-order',
      'Challenge 2 is an upgrade of challenge 1 and must come in a later session',
    );
  }

  // Rule M6: nothing here is auto-judged. A Micro:bit task handed to the Python
  // judge would be marked wrong for producing no stdout, which is exactly the
  // failure mode this rule exists to prevent.
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      if (block.problem && block.problem.judgeMode !== 'MAKECODE') {
        throw new CurriculumViolation(
          'microbit-judge-mode',
          `${block.problem.slug} must be judgeMode MAKECODE — hardware behaviour ` +
            'cannot be observed by the Python sandbox',
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════

/** Runs every rule. Throws CurriculumViolation on the first failure. */
export function assertCurriculumCompliance(courses: CourseSpec[]): void {
  assertUniqueSlugs(courses);

  for (const course of courses) {
    assertStructure(course);
    assertPedagogicalFlow(course);
    assertProblemsAreTestable(course);
    assertNoDeficitLanguage(course);

    switch (course.slug) {
      case 'python-co-ban':
        assertPythonBasicNotes(course);
        break;
      case 'lap-trinh-game-pygame':
        assertPygameNotes(course);
        break;
      case 'python-nang-cao':
        assertPythonAdvancedNotes(course);
        break;
      case 'microbit-co-ban':
        assertMicrobitBasicNotes(course);
        break;
      default:
        throw new CurriculumViolation(
          'unknown-course',
          `${course.slug} has no teacher-note assertions. Add them before seeding.`,
        );
    }
  }
}
