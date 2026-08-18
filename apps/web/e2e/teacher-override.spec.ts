/**
 * Teacher override: a locked lesson refuses a student, the teacher opens it,
 * and the student gets in.
 *
 * The interesting half is the refusal. Phase 5 shipped a locked lesson as an
 * HTTP 500 with Next.js's internal error shell — the boundary held, but the
 * status said the server broke. This asserts the student sees a real page that
 * tells them what to finish next, and that the same is true after the override
 * is applied and again after it is removed.
 */
import { expect, test } from '@playwright/test';

import { dangNhap, db, dongDb } from './ho-tro';

const HOC_SINH = 'hs.dung';

let studentId: string;
let teacherId: string;
let lessonId: string;
let lessonSlug: string;

test.beforeAll(async () => {
  const hs = await db().user.findFirstOrThrow({
    where: { username: HOC_SINH },
    select: { id: true },
  });
  studentId = hs.id;

  // The teacher who actually teaches this student — the override is only
  // permitted through a real Class → Enrollment relationship.
  const ghiDanh = await db().enrollment.findFirstOrThrow({
    where: { studentId, isActive: true, class: { classCourses: { some: {} } } },
    select: { class: { select: { teacherId: true } } },
  });
  teacherId = ghiDanh.class.teacherId;

  // A lesson deep enough that its prerequisite chain is genuinely unmet.
  const bai = await db().lesson.findFirstOrThrow({
    where: { course: { slug: 'python-co-ban' }, order: 28 },
    select: { id: true, slug: true },
  });
  lessonId = bai.id;
  lessonSlug = bai.slug;

  // Start clean: a leftover override from an earlier run would make the first
  // assertion pass for the wrong reason.
  await db().lessonOverride.deleteMany({ where: { lessonId, studentId } });
});

test.afterAll(async () => {
  await db().lessonOverride.deleteMany({ where: { lessonId, studentId } });
  await dongDb();
});

test('bài bị khoá → thầy cô mở → học sinh vào được', async ({ page, browser }) => {
  // ── 1. Locked: a real page, not a crash ──────────────────────────────────
  await dangNhap(page, HOC_SINH);

  const phanHoi = await page.goto(`/bai-hoc/${lessonSlug}`);
  expect(phanHoi?.status(), 'bài bị khoá phải trả 200, không phải 500').toBe(200);

  // The lock reason names what to finish first, which is safe to show and is
  // the only actionable thing a student can be told here.
  await expect(page.getByText(/Em cần hoàn thành trước/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Về bản đồ khoá học/ })).toBeVisible();

  // The lesson's own content must not be on the page at all: a locked lesson
  // never has its blocks read out of the database.
  await expect(page.getByTestId('soan-thao')).toHaveCount(0);

  // ── 2. The teacher opens it, through the real UI ─────────────────────────
  /*
   * A separate BROWSER CONTEXT, not another tab.
   *
   * A second page in the same context shares the student's cookie jar, so
   * `/dang-nhap` redirects an already-authenticated visitor straight to their
   * dashboard and the password field is never rendered. Two people need two
   * cookie jars — which is also what actually happens in a classroom.
   */
  const boiCanhGv = await browser.newContext({ locale: 'vi-VN' });
  const trangGv = await boiCanhGv.newPage();

  const gv = await db().user.findUniqueOrThrow({
    where: { id: teacherId },
    select: { username: true },
  });

  await dangNhap(trangGv, gv.username);
  await trangGv.goto(`/giao-vien/hoc-sinh/${studentId}`);

  /*
   * Scoped to the lesson list, not the whole page.
   *
   * Once an override exists the page grows a "Can thiệp đang áp dụng" section
   * ABOVE the list, and it also contains the words "Buổi 28". A page-wide
   * `.first()` re-resolves to that summary — which has no controls on it — so
   * the locator silently starts pointing at the wrong element halfway through
   * the test.
   */
  const loTrinh = trangGv.getByRole('region', { name: /Lộ trình của em này/ });
  const hang = loTrinh.locator('li').filter({ hasText: 'Buổi 28 ·' }).first();

  await hang.getByRole('button', { name: /Điều chỉnh/ }).click();

  await hang.getByLabel(/Lý do/).fill('Em đã học trước phần này ở nhà');
  await hang.getByRole('button', { name: /Mở bài này cho em/ }).click();

  await expect(trangGv.getByText(/Đã mở Buổi 28/)).toBeVisible({ timeout: 30_000 });

  // The override is a real row, attributed to the teacher who made it.
  const ghiDe = await db().lessonOverride.findFirstOrThrow({
    where: { lessonId, studentId },
    select: { isUnlocked: true, createdBy: true, reason: true },
  });
  expect(ghiDe.isUnlocked).toBe(true);
  expect(ghiDe.createdBy).toBe(teacherId);
  expect(ghiDe.reason).toContain('học trước');

  // ── 3. The student now gets in ───────────────────────────────────────────
  const sau = await page.goto(`/bai-hoc/${lessonSlug}`);
  expect(sau?.status()).toBe(200);

  await expect(page.getByText(/Em cần hoàn thành trước/)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // ── 4. Removing the override closes it again ─────────────────────────────
  // An override that could not be undone would be a one-way door on a decision
  // teachers are expected to revisit.
  await hang.getByRole('button', { name: /Gỡ can thiệp/ }).click();
  await expect(trangGv.getByText(/Đã gỡ can thiệp/)).toBeVisible({ timeout: 30_000 });

  const lai = await page.goto(`/bai-hoc/${lessonSlug}`);
  expect(lai?.status()).toBe(200);
  await expect(page.getByText(/Em cần hoàn thành trước/)).toBeVisible();

  await trangGv.close();
  await boiCanhGv.close();
});

test('giáo viên KHÔNG dạy em đó thì không mở khoá được', async ({ page }) => {
  /*
   * Restricted to the SEEDED demo teachers.
   *
   * Querying "any teacher who does not teach this student" once picked up a
   * leftover row from an aborted integration run, whose password is a different
   * fixture constant — so the test failed at the login step for a reason that
   * had nothing to do with authorization.
   */
  const DEMO_GIAO_VIEN = ['co.lan', 'thay.minh'];

  const khac = await db().user.findFirst({
    where: {
      role: 'TEACHER',
      username: { in: DEMO_GIAO_VIEN },
      id: { not: teacherId },
      taughtClasses: { none: { enrollments: { some: { studentId, isActive: true } } } },
    },
    select: { username: true },
  });

  // In the seed every Pygame student is also one of co.lan's students, so this
  // can legitimately find nobody. Skipping is honest; inventing a teacher would
  // be testing a fixture rather than the system.
  test.skip(!khac, 'Dữ liệu mẫu không có giáo viên nào không dạy em này');

  await dangNhap(page, khac!.username);
  const res = await page.goto(`/giao-vien/hoc-sinh/${studentId}`);

  expect(res?.status(), 'phải là trang từ chối, không phải 500').toBe(200);
  await expect(page).toHaveURL(/khong-co-quyen/);
});
