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

/**
 * Should the demo accounts be created?
 *
 * The curriculum and badges ARE the product: a production database is useless
 * without them, so they always seed. The demo accounts are a different thing —
 * they all share one password that is documented in this repository, so creating
 * them on a live server hands six working logins to anyone who has read the
 * README, one of them an admin.
 *
 * Hence the split rather than a single all-or-nothing refusal. In production the
 * demo data is skipped and the seed still succeeds, leaving a server with the
 * full 90-lesson curriculum and no accounts except the ones a real admin makes.
 * SEED_ALLOW_PRODUCTION=yes opts back in, for a staging box that genuinely wants
 * the demo spread to look at.
 */
function nenTaoDuLieuDemo(): boolean {
  if (process.env['NODE_ENV'] !== 'production') return true;

  if (process.env['SEED_ALLOW_PRODUCTION'] === 'yes') {
    console.warn('  ⚠ Tạo tài khoản demo trên database PRODUCTION vì SEED_ALLOW_PRODUCTION=yes.');
    return true;
  }
  return false;
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  console.log('');
  console.log('  DYE LMS — seed');
  console.log('  ' + '─'.repeat(56));

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
  const demo = nenTaoDuLieuDemo() ? await seedDemoData(db) : null;
  if (demo) {
    console.log(
      `${demo.users} tài khoản · ${demo.classes} lớp · ${demo.enrollments} lượt ghi danh`,
    );
  } else {
    console.log('bỏ qua (NODE_ENV=production)');
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('  ' + '─'.repeat(56));
  console.log(
    `  ✓ Hoàn tất trong ${seconds}s — ${lessons} bài học, ${blocks} khối nội dung, ` +
      `${problems} bài lập trình, ${quizzes} bài trắc nghiệm`,
  );

  if (!demo) {
    console.log('');
    console.log('  Bỏ qua dữ liệu demo vì NODE_ENV=production.');
    console.log('    Database đã có đủ chương trình học, chưa có tài khoản nào.');
    console.log('    Tạo tài khoản quản trị thật trước khi mở cho học sinh dùng.');
    console.log('');
    return;
  }

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
