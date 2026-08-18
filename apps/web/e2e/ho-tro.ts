/**
 * Shared helpers for the end-to-end suite.
 *
 * These talk to the same database the app is serving from, which is deliberate:
 * a browser test that also inspects the rows can assert what the student SEES
 * and what was actually WRITTEN, rather than trusting one to imply the other.
 */
import { PrismaClient } from '@prisma/client';
import { expect, type Page } from '@playwright/test';

export const MAT_KHAU = process.env['SEED_DEMO_PASSWORD'] ?? 'DyeLms#2026';

let client: PrismaClient | null = null;

export function db(): PrismaClient {
  client ??= new PrismaClient({
    datasources: { db: { url: process.env['DATABASE_URL'] ?? '' } },
    log: ['error'],
  });
  return client;
}

export async function dongDb(): Promise<void> {
  await client?.$disconnect();
  client = null;
}

/** Log in through the real form, and confirm we landed somewhere authenticated. */
export async function dangNhap(page: Page, username: string): Promise<void> {
  await page.goto('/dang-nhap');
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu').fill(MAT_KHAU);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // The login page must be gone. Asserting on the destination instead would
  // couple every test to whichever dashboard that role happens to get.
  await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 30_000 });
}

/** Wait for a submission row to reach a judged state, or fail with what it was. */
export async function choChamXong(
  submissionId: string,
  hanMs = 60_000,
): Promise<{ verdict: string; passedTests: number; totalTests: number }> {
  const batDau = Date.now();

  while (Date.now() - batDau < hanMs) {
    const row = await db().submission.findUnique({
      where: { id: submissionId },
      select: { verdict: true, passedTests: true, totalTests: true, judgedAt: true },
    });
    if (row?.judgedAt) {
      return {
        verdict: row.verdict,
        passedTests: row.passedTests,
        totalTests: row.totalTests,
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const cuoi = await db().submission.findUnique({
    where: { id: submissionId },
    select: { verdict: true },
  });
  throw new Error(
    `Bài nộp ${submissionId} chưa được chấm sau ${hanMs}ms (trạng thái: ${cuoi?.verdict}). ` +
      'Judge worker có đang chạy không? `npm run judge:dev`',
  );
}
