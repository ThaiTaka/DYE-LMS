/**
 * Performance gate for the teacher analytics dashboard.
 *
 * The Phase 6 brief set p95 < 300 ms and it went unmeasured through four phases.
 * A target nobody measures is a target nobody meets, so it is a test: it runs on
 * every commit and fails when the dashboard gets slower.
 *
 * ── What this measures, and what it does not ─────────────────────────────────
 * It measures the real function against the real seeded database on this
 * machine. That is not production hardware, so the absolute number is not a
 * production SLA — what it protects is the SHAPE. An N+1 regression shows up as
 * a cliff in the timing AND directly in the query count, which is asserted
 * rather than left as a number to argue about.
 *
 * ── Why the client is installed before the import ────────────────────────────
 * `lib/db` caches its client on `globalThis.prisma`. Seeding that first is what
 * makes the counter see the queries the application actually runs; a separate
 * client would count nothing and quietly report zero N+1 forever.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Actor } from '@dye/core';
import type { PrismaClient } from '@prisma/client';

const { PrismaClient: Client } = await import('@prisma/client');

let soTruyVan = 0;

const dem = new Client({
  datasources: { db: { url: process.env['DATABASE_URL'] ?? '' } },
  log: [{ emit: 'event', level: 'query' }],
}) as PrismaClient & { $on: (e: 'query', cb: () => void) => void };

dem.$on('query', () => {
  soTruyVan += 1;
});

// Installed BEFORE the modules under test are loaded, so `lib/db` adopts it.
(globalThis as unknown as { prisma?: PrismaClient }).prisma = dem;

const { duLieuBangGiaoVien, duLieuLop } = await import('./teacher-data');

let giaoVien: Actor;
let classId: string;
let siSo: number;

beforeAll(async () => {
  /*
   * The class with the most students. Picking the first would land on the
   * 1-student Micro:bit class, where any target passes and nothing is proven.
   *
   * These fixtures are NOT created by `npm run db:seed`, which deliberately makes
   * only the curriculum and one admin. `findFirstOrThrow` would fail here with a
   * bare "No Class found", which reads like a broken query rather than a missing
   * fixture, so the absence is reported in words instead.
   */
  const lop = await dem.class.findFirst({
    where: { enrollments: { some: { isActive: true } } },
    orderBy: { enrollments: { _count: 'desc' } },
    select: {
      id: true,
      teacher: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!lop) {
    throw new Error(
      [
        'Không tìm thấy lớp nào có học sinh, nên không đo được hiệu năng.',
        'Bộ seed chỉ tạo chương trình học và một tài khoản quản trị.',
        'Chạy `npm run db:demo` để có dữ liệu mẫu rồi thử lại.',
      ].join(' '),
    );
  }

  classId = lop.id;
  giaoVien = lop.teacher;
  siSo = lop._count.enrollments;
}, 60_000);

afterAll(async () => {
  await dem.$disconnect();
});

/** Run `lan` times and report percentiles, after a warm-up. */
async function doThoiGian(
  viec: () => Promise<unknown>,
  lan = 10,
): Promise<{ p50: number; p95: number; max: number }> {
  // The first calls pay connection setup and engine start, which is not what
  // this is measuring.
  await viec();
  await viec();

  const times: number[] = [];
  for (let i = 0; i < lan; i += 1) {
    const t0 = performance.now();
    await viec();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);

  const at = (q: number): number =>
    times[Math.min(times.length - 1, Math.floor(q * times.length))]!;
  return { p50: at(0.5), p95: at(0.95), max: times[times.length - 1]! };
}

/** Mục tiêu từ Phase 6. */
const MUC_TIEU_MS = 300;

describe('Bảng phân tích của giáo viên đạt p95 < 300 ms', () => {
  it('bối cảnh đo là lớp có sĩ số thật, không phải lớp rỗng', () => {
    // A 1-student class would pass any target and prove nothing.
    expect(siSo).toBeGreaterThanOrEqual(10);
  });

  it('bảng tổng quan đạt mục tiêu', async () => {
    const t = await doThoiGian(() => duLieuBangGiaoVien(giaoVien));
    console.log(
      `  [hiệu năng] tổng quan (${siSo} em): p50=${t.p50.toFixed(0)}ms p95=${t.p95.toFixed(0)}ms max=${t.max.toFixed(0)}ms`,
    );
    expect(t.p95).toBeLessThan(MUC_TIEU_MS);
  }, 120_000);

  it('danh sách lớp đạt mục tiêu', async () => {
    const t = await doThoiGian(() => duLieuLop(giaoVien, classId));
    console.log(
      `  [hiệu năng] danh sách lớp: p50=${t.p50.toFixed(0)}ms p95=${t.p95.toFixed(0)}ms max=${t.max.toFixed(0)}ms`,
    );
    expect(t.p95).toBeLessThan(MUC_TIEU_MS);
  }, 120_000);
});

describe('Không có N+1 ẩn trong bảng phân tích', () => {
  it('bộ đếm truy vấn thật sự thấy được truy vấn của ứng dụng', async () => {
    soTruyVan = 0;
    await duLieuLop(giaoVien, classId);
    // If this is 0, the counter is watching the wrong client and every
    // assertion below would pass vacuously.
    expect(soTruyVan).toBeGreaterThan(0);
  }, 60_000);

  it('số truy vấn tăng theo số học sinh, KHÔNG theo số học sinh × số bài', async () => {
    await duLieuBangGiaoVien(giaoVien);

    soTruyVan = 0;
    await duLieuBangGiaoVien(giaoVien);
    const tongQuan = soTruyVan;

    soTruyVan = 0;
    await duLieuLop(giaoVien, classId);
    const lop = soTruyVan;

    console.log(
      `  [truy vấn] tổng quan=${tongQuan} · lớp=${lop} · sĩ số=${siSo} · mỗi em≈${(lop / siSo).toFixed(1)}`,
    );

    /*
     * The bound is per student, not constant, and deliberately so: Phase 4's
     * progress denominator is per student and cannot be computed once for a
     * whole class without giving up the guarantee that makes it correct.
     *
     * What must NOT happen is the count growing per student per LESSON. On a
     * 30-lesson course that is the N+1 shape, and it would put this an order of
     * magnitude past any budget.
     */
    expect(lop).toBeLessThan(siSo * 12);
    expect(tongQuan).toBeLessThan(siSo * 20);
  }, 120_000);
});
