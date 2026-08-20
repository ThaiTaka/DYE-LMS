/**
 * Curriculum invariant tests.
 *
 * These run without a database. They lock in the rules that the brief calls
 * non-negotiable, so a future curriculum edit that breaks one fails CI rather
 * than reaching a student.
 */
import { describe, expect, it } from 'vitest';

import { assertCurriculumCompliance, CurriculumViolation } from '../prisma/seed/assertions.ts';
import { allCourses } from '../prisma/seed/courses/index.ts';
import type { CourseSpec, LessonSpec } from '../prisma/seed/types.ts';

const byCourse = (slug: string): CourseSpec => {
  const course = allCourses.find((c) => c.slug === slug);
  if (!course) throw new Error(`Missing course ${slug}`);
  return course;
};

const lessonsOf = (course: CourseSpec): LessonSpec[] => course.modules.flatMap((m) => m.lessons);

describe('toàn bộ chương trình học', () => {
  it('tuân thủ mọi ghi chú của giáo viên', () => {
    expect(() => assertCurriculumCompliance(allCourses)).not.toThrow();
  });

  it('ba khoá Python vẫn đủ 30 buổi mỗi khoá', () => {
    // Asserted by slug rather than by counting the array: adding a course must
    // not be able to weaken the guarantee about the three that already existed.
    for (const slug of ['python-co-ban', 'lap-trinh-game-pygame', 'python-nang-cao']) {
      const course = byCourse(slug);
      expect(course.totalSessions, slug).toBe(30);
      expect(lessonsOf(course), slug).toHaveLength(30);
    }
  });

  it('mỗi khoá đánh số buổi liên tục từ 1, không trùng, không thiếu', () => {
    for (const course of allCourses) {
      const orders = lessonsOf(course)
        .map((l) => l.order)
        .sort((a, b) => a - b);
      expect(
        orders,
        course.slug,
      ).toEqual(Array.from({ length: course.totalSessions }, (_, i) => i + 1));
    }
  });

  it('không có slug bài học nào trùng nhau trên toàn hệ thống', () => {
    const slugs = allCourses.flatMap((c) => lessonsOf(c).map((l) => l.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('mọi bài lập trình chấm tự động đều chạy với mạng bị tắt', () => {
    const problems = allCourses.flatMap((c) =>
      lessonsOf(c).flatMap((l) => l.blocks.map((b) => b.problem).filter((p) => p !== undefined)),
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      expect(problem.networkPolicy ?? 'NONE').not.toBe('EGRESS_ALLOWLIST');
    }
  });
});

describe('Python Cơ Bản — mốc hoàn thành đảm bảo', () => {
  const course = byCourse('python-co-ban');
  const lessons = lessonsOf(course);

  it('buổi 1–19 là bắt buộc, tạo thành phần nền tảng mọi học sinh đều học', () => {
    for (const lesson of lessons.filter((l) => l.order <= 19)) {
      expect(lesson.status).toBe('REQUIRED');
    }
  });

  it('từ buổi 20 (Collections) trở đi không còn bắt buộc', () => {
    // Kế hoạch bài giảng: "có học sinh sẽ dừng lại quanh Lesson 5".
    for (const lesson of lessons.filter((l) => l.order >= 20)) {
      expect(lesson.status).not.toBe('REQUIRED');
    }
  });

  it('học sinh hoàn thành buổi 1–19 đã hoàn thành 100% phần bắt buộc', () => {
    const required = lessons.filter((l) => l.status === 'REQUIRED');
    const completedThrough19 = required.filter((l) => l.order <= 19);
    expect(completedThrough19).toHaveLength(required.length);
  });

  it('buổi 1 và 2 không dùng print() — tránh quá tải nhận thức', () => {
    for (const lesson of lessons.filter((l) => l.order <= 2)) {
      const surface = JSON.stringify(lesson.blocks);
      expect(surface).not.toMatch(/print\s*\(/u);
    }
  });

  /**
   * Nội dung học sinh thực sự nhìn thấy: các khối bài học và bài tập.
   *
   * Cố ý KHÔNG bao gồm `teacherNotes` — ghi chú giáo viên có quyền nhắc tới
   * những thứ bị cấm, đúng nghĩa là để cấm chúng. Ví dụ buổi 3 ghi rõ
   * "KHÔNG đưa số phức vào chương trình". Đó là tuân thủ, không phải vi phạm.
   */
  const noiDungHocSinhThay = (l: LessonSpec): string => JSON.stringify(l.blocks);

  it('không nhắc tới số phức trong nội dung học sinh thấy', () => {
    for (const lesson of lessons) {
      expect(noiDungHocSinhThay(lesson)).not.toMatch(/\bcomplex\s*\(/u);
      expect(noiDungHocSinhThay(lesson)).not.toMatch(/số\s+phức/iu);
    }
  });

  it('ghi chú giáo viên buổi 3 nêu rõ lý do loại trừ số phức', () => {
    const lesson = lessons.find((l) => l.order === 3);
    expect(lesson?.teacherNotes).toMatch(/số\s+phức/iu);
  });

  it('không dùng module csv — kế hoạch bài giảng loại bỏ CSV', () => {
    for (const lesson of lessons) {
      const surface = noiDungHocSinhThay(lesson);
      expect(surface).not.toMatch(/\bimport\s+csv\b/u);
      expect(surface).not.toMatch(/\bcsv\.(reader|writer|DictReader|DictWriter)\b/u);
    }
  });

  it('Tuple và Set chỉ dạy lý thuyết, không có bài lập trình', () => {
    const lesson = lessons.find((l) => l.slug.includes('tuple-set'));
    expect(lesson).toBeDefined();
    const coding = lesson?.blocks.filter((b) => b.type === 'CODING' || b.type === 'MINI_CHALLENGE');
    expect(coding).toHaveLength(0);
  });

  it('List và Dictionary có nhiều bài thực hành', () => {
    const practiceHeavy = lessons.filter(
      (l) => l.slug.includes('list') || l.slug.includes('dictionary'),
    );
    const problems = practiceHeavy.reduce(
      (n, l) => n + l.blocks.filter((b) => b.problem !== undefined).length,
      0,
    );
    expect(problems).toBeGreaterThanOrEqual(4);
  });

  it('bài xử lý ngoại lệ không định nghĩa lớp Exception riêng', () => {
    const lesson = lessons.find((l) => l.slug.includes('ngoai-le'));
    expect(lesson).toBeDefined();
    expect(JSON.stringify(lesson)).not.toMatch(/class\s+\w+\s*\(\s*Exception\s*\)/u);
  });

  it('bài lượng giác được gắn mức Nâng cao, không hiện với nhánh Cơ bản', () => {
    const mathLesson = lessons.find((l) => l.slug.includes('module-math'));
    expect(mathLesson).toBeDefined();

    const trigBlocks = mathLesson?.blocks.filter((b) =>
      /sin|cos|lượng giác/iu.test(JSON.stringify(b)),
    );
    expect(trigBlocks?.length).toBeGreaterThan(0);
    for (const block of trigBlocks ?? []) {
      expect(block.tier).toBe('NANG_CAO');
    }
  });
});

describe('Pygame — cấu trúc do đề bài quy định', () => {
  const course = byCourse('lap-trinh-game-pygame');
  const lessons = lessonsOf(course);

  it('có đúng 5 mô-đun với số buổi 4 / 4 / 8 / 10 / 4', () => {
    expect(course.modules.map((m) => m.lessons.length)).toEqual([4, 4, 8, 10, 4]);
  });

  it('không có bài nào suy dẫn — đề bài đã liệt kê đầy đủ', () => {
    expect(lessons.filter((l) => l.isDerived)).toHaveLength(0);
  });

  it('bốn buổi đầu đều kết thúc bằng thứ chạy được trên màn hình', () => {
    for (const lesson of lessons.filter((l) => l.order <= 4)) {
      const handsOn = lesson.blocks.filter(
        (b) => b.type === 'INTERACTIVE_EXAMPLE' || b.type === 'PLAYGROUND',
      );
      expect(handsOn.length).toBeGreaterThan(0);
    }
  });

  it('chuyển động nâng cao và vật lý là hai buổi riêng biệt', () => {
    const movement = lessons.find((l) => l.slug.includes('chuyen-dong-nang-cao'));
    const physics = lessons.find((l) => l.slug.includes('vat-ly'));
    expect(movement).toBeDefined();
    expect(physics).toBeDefined();
    expect(movement?.order).not.toBe(physics?.order);
  });

  it('bài Menu được đảo lên trước buổi dự án của mô-đun', () => {
    const menu = lessons.find((l) => l.slug.includes('menu'));
    const project = lessons.find((l) => l.slug.includes('du-an-pong'));
    expect(menu?.order).toBeLessThan(project?.order ?? 0);
  });

  it('không có bài nào về multiplayer — đã thay bằng buổi tổng hợp', () => {
    for (const lesson of lessons) {
      expect(`${lesson.title} ${lesson.summary}`).not.toMatch(/multiplayer/iu);
    }
    const synthesis = lessons.filter((l) => l.slug.includes('tong-hop'));
    expect(synthesis).toHaveLength(3);
  });
});

describe('Python Nâng Cao — thử thách hiệu năng Big-O', () => {
  const course = byCourse('python-nang-cao');
  const lessons = lessonsOf(course);

  const perfScenarios = lessons.flatMap((l) =>
    l.blocks.flatMap((b) => b.problem?.perfScenarios ?? []),
  );

  it('có kịch bản đo hiệu năng', () => {
    expect(perfScenarios.length).toBeGreaterThan(0);
  });

  it('trải từ N = 100 tới ít nhất N = 100 000, đúng yêu cầu đề bài', () => {
    const sizes = perfScenarios.map((s) => s.n);
    expect(sizes).toContain(100);
    expect(Math.max(...sizes)).toBeGreaterThanOrEqual(100_000);
  });

  it('mọi bài dùng requests đều chạy trên ảnh PY_WEB với dữ liệu mô phỏng', () => {
    const problems = lessons.flatMap((l) =>
      l.blocks.map((b) => b.problem).filter((p) => p !== undefined),
    );
    const webProblems = problems.filter((p) =>
      /\brequests\.(get|post|put|delete)\b/u.test(p.solutionCode),
    );
    expect(webProblems.length).toBeGreaterThan(0);
    for (const problem of webProblems) {
      expect(problem.runtimeImage).toBe('PY_WEB');
      expect(problem.mockFixtures).toBeDefined();
    }
  });

  it('mọi bài dùng socket đều nằm trên loopback với mạng bị tắt', () => {
    const problems = lessons.flatMap((l) =>
      l.blocks.map((b) => b.problem).filter((p) => p !== undefined),
    );
    const socketProblems = problems.filter((p) => /\bsocket\.socket\b/u.test(p.solutionCode));
    expect(socketProblems.length).toBeGreaterThan(0);
    for (const problem of socketProblems) {
      expect(problem.networkPolicy ?? 'NONE').toBe('NONE');
      expect(problem.solutionCode).toMatch(/127\.0\.0\.1|localhost/u);
    }
  });

  it('chương OOP có nhắc tới chuẩn PEP8', () => {
    const oop = course.modules[0];
    const mentions = oop?.lessons.some((l) =>
      /pep\s*-?\s*8/iu.test(`${l.title} ${l.summary} ${l.objectives.join(' ')}`),
    );
    expect(mentions).toBe(true);
  });

  it('bài OOP dùng chấm bằng unit test, vì I/O không kiểm tra được kế thừa', () => {
    const oopProblems = (course.modules[0]?.lessons ?? []).flatMap((l) =>
      l.blocks.map((b) => b.problem).filter((p) => p !== undefined),
    );
    expect(oopProblems.length).toBeGreaterThan(0);
    for (const problem of oopProblems) {
      expect(problem.judgeMode).toBe('UNIT_TEST');
      expect(problem.unitTestCode?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('bộ kiểm tra tuân thủ tự phát hiện vi phạm', () => {
  const baseCourse = (): CourseSpec => JSON.parse(JSON.stringify(byCourse('python-co-ban')));

  it('bắt được khi một buổi bắt buộc bị đổi thành tuỳ chọn', () => {
    const broken = baseCourse();
    const lesson = broken.modules[0]?.lessons[0];
    if (lesson) lesson.status = 'OPTIONAL';

    expect(() => assertCurriculumCompliance([broken])).toThrow(CurriculumViolation);
  });

  it('bắt được khi buổi 1 dùng print()', () => {
    const broken = baseCourse();
    const lesson = broken.modules[0]?.lessons[0];
    lesson?.blocks.push({
      type: 'PLAYGROUND',
      title: 'Vi phạm',
      content: { kind: 'playground', markdown: '', starterCode: 'print("xin chao")', goal: '' },
    });

    expect(() => assertCurriculumCompliance([broken])).toThrow(/note-1-no-print/u);
  });

  it('bắt được khi lý thuyết nhảy thẳng sang kiểm tra, không có phần thực hành', () => {
    const broken = baseCourse();
    const lesson = broken.modules[0]?.lessons[0];
    if (lesson) {
      lesson.blocks = [
        { type: 'THEORY', title: 'Lý thuyết', content: { kind: 'theory', markdown: 'abc' } },
        { type: 'QUIZ', title: 'Kiểm tra', content: { kind: 'quiz', markdown: 'abc' } },
      ];
    }

    expect(() => assertCurriculumCompliance([broken])).toThrow(/pedagogical-flow/u);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
// Micro:bit — khoá mới, không được phá ba khoá Python
// ═══════════════════════════════════════════════════════════════════════════

describe('Khoá Micro:bit Cơ Bản', () => {
  const microbit = byCourse('microbit-co-ban');
  const buoi = lessonsOf(microbit);
  const moiThu = JSON.stringify(microbit);

  it('nằm cạnh ba khoá Python chứ không thay thế khoá nào', () => {
    const slug = allCourses.map((c) => c.slug);
    expect(slug).toEqual(
      expect.arrayContaining([
        'python-co-ban',
        'lap-trinh-game-pygame',
        'python-nang-cao',
        'microbit-co-ban',
      ]),
    );
    expect(allCourses).toHaveLength(4);
  });

  it('dạy đủ năm khối lệnh Basic mà đề bài yêu cầu', () => {
    for (const khoi of ['forever', 'show string', 'show icon', 'pause', 'clearScreen']) {
      expect(moiThu, `thiếu khối ${khoi}`).toContain(khoi);
    }
  });

  it('dạy pause bằng mili giây — lỗi hay gặp nhất của học sinh', () => {
    const lyThuyet = buoi
      .flatMap((l) => l.blocks)
      .filter((b) => b.content.kind === 'theory')
      .map((b) => (b.content.kind === 'theory' ? b.content.markdown : ''))
      .join('\n');

    expect(lyThuyet).toMatch(/mili\s*gi[aâ]y/i);
    // 1 giây = 1000 ms; nửa giây = 500 ms.
    expect(lyThuyet).toContain('1000');
    expect(lyThuyet).toContain('500');
  });

  it('thử thách 1: mặt cười 0,5 giây rồi mặt khóc, chạy MỘT lần', () => {
    const bai = buoi
      .flatMap((l) => l.blocks)
      .find((b) => b.problem?.slug === 'mb-p-b02-mat-cuoi-mat-khoc-mot-lan');

    expect(bai?.problem).toBeDefined();
    expect(bai!.problem!.solutionCode).toContain('500');
    // Running once is the point; forever is what challenge 2 adds.
    expect(bai!.problem!.solutionCode).not.toMatch(/forever/i);
  });

  it('thử thách 2: cùng hiệu ứng nhưng lặp vô hạn', () => {
    const bai = buoi
      .flatMap((l) => l.blocks)
      .find((b) => b.problem?.slug === 'mb-p-b03-mat-cuoi-mat-khoc-lap-vo-han');

    expect(bai?.problem).toBeDefined();
    expect(bai!.problem!.solutionCode).toMatch(/forever/i);
    expect(bai!.problem!.solutionCode).toContain('500');
  });

  it('thử thách 2 nằm ở buổi SAU thử thách 1', () => {
    const mot = buoi.find((l) =>
      l.blocks.some((b) => b.problem?.slug === 'mb-p-b02-mat-cuoi-mat-khoc-mot-lan'),
    );
    const hai = buoi.find((l) =>
      l.blocks.some((b) => b.problem?.slug === 'mb-p-b03-mat-cuoi-mat-khoc-lap-vo-han'),
    );

    // Challenge 2 is framed as an upgrade of challenge 1; that only reads
    // correctly in order.
    expect(mot).toBeDefined();
    expect(hai).toBeDefined();
    expect(hai!.order).toBeGreaterThan(mot!.order);
  });

  it('MỌI bài tập đều là MAKECODE — không bài nào lọt vào judge Python', () => {
    const baiTap = buoi.flatMap((l) => l.blocks).filter((b) => b.problem);
    expect(baiTap.length).toBeGreaterThan(0);

    for (const b of baiTap) {
      // A Micro:bit task handed to the Python judge would be marked wrong for
      // producing no stdout.
      expect(b.problem!.judgeMode, b.problem!.slug).toBe('MAKECODE');
    }
  });

  it('bài MAKECODE không có ca kiểm thử, nhưng luôn có lời giải mẫu', () => {
    for (const b of buoi.flatMap((l) => l.blocks).filter((x) => x.problem)) {
      expect(b.problem!.tests ?? [], b.problem!.slug).toHaveLength(0);
      // A task nobody has solved is a task nobody has checked is solvable.
      expect(b.problem!.solutionCode.trim().length, b.problem!.slug).toBeGreaterThan(0);
    }
  });

  /*
   * The course runs to 30 sessions, and they are not all the same kind of thing.
   * Buổi 1–4 are authored from the brief; Buổi 5–30 are planned shells whose
   * lesson content no teacher has written yet.
   *
   * The pair of tests below is what keeps that distinction honest in BOTH
   * directions — which matters more than either test on its own:
   *
   *   • an authored session must carry a task, or it is not authored;
   *   • a session with no task must be FLAGGED as a shell, or it is a
   *     half-written lesson masquerading as a finished one.
   *
   * Without the second test, "session has no workspace block" would have become
   * an acceptable state, and the next unfinished lesson would ship silently.
   */
  it('mỗi buổi đã biên soạn đều có khối MICROBIT_WORKSPACE để em làm bài', () => {
    const daBienSoan = buoi.filter((l) => !l.isDerived);
    expect(daBienSoan.length).toBeGreaterThan(0);

    for (const l of daBienSoan) {
      expect(
        l.blocks.some((b) => b.type === 'MICROBIT_WORKSPACE'),
        `${l.slug} không có khối làm bài`,
      ).toBe(true);
    }
  });

  it('buổi chưa biên soạn phải tự khai báo là khung, và không tính vào tiến độ bắt buộc', () => {
    for (const l of buoi) {
      const coBaiLam = l.blocks.some((b) => b.type === 'MICROBIT_WORKSPACE');
      if (coBaiLam) continue;

      // Flagged as reconstructed, so the teacher curriculum view can tell the
      // difference and the real plan can be swapped in later.
      expect(l.isDerived, `${l.slug} chưa có bài làm nhưng không đánh dấu isDerived`).toBe(true);

      // Never REQUIRED. With the default linear prerequisite chain, a required
      // empty lesson parks every student in the class behind a page with
      // nothing on it and reports the whole class as behind.
      expect(l.status, `${l.slug} là khung nhưng lại đang REQUIRED`).not.toBe('REQUIRED');

      // Still a usable self-study prompt rather than a dead end.
      expect(l.blocks.length, `${l.slug} không có khối nội dung nào`).toBeGreaterThan(0);
      expect(l.objectives.length, `${l.slug} không có mục tiêu`).toBeGreaterThan(0);
    }
  });

  it('đủ 30 buổi và số buổi khớp với totalSessions', () => {
    expect(buoi).toHaveLength(30);
    expect(microbit.totalSessions).toBe(30);

    const soThuTu = buoi.map((l) => l.order).sort((a, b) => a - b);
    expect(soThuTu).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('không dùng ngôn ngữ tiêu cực về học sinh', () => {
    for (const xau of [/học sinh yếu/i, /kém/i, /dở/i]) {
      expect(moiThu).not.toMatch(xau);
    }
  });
});
