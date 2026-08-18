/**
 * End-to-end judging, against real Postgres and real containers.
 *
 * The accuracy gates the brief names: a correct solution is ACCEPTED, an
 * infinite loop is TIME_LIMIT_EXCEEDED with the container killed, and wrong
 * output is WRONG_ANSWER.
 *
 * Also covers the two things a judge must never do: leak host internals to a
 * student, and leak hidden test data through the results panel.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { chamBai } from './judge';
import { coDocker } from './sandbox';

const db = new PrismaClient({ log: ['error'] });
const prefix = `p8-${randomBytes(4).toString('hex')}`;

const userIds: string[] = [];
const problemIds: string[] = [];
const classIds: string[] = [];

let studentId: string;
let teacherId: string;
let ioProblemId: string;
let unitProblemId: string;
let lessonId: string;

beforeAll(async () => {
  if (!(await coDocker())) {
    throw new Error('Cac test cham bai can Docker that. Khoi dong Docker roi chay lai.');
  }

  const teacher = await db.user.create({
    data: {
      username: `${prefix}-gv`,
      displayName: 'GV',
      role: 'TEACHER',
      passwordHash: 'x',
    },
    select: { id: true },
  });
  const student = await db.user.create({
    data: {
      username: `${prefix}-hs`,
      displayName: 'HS',
      role: 'STUDENT',
      passwordHash: 'x',
    },
    select: { id: true },
  });
  teacherId = teacher.id;
  studentId = student.id;
  userIds.push(teacherId, studentId);

  const course = await db.course.findUniqueOrThrow({
    where: { slug: 'python-co-ban' },
    select: { id: true },
  });
  const lesson = await db.lesson.findFirstOrThrow({
    where: { courseId: course.id, order: 1 },
    select: { id: true },
  });
  lessonId = lesson.id;

  const lop = await db.class.create({
    data: { code: `${prefix}-LOP`, name: 'Lop', teacherId },
    select: { id: true },
  });
  classIds.push(lop.id);
  await db.classCourse.create({ data: { classId: lop.id, courseId: course.id } });
  await db.enrollment.create({ data: { classId: lop.id, studentId, isActive: true } });

  // Sum of the numbers on stdin. One sample test, one hidden test.
  const io = await db.problem.create({
    data: {
      slug: `${prefix}-tong`,
      title: 'Tính tổng',
      statement: 'Đọc các số và in tổng.',
      judgeMode: 'IO_MATCH',
      runtimeImage: 'PY_BASE',
      timeLimitMs: 3000,
      memoryLimitMb: 128,
      totalPoints: 100,
      testCases: {
        create: [
          { order: 1, input: '1 2 3\n', expectedOutput: '6', isSample: true, points: 50 },
          { order: 2, input: '10 20 30\n', expectedOutput: '60', isHidden: true, points: 50 },
        ],
      },
    },
    select: { id: true },
  });
  ioProblemId = io.id;
  problemIds.push(io.id);

  const unit = await db.problem.create({
    data: {
      slug: `${prefix}-lop-hcn`,
      title: 'Lớp hình chữ nhật',
      statement: 'Viết lớp HinhChuNhat.',
      judgeMode: 'UNIT_TEST',
      runtimeImage: 'PY_BASE',
      timeLimitMs: 5000,
      memoryLimitMb: 128,
      totalPoints: 100,
      unitTestCode: `
from solution import HinhChuNhat

def test_chu_vi():
    h = HinhChuNhat(5, 3)
    assert h.chu_vi() == 16

def test_dien_tich():
    h = HinhChuNhat(5, 3)
    assert h.dien_tich() == 15
`,
    },
    select: { id: true },
  });
  unitProblemId = unit.id;
  problemIds.push(unit.id);
}, 90_000);

afterAll(async () => {
  await db.submissionTestResult.deleteMany({
    where: { submission: { studentId: { in: userIds } } },
  });
  await db.submission.deleteMany({ where: { studentId: { in: userIds } } });
  await db.blockProgress.deleteMany({ where: { studentId: { in: userIds } } });
  await db.lessonProgress.deleteMany({ where: { studentId: { in: userIds } } });
  await db.testCase.deleteMany({ where: { problemId: { in: problemIds } } });
  await db.problem.deleteMany({ where: { id: { in: problemIds } } });
  await db.class.deleteMany({ where: { id: { in: classIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

async function nop(problemId: string, code: string): Promise<string> {
  const s = await db.submission.create({
    data: { studentId, problemId, lessonId, code, verdict: 'PENDING', queuedAt: new Date() },
    select: { id: true },
  });
  return s.id;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cổng chính xác
// ═══════════════════════════════════════════════════════════════════════════

describe('Cổng chính xác — IO_MATCH', () => {
  it('lời giải đúng cho ACCEPTED và điểm tối đa', async () => {
    const id = await nop(
      ioProblemId,
      'import sys\nprint(sum(int(x) for x in sys.stdin.read().split()))\n',
    );
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('ACCEPTED');
    expect(kq.passedTests).toBe(2);
    expect(kq.totalTests).toBe(2);
    expect(kq.score).toBe(100);
  }, 60_000);

  it('kết quả sai cho WRONG_ANSWER', async () => {
    const id = await nop(ioProblemId, 'print(999)\n');
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('WRONG_ANSWER');
    expect(kq.passedTests).toBe(0);
  }, 60_000);

  it('vòng lặp vô hạn cho TIME_LIMIT_EXCEEDED', async () => {
    const id = await nop(ioProblemId, 'while True:\n    pass\n');
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('TIME_LIMIT_EXCEEDED');
  }, 60_000);

  it('lỗi cú pháp cho COMPILE_ERROR, không phải RUNTIME_ERROR', async () => {
    // The distinction matters to a beginner: one means Python could not read
    // the program at all, the other means it ran and then went wrong.
    const id = await nop(ioProblemId, 'print("thieu dau ngoac"\n');
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('COMPILE_ERROR');
    expect(kq.compileError).toBeTruthy();
  }, 60_000);

  it('lỗi khi chạy cho RUNTIME_ERROR', async () => {
    const id = await nop(ioProblemId, 'x = 1 / 0\n');
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('RUNTIME_ERROR');
  }, 60_000);

  it('khoảng trắng thừa cuối dòng vẫn được chấp nhận', async () => {
    // A beginner must never fail on whitespace they cannot see.
    const id = await nop(
      ioProblemId,
      'import sys\nprint(str(sum(int(x) for x in sys.stdin.read().split())) + "   ")\n',
    );
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('ACCEPTED');
  }, 60_000);

  it('ghi đủ trạng thái vào bảng Submission', async () => {
    const id = await nop(
      ioProblemId,
      'import sys\nprint(sum(int(x) for x in sys.stdin.read().split()))\n',
    );
    await chamBai(db, id);

    const row = await db.submission.findUniqueOrThrow({
      where: { id },
      select: { verdict: true, score: true, judgedAt: true, maxTimeMs: true },
    });

    expect(row.verdict).toBe('ACCEPTED');
    expect(row.judgedAt).not.toBeNull();
    expect(row.maxTimeMs).toBeGreaterThan(0);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Không rò rỉ
// ═══════════════════════════════════════════════════════════════════════════

describe('Không rò rỉ thông tin', () => {
  it('không lưu dữ liệu của ca kiểm thử ẩn', async () => {
    const id = await nop(ioProblemId, 'print(0)\n');
    await chamBai(db, id);

    const ket = await db.submissionTestResult.findMany({
      where: { submissionId: id },
      select: { stdout: true, stderr: true, testCase: { select: { isHidden: true } } },
    });

    for (const r of ket) {
      if (r.testCase.isHidden) {
        // Storing a hidden test's output would hand over the assessment through
        // the results panel.
        expect(r.stdout).toBeNull();
        expect(r.stderr).toBeNull();
      }
    }
  }, 60_000);

  it('không lộ đường dẫn máy chủ hay nội bộ container cho học sinh', async () => {
    const id = await nop(ioProblemId, 'raise ValueError("oops")\n');
    await chamBai(db, id);

    const ket = await db.submissionTestResult.findMany({
      where: { submissionId: id },
      select: { stderr: true, friendlyError: true },
    });

    for (const r of ket) {
      expect(r.stderr ?? '').not.toContain('/sandbox/');
      expect(r.stderr ?? '').not.toContain('/usr/local/lib/python');
      expect(r.friendlyError ?? '').not.toContain('/sandbox/');
    }
  }, 60_000);

  it('thông điệp lỗi bằng tiếng Việt và chỉ ra chỗ cần xem', async () => {
    const id = await nop(ioProblemId, 'print(ten_chua_co)\n');
    await chamBai(db, id);

    const r = await db.submissionTestResult.findFirst({
      where: { submissionId: id },
      select: { friendlyError: true },
    });

    expect(r?.friendlyError).toContain('ten_chua_co');
    // Names what to look at, never what the student is.
    expect(r?.friendlyError ?? '').not.toMatch(/sai rồi|kém|dở/i);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// UNIT_TEST
// ═══════════════════════════════════════════════════════════════════════════

describe('Chế độ UNIT_TEST', () => {
  it('lớp đúng thì mọi test đều đạt', async () => {
    const id = await nop(
      unitProblemId,
      `
class HinhChuNhat:
    def __init__(self, dai, rong):
        self.dai = dai
        self.rong = rong
    def chu_vi(self):
        return (self.dai + self.rong) * 2
    def dien_tich(self):
        return self.dai * self.rong
`,
    );
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('ACCEPTED');
    expect(kq.passedTests).toBe(2);
    expect(kq.totalTests).toBe(2);
  }, 60_000);

  it('một phương thức sai thì cho điểm một phần', async () => {
    const id = await nop(
      unitProblemId,
      `
class HinhChuNhat:
    def __init__(self, dai, rong):
        self.dai = dai
        self.rong = rong
    def chu_vi(self):
        return (self.dai + self.rong) * 2
    def dien_tich(self):
        return 0
`,
    );
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('WRONG_ANSWER');
    expect(kq.passedTests).toBe(1);
    expect(kq.totalTests).toBe(2);
    expect(kq.score).toBe(50);
  }, 60_000);

  it('học sinh không giả mạo được kết quả đạt bằng cách in ra', async () => {
    // The sentinel carries a per-run nonce the student's program cannot predict.
    const id = await nop(
      unitProblemId,
      `
print("__DYE_KET_QUA__" + '{"tests":[{"ten":"test_chu_vi","dat":true,"bo_qua":false,"loi":null}],"loi_nap":null}')
class HinhChuNhat:
    def __init__(self, dai, rong): pass
    def chu_vi(self): return 0
    def dien_tich(self): return 0
`,
    );
    const kq = await chamBai(db, id);

    expect(kq.verdict).not.toBe('ACCEPTED');
  }, 60_000);

  it('thiếu lớp thì báo lỗi chạy, không phải lỗi hệ thống', async () => {
    const id = await nop(unitProblemId, 'x = 1\n');
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('RUNTIME_ERROR');
    expect(kq.verdict).not.toBe('INTERNAL_ERROR');
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Tích hợp engine tiến độ Phase 4
// ═══════════════════════════════════════════════════════════════════════════

describe('ACCEPTED cập nhật tiến độ', () => {
  it('bài đúng đánh dấu khối hoàn thành và tính lại tiến độ bài học', async () => {
    // Attach the problem to a real block in session 1.
    const khoi = await db.lessonBlock.findFirstOrThrow({
      where: { lessonId },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    await db.lessonBlock.update({
      where: { id: khoi.id },
      data: { problemId: ioProblemId },
    });

    const id = await nop(
      ioProblemId,
      'import sys\nprint(sum(int(x) for x in sys.stdin.read().split()))\n',
    );
    const kq = await chamBai(db, id);
    expect(kq.verdict).toBe('ACCEPTED');

    const bp = await db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId, blockId: khoi.id } },
      select: { state: true },
    });
    expect(bp?.state).toBe('COMPLETED');

    // Lesson completion is recomputed by the Phase 4 engine, never written
    // directly, so a Cơ bản student is not held back by a Nâng cao block.
    const lp = await db.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
      select: { state: true },
    });
    expect(lp).not.toBeNull();
  }, 60_000);

  it('bài sai KHÔNG đánh dấu hoàn thành', async () => {
    const khoi = await db.lessonBlock.findFirstOrThrow({
      where: { lessonId, problemId: ioProblemId },
      select: { id: true },
    });
    await db.blockProgress.deleteMany({ where: { studentId, blockId: khoi.id } });

    const id = await nop(ioProblemId, 'print(1)\n');
    const kq = await chamBai(db, id);
    expect(kq.verdict).toBe('WRONG_ANSWER');

    const bp = await db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId, blockId: khoi.id } },
    });
    expect(bp).toBeNull();
  }, 60_000);
});
