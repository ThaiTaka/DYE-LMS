/**
 * Standalone curriculum verifier.
 *
 *   npm run db:verify --workspace @dye/db
 *
 * Runs every compliance assertion WITHOUT touching the database, so a curriculum
 * edit can be checked in CI or before Docker is even running. `prisma db seed`
 * runs the same checks before its first write.
 */
import { assertCurriculumCompliance, CurriculumViolation } from './assertions.ts';
import { allCourses } from './courses/index.ts';

function summarise(): void {
  let lessons = 0;
  let blocks = 0;
  let problems = 0;
  let tests = 0;
  let quizzes = 0;
  let questions = 0;
  let derived = 0;

  for (const course of allCourses) {
    const courseLessons = course.modules.flatMap((m) => m.lessons);
    lessons += courseLessons.length;
    derived += courseLessons.filter((l) => l.isDerived).length;

    for (const lesson of courseLessons) {
      blocks += lesson.blocks.length;
      for (const block of lesson.blocks) {
        if (block.problem) {
          problems += 1;
          tests += block.problem.tests?.length ?? 0;
        }
        if (block.quiz) {
          quizzes += 1;
          questions += block.quiz.questions.length;
        }
      }
    }

    const required = courseLessons.filter((l) => l.status === 'REQUIRED').length;
    console.log(
      `  ${course.slug.padEnd(24)} ${String(courseLessons.length).padStart(2)} buổi ` +
        `· ${String(required).padStart(2)} bắt buộc · ${course.modules.length} mô-đun`,
    );
  }

  console.log('');
  console.log(`  Tổng: ${lessons} bài học (${derived} bài suy dẫn), ${blocks} khối nội dung`);
  console.log(`        ${problems} bài lập trình / ${tests} test case`);
  console.log(`        ${quizzes} bài trắc nghiệm / ${questions} câu hỏi`);
}

function main(): void {
  console.log('');
  console.log('Kiểm tra tuân thủ chương trình học...');
  console.log('');

  try {
    assertCurriculumCompliance(allCourses);
  } catch (error) {
    if (error instanceof CurriculumViolation) {
      console.error(`\n  ✗ ${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }

  summarise();
  console.log('');
  console.log('  ✓ Mọi ghi chú của giáo viên đều được tuân thủ.');
  console.log('');
}

main();
