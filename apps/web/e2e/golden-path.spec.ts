/**
 * Golden path: a student logs in, opens a lesson, submits code, the judge
 * accepts it, and their progress moves.
 *
 * This is the one journey that has to work. Every phase built a piece of it —
 * auth, gating, the editor, the queue, the sandbox, the progress engine — and
 * they have only ever been tested a layer at a time. This is the first thing
 * that proves they connect.
 */
import { expect, test } from '@playwright/test';

import { choChamXong, dangNhap, db, dongDb } from './ho-tro';

const HOC_SINH = 'hs.dung';

/** Set up in `beforeAll`: an unlocked lesson with a real IO_MATCH problem. */
let lessonSlug: string;
let blockId: string;
let problemId: string;
let studentId: string;
let loiGiaiDung: string;

test.beforeAll(async () => {
  const hs = await db().user.findFirstOrThrow({
    where: { username: HOC_SINH },
    select: { id: true },
  });
  studentId = hs.id;

  /*
   * Pick a block the student can definitely reach: an early lesson in a course
   * they are enrolled in, carrying an auto-judged problem whose reference
   * solution is known to pass (verified by `npm run judge:verify`).
   */
  const khoi = await db().lessonBlock.findFirstOrThrow({
    where: {
      // The TYPE matters as much as the problem: a THEORY block can carry a
      // problemId and still render as prose with no editor and no submit
      // button, which is exactly what this query first picked up.
      type: { in: ['MINI_CHALLENGE', 'CODING'] },
      problem: { judgeMode: 'IO_MATCH', solutionCode: { not: '' }, testCases: { some: {} } },
      lesson: {
        order: { lte: 6 },
        course: { slug: 'python-co-ban' },
      },
    },
    orderBy: { lesson: { order: 'asc' } },
    select: {
      id: true,
      lesson: { select: { slug: true } },
      problem: { select: { id: true, solutionCode: true } },
    },
  });

  blockId = khoi.id;
  lessonSlug = khoi.lesson.slug;
  problemId = khoi.problem!.id;
  loiGiaiDung = khoi.problem!.solutionCode;

  // Start from a known state so "progress moved" means this run moved it.
  await db().submissionTestResult.deleteMany({
    where: { submission: { studentId, problemId } },
  });
  await db().submission.deleteMany({ where: { studentId, problemId } });
  await db().blockProgress.deleteMany({ where: { studentId, blockId } });
});

test.afterAll(async () => {
  await dongDb();
});

test('học sinh đăng nhập, mở bài, nộp code, được chấm ĐẠT và tiến độ tăng', async ({
  page,
}) => {
  // ── 1. Log in ────────────────────────────────────────────────────────────
  await dangNhap(page, HOC_SINH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // ── 2. Open the lesson ───────────────────────────────────────────────────
  await page.goto(`/bai-hoc/${lessonSlug}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // The editor must actually mount — a lesson page that renders without it
  // would leave a student with nowhere to type.
  const soanThao = page.getByTestId('soan-thao').first();
  await expect(soanThao).toBeVisible();

  // ── 3. Type a correct solution and submit ────────────────────────────────
  const vungGo = soanThao.locator('.cm-content').first();
  await vungGo.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  // `insertText` rather than `type`: CodeMirror auto-indents and auto-closes
  // brackets, so simulating keystrokes would mangle real Python.
  await page.keyboard.insertText(loiGiaiDung);

  await expect(vungGo).toContainText(loiGiaiDung.split('\n')[0]!.slice(0, 12));

  const nutNop = page.getByRole('button', { name: /^Nộp bài$/ }).first();
  await expect(nutNop).toBeEnabled();
  await nutNop.click();

  // ── 4. The student is told it was received, and not told it passed ───────
  await expect(page.getByText(/Đã nhận bài làm lần/)).toBeVisible({ timeout: 30_000 });

  // ── 5. The judge reaches ACCEPTED ────────────────────────────────────────
  const sub = await db().submission.findFirstOrThrow({
    where: { studentId, problemId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  const ketQua = await choChamXong(sub.id);
  expect(ketQua.verdict, 'lời giải mẫu phải được chấm ĐẠT').toBe('ACCEPTED');
  expect(ketQua.passedTests).toBe(ketQua.totalTests);

  // ── 6. Progress moved, via the Phase 4 engine ────────────────────────────
  const bp = await db().blockProgress.findUnique({
    where: { studentId_blockId: { studentId, blockId } },
    select: { state: true },
  });
  expect(bp?.state, 'ACCEPTED phải đánh dấu khối hoàn thành').toBe('COMPLETED');

  const lp = await db().lessonProgress.findFirst({
    where: { studentId, lesson: { blocks: { some: { id: blockId } } } },
    select: { state: true },
  });
  // Recomputed from the blocks REQUIRED for this student, never written direct.
  expect(lp).not.toBeNull();

  // ── 7. The student SEES the result without reloading ─────────────────────
  // Phase 8 added polling for exactly this: without it a child watches
  // "đang chờ" forever and reads it as the system losing their work.
  await expect(page.getByText(/Đúng rồi/)).toBeVisible({ timeout: 45_000 });
});
