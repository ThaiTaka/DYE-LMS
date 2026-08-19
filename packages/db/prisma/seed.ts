/**
 * DYE LMS — database seed.
 *
 * Runs on `prisma db seed`, and automatically as part of `docker compose up`
 * via the `db-migrate` service.
 *
 * Order matters:
 *   1. Compliance assertions   — fail BEFORE writing anything if a teacher note
 *                                has been violated by a curriculum edit.
 *   2. Curriculum              — 4 courses / 94 lessons, upserted by natural key.
 *   3. Badges                  — gamification catalogue.
 *   4. Root admin              — the ONE account this creates.
 *
 * What it deliberately does NOT create: teachers, students, classes, enrolments,
 * progress or submissions. A seeded database is a clean database — the curriculum
 * plus exactly one way in. Everything else is made through the web UI by a real
 * person whose name ends up in the audit log.
 *
 * The demo spread that used to live in step 4 is now a development fixture behind
 * SEED_DEMO=yes, and the test suites that need it ask for it explicitly. Keeping
 * it in the default path meant a fresh database arrived pre-populated with six
 * accounts sharing one password documented in this repository.
 *
 * Every write is an upsert on a stable key, so running this twice produces
 * identical row counts and never orphans student progress.
 */
import { PrismaClient } from '@prisma/client';

import { assertCurriculumCompliance, CurriculumViolation } from './seed/assertions.ts';
import { seedBadges } from './seed/badges.ts';
import { allCourses } from './seed/courses/index.ts';
import { seedDemoData } from './seed/demo.ts';
import { taoQuanTriGoc } from './seed/quan-tri.ts';
import { seedCourse } from './seed/upsert.ts';

const db = new PrismaClient();

/**
 * Should the development fixtures be created?
 *
 * Off unless asked for, in every environment. The demo accounts share a single
 * password documented in this repository, so a database that gets them by default
 * hands out six working logins — one of them an admin — to anyone who has read the
 * README. They exist for local work and for the integration and end-to-end suites,
 * which set this themselves.
 *
 * Refused outright under NODE_ENV=production. There is no flag to override that:
 * a live server has no legitimate use for a shared known password.
 */
function nenTaoDuLieuDemo(): boolean {
  if (process.env['SEED_DEMO'] !== 'yes') return false;

  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'SEED_DEMO=yes bị từ chối vì NODE_ENV=production. ' +
        'Tài khoản demo dùng chung một mật khẩu đã công bố trong kho mã.',
    );
  }
  return true;
}

async function main(): Promise<void> {
  const startedAt = Date.now();

  // Asked and answered before anything is written. Refusing SEED_DEMO in
  // production only after the curriculum and the admin are already committed
  // would report a failure for a run that half succeeded.
  const taoDemo = nenTaoDuLieuDemo();

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

  // ── 4. Root admin ────────────────────────────────────────────────────────
  process.stdout.write('  4/4  Tài khoản quản trị gốc ... ');
  const quanTri = await taoQuanTriGoc(db, {
    username: process.env['ADMIN_USERNAME'],
    password: process.env['ADMIN_PASSWORD'] ?? '',
    displayName: process.env['ADMIN_DISPLAY_NAME'],
  });
  console.log(`${quanTri.username} (${quanTri.laMoi ? 'mới tạo' : 'đặt lại mật khẩu'})`);

  // ── 5. Development fixtures, only when asked for ─────────────────────────
  const demo = taoDemo ? await seedDemoData(db) : null;
  if (demo) {
    console.log(
      `  5/5  Dữ liệu demo (SEED_DEMO=yes) ... ${demo.users} tài khoản · ` +
        `${demo.classes} lớp · ${demo.enrollments} lượt ghi danh`,
    );
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
    console.log(`  Đăng nhập bằng ${quanTri.username} · ${quanTri.displayName}`);
    console.log('    Mật khẩu lấy từ ADMIN_PASSWORD, không in ra ở đây.');
    console.log('');
    console.log('    Chưa có giáo viên, học sinh hay lớp nào — tạo bằng giao diện web:');
    console.log('      Lớp học   → /giao-vien/lop');
    console.log('      Nhân sự   → /giao-vien/nhan-su');
    console.log('      Học sinh  → /giao-vien/hoc-sinh');
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
