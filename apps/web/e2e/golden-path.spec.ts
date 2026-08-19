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
  /*
   * `npm run db:seed` no longer creates this student — it makes the curriculum and
   * one admin, nothing else. Say so, because "No User found" reads like a broken
   * query rather than a missing fixture.
   */
  const hs = await db().user.findFirst({
    where: { username: HOC_SINH },
    select: { id: true },
  });
  if (!hs) {
    throw new Error(
      `Không có tài khoản demo "${HOC_SINH}". Chạy \`npm run db:demo\` rồi thử lại.`,
    );
  }
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

  /*
   * Scope everything to the exercise block, never `.first()`.
   *
   * Buổi 6 renders an INTERACTIVE_EXAMPLE and a PLAYGROUND editor BEFORE the
   * graded MINI_CHALLENGE, and all three are `soan-thao`. Taking the first one
   * meant typing into the example — whose sample code happens to be the
   * solution, so even a full-text assertion passed — and then clicking the
   * exercise's own submit button, which handed in its untouched starter code.
   * The run failed at the verdict and read like a broken judge.
   */
  const khuLamBai = page.locator(`[data-block-id="${blockId}"]`);
  await expect(khuLamBai).toBeVisible();

  // The editor must actually mount — a lesson page that renders without it
  // would leave a student with nowhere to type.
  const soanThao = khuLamBai.getByTestId('soan-thao');
  await expect(soanThao).toBeVisible();

  // ── 3. Type a correct solution and submit ────────────────────────────────
  const vungGo = soanThao.locator('.cm-content').first();

  /*
   * Retry the whole type-and-check, and assert the FULL text.
   *
   * Two things went wrong here before, and they hid each other:
   *
   *   1. The editor fills itself asynchronously — a saved draft if there is
   *      one, otherwise the problem's starter code. Clearing and typing before
   *      that lands means the app overwrites the solution a moment later, and
   *      the submission carries the starter template instead.
   *   2. The check was `toContainText(first 12 chars of line 1)`. This
   *      problem's starter template opens with the same two lines as its
   *      solution, so that assertion passed while the editor still held the
   *      template — and the run failed later at the verdict, blaming the judge
   *      for a WRONG_ANSWER on code the test had never actually entered.
   *
   * `toPass` re-runs the click/clear/insert until the editor really holds the
   * solution, so a slow fill is retried instead of silently submitted.
   * `insertText` rather than `type`: CodeMirror auto-indents and auto-closes
   * brackets, so simulating keystrokes would mangle real Python.
   */
  await expect(async () => {
    await vungGo.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(loiGiaiDung);

    // CodeMirror renders each line as its own element and pads empty lines with
    // non-breaking spaces, so compare on normalised text.
    const trongTrinhSoan = (await vungGo.innerText()).replace(/\u00a0/g, ' ').trim();
    expect(trongTrinhSoan, 'trình soạn thảo phải chứa đúng lời giải mẫu').toBe(
      loiGiaiDung.trim(),
    );
  }).toPass({ timeout: 20_000 });

  const nutNop = khuLamBai.getByRole('button', { name: /^Nộp bài$/ });
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
