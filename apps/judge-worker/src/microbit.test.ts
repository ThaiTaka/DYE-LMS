/**
 * The judge worker must never break on a Micro:bit submission.
 *
 * This is the mandated safety check. A hardware task reaching the Python judge
 * has two ways to go wrong, and both are worse than doing nothing:
 *
 *   • crash the worker, stalling every Python submission behind it in the queue;
 *   • mark it WRONG_ANSWER for producing no stdout, failing a student whose
 *     blocks were perfect.
 *
 * Neither is acceptable, so both are asserted here against real Postgres.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { chamBai } from './judge';

const db = new PrismaClient({ log: ['error'] });
const prefix = `p11-${randomBytes(4).toString('hex')}`;

const userIds: string[] = [];
const problemIds: string[] = [];

let studentId: string;
let makecodeProblemId: string;
let pythonProblemId: string;

const BLOCKS_XML =
  '<xml xmlns="https://developers.google.com/blockly/xml">' +
  '<block type="device_forever"><statement name="HANDLER">' +
  '<block type="basic_show_icon"><field name="i">IconNames.Happy</field></block>' +
  '</statement></block></xml>';

beforeAll(async () => {
  const hs = await db.user.create({
    data: { username: `${prefix}-hs`, displayName: 'HS', role: 'STUDENT', passwordHash: 'x' },
    select: { id: true },
  });
  studentId = hs.id;
  userIds.push(hs.id);

  const mb = await db.problem.create({
    data: {
      slug: `${prefix}-mb`,
      title: 'Mặt cười mặt khóc',
      statement: 'Hiện mặt cười rồi mặt khóc.',
      judgeMode: 'MAKECODE',
      solutionCode: 'basic.forever(function () { })',
      totalPoints: 100,
    },
    select: { id: true },
  });
  makecodeProblemId = mb.id;
  problemIds.push(mb.id);

  // A normal Python problem, to prove the worker still judges those afterwards.
  const py = await db.problem.create({
    data: {
      slug: `${prefix}-py`,
      title: 'Tổng',
      statement: 'In tổng.',
      judgeMode: 'IO_MATCH',
      solutionCode: 'print(3)',
      totalPoints: 100,
      testCases: {
        create: [{ order: 1, input: '', expectedOutput: '3', isSample: true, points: 100 }],
      },
    },
    select: { id: true },
  });
  pythonProblemId = py.id;
  problemIds.push(py.id);
}, 60_000);

afterAll(async () => {
  await db.submissionTestResult.deleteMany({
    where: { submission: { studentId: { in: userIds } } },
  });
  await db.submission.deleteMany({ where: { studentId: { in: userIds } } });
  await db.blockProgress.deleteMany({ where: { studentId: { in: userIds } } });
  await db.testCase.deleteMany({ where: { problemId: { in: problemIds } } });
  await db.problem.deleteMany({ where: { id: { in: problemIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

async function nop(problemId: string, code: string, blocksXml?: string): Promise<string> {
  const s = await db.submission.create({
    data: {
      studentId,
      problemId,
      code,
      verdict: 'PENDING',
      queuedAt: new Date(),
      ...(blocksXml ? { blocksXml } : {}),
    },
    select: { id: true },
  });
  return s.id;
}

// ═══════════════════════════════════════════════════════════════════════════

describe('Worker bỏ qua bài MAKECODE một cách an toàn', () => {
  it('không ném lỗi khi gặp bài Micro:bit', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    // The crash case: an exception here would stall every Python submission
    // queued behind this one.
    await expect(chamBai(db, id)).resolves.toBeDefined();
  }, 60_000);

  it('cho SKIPPED, KHÔNG phải WRONG_ANSWER', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    const kq = await chamBai(db, id);

    expect(kq.verdict).toBe('SKIPPED');
    // Marking it wrong would fail a student whose blocks were perfect, for the
    // sole reason that an LED matrix produces no stdout.
    expect(kq.verdict).not.toBe('WRONG_ANSWER');
    expect(kq.verdict).not.toBe('INTERNAL_ERROR');
  }, 60_000);

  it('nêu rõ lý do bỏ qua trong nhật ký nội bộ', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    await chamBai(db, id);

    const row = await db.submission.findUniqueOrThrow({
      where: { id },
      select: { runnerError: true, verdict: true },
    });
    expect(row.runnerError).toMatch(/MAKECODE/i);
  }, 60_000);

  it('KHÔNG khởi động container nào cho bài Micro:bit', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    const batDau = Date.now();
    await chamBai(db, id);

    // A container start is hundreds of milliseconds at minimum. Returning this
    // fast proves the skip happens before Docker is ever involved — which also
    // means it works on a machine with no Docker at all.
    expect(Date.now() - batDau).toBeLessThan(400);
  }, 60_000);

  it('KHÔNG đánh dấu hoàn thành — bài chưa có ai chấm', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    await chamBai(db, id);

    const bp = await db.blockProgress.count({ where: { studentId } });
    // SKIPPED is not a pass. Progress waits for a teacher.
    expect(bp).toBe(0);
  }, 60_000);

  it('giữ nguyên blocksXml đã nộp', async () => {
    const id = await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML);
    await chamBai(db, id);

    const row = await db.submission.findUniqueOrThrow({
      where: { id },
      select: { blocksXml: true },
    });
    expect(row.blocksXml).toBe(BLOCKS_XML);
  }, 60_000);

  it('vẫn chấm bình thường bài Python ngay sau đó', async () => {
    await chamBai(db, await nop(makecodeProblemId, BLOCKS_XML, BLOCKS_XML));

    const id = await nop(pythonProblemId, 'print(3)\n');
    const kq = await chamBai(db, id);

    // The worker is not left in a bad state by a hardware submission.
    expect(kq.verdict).toBe('ACCEPTED');
  }, 90_000);
});
