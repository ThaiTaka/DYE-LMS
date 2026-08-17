/**
 * Gating, tier and flow rules — pure unit tests.
 *
 * These take hand-built input rather than hitting the database, so each rule can
 * be pinned down in isolation. The integration proofs on real seeded data live
 * in progress.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { validateLessonFlow, stageOf } from './flow';
import { isStatusRequiredForTier, resolveGating, type GatingInput, type GatingLesson } from './gating';
import { resolveBlockAccess, nextTier, tierRank, tierWithinScope } from './tiers';

import type { LessonStatus, ProgressState, Tier } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function lesson(order: number, status: LessonStatus = 'REQUIRED'): GatingLesson {
  return {
    id: `l${order}`,
    slug: `bai-${order}`,
    title: `Buổi ${order}`,
    order,
    moduleId: 'm1',
    status,
    isPublished: true,
  };
}

/** Linear chain: each lesson requires the previous one. */
function chain(lessons: GatingLesson[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (let i = 1; i < lessons.length; i += 1) {
    const cur = lessons[i];
    const prev = lessons[i - 1];
    if (cur && prev) map.set(cur.id, [prev.id]);
  }
  return map;
}

function input(over: Partial<GatingInput> = {}): GatingInput {
  const lessons = over.lessons ? [...over.lessons] : [lesson(1), lesson(2), lesson(3)];
  return {
    studentId: 'hs',
    tier: 'CO_BAN',
    enrolled: true,
    lessons,
    prerequisites: chain(lessons as GatingLesson[]),
    overrides: [],
    progress: new Map<string, ProgressState>(),
    ...over,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tiers
// ═══════════════════════════════════════════════════════════════════════════

describe('Thang phân hoá', () => {
  it('xếp hạng đúng thứ tự Cơ bản → Thử thách → Nâng cao → Mở rộng', () => {
    expect(tierRank('CO_BAN')).toBeLessThan(tierRank('THU_THACH'));
    expect(tierRank('THU_THACH')).toBeLessThan(tierRank('NANG_CAO'));
    expect(tierRank('NANG_CAO')).toBeLessThan(tierRank('MO_RONG'));
  });

  it('cộng dồn: học sinh Nâng cao vẫn nhận nội dung Cơ bản', () => {
    expect(tierWithinScope('CO_BAN', 'NANG_CAO')).toBe(true);
    expect(tierWithinScope('THU_THACH', 'NANG_CAO')).toBe(true);
    expect(tierWithinScope('NANG_CAO', 'NANG_CAO')).toBe(true);
    expect(tierWithinScope('MO_RONG', 'NANG_CAO')).toBe(false);
  });

  it('khối trong tầm là BẮT BUỘC, trên tầm là KHÁM PHÁ — không bao giờ bị giấu', () => {
    // Khối lượng giác (NANG_CAO) ở buổi 17 Python Cơ Bản.
    expect(resolveBlockAccess('NANG_CAO', false, 'CO_BAN')).toBe('EXPLORATION');
    expect(resolveBlockAccess('NANG_CAO', false, 'NANG_CAO')).toBe('REQUIRED');
    expect(resolveBlockAccess('CO_BAN', false, 'NANG_CAO')).toBe('REQUIRED');
  });

  it('khối đánh dấu tuỳ chọn không bao giờ là bắt buộc', () => {
    expect(resolveBlockAccess('CO_BAN', true, 'MO_RONG')).toBe('OPTIONAL');
  });

  it('gợi ý nâng nhánh cho học sinh đang tiến nhanh', () => {
    expect(nextTier('CO_BAN')).toBe('THU_THACH');
    expect(nextTier('MO_RONG')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Trạng thái theo nhánh
// ═══════════════════════════════════════════════════════════════════════════

describe('Trạng thái bài học phân giải theo nhánh', () => {
  it('REQUIRED luôn bắt buộc với mọi nhánh', () => {
    for (const tier of ['CO_BAN', 'THU_THACH', 'NANG_CAO', 'MO_RONG'] as Tier[]) {
      expect(isStatusRequiredForTier('REQUIRED', tier)).toBe(true);
    }
  });

  it('ADVANCED chỉ bắt buộc từ nhánh Nâng cao trở lên', () => {
    expect(isStatusRequiredForTier('ADVANCED', 'CO_BAN')).toBe(false);
    expect(isStatusRequiredForTier('ADVANCED', 'THU_THACH')).toBe(false);
    expect(isStatusRequiredForTier('ADVANCED', 'NANG_CAO')).toBe(true);
    expect(isStatusRequiredForTier('ADVANCED', 'MO_RONG')).toBe(true);
  });

  it('OPTIONAL và RECOMMENDED không bao giờ bắt buộc', () => {
    for (const tier of ['CO_BAN', 'MO_RONG'] as Tier[]) {
      expect(isStatusRequiredForTier('OPTIONAL', tier)).toBe(false);
      expect(isStatusRequiredForTier('RECOMMENDED', tier)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Mở khoá theo tiên quyết
// ═══════════════════════════════════════════════════════════════════════════

describe('Mở khoá theo tiên quyết', () => {
  it('bài đầu tiên mở sẵn, các bài sau bị khoá', () => {
    const result = resolveGating(input());
    expect(result[0]?.unlocked).toBe(true);
    expect(result[1]?.unlocked).toBe(false);
    expect(result[2]?.unlocked).toBe(false);
  });

  it('hoàn thành bài trước thì mở bài kế tiếp', () => {
    const result = resolveGating(
      input({ progress: new Map<string, ProgressState>([['l1', 'COMPLETED']]) }),
    );
    expect(result[1]?.unlocked).toBe(true);
    // Nhưng chưa mở bài thứ ba.
    expect(result[2]?.unlocked).toBe(false);
  });

  it('lý do khoá nói rõ cần hoàn thành bài nào', () => {
    const result = resolveGating(input());
    expect(result[1]?.lockReason).toContain('Buổi 1');
    expect(result[1]?.missingPrerequisites).toHaveLength(1);
  });

  it('IN_PROGRESS chưa đủ để mở bài kế tiếp — phải COMPLETED', () => {
    const result = resolveGating(
      input({ progress: new Map<string, ProgressState>([['l1', 'IN_PROGRESS']]) }),
    );
    expect(result[1]?.unlocked).toBe(false);
  });

  it('bài tuỳ chọn VẪN chặn bài sau — tuỳ chọn không có nghĩa là được nhảy cóc', () => {
    // Nếu tiên quyết tuỳ chọn không chặn, học sinh Cơ bản sẽ mở thẳng buổi cuối.
    const lessons = [lesson(1), lesson(2, 'OPTIONAL'), lesson(3, 'OPTIONAL')];
    const result = resolveGating(
      input({
        lessons,
        prerequisites: chain(lessons),
        progress: new Map<string, ProgressState>([['l1', 'COMPLETED']]),
      }),
    );
    expect(result[1]?.unlocked).toBe(true);
    expect(result[2]?.unlocked).toBe(false);
  });

  it('chưa ghi danh thì khoá toàn bộ', () => {
    const result = resolveGating(input({ enrolled: false }));
    expect(result.every((r) => !r.unlocked)).toBe(true);
    expect(result[0]?.lockReason).toContain('ghi danh');
  });

  it('bài chưa xuất bản thì bị khoá', () => {
    const lessons = [{ ...lesson(1), isPublished: false }];
    const result = resolveGating(input({ lessons, prerequisites: new Map() }));
    expect(result[0]?.unlocked).toBe(false);
    expect(result[0]?.lockReason).toContain('chưa được mở');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Can thiệp của giáo viên
// ═══════════════════════════════════════════════════════════════════════════

describe('Can thiệp của giáo viên', () => {
  const now = new Date();

  it('mở khoá thủ công bỏ qua tiên quyết', () => {
    const result = resolveGating(
      input({
        overrides: [
          {
            lessonId: 'l3',
            studentId: 'hs',
            classId: null,
            forceStatus: null,
            isUnlocked: true,
            waivePrerequisites: false,
            createdAt: now,
          },
        ],
      }),
    );
    expect(result[2]?.unlocked).toBe(true);
    expect(result[2]?.teacherOverridden).toBe(true);
  });

  it('khoá thủ công thắng cả khi tiên quyết đã xong', () => {
    const result = resolveGating(
      input({
        progress: new Map<string, ProgressState>([['l1', 'COMPLETED']]),
        overrides: [
          {
            lessonId: 'l2',
            studentId: null,
            classId: 'c1',
            forceStatus: null,
            isUnlocked: false,
            waivePrerequisites: false,
            createdAt: now,
          },
        ],
      }),
    );
    expect(result[1]?.unlocked).toBe(false);
    expect(result[1]?.lockReason).toContain('tạm khoá');
  });

  it('miễn tiên quyết mở toàn bộ chuỗi', () => {
    const result = resolveGating(
      input({
        overrides: [
          {
            lessonId: 'l3',
            studentId: 'hs',
            classId: null,
            forceStatus: null,
            isUnlocked: null,
            waivePrerequisites: true,
            createdAt: now,
          },
        ],
      }),
    );
    expect(result[2]?.unlocked).toBe(true);
    expect(result[2]?.prerequisitesWaived).toBe(true);
    expect(result[2]?.missingPrerequisites).toHaveLength(0);
  });

  it('override cấp học sinh thắng override cấp lớp', () => {
    const result = resolveGating(
      input({
        overrides: [
          {
            lessonId: 'l1',
            studentId: null,
            classId: 'c1',
            forceStatus: 'OPTIONAL',
            isUnlocked: null,
            waivePrerequisites: false,
            createdAt: new Date(now.getTime() + 1000), // mới hơn
          },
          {
            lessonId: 'l1',
            studentId: 'hs',
            classId: null,
            forceStatus: 'REQUIRED',
            isUnlocked: null,
            waivePrerequisites: false,
            createdAt: now, // cũ hơn nhưng phạm vi hẹp hơn
          },
        ],
      }),
    );
    // Phạm vi hẹp hơn thắng, bất kể thời điểm tạo.
    expect(result[0]?.status).toBe('REQUIRED');
    expect(result[0]?.statusSource).toBe('student-override');
  });

  it('cùng phạm vi thì override mới nhất thắng', () => {
    const result = resolveGating(
      input({
        overrides: [
          {
            lessonId: 'l1',
            studentId: 'hs',
            classId: null,
            forceStatus: 'OPTIONAL',
            isUnlocked: null,
            waivePrerequisites: false,
            createdAt: now,
          },
          {
            lessonId: 'l1',
            studentId: 'hs',
            classId: null,
            forceStatus: 'ADVANCED',
            isUnlocked: null,
            waivePrerequisites: false,
            createdAt: new Date(now.getTime() + 5000),
          },
        ],
      }),
    );
    expect(result[0]?.status).toBe('ADVANCED');
  });

  it('giáo viên nâng bài tuỳ chọn thành bắt buộc cho một học sinh', () => {
    const lessons = [lesson(1), lesson(2, 'OPTIONAL')];
    const result = resolveGating(
      input({
        lessons,
        prerequisites: chain(lessons),
        overrides: [
          {
            lessonId: 'l2',
            studentId: 'hs',
            classId: null,
            forceStatus: 'REQUIRED',
            isUnlocked: null,
            waivePrerequisites: false,
            createdAt: now,
          },
        ],
      }),
    );
    expect(result[1]?.isRequired).toBe(true);
    expect(result[1]?.statusSource).toBe('student-override');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Luồng bài học
// ═══════════════════════════════════════════════════════════════════════════

describe('Kiểm tra luồng bài học', () => {
  it('chấp nhận luồng đúng: Lý thuyết → Ví dụ → Sân chơi → Thử thách', () => {
    const result = validateLessonFlow([
      { order: 0, type: 'THEORY' },
      { order: 1, type: 'INTERACTIVE_EXAMPLE' },
      { order: 2, type: 'PLAYGROUND' },
      { order: 3, type: 'MINI_CHALLENGE' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('từ chối Lý thuyết → Kiểm tra, không có phần thực hành ở giữa', () => {
    const result = validateLessonFlow([
      { order: 0, type: 'THEORY' },
      { order: 1, type: 'QUIZ' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.violations[0]?.code).toBe('theory-then-assessment');
  });

  it('chấp nhận bài luyện tập thuần, không có lý thuyết', () => {
    const result = validateLessonFlow([
      { order: 0, type: 'PLAYGROUND' },
      { order: 1, type: 'CODING' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('bắt bài học rỗng', () => {
    expect(validateLessonFlow([]).violations[0]?.code).toBe('empty-lesson');
  });

  it('bắt hai khối cùng vị trí', () => {
    const result = validateLessonFlow([
      { order: 0, type: 'THEORY' },
      { order: 0, type: 'PLAYGROUND' },
    ]);
    expect(result.violations.some((v) => v.code === 'duplicate-order')).toBe(true);
  });

  it('kiểm tra theo thứ tự vị trí, không theo thứ tự mảng', () => {
    // Khối đưa vào lộn xộn nhưng thứ tự thật là đúng.
    const result = validateLessonFlow([
      { order: 3, type: 'MINI_CHALLENGE' },
      { order: 0, type: 'THEORY' },
      { order: 1, type: 'INTERACTIVE_EXAMPLE' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('xếp khối vào đúng chặng của thanh tiến trình', () => {
    expect(stageOf('THEORY')).toBe('LY_THUYET');
    expect(stageOf('INTERACTIVE_EXAMPLE')).toBe('VI_DU');
    expect(stageOf('PLAYGROUND')).toBe('SAN_CHOI');
    expect(stageOf('MINI_CHALLENGE')).toBe('THU_THACH');
    expect(stageOf('QUIZ')).toBe('THU_THACH');
  });
});
