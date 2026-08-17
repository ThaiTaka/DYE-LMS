/**
 * Curriculum engine integration tests — real PostgreSQL, real seeded curriculum.
 *
 * These prove the three properties Phase 4 exists to guarantee:
 *
 *   1. Two students on the same course have DIFFERENT required paths and
 *      different progress denominators, driven by their assigned tier.
 *   2. A locked lesson refuses direct access, and a teacher override opens it.
 *   3. Progress reaches 100% when a student finishes THEIR required track,
 *      even with the optional advanced lessons untouched.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenError } from '../errors';
import { createFixture, type Fixture } from '../testing/fixtures';
import { assertLessonUnlocked, resolveCourseAccess } from './gating';
import { courseProgress, lessonView, syncLessonCompletion } from './progress';

import type { LessonStatus, Tier } from '@prisma/client';

let fx: Fixture;

/** order → lesson id, for the seeded Python Cơ Bản course. */
let lessonByOrder: Map<number, string>;
let statusByOrder: Map<number, LessonStatus>;

beforeAll(async () => {
  fx = await createFixture();

  const lessons = await fx.db.lesson.findMany({
    where: { courseId: fx.courseId },
    select: { id: true, order: true, status: true },
    orderBy: { order: 'asc' },
  });

  lessonByOrder = new Map(lessons.map((l) => [l.order, l.id]));
  statusByOrder = new Map(lessons.map((l) => [l.order, l.status]));
});

afterAll(async () => {
  await fx?.cleanup();
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function setTier(studentId: string, tier: Tier): Promise<void> {
  await fx.db.trackAssignment.upsert({
    where: { studentId_courseId: { studentId, courseId: fx.courseId } },
    create: { studentId, courseId: fx.courseId, tier, assignedBy: fx.teacherA },
    update: { tier },
  });
}

/** Mark sessions 1..upTo as COMPLETED for a student. */
async function completeThrough(studentId: string, upTo: number): Promise<void> {
  for (let order = 1; order <= upTo; order += 1) {
    const lessonId = lessonByOrder.get(order);
    if (!lessonId) continue;
    await fx.db.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, state: 'COMPLETED', completedAt: new Date() },
      update: { state: 'COMPLETED', completedAt: new Date() },
    });
  }
}

async function resetStudent(studentId: string): Promise<void> {
  await fx.db.lessonProgress.deleteMany({ where: { studentId } });
  await fx.db.lessonOverride.deleteMany({ where: { studentId } });
  await fx.db.trackAssignment.deleteMany({ where: { studentId } });
}

beforeEach(async () => {
  await resetStudent(fx.studentA1);
  await resetStudent(fx.studentA2);
  await fx.db.lessonOverride.deleteMany({ where: { classId: fx.classA } });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Hai nhánh, hai lộ trình khác nhau
// ═══════════════════════════════════════════════════════════════════════════

describe('Học sinh khác nhánh có lộ trình bắt buộc khác nhau', () => {
  it('chương trình seed có đúng 19 bài bắt buộc và 1 bài nâng cao', () => {
    // Chốt lại giả định của các test bên dưới — nếu curriculum đổi, test này đỏ trước.
    const required = [...statusByOrder.values()].filter((s) => s === 'REQUIRED').length;
    const advanced = [...statusByOrder.values()].filter((s) => s === 'ADVANCED').length;
    expect(required).toBe(19);
    expect(advanced).toBe(1);
  });

  it('học sinh Cơ bản có 19 bài bắt buộc, học sinh Nâng cao có 20', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await setTier(fx.studentA2, 'NANG_CAO');

    const coBan = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    const nangCao = await courseProgress(fx.db, fx.studentA2, fx.courseId);

    expect(coBan.required.total).toBe(19);
    expect(nangCao.required.total).toBe(20);
    // Chính là mẫu số khác nhau mà đề bài yêu cầu.
    expect(nangCao.required.total).toBeGreaterThan(coBan.required.total);
  });

  it('bài ADVANCED nằm trong lộ trình Nâng cao nhưng ngoài lộ trình Cơ bản', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await setTier(fx.studentA2, 'NANG_CAO');

    const advancedOrder = [...statusByOrder.entries()].find(([, s]) => s === 'ADVANCED')?.[0];
    expect(advancedOrder).toBeDefined();

    const coBan = await resolveCourseAccess(fx.db, fx.studentA1, fx.courseId);
    const nangCao = await resolveCourseAccess(fx.db, fx.studentA2, fx.courseId);

    expect(coBan.find((a) => a.order === advancedOrder)?.isRequired).toBe(false);
    expect(nangCao.find((a) => a.order === advancedOrder)?.isRequired).toBe(true);
  });

  it('nhánh Thử thách vẫn giống Cơ bản — chỉ Nâng cao mới thêm bài ADVANCED', async () => {
    await setTier(fx.studentA1, 'THU_THACH');
    const thuThach = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(thuThach.required.total).toBe(19);
  });

  it('chưa gán nhánh thì mặc định là Cơ bản', async () => {
    const macDinh = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(macDinh.tier).toBe('CO_BAN');
    expect(macDinh.required.total).toBe(19);
  });

  it('giáo viên nâng nhánh thì lộ trình mở rộng ngay, không cần tạo lại dữ liệu', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    expect((await courseProgress(fx.db, fx.studentA1, fx.courseId)).required.total).toBe(19);

    await setTier(fx.studentA1, 'NANG_CAO');
    expect((await courseProgress(fx.db, fx.studentA1, fx.courseId)).required.total).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Định tuyến nội dung theo nhánh
// ═══════════════════════════════════════════════════════════════════════════

describe('Định tuyến khối nội dung theo nhánh (phân hoá)', () => {
  it('khối lượng giác buổi 17 là KHÁM PHÁ với Cơ bản, BẮT BUỘC với Nâng cao', async () => {
    const lessonId = lessonByOrder.get(17);
    expect(lessonId).toBeDefined();

    await setTier(fx.studentA1, 'CO_BAN');
    await setTier(fx.studentA2, 'NANG_CAO');

    const coBan = await lessonView(fx.db, fx.studentA1, lessonId!);
    const nangCao = await lessonView(fx.db, fx.studentA2, lessonId!);

    const trigCoBan = coBan?.blocks.filter((b) => b.tier === 'NANG_CAO') ?? [];
    const trigNangCao = nangCao?.blocks.filter((b) => b.tier === 'NANG_CAO') ?? [];

    // Buổi 17 thực sự có khối Nâng cao — nếu không, test này vô nghĩa.
    expect(trigCoBan.length).toBeGreaterThan(0);

    // Với học sinh Cơ bản: mọi khối lượng giác đều là KHÁM PHÁ, không tính điểm.
    expect(trigCoBan.every((b) => b.access === 'EXPLORATION')).toBe(true);

    // Với học sinh Nâng cao: đã vào tầm, nên không còn khối nào là KHÁM PHÁ.
    expect(trigNangCao.every((b) => b.access !== 'EXPLORATION')).toBe(true);
    // Và ít nhất phần lý thuyết + ví dụ trở thành bắt buộc.
    expect(trigNangCao.filter((b) => b.access === 'REQUIRED').length).toBeGreaterThanOrEqual(2);
  });

  it('khối đánh dấu tuỳ chọn KHÔNG trở thành bắt buộc dù học sinh ở nhánh cao', async () => {
    // Kế hoạch bài giảng ghi rõ bài "Tính chiều cao cột cờ" là tuỳ chọn:
    // "Không làm bài này cũng không ảnh hưởng đến tiến độ của em."
    // Nhánh Nâng cao mở khoá nó, nhưng không được biến nó thành nghĩa vụ.
    const lessonId = lessonByOrder.get(17)!;
    await setTier(fx.studentA2, 'NANG_CAO');

    const view = await lessonView(fx.db, fx.studentA2, lessonId);
    const optional = view?.blocks.filter((b) => b.tier === 'NANG_CAO' && b.access === 'OPTIONAL');

    expect(optional?.length).toBeGreaterThan(0);
    expect(optional?.every((b) => b.title.includes('cột cờ'))).toBe(true);
  });

  it('không khối nào bị giấu — cả hai nhánh thấy cùng số khối', async () => {
    const lessonId = lessonByOrder.get(17)!;
    await setTier(fx.studentA1, 'CO_BAN');
    await setTier(fx.studentA2, 'NANG_CAO');

    const coBan = await lessonView(fx.db, fx.studentA1, lessonId);
    const nangCao = await lessonView(fx.db, fx.studentA2, lessonId);

    expect(coBan?.blocks.length).toBe(nangCao?.blocks.length);
    // Khác nhau ở PHÂN LOẠI, không phải ở khả năng nhìn thấy.
    expect(coBan?.required.total).toBeLessThan(nangCao?.required.total ?? 0);
  });

  it('học sinh Cơ bản hoàn thành buổi 17 mà không cần đụng bài lượng giác', async () => {
    const lessonId = lessonByOrder.get(17)!;
    await setTier(fx.studentA1, 'CO_BAN');

    const view = await lessonView(fx.db, fx.studentA1, lessonId);
    const requiredBlocks = view?.blocks.filter((b) => b.access === 'REQUIRED') ?? [];

    for (const block of requiredBlocks) {
      await fx.db.blockProgress.upsert({
        where: { studentId_blockId: { studentId: fx.studentA1, blockId: block.blockId } },
        create: { studentId: fx.studentA1, blockId: block.blockId, state: 'COMPLETED' },
        update: { state: 'COMPLETED' },
      });
    }

    const done = await syncLessonCompletion(fx.db, fx.studentA1, lessonId);
    expect(done).toBe(true);

    // Khối lượng giác vẫn chưa làm — và điều đó hoàn toàn ổn.
    const after = await lessonView(fx.db, fx.studentA1, lessonId);
    expect(after?.explorationCompleted).toBe(0);
    expect(after?.explorationTotal).toBeGreaterThan(0);
    expect(after?.isComplete).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Bài bị khoá từ chối truy cập trực tiếp
// ═══════════════════════════════════════════════════════════════════════════

describe('Bài bị khoá từ chối truy cập trực tiếp', () => {
  it('buổi 1 mở sẵn cho học sinh đã ghi danh', async () => {
    await expect(
      assertLessonUnlocked(fx.db, fx.studentA1, lessonByOrder.get(1)!),
    ).resolves.toBeDefined();
  });

  it('buổi 5 bị từ chối khi chưa hoàn thành các buổi trước', async () => {
    await expect(
      assertLessonUnlocked(fx.db, fx.studentA1, lessonByOrder.get(5)!),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('thông báo lỗi nói rõ cần hoàn thành bài nào', async () => {
    // Với bài bị khoá, nói cho em biết cần làm gì tiếp là hữu ích và không lộ
    // thông tin của ai khác — nên thông báo được phép cụ thể.
    await expect(
      assertLessonUnlocked(fx.db, fx.studentA1, lessonByOrder.get(5)!),
    ).rejects.toThrow(/Buổi 4/);
  });

  it('giáo viên mở khoá thủ công thì truy cập được ngay', async () => {
    const lessonId = lessonByOrder.get(5)!;

    await expect(assertLessonUnlocked(fx.db, fx.studentA1, lessonId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    await fx.db.lessonOverride.create({
      data: {
        lessonId,
        studentId: fx.studentA1,
        isUnlocked: true,
        createdBy: fx.teacherA,
        reason: 'Em đã học phần này ở nhà',
      },
    });

    const access = await assertLessonUnlocked(fx.db, fx.studentA1, lessonId);
    expect(access.unlocked).toBe(true);
    expect(access.teacherOverridden).toBe(true);
  });

  it('override cấp lớp mở khoá cho mọi học sinh trong lớp', async () => {
    const lessonId = lessonByOrder.get(6)!;

    await fx.db.lessonOverride.create({
      data: { lessonId, classId: fx.classA, isUnlocked: true, createdBy: fx.teacherA },
    });

    // Cả hai học sinh của lớp A đều mở được.
    await expect(assertLessonUnlocked(fx.db, fx.studentA1, lessonId)).resolves.toBeDefined();
    await expect(assertLessonUnlocked(fx.db, fx.studentA2, lessonId)).resolves.toBeDefined();

    // Nhưng học sinh lớp B thì không.
    await expect(assertLessonUnlocked(fx.db, fx.studentB1, lessonId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('giáo viên khoá lại được cả bài đã đủ tiên quyết', async () => {
    const lessonId = lessonByOrder.get(2)!;
    await completeThrough(fx.studentA1, 1);

    await expect(assertLessonUnlocked(fx.db, fx.studentA1, lessonId)).resolves.toBeDefined();

    await fx.db.lessonOverride.create({
      data: { lessonId, studentId: fx.studentA1, isUnlocked: false, createdBy: fx.teacherA },
    });

    await expect(assertLessonUnlocked(fx.db, fx.studentA1, lessonId)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('bài không tồn tại bị từ chối, không lộ thông tin', async () => {
    await expect(
      assertLessonUnlocked(fx.db, fx.studentA1, 'khong-ton-tai'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh chưa ghi danh khoá học thì mọi bài đều khoá', async () => {
    // studentWithdrawn có ghi danh nhưng isActive = false.
    await expect(
      assertLessonUnlocked(fx.db, fx.studentWithdrawn, lessonByOrder.get(1)!),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Tiến độ đạt 100% đúng lộ trình của từng em
// ═══════════════════════════════════════════════════════════════════════════

describe('Tiến độ đạt 100% theo lộ trình riêng của từng học sinh', () => {
  it('học sinh Cơ bản xong buổi 19 là HOÀN THÀNH 100%, dù còn 11 bài tuỳ chọn', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await completeThrough(fx.studentA1, 19);

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);

    expect(progress.required.total).toBe(19);
    expect(progress.required.completed).toBe(19);
    expect(progress.required.percent).toBe(100);
    expect(progress.isComplete).toBe(true);

    // 11 bài còn lại vẫn tồn tại và vẫn chưa làm — nhưng không kéo tụt thanh tiến độ.
    expect(progress.optional.total).toBe(11);
    expect(progress.optional.completed).toBe(0);
  });

  it('CÙNG tiến độ đó, học sinh Nâng cao mới chỉ 95% vì còn bài ADVANCED', async () => {
    await setTier(fx.studentA2, 'NANG_CAO');
    await completeThrough(fx.studentA2, 19);

    const progress = await courseProgress(fx.db, fx.studentA2, fx.courseId);

    expect(progress.required.total).toBe(20);
    expect(progress.required.completed).toBe(19);
    expect(progress.required.percent).toBe(95);
    expect(progress.isComplete).toBe(false);
  });

  it('tiến độ giữa chừng tính đúng theo mẫu số riêng', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await completeThrough(fx.studentA1, 10);

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(progress.required.completed).toBe(10);
    // 10/19 ≈ 53%
    expect(progress.required.percent).toBe(53);
    expect(progress.isComplete).toBe(false);
  });

  it('trả lời được câu hỏi "Tiếp theo làm gì?"', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await completeThrough(fx.studentA1, 3);

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(progress.nextLesson?.order).toBe(4);
  });

  it('xong lộ trình bắt buộc vẫn còn gợi ý bài tuỳ chọn để đi tiếp', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await completeThrough(fx.studentA1, 19);

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(progress.isComplete).toBe(true);
    // Không bỏ rơi em: buổi 20 đã mở và được gợi ý.
    expect(progress.nextLesson?.order).toBe(20);
  });

  it('tiến độ theo mô-đun cũng dùng mẫu số riêng của từng em', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    await completeThrough(fx.studentA1, 19);

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);

    // Các mô-đun nằm trong buổi 1–19 phải hoàn thành hết.
    const done = progress.modules.filter((m) => m.isComplete);
    expect(done.length).toBeGreaterThanOrEqual(5);

    // Mô-đun toàn bài tuỳ chọn không có công việc bắt buộc nào.
    const noRequired = progress.modules.filter((m) => m.required.total === 0);
    expect(noRequired.length).toBeGreaterThan(0);
  });

  it('phân biệt được "đã xong" với "chưa được giao gì"', async () => {
    await setTier(fx.studentA1, 'CO_BAN');

    // Giáo viên chuyển toàn bộ bài bắt buộc thành tuỳ chọn.
    for (let order = 1; order <= 19; order += 1) {
      await fx.db.lessonOverride.create({
        data: {
          lessonId: lessonByOrder.get(order)!,
          studentId: fx.studentA1,
          forceStatus: 'OPTIONAL',
          createdBy: fx.teacherA,
        },
      });
    }

    const progress = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(progress.required.total).toBe(0);
    // Thanh tiến độ hiện 100% nhưng cờ nói rõ chưa có bài nào được giao.
    expect(progress.required.percent).toBe(100);
    expect(progress.hasRequiredWork).toBe(false);
    expect(progress.isComplete).toBe(false);
  });

  it('override của giáo viên đổi mẫu số ngay lập tức', async () => {
    await setTier(fx.studentA1, 'CO_BAN');
    expect((await courseProgress(fx.db, fx.studentA1, fx.courseId)).required.total).toBe(19);

    // Nâng buổi 20 (Collections) thành bắt buộc cho riêng em này.
    await fx.db.lessonOverride.create({
      data: {
        lessonId: lessonByOrder.get(20)!,
        studentId: fx.studentA1,
        forceStatus: 'REQUIRED',
        createdBy: fx.teacherA,
        reason: 'Em học nhanh, cho đi tiếp',
      },
    });

    const after = await courseProgress(fx.db, fx.studentA1, fx.courseId);
    expect(after.required.total).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Hiệu năng truy vấn
// ═══════════════════════════════════════════════════════════════════════════

describe('Hiệu năng', () => {
  it('phân giải cả khoá 30 buổi không gây truy vấn N+1', async () => {
    let queries = 0;
    const counted = fx.db.$extends({
      query: {
        $allModels: {
          $allOperations({ args, query }) {
            queries += 1;
            return query(args);
          },
        },
      },
    });

    await resolveCourseAccess(counted as unknown as typeof fx.db, fx.studentA1, fx.courseId);

    // 3 truy vấn song song khi nạp + 2 truy vấn phụ thuộc = 5.
    // Nếu ai đó vô tình thêm truy vấn trong vòng lặp, con số sẽ nhảy vọt.
    expect(queries).toBeLessThanOrEqual(6);
  });
});
