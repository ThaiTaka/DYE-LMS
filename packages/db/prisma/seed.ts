/**
 * DYE LMS — database seed.
 *
 * Runs on `prisma db seed`, and automatically as part of `docker compose up`
 * via the `db-migrate` service.
 *
 * Order matters:
 *   1. Compliance assertions   — fail BEFORE writing anything if a teacher note
 *                                has been violated by a curriculum edit.
 *   2. Curriculum              — 3 courses / 90 lessons, upserted by natural key.
 *   3. Badges                  — gamification catalogue.
 *   4. Demo data               — accounts, classes, progress, submissions, so
 *                                teacher analytics is not an empty page.
 *
 * Every write is an upsert on a stable key, so running this twice produces
 * identical row counts and never orphans student progress.
 */
import { PrismaClient } from '@prisma/client';

import { assertCurriculumCompliance, CurriculumViolation } from './seed/assertions.ts';
import { seedBadges } from './seed/badges.ts';
import { allCourses } from './seed/courses/index.ts';
import { seedDemoData } from './seed/demo.ts';
import { seedCourse } from './seed/upsert.ts';

const db = new PrismaClient();

function assertNotProduction(): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  const allowed = process.env['SEED_ALLOW_PRODUCTION'] === 'yes';

  if (isProd && !allowed) {
    throw new Error(
      'Refusing to seed with NODE_ENV=production.\n' +
        'The seed creates demo accounts with a shared, publicly documented password.\n' +
        'Set SEED_ALLOW_PRODUCTION=yes only if you genuinely intend this.',
    );
  }
  if (isProd && allowed) {
    console.warn('  ⚠ Seeding a PRODUCTION database because SEED_ALLOW_PRODUCTION=yes.');
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  console.log('');
  console.log('  DYE LMS — seed');
  console.log('  ' + '─'.repeat(56));

  assertNotProduction();

  // ── 1. Compliance ────────────────────────────────────────────────────────
  process.stdout.write('  1/4  Kiểm tra tuân thủ chương trình học ... ');
  assertCurriculumCompliance(allCourses);
  console.log('OK');

  // ── 2. Curriculum ────────────────────────────────────────────────────────
  console.log('  2/4  Nạp chương trình học');
  let lessons = 0;
  let blocks = 0;
  let problems = 0;
  let quizzes = 0;

  for (const course of allCourses) {
    const result = await seedCourse(db, course);
    lessons += result.lessons;
    blocks += result.blocks;
    problems += result.problems;
    quizzes += result.quizzes;
    console.log(
      `         · ${course.slug.padEnd(24)} ${String(result.lessons).padStart(2)} bài · ` +
        `${String(result.blocks).padStart(3)} khối · ${String(result.problems).padStart(2)} bài tập`,
    );
  }

  // ── 3. Badges ────────────────────────────────────────────────────────────
  process.stdout.write('  3/4  Huy hiệu ... ');
  const badgeCount = await seedBadges(db);
  console.log(`${badgeCount} huy hiệu`);

  // ── 4. Demo data ─────────────────────────────────────────────────────────
  process.stdout.write('  4/4  Dữ liệu demo ... ');
  const demo = await seedDemoData(db);
  console.log(
    `${demo.users} tài khoản · ${demo.classes} lớp · ${demo.enrollments} lượt ghi danh`,
  );

  // ── Summary ──────────────────────────────────────────────────────────────
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('  ' + '─'.repeat(56));
  console.log(
    `  ✓ Hoàn tất trong ${seconds}s — ${lessons} bài học, ${blocks} khối nội dung, ` +
      `${problems} bài lập trình, ${quizzes} bài trắc nghiệm`,
  );
  console.log(
    `    ${demo.lessonProgress} bản ghi tiến độ, ${demo.submissions} bài nộp mẫu ` +
      '(để bảng phân tích của giáo viên có dữ liệu thật)',
  );
  console.log('');
  console.log('  Tài khoản demo (mật khẩu: biến môi trường SEED_DEMO_PASSWORD)');
  console.log('    admin       · Quản trị viên');
  console.log('    co.lan      · Giáo viên — lớp Python Cơ Bản');
  console.log('    thay.minh   · Giáo viên — lớp Lập Trình Game');
  console.log('    hs.an       · Học sinh — đang ở nhánh Nâng cao');
  console.log('    hs.dung     · Học sinh — vừa hoàn thành mốc buổi 16');
  console.log('    hs.phuc     · Học sinh — mới bắt đầu');
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.log('');
    if (error instanceof CurriculumViolation) {
      console.error(`  ✗ ${error.message}`);
      console.error('');
      console.error('    Chương trình học vi phạm một ghi chú của giáo viên.');
      console.error('    Xem docs/03-CURRICULUM-MAP.md để biết quy tắc tương ứng.');
    } else {
      console.error('  ✗ Seed thất bại:', error);
    }
    console.log('');
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
