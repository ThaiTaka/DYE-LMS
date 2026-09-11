/**
 * Milestone exams, against a real database.
 *
 * What is protected here, in order of how badly a regression would hurt:
 *
 *   1. ONE ALT-TAB IS ONE STRIKE. A burst of reports inside the dedupe window
 *      — which is what a single departure looks like from the browser — must
 *      count once. Lose this and the two-strike rule zeroes the first Alt-Tab.
 *   2. THE SERVER COUNTS. Ten concurrent reports produce one increment,
 *      because the increment is a compare-and-set, not a read-then-write.
 *   3. THE LOCK IS A ZERO, AND IT IS REVERSIBLE. Strike `maxStrikes` closes
 *      the attempt at 0 whatever was answered; a teacher who teaches the
 *      child can void it and the child can sit again.
 *   4. THE KEY NEVER LEAVES. The question payload for the browser carries no
 *      `isCorrect` and no `acceptedAnswers`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import {
  batDauLamBai,
  cauHoiChoBaiThi,
  danhSachKiemTra,
  DEDUP_VI_PHAM_MS,
  ghiNhanViPham,
  hetGioNeuQuaHan,
  huyLuotThi,
  luotThiCuaHocSinh,
  luuTraLoi,
  nopBaiThi,
  TRE_NOP_MS,
} from './kiem-tra';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let examId: string;
let quizId: string;
/** The correct choice for the first question, read straight from the key. */
let cauDau: { id: string; dung: string; sai: string; points: number };

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);

  // Any seeded quiz whose first question is multiple choice will do as a bank.
  const quiz = await fx.db.quiz.findFirstOrThrow({
    where: { questions: { some: { type: 'MULTIPLE_CHOICE' } } },
    select: {
      id: true,
      questions: {
        where: { type: 'MULTIPLE_CHOICE' },
        orderBy: { order: 'asc' },
        take: 1,
        select: { id: true, points: true, choices: { select: { id: true, isCorrect: true } } },
      },
    },
  });
  quizId = quiz.id;
  const q = quiz.questions[0]!;
  cauDau = {
    id: q.id,
    dung: q.choices.find((c) => c.isCorrect)!.id,
    sai: q.choices.find((c) => !c.isCorrect)!.id,
    points: q.points,
  };

  const exam = await fx.db.exam.create({
    data: {
      slug: `${fx.prefix}-kiem-tra-1`,
      courseId: fx.courseId,
      quizId,
      title: `${fx.prefix} Bài kiểm tra 1`,
      afterLessonOrder: 1,
      durationMinutes: 30,
      passingScore: 60,
      maxStrikes: 2,
    },
    select: { id: true },
  });
  examId = exam.id;
});

afterAll(async () => {
  await fx.db.exam.deleteMany({ where: { id: examId } });
  await fx.cleanup();
});

beforeEach(async () => {
  await fx.db.examAttempt.deleteMany({ where: { examId } });
  await fx.db.lessonProgress.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.notification.deleteMany({ where: { type: 'EXAM_LOCKED' } });
});

/** Finish lesson 1 for A1, which is what opens the exam. */
async function xongBai1(): Promise<void> {
  await fx.db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId: fx.studentA1, lessonId: fx.lessonId } },
    create: { studentId: fx.studentA1, lessonId: fx.lessonId, state: 'COMPLETED', percent: 100 },
    update: { state: 'COMPLETED', percent: 100 },
  });
}

/** Push the last strike back past the dedupe window. */
async function quaCuaSo(attemptId: string): Promise<void> {
  await fx.db.examStrike.updateMany({
    where: { attemptId },
    data: { createdAt: new Date(Date.now() - DEDUP_VI_PHAM_MS - 500) },
  });
}

describe('mở bài thi theo tiến độ', () => {
  it('chưa xong bài học phía trước thì chưa mở, và nói rõ còn thiếu bài nào', async () => {
    const ds = await danhSachKiemTra(fx.db, fx.studentA1, fx.courseId);
    const bai = ds.find((b) => b.examId === examId)!;

    expect(bai.trangThai).toBe('chua-mo');
    expect(bai.conThieu.map((b) => b.order)).toContain(1);

    await expect(batDauLamBai(fx.db, fx.studentA1, examId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('xong bài rồi thì sẵn sàng, và bắt đầu tạo lượt với hạn nộp đúng thời lượng', async () => {
    await xongBai1();

    const ds = await danhSachKiemTra(fx.db, fx.studentA1, fx.courseId);
    expect(ds.find((b) => b.examId === examId)!.trangThai).toBe('san-sang');

    const truoc = Date.now();
    const kq = await batDauLamBai(fx.db, fx.studentA1, examId);

    expect(kq.attemptNo).toBe(1);
    expect(kq.maxStrikes).toBe(2);
    // 30 minutes, give or take the round trip.
    expect(kq.deadlineAt.getTime() - truoc).toBeGreaterThanOrEqual(30 * 60_000 - 2000);
    expect(kq.deadlineAt.getTime() - truoc).toBeLessThanOrEqual(30 * 60_000 + 5000);
  });

  it('vào lại khi đang làm dở thì trả về ĐÚNG lượt đó, không tạo lượt mới', async () => {
    await xongBai1();
    const a = await batDauLamBai(fx.db, fx.studentA1, examId);
    const b = await batDauLamBai(fx.db, fx.studentA1, examId);
    expect(b.attemptId).toBe(a.attemptId);
    expect(await fx.db.examAttempt.count({ where: { examId } })).toBe(1);
  });
});

describe('câu hỏi gửi xuống trình duyệt', () => {
  it('không mang đáp án', async () => {
    const cauHoi = await cauHoiChoBaiThi(fx.db, examId);
    expect(cauHoi.length).toBeGreaterThan(0);
    const chu = JSON.stringify(cauHoi);
    expect(chu).not.toContain('isCorrect');
    expect(chu).not.toContain('acceptedAnswers');
  });
});

describe('vi phạm', () => {
  it('lần một: cảnh báo, chưa khoá', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);

    const kq = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');

    expect(kq.cheatStrikes).toBe(1);
    expect(kq.biKhoa).toBe(false);
    expect(kq.trungLap).toBe(false);
  });

  it('một lần Alt-Tab bắn ba sự kiện thì vẫn chỉ là MỘT lần', async () => {
    /*
     * The bug the dedupe window exists for. In fullscreen, one Alt-Tab fires
     * `blur`, then `visibilitychange`, then `fullscreenchange`, and a client
     * that reported all three would put a student on strike three — past the
     * lock — for pressing Alt-Tab once.
     */
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);

    const a = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'WINDOW_BLUR');
    const b = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    const c = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'FULLSCREEN_EXIT');

    expect(a.cheatStrikes).toBe(1);
    expect(b).toMatchObject({ cheatStrikes: 1, trungLap: true, biKhoa: false });
    expect(c).toMatchObject({ cheatStrikes: 1, trungLap: true, biKhoa: false });
    expect(await fx.db.examStrike.count({ where: { attemptId } })).toBe(1);
  });

  it('mười báo cáo song song chỉ tính một lần', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);

    await Promise.all(
      Array.from({ length: 10 }, () =>
        ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'WINDOW_BLUR'),
      ),
    );

    const sau = await fx.db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(sau.cheatStrikes).toBe(1);
    expect(sau.state).toBe('IN_PROGRESS');
  });

  it('lần hai (ngoài cửa sổ gộp) thì khoá ở 0 điểm, dù đã trả lời đúng', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await luuTraLoi(fx.db, fx.studentA1, attemptId, cauDau.id, cauDau.dung);

    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    await quaCuaSo(attemptId);
    const kq = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'WINDOW_BLUR');

    expect(kq).toMatchObject({ cheatStrikes: 2, biKhoa: true });

    const sau = await fx.db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(sau.state).toBe('LOCKED_CHEATING');
    // The rule the student was shown: a lock is a zero, not a mark of what
    // they had answered so far.
    expect(sau.score).toBe(0);
    expect(sau.isPassed).toBe(false);
    expect(sau.lockedAt).not.toBeNull();
    expect(sau.submittedAt).not.toBeNull();

    const log = await fx.db.examStrike.findMany({ where: { attemptId }, orderBy: { strikeNo: 'asc' } });
    expect(log.map((s) => s.kind)).toEqual(['TAB_HIDDEN', 'WINDOW_BLUR']);
  });

  it('khoá rồi thì báo cho giáo viên phụ trách, không báo cho học sinh', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    await quaCuaSo(attemptId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');

    const tb = await fx.db.notification.findMany({ where: { type: 'EXAM_LOCKED' }, select: { userId: true } });
    const ids = tb.map((t) => t.userId);
    expect(ids).toContain(fx.teacherA);
    expect(ids).not.toContain(fx.studentA1);
  });

  it('báo cáo sau khi khoá không đổi gì, và không ai báo được hộ người khác', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    await quaCuaSo(attemptId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    await quaCuaSo(attemptId);

    const sau = await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    expect(sau).toMatchObject({ cheatStrikes: 2, biKhoa: true });
    expect(await fx.db.examStrike.count({ where: { attemptId } })).toBe(2);

    // A classmate cannot add strikes to this attempt.
    await expect(
      ghiNhanViPham(fx.db, fx.studentA2, attemptId, 'TAB_HIDDEN'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('làm bài và nộp', () => {
  it('lưu câu trả lời, chấm đúng lúc nộp, và không nhận thêm sau đó', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);

    expect(await luuTraLoi(fx.db, fx.studentA1, attemptId, cauDau.id, cauDau.sai)).toEqual({ daLuu: true });
    // Changing one's mind overwrites.
    expect(await luuTraLoi(fx.db, fx.studentA1, attemptId, cauDau.id, cauDau.dung)).toEqual({ daLuu: true });
    // Garbage is not stored.
    expect(await luuTraLoi(fx.db, fx.studentA1, attemptId, cauDau.id, { x: 1 })).toEqual({ daLuu: false });

    const kq = await nopBaiThi(fx.db, fx.studentA1, attemptId);
    expect(kq.state).toBe('SUBMITTED');
    expect(kq.score).toBeGreaterThanOrEqual(cauDau.points);
    expect(kq.maxScore).toBeGreaterThan(0);

    expect(await luuTraLoi(fx.db, fx.studentA1, attemptId, cauDau.id, cauDau.sai)).toEqual({ daLuu: false });
    // Submitting twice is a no-op, not a re-mark.
    expect((await nopBaiThi(fx.db, fx.studentA1, attemptId)).score).toBe(kq.score);
  });

  it('nộp xong thì không mở lại được nếu không có giáo viên', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await nopBaiThi(fx.db, fx.studentA1, attemptId);

    await expect(batDauLamBai(fx.db, fx.studentA1, examId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('hết giờ (quá cả thời gian trễ cho phép) thì tự nộp khi được đọc tới', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await fx.db.examAttempt.update({
      where: { id: attemptId },
      data: { deadlineAt: new Date(Date.now() - TRE_NOP_MS - 1000) },
    });

    const a = await fx.db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(await hetGioNeuQuaHan(fx.db, a)).toBe(true);
    const sau = await fx.db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(sau.state).toBe('SUBMITTED');
    // A second pass finds it closed and does nothing.
    expect(await hetGioNeuQuaHan(fx.db, sau)).toBe(false);
  });
});

describe('giáo viên huỷ lượt', () => {
  it('huỷ lượt bị khoá thì em thi lại được, lượt cũ vẫn còn trong hồ sơ', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');
    await quaCuaSo(attemptId);
    await ghiNhanViPham(fx.db, fx.studentA1, attemptId, 'TAB_HIDDEN');

    const kq = await huyLuotThi(fx.db, teacherA, attemptId, 'Em bật Unikey, không phải gian lận.');
    expect(kq.examTitle).toContain('Bài kiểm tra 1');

    const ds = await danhSachKiemTra(fx.db, fx.studentA1, fx.courseId);
    expect(ds.find((b) => b.examId === examId)!.trangThai).toBe('san-sang');

    const lai = await batDauLamBai(fx.db, fx.studentA1, examId);
    expect(lai.attemptNo).toBe(2);
    expect(lai.attemptId).not.toBe(attemptId);

    const hoSo = await luotThiCuaHocSinh(fx.db, fx.studentA1);
    const cu = hoSo.find((h) => h.attemptId === attemptId)!;
    expect(cu.state).toBe('VOIDED');
    expect(cu.strikes).toHaveLength(2);
    expect(cu.nguoiHuy).toBeTruthy();
    expect(cu.voidNote).toContain('Unikey');
  });

  it('giáo viên không dạy em này thì không huỷ được', async () => {
    await xongBai1();
    const { attemptId } = await batDauLamBai(fx.db, fx.studentA1, examId);
    await expect(huyLuotThi(fx.db, teacherB, attemptId, 'thử')).rejects.toBeInstanceOf(ForbiddenError);
  });
});
