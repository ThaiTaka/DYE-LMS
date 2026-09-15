/**
 * The one-attempt policy: quiz answers, the .hex self-delete, the teacher reset.
 *
 * What is protected:
 *   1. A second answer to the same question is refused, and the first survives
 *      a reload — it is on the server, not in React.
 *   2. The correct answer is revealed ONLY for a closed question.
 *   3. A student can delete their own .hex and nobody else's; a shared blob
 *      is not deleted while another submission still points at it.
 *   4. A teacher's reset removes exactly that student's history for exactly
 *      that block, keeps the draft, logs what it removed, and is scoped by
 *      the teaching relationship.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { nopBai, nopBaiMicrobitHex } from './code';
import { ForbiddenError } from './errors';
import { moLaiKhoi, soLanDaNop, xoaBaiNopHex } from './luot-nop';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';
import { traLoiCauHoi, traLoiCuaHocSinh } from './tra-loi';

import type { KhoLuuTru } from './projects';
import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let khoiCode: string;
let khoiQuiz: string;
let cauMcq: { id: string; dung: string; sai: string; dapAnDung: string };
let khoiMb: string;
let problemMb: string;

/** An in-memory store that records deletes, so blob handling is observable. */
function khoGia(): KhoLuuTru & { daXoa: string[] } {
  const daXoa: string[] = [];
  return {
    daXoa,
    ghi: async () => undefined,
    doc: async () => null,
    xoa: async (key) => {
      daXoa.push(key);
    },
  };
}

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);

  const code = await fx.db.lessonBlock.findFirstOrThrow({
    where: { lessonId: fx.lessonId, problemId: fx.problemId },
    select: { id: true },
  });
  khoiCode = code.id;

  // A quiz block in the fixture lesson with a multiple-choice question.
  const quiz = await fx.db.lessonBlock.findFirstOrThrow({
    where: { lessonId: fx.lessonId, quiz: { questions: { some: { type: 'MULTIPLE_CHOICE' } } } },
    select: {
      id: true,
      quiz: {
        select: {
          questions: {
            where: { type: 'MULTIPLE_CHOICE' },
            take: 1,
            select: { id: true, choices: { select: { id: true, text: true, isCorrect: true } } },
          },
        },
      },
    },
  });
  khoiQuiz = quiz.id;
  const q = quiz.quiz!.questions[0]!;
  cauMcq = {
    id: q.id,
    dung: q.choices.find((c) => c.isCorrect)!.id,
    sai: q.choices.find((c) => !c.isCorrect)!.id,
    dapAnDung: q.choices.find((c) => c.isCorrect)!.text,
  };

  const pb = await fx.db.problem.create({
    data: {
      slug: `${fx.prefix}-mb-luot`,
      title: `${fx.prefix} Đèn`,
      statement: 'x',
      solutionCode: '<xml/>',
      judgeMode: 'MAKECODE',
      totalPoints: 100,
    },
    select: { id: true },
  });
  problemMb = pb.id;
  const cuoi = await fx.db.lessonBlock.aggregate({ where: { lessonId: fx.lessonId }, _max: { order: true } });
  const mb = await fx.db.lessonBlock.create({
    data: {
      lessonId: fx.lessonId,
      order: (cuoi._max.order ?? 0) + 1,
      type: 'MICROBIT_WORKSPACE',
      tier: 'CO_BAN',
      title: `${fx.prefix} Micro:bit`,
      content: { kind: 'microbit', markdown: 'x', goal: 'y', khoiLenh: [], blocksXml: '' },
      problemId: pb.id,
    },
    select: { id: true },
  });
  khoiMb = mb.id;
});

afterAll(async () => {
  await fx.db.submission.deleteMany({ where: { problemId: problemMb } });
  await fx.db.blockProgress.deleteMany({ where: { blockId: khoiMb } });
  await fx.db.lessonBlock.delete({ where: { id: khoiMb } });
  await fx.db.problem.delete({ where: { id: problemMb } });
  await fx.cleanup();
});

beforeEach(async () => {
  for (const sid of [fx.studentA1, fx.studentA2]) {
    await fx.db.answer.deleteMany({ where: { attempt: { studentId: sid } } });
    await fx.db.quizAttempt.deleteMany({ where: { studentId: sid } });
    await fx.db.submission.deleteMany({ where: { studentId: sid } });
    await fx.db.blockProgress.deleteMany({ where: { studentId: sid } });
  }
});

describe('trắc nghiệm: một câu, một lần', () => {
  it('trả lời sai thì bị chấm sai, lộ đáp án đúng, và KHÔNG trả lời lại được', async () => {
    const lan1 = await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.sai);
    expect(lan1).toMatchObject({ trangThai: 'da-cham', dung: false, dapAnDung: cauMcq.dapAnDung });

    const lan2 = await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.dung);
    expect(lan2).toEqual({ trangThai: 'da-tra-loi-roi' });

    // The record is the FIRST answer, not the retry.
    const luu = await traLoiCuaHocSinh(fx.db, fx.studentA1, [cauMcq.id]);
    expect(luu.get(cauMcq.id)).toMatchObject({ dung: false, chon: cauMcq.sai });
  });

  it('trả lời đúng thì không lộ đáp án (không cần) và vẫn khoá', async () => {
    const kq = await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.dung);
    expect(kq).toMatchObject({ trangThai: 'da-cham', dung: true, dapAnDung: null });
    expect(await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.sai)).toEqual({
      trangThai: 'da-tra-loi-roi',
    });
  });

  it('câu chưa trả lời thì không có gì trên hồ sơ — đáp án không rò rỉ trước', async () => {
    const luu = await traLoiCuaHocSinh(fx.db, fx.studentA1, [cauMcq.id]);
    expect(luu.size).toBe(0);
  });

  it('khoá là của từng học sinh: bạn cùng lớp vẫn trả lời được', async () => {
    await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.sai);
    const kq = await traLoiCauHoi(fx.db, fx.studentA2, cauMcq.id, cauMcq.dung);
    expect(kq).toMatchObject({ trangThai: 'da-cham', dung: true });
  });
});

describe('xoá tệp .hex đã nộp', () => {
  const HEX = 'ab/' + 'c'.repeat(64);

  it('học sinh xoá được bài .hex của mình, rồi nộp lại được', async () => {
    const kho = khoGia();
    const nop = await nopBaiMicrobitHex(fx.db, fx.studentA1, khoiMb, { hexKey: HEX, tenTep: 'a.hex', kichThuoc: 10 });
    await expect(
      nopBaiMicrobitHex(fx.db, fx.studentA1, khoiMb, { hexKey: HEX, tenTep: 'b.hex', kichThuoc: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const kq = await xoaBaiNopHex(fx.db, fx.studentA1, nop.submissionId, kho);
    expect(kq.daXoa).toBe(true);
    expect(kq.tenTep).toBe('a.hex');
    expect(kho.daXoa).toEqual([HEX]);

    const lai = await nopBaiMicrobitHex(fx.db, fx.studentA1, khoiMb, { hexKey: HEX, tenTep: 'b.hex', kichThuoc: 10 });
    expect(lai.attemptNo).toBe(1);
  });

  it('blob dùng chung KHÔNG bị xoá khi bài của bạn khác còn trỏ tới', async () => {
    const kho = khoGia();
    const cuaA1 = await nopBaiMicrobitHex(fx.db, fx.studentA1, khoiMb, { hexKey: HEX, tenTep: 'a.hex', kichThuoc: 10 });
    await nopBaiMicrobitHex(fx.db, fx.studentA2, khoiMb, { hexKey: HEX, tenTep: 'a.hex', kichThuoc: 10 });

    await xoaBaiNopHex(fx.db, fx.studentA1, cuaA1.submissionId, kho);
    expect(kho.daXoa).toEqual([]);
    expect(await fx.db.submission.count({ where: { hexKey: HEX } })).toBe(1);
  });

  it('không xoá được bài của bạn khác, bài không phải .hex, hay bài giáo viên đã chấm', async () => {
    const kho = khoGia();
    const cuaA2 = await nopBaiMicrobitHex(fx.db, fx.studentA2, khoiMb, { hexKey: HEX, tenTep: 'a.hex', kichThuoc: 10 });
    await expect(xoaBaiNopHex(fx.db, fx.studentA1, cuaA2.submissionId, kho)).rejects.toBeInstanceOf(ForbiddenError);

    const code = await nopBai(fx.db, fx.studentA1, khoiCode, 'print(1)');
    await expect(xoaBaiNopHex(fx.db, fx.studentA1, code.submissionId, kho)).rejects.toBeInstanceOf(ForbiddenError);

    await fx.db.submission.update({ where: { id: cuaA2.submissionId }, data: { runnerError: 'cham tay boi co.lan' } });
    await expect(xoaBaiNopHex(fx.db, fx.studentA2, cuaA2.submissionId, kho)).rejects.toBeInstanceOf(ForbiddenError);
    expect(kho.daXoa).toEqual([]);
  });
});

describe('giáo viên mở lại khối', () => {
  it('xoá đúng lịch sử của em đó ở khối đó, giữ bản nháp, ghi nhật ký', async () => {
    const kho = khoGia();
    await nopBai(fx.db, fx.studentA1, khoiCode, 'print("nhap cua em")');
    await nopBai(fx.db, fx.studentA2, khoiCode, 'print("cua ban khac")');
    expect((await soLanDaNop(fx.db, fx.studentA1, [fx.problemId])).get(fx.problemId)).toBe(1);

    const kq = await moLaiKhoi(fx.db, teacherA, fx.studentA1, khoiCode, 'Em làm nhầm bài.', kho);
    expect(kq).toMatchObject({ soBaiNopXoa: 1, soCauTraLoiXoa: 0 });

    // Their history is gone; the classmate's is untouched.
    expect((await soLanDaNop(fx.db, fx.studentA1, [fx.problemId])).get(fx.problemId)).toBeUndefined();
    expect(await fx.db.submission.count({ where: { studentId: fx.studentA2, problemId: fx.problemId } })).toBe(1);

    // The draft — the student's own text — survives.
    const nhap = await fx.db.codeDraft.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiCode } },
    });
    expect(nhap?.code).toContain('nhap cua em');

    // Completion is withdrawn until they hand in again.
    const bp = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiCode } },
    });
    expect(bp).toBeNull();

    const log = await fx.db.auditLog.findFirst({
      where: { action: 'block.reset', entityId: khoiCode, actorId: fx.teacherA },
      orderBy: { createdAt: 'desc' },
    });
    expect(log?.meta).toMatchObject({ studentId: fx.studentA1, ghiChu: 'Em làm nhầm bài.' });
  });

  it('mở lại khối trắc nghiệm thì câu đã trả lời mở ra lại', async () => {
    const kho = khoGia();
    await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.sai);
    const kq = await moLaiKhoi(fx.db, teacherA, fx.studentA1, khoiQuiz, 'Cho em thử lại.', kho);
    expect(kq.soCauTraLoiXoa).toBeGreaterThanOrEqual(1);
    expect(await traLoiCauHoi(fx.db, fx.studentA1, cauMcq.id, cauMcq.dung)).toMatchObject({
      trangThai: 'da-cham',
      dung: true,
    });
  });

  it('giáo viên không dạy em này thì không mở được', async () => {
    await nopBai(fx.db, fx.studentA1, khoiCode, 'print(1)');
    await expect(
      moLaiKhoi(fx.db, teacherB, fx.studentA1, khoiCode, 'thử', khoGia()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
