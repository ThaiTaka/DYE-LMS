/**
 * Effort-based completion, and the .hex hand-in.
 *
 *   1. Handing in — code, blocks, or a .hex — completes the block at once.
 *      The judge's later verdict changes the score, never the completion.
 *   2. `kiemTraIntelHex` accepts what MakeCode exports and refuses what a
 *      renamed photo, a truncated download, or a corrupted copy looks like.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GIOI_HAN_HEX_BYTE, kiemTraIntelHex, nopBai, nopBaiMicrobitHex } from './code';
import { ForbiddenError } from './errors';
import { createFixture, type Fixture } from './testing/fixtures';

let fx: Fixture;
let khoiCode: string;
let khoiMb: string;
let problemMb: string;

beforeAll(async () => {
  fx = await createFixture();
  const code = await fx.db.lessonBlock.findFirstOrThrow({
    where: { lessonId: fx.lessonId, problemId: fx.problemId },
    select: { id: true },
  });
  khoiCode = code.id;

  // A MAKECODE problem on a block of the fixture lesson, so the student is
  // enrolled for it and `moKhoiCode` lets them through.
  const pb = await fx.db.problem.create({
    data: {
      slug: `${fx.prefix}-mb-hex`,
      title: `${fx.prefix} Đèn nháy`,
      statement: 'Nhấp nháy LED.',
      solutionCode: '<xml/>',
      judgeMode: 'MAKECODE',
      runtimeImage: 'PY_TEST',
      networkPolicy: 'NONE',
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
  await fx.db.blockProgress.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.lessonProgress.deleteMany({ where: { studentId: fx.studentA1 } });
  await fx.db.submission.deleteMany({ where: { studentId: fx.studentA1, attemptNo: { gt: 0 } } });
});

describe('nỗ lực được tính', () => {
  it('nộp code là khối HOÀN THÀNH ngay, khi bài còn PENDING', async () => {
    const nop = await nopBai(fx.db, fx.studentA1, khoiCode, 'print("em da lam")');

    const sub = await fx.db.submission.findUniqueOrThrow({ where: { id: nop.submissionId } });
    expect(sub.verdict).toBe('PENDING'); // the judge has not run

    const bp = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiCode } },
    });
    expect(bp?.state).toBe('COMPLETED');
  });

  it('nộp lại không xoá mốc hoàn thành lần đầu', async () => {
    await nopBai(fx.db, fx.studentA1, khoiCode, 'print(1)');
    const dau = await fx.db.blockProgress.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiCode } },
    });
    await nopBai(fx.db, fx.studentA1, khoiCode, 'print(2)');
    const sau = await fx.db.blockProgress.findUniqueOrThrow({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiCode } },
    });
    expect(sau.completedAt?.getTime()).toBe(dau.completedAt?.getTime());
  });
});

/** Two real records from a MakeCode export, plus the EOF record. */
const HEX_HOP_LE = [
  ':020000040000FA',
  ':1000000000400020218A01005D8A01005F8A010012',
  ':00000001FF',
].join('\n');

describe('kiểm tra tệp .hex', () => {
  it('nhận tệp Intel HEX hợp lệ, kể cả xuống dòng kiểu Windows', () => {
    expect(kiemTraIntelHex(HEX_HOP_LE)).toEqual({ ok: true });
    expect(kiemTraIntelHex(HEX_HOP_LE.replace(/\n/g, '\r\n'))).toEqual({ ok: true });
    expect(kiemTraIntelHex(HEX_HOP_LE + '\n\n')).toEqual({ ok: true });
  });

  it('từ chối tệp rỗng', () => {
    expect(kiemTraIntelHex('')).toEqual({ ok: false, loi: 'rong' });
    expect(kiemTraIntelHex('\n \n')).toEqual({ ok: false, loi: 'rong' });
  });

  it('từ chối tệp không phải Intel HEX (ảnh đổi tên, văn bản)', () => {
    expect(kiemTraIntelHex('PNG\r\n\n')).toEqual({ ok: false, loi: 'khong-phai-intel-hex' });
    expect(kiemTraIntelHex('print("hello")')).toEqual({ ok: false, loi: 'khong-phai-intel-hex' });
  });

  it('từ chối dòng hỏng (lẻ ký tự, không phải hex, quá ngắn)', () => {
    expect(kiemTraIntelHex(':0000000\n:00000001FF')).toEqual({ ok: false, loi: 'dong-hong' });
    expect(kiemTraIntelHex(':00000001FZ')).toEqual({ ok: false, loi: 'dong-hong' });
    expect(kiemTraIntelHex(':00\n:00000001FF')).toEqual({ ok: false, loi: 'dong-hong' });
  });

  it('từ chối sai checksum — một byte hỏng khi tải về', () => {
    // Flip one data byte and leave the checksum alone.
    const hong = HEX_HOP_LE.replace(':1000000000400020', ':1000000000400021');
    expect(kiemTraIntelHex(hong)).toEqual({ ok: false, loi: 'sai-checksum' });
  });

  it('từ chối tệp thiếu bản ghi kết thúc — tải dở', () => {
    const cut = HEX_HOP_LE.split('\n').slice(0, -1).join('\n');
    expect(kiemTraIntelHex(cut)).toEqual({ ok: false, loi: 'thieu-ket-thuc' });
  });

  it('từ chối tệp quá lớn trước khi đọc nội dung', () => {
    expect(kiemTraIntelHex(HEX_HOP_LE, GIOI_HAN_HEX_BYTE + 1)).toEqual({ ok: false, loi: 'qua-lon' });
  });
});

describe('nộp tệp .hex', () => {
  it('là một bài nộp thật: cùng dãy số lần, chờ giáo viên, và hoàn thành khối', async () => {
    const kq = await nopBaiMicrobitHex(fx.db, fx.studentA1, khoiMb, {
      hexKey: 'ab/' + 'a'.repeat(64),
      tenTep: 'microbit-den-nhap-nhay.hex',
      kichThuoc: 1_234_567,
    });
    expect(kq.verdict).toBe('PENDING');

    const sub = await fx.db.submission.findUniqueOrThrow({ where: { id: kq.submissionId } });
    expect(sub.hexKey).toBe('ab/' + 'a'.repeat(64));
    expect(sub.blocksXml).toBeNull();
    expect(sub.code).toContain('microbit-den-nhap-nhay.hex');

    const bp = await fx.db.blockProgress.findUnique({
      where: { studentId_blockId: { studentId: fx.studentA1, blockId: khoiMb } },
    });
    expect(bp?.state).toBe('COMPLETED');
  });

  it('khối không có bài tập thì không nộp được', async () => {
    const lyThuyet = await fx.db.lessonBlock.findFirstOrThrow({
      where: { lessonId: fx.lessonId, problemId: null },
      select: { id: true },
    });
    await expect(
      nopBaiMicrobitHex(fx.db, fx.studentA1, lyThuyet.id, { hexKey: 'ab/' + 'b'.repeat(64), tenTep: 'x.hex', kichThuoc: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
