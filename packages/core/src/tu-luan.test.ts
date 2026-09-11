/**
 * Free-text answers: the lock, the queue, the grade and the reopen.
 *
 * The lock is the point of this suite. Before it, `kiemTraCauTraLoi` answered a
 * SHORT_ANSWER question with `dung: true` and stored nothing — a child could
 * type one character and be told they were right. So the assertions that matter
 * are the negative ones: a second submission is REFUSED, and it is refused by
 * the database rather than by a disabled button that a stale tab would not have.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';
import {
  chamTuLuan,
  moLaiTuLuan,
  nopTuLuan,
  soTuLuanChoCham,
  trangThaiTuLuan,
  tuLuanChoCham,
  tuLuanDaCham,
} from './tu-luan';

import type { Actor } from './session';

let fx: Fixture;
let admin: Actor;
let teacherA: Actor;
let teacherB: Actor;
let hsA1: Actor;

/** Ids created per test, cleaned up afterwards. */
let quizId = '';
let questionId = '';
let blockId = '';

beforeAll(async () => {
  fx = await createFixture();
  admin = await actorFor(fx.db, fx.admin);
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  hsA1 = await actorFor(fx.db, fx.studentA1);
});

/**
 * A quiz with one essay question, attached to a block in the fixture's lesson.
 *
 * The block matters: `nopTuLuan` resolves lesson access before storing, so a
 * question floating free of any lesson would take a different path than the one
 * students actually use.
 */
beforeAll(async () => {
  const quiz = await fx.db.quiz.create({
    data: {
      slug: `${fx.prefix}-quiz-tu-luan`,
      title: 'Tự luận thử',
      questions: {
        create: {
          order: 0,
          type: 'SHORT_ANSWER',
          prompt: 'Em hãy giải thích vì sao vòng lặp cần điều kiện dừng.',
          points: 20,
        },
      },
    },
    select: { id: true, questions: { select: { id: true } } },
  });
  quizId = quiz.id;
  questionId = quiz.questions[0]!.id;

  const block = await fx.db.lessonBlock.create({
    data: {
      lessonId: fx.lessonId,
      order: 900,
      type: 'QUIZ',
      title: 'Tự luận thử',
      content: {},
      quizId,
    },
    select: { id: true },
  });
  blockId = block.id;
});

afterEach(async () => {
  await fx.db.auditLog.deleteMany({ where: { entityType: 'Answer' } });
  await fx.db.answer.deleteMany({ where: { questionId } });
  await fx.db.quizAttempt.deleteMany({ where: { quizId } });
});

afterAll(async () => {
  await fx.db.lessonBlock.deleteMany({ where: { id: blockId } });
  await fx.db.quiz.deleteMany({ where: { id: quizId } });
  await fx.cleanup();
});

describe('Nộp bài tự luận', () => {
  it('lưu lại bài và để nguyên trạng thái chờ chấm', async () => {
    const kq = await nopTuLuan(fx.db, hsA1, questionId, 'Vì không có điều kiện dừng thì lặp mãi.');
    expect(kq.trangThai).toBe('da-nhan');

    const tt = await trangThaiTuLuan(fx.db, fx.studentA1, questionId);
    expect(tt.trangThai).toBe('cho-cham');

    // Not right, not wrong, not scored — a person has not looked yet.
    const answer = await fx.db.answer.findFirstOrThrow({ where: { questionId } });
    expect(answer.gradedAt).toBeNull();
    expect(answer.isCorrect).toBe(false);
    expect(answer.pointsAwarded).toBe(0);
  });

  it('bài rỗng hoặc chỉ có khoảng trắng thì không lưu gì', async () => {
    expect((await nopTuLuan(fx.db, hsA1, questionId, '   \n  ')).trangThai).toBe('rong');
    expect(await fx.db.answer.count({ where: { questionId } })).toBe(0);
  });

  it('KHOÁ LẠI: nộp lần thứ hai bị từ chối, bài cũ giữ nguyên', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai lan mot');
    const lan2 = await nopTuLuan(fx.db, hsA1, questionId, 'Bai lan hai');

    expect(lan2.trangThai).toBe('da-nop-roi');
    // The refusal is the database's, not a disabled button's: still one row,
    // still the original text.
    const ds = await fx.db.answer.findMany({ where: { questionId } });
    expect(ds).toHaveLength(1);
    expect(ds[0]?.response).toBe('Bai lan mot');
  });

  it('đã chấm rồi vẫn không nộp đè được', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai goc');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });
    await chamTuLuan(fx.db, teacherA, a.id, true);

    expect((await nopTuLuan(fx.db, hsA1, questionId, 'Bai moi')).trangThai).toBe('da-nop-roi');
  });

  it('câu trắc nghiệm không đi qua đường tự luận', async () => {
    const tn = await fx.db.question.create({
      data: { quizId, order: 901, type: 'MULTIPLE_CHOICE', prompt: 'x?', points: 10 },
      select: { id: true },
    });
    await expect(nopTuLuan(fx.db, hsA1, tn.id, 'abc')).rejects.toBeInstanceOf(ForbiddenError);
    await fx.db.question.delete({ where: { id: tn.id } });
  });
});

describe('Hàng chờ chấm', () => {
  it('chỉ hiện bài của học sinh mình dạy', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai cua A1');

    const cuaA = await tuLuanChoCham(fx.db, [fx.studentA1, fx.studentA2]);
    expect(cuaA.map((t) => t.studentId)).toContain(fx.studentA1);

    // A teacher with no relationship to this child sees an empty queue.
    const cuaB = await tuLuanChoCham(fx.db, [fx.studentB1]);
    expect(cuaB).toHaveLength(0);
  });

  it('bài đã chấm rời khỏi hàng chờ', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai cho cham');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    expect(await tuLuanChoCham(fx.db, [fx.studentA1])).toHaveLength(1);
    await chamTuLuan(fx.db, teacherA, a.id, true);
    expect(await tuLuanChoCham(fx.db, [fx.studentA1])).toHaveLength(0);
  });

  it('huy hiệu đếm đúng số bài đang chờ, và về 0 khi chấm xong', async () => {
    expect(await soTuLuanChoCham(fx.db, [fx.studentA1])).toBe(0);
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai cho dem');
    expect(await soTuLuanChoCham(fx.db, [fx.studentA1])).toBe(1);

    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });
    await chamTuLuan(fx.db, teacherA, a.id, true);
    expect(await soTuLuanChoCham(fx.db, [fx.studentA1])).toBe(0);
    // An empty scope is 0, never an unscoped count.
    expect(await soTuLuanChoCham(fx.db, [])).toBe(0);
  });
});

describe('Bài đã chấm', () => {
  it('chấm xong thì sang danh sách đã chấm, mang đúng điểm và người thấy được', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai da cham');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    expect(await tuLuanDaCham(fx.db, [fx.studentA1])).toHaveLength(0);
    await chamTuLuan(fx.db, teacherA, a.id, true);

    const daCham = await tuLuanDaCham(fx.db, [fx.studentA1]);
    expect(daCham).toHaveLength(1);
    expect(daCham[0]?.answerId).toBe(a.id);
    expect(daCham[0]?.dat).toBe(true);
    expect(daCham[0]?.diem).toBe(daCham[0]?.diemToiDa);
    expect(daCham[0]?.khoaViPham).toBe(false);
    expect(daCham[0]?.chamLuc.getTime()).toBeGreaterThan(0);

    /*
     * The record is scoped exactly like the queue. A results list is the
     * easiest place in an LMS to leak, because a missing WHERE reads as a
     * working page rather than an error — so the other teacher gets nothing.
     */
    expect(await tuLuanDaCham(fx.db, [fx.studentB1])).toHaveLength(0);
    expect(await tuLuanDaCham(fx.db, [])).toHaveLength(0);
  });

  it('mở lại thì rời khỏi cả danh sách đã chấm', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai se mo lai');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });
    await chamTuLuan(fx.db, teacherA, a.id, false);
    expect(await tuLuanDaCham(fx.db, [fx.studentA1])).toHaveLength(1);

    await moLaiTuLuan(fx.db, teacherA, a.id);
    expect(await tuLuanDaCham(fx.db, [fx.studentA1])).toHaveLength(0);
  });
});

describe('Chấm bài tự luận', () => {
  it('đạt thì cho đủ điểm và đóng dấu thời gian chấm', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai tot');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await chamTuLuan(fx.db, teacherA, a.id, true);

    const sau = await fx.db.answer.findFirstOrThrow({ where: { id: a.id } });
    expect(sau.isCorrect).toBe(true);
    expect(sau.pointsAwarded).toBe(20);
    // Setting gradedAt is what takes it out of the queue; a verdict without it
    // would leave the answer looking unreviewed forever.
    expect(sau.gradedAt).not.toBeNull();
  });

  it('chưa đạt thì 0 điểm nhưng vẫn tính là đã chấm', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai so sai');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await chamTuLuan(fx.db, teacherA, a.id, false);

    const sau = await fx.db.answer.findFirstOrThrow({ where: { id: a.id } });
    expect(sau.isCorrect).toBe(false);
    expect(sau.pointsAwarded).toBe(0);
    expect(sau.gradedAt).not.toBeNull();
  });

  it('chấm xong KHÔNG tự mở lại — đó là quyết định riêng', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai chua dat');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await chamTuLuan(fx.db, teacherA, a.id, false);

    // Marking work down and handing it back are different decisions.
    expect(await fx.db.answer.count({ where: { id: a.id } })).toBe(1);
    expect((await trangThaiTuLuan(fx.db, fx.studentA1, questionId)).trangThai).toBe('da-cham');
  });

  it('giáo viên không dạy em này thì không chấm được', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai cua A1');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await expect(chamTuLuan(fx.db, teacherB, a.id, true)).rejects.toBeInstanceOf(ForbiddenError);

    const sau = await fx.db.answer.findFirstOrThrow({ where: { id: a.id } });
    expect(sau.gradedAt).toBeNull();
  });

  it('ghi nhật ký kiểm toán kèm người chấm', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai co audit');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await chamTuLuan(fx.db, admin, a.id, true);

    const log = await fx.db.auditLog.findFirst({
      where: { entityType: 'Answer', entityId: a.id, action: 'essay.graded' },
    });
    expect(log?.actorId).toBe(fx.admin);
  });
});

describe('Mở lại cho em làm lại', () => {
  it('xoá bài cũ để em nộp lại được', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai lan mot');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await moLaiTuLuan(fx.db, teacherA, a.id);

    expect((await trangThaiTuLuan(fx.db, fx.studentA1, questionId)).trangThai).toBe('chua-nop');

    // The lock is genuinely lifted, not merely hidden.
    const lai = await nopTuLuan(fx.db, hsA1, questionId, 'Bai lan hai');
    expect(lai.trangThai).toBe('da-nhan');
    const ds = await fx.db.answer.findMany({ where: { questionId } });
    expect(ds).toHaveLength(1);
    expect(ds[0]?.response).toBe('Bai lan hai');
  });

  it('mở lại được cả bài đã chấm', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai da cham');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });
    await chamTuLuan(fx.db, teacherA, a.id, false);

    await moLaiTuLuan(fx.db, teacherA, a.id);
    expect((await trangThaiTuLuan(fx.db, fx.studentA1, questionId)).trangThai).toBe('chua-nop');
  });

  it('giáo viên lớp khác không mở lại được', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai cua A1');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await expect(moLaiTuLuan(fx.db, teacherB, a.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await fx.db.answer.count({ where: { id: a.id } })).toBe(1);
  });

  it('nhật ký được ghi TRƯỚC khi xoá, nên vẫn còn sau đó', async () => {
    await nopTuLuan(fx.db, hsA1, questionId, 'Bai se bi xoa');
    const a = await fx.db.answer.findFirstOrThrow({ where: { questionId } });

    await moLaiTuLuan(fx.db, teacherA, a.id);

    const log = await fx.db.auditLog.findFirst({
      where: { entityType: 'Answer', entityId: a.id, action: 'essay.reopened' },
    });
    expect(log).not.toBeNull();
    expect(await fx.db.answer.count({ where: { id: a.id } })).toBe(0);
  });
});
