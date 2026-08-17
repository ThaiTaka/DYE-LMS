/**
 * Authorization integration tests — run against a real PostgreSQL instance.
 *
 * These assert the three properties the brief calls non-negotiable:
 *
 *   1. Teacher A cannot reach Teacher B's classes or students.
 *   2. A student cannot reach another student's submissions or progress.
 *   3. Disabling an account revokes access immediately.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { authorize, can, visibleStudentIds } from './authz';
import { AccountDisabledError, ForbiddenError, UnauthorizedError } from './errors';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

let fx: Fixture;
let teacherA: Actor;
let teacherB: Actor;
let admin: Actor;
let studentA1: Actor;
let studentA2: Actor;
let studentB1: Actor;
let withdrawn: Actor;

beforeAll(async () => {
  fx = await createFixture();
  teacherA = await actorFor(fx.db, fx.teacherA);
  teacherB = await actorFor(fx.db, fx.teacherB);
  admin = await actorFor(fx.db, fx.admin);
  studentA1 = await actorFor(fx.db, fx.studentA1);
  studentA2 = await actorFor(fx.db, fx.studentA2);
  studentB1 = await actorFor(fx.db, fx.studentB1);
  withdrawn = await actorFor(fx.db, fx.studentWithdrawn);
});

afterAll(async () => {
  await fx?.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Cách ly giữa hai giáo viên
// ═══════════════════════════════════════════════════════════════════════════

describe('Giáo viên A không chạm được vào lớp và học sinh của Giáo viên B', () => {
  it('đọc được học sinh của chính mình', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG đọc được học sinh của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'student', action: 'read', studentId: fx.studentB1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG sửa được học sinh của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'student',
        action: 'manage',
        studentId: fx.studentB1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('quản lý được lớp của mình nhưng KHÔNG quản lý được lớp của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'class', action: 'manage', classId: fx.classA }),
    ).resolves.toBeUndefined();

    await expect(
      authorize(fx.db, teacherA, { resource: 'class', action: 'manage', classId: fx.classB }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG cả đọc được lớp của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'class', action: 'read', classId: fx.classB }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG xem được bài nộp của học sinh thuộc giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionB1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Nhưng bài nộp của học sinh mình thì được.
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionA1,
      }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG gán được nhánh phân hoá cho học sinh của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'track',
        action: 'manage',
        studentId: fx.studentB1,
        courseId: fx.courseId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, teacherA, {
        resource: 'track',
        action: 'manage',
        studentId: fx.studentA1,
        courseId: fx.courseId,
      }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG mở khoá bài học cho lớp của giáo viên khác', async () => {
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'lessonOverride',
        action: 'manage',
        classId: fx.classB,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG áp override toàn hệ thống — đó là quyền của quản trị viên', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'lessonOverride', action: 'manage' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, admin, { resource: 'lessonOverride', action: 'manage' }),
    ).resolves.toBeUndefined();
  });

  it('override có cả lớp lẫn học sinh: phải nắm CẢ HAI quan hệ', async () => {
    // Lớp của A nhưng học sinh của B → phải bị từ chối.
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'lessonOverride',
        action: 'manage',
        classId: fx.classA,
        studentId: fx.studentB1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('danh sách học sinh nhìn thấy được khớp chính xác với authorize()', async () => {
    const visibleToA = await visibleStudentIds(fx.db, teacherA);
    expect(visibleToA).toContain(fx.studentA1);
    expect(visibleToA).toContain(fx.studentA2);
    expect(visibleToA).not.toContain(fx.studentB1);
    // Học sinh đã rời lớp không còn nhìn thấy.
    expect(visibleToA).not.toContain(fx.studentWithdrawn);

    // Bất biến: mọi id trong danh sách đều phải qua được authorize().
    for (const id of visibleToA) {
      await expect(
        authorize(fx.db, teacherA, { resource: 'student', action: 'read', studentId: id }),
      ).resolves.toBeUndefined();
    }
  });

  it('học sinh đã rời lớp thì giáo viên cũ mất quyền truy cập', async () => {
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'student',
        action: 'read',
        studentId: fx.studentWithdrawn,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('cách ly là HAI CHIỀU: giáo viên B cũng không chạm được học sinh của A', async () => {
    // Nếu chỉ kiểm tra một chiều, một lỗi bất đối xứng sẽ lọt qua.
    await expect(
      authorize(fx.db, teacherB, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, teacherB, { resource: 'class', action: 'read', classId: fx.classA }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, teacherB, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionA1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Nhưng học sinh của chính B thì vẫn truy cập được.
    await expect(
      authorize(fx.db, teacherB, { resource: 'student', action: 'read', studentId: fx.studentB1 }),
    ).resolves.toBeUndefined();
  });

  it('danh sách học sinh của B không lẫn học sinh của A', async () => {
    const visibleToB = await visibleStudentIds(fx.db, teacherB);
    expect(visibleToB).toEqual([fx.studentB1]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Cách ly giữa các học sinh
// ═══════════════════════════════════════════════════════════════════════════

describe('Học sinh không chạm được vào dữ liệu của học sinh khác', () => {
  it('đọc được hồ sơ của chính mình', async () => {
    await expect(
      authorize(fx.db, studentA1, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG đọc được hồ sơ bạn cùng lớp', async () => {
    await expect(
      authorize(fx.db, studentA1, { resource: 'student', action: 'read', studentId: fx.studentA2 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG xem được bài nộp của bạn khác', async () => {
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionB1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, studentA1, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionA1,
      }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG xem được tiến độ của bạn khác', async () => {
    await expect(
      authorize(fx.db, studentA1, { resource: 'progress', action: 'read', studentId: fx.studentA2 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG chấm điểm bài nộp, kể cả bài của chính mình', async () => {
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'submission',
        action: 'grade',
        submissionId: fx.submissionA1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG quản lý lớp, kể cả lớp mình đang học', async () => {
    await expect(
      authorize(fx.db, studentA1, { resource: 'class', action: 'manage', classId: fx.classA }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Nhưng đọc thì được.
    await expect(
      authorize(fx.db, studentA1, { resource: 'class', action: 'read', classId: fx.classA }),
    ).resolves.toBeUndefined();
  });

  it('KHÔNG đọc được lớp mình không tham gia', async () => {
    await expect(
      authorize(fx.db, studentA1, { resource: 'class', action: 'read', classId: fx.classB }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG tự gán nhánh phân hoá cho mình', async () => {
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'track',
        action: 'manage',
        studentId: fx.studentA1,
        courseId: fx.courseId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG tự mở khoá bài học cho mình', async () => {
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'lessonOverride',
        action: 'manage',
        studentId: fx.studentA1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('KHÔNG sửa được bài tập — sẽ lộ test ẩn', async () => {
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'problem',
        action: 'manage',
        problemId: fx.problemId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('chỉ nhìn thấy chính mình trong danh sách học sinh', async () => {
    expect(await visibleStudentIds(fx.db, studentA1)).toEqual([fx.studentA1]);
  });

  it('cách ly hai chiều: bạn cùng lớp cũng không đọc ngược lại được', async () => {
    await expect(
      authorize(fx.db, studentA2, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, studentA2, {
        resource: 'submission',
        action: 'read',
        submissionId: fx.submissionA1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh lớp khác cũng không đọc được dữ liệu chéo', async () => {
    await expect(
      authorize(fx.db, studentB1, { resource: 'progress', action: 'read', studentId: fx.studentA1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, studentB1, { resource: 'class', action: 'read', classId: fx.classA }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('id không tồn tại bị từ chối, không trả về "không tìm thấy"', async () => {
    // Phân biệt 403 với 404 chính là một kênh dò id.
    await expect(
      authorize(fx.db, studentA1, {
        resource: 'submission',
        action: 'read',
        submissionId: 'khong-ton-tai',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Tài khoản bị vô hiệu hoá
// ═══════════════════════════════════════════════════════════════════════════

describe('Tài khoản bị vô hiệu hoá mất quyền ngay lập tức', () => {
  it('học sinh bị vô hiệu hoá không đọc được chính hồ sơ mình', async () => {
    const disabled: Actor = { ...studentA1, isActive: false };
    await expect(
      authorize(fx.db, disabled, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).rejects.toBeInstanceOf(AccountDisabledError);
  });

  it('giáo viên bị vô hiệu hoá mất mọi quyền, kể cả với lớp mình', async () => {
    const disabled: Actor = { ...teacherA, isActive: false };
    await expect(
      authorize(fx.db, disabled, { resource: 'class', action: 'manage', classId: fx.classA }),
    ).rejects.toBeInstanceOf(AccountDisabledError);
  });

  it('QUẢN TRỊ VIÊN bị vô hiệu hoá cũng bị chặn — không có ngoại lệ nào', async () => {
    const disabled: Actor = { ...admin, isActive: false };
    await expect(
      authorize(fx.db, disabled, { resource: 'curriculum', action: 'create' }),
    ).rejects.toBeInstanceOf(AccountDisabledError);
  });

  it('không có phiên đăng nhập thì bị từ chối bằng 401, không phải 403', async () => {
    await expect(
      authorize(fx.db, null, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('vô hiệu hoá cũng chặn cả visibleStudentIds', async () => {
    const disabled: Actor = { ...teacherA, isActive: false };
    await expect(visibleStudentIds(fx.db, disabled)).rejects.toBeInstanceOf(AccountDisabledError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Quản trị viên và can()
// ═══════════════════════════════════════════════════════════════════════════

describe('Quản trị viên và hàm can()', () => {
  it('quản trị viên đọc được mọi học sinh', async () => {
    for (const id of [fx.studentA1, fx.studentB1, fx.studentWithdrawn]) {
      await expect(
        authorize(fx.db, admin, { resource: 'student', action: 'read', studentId: id }),
      ).resolves.toBeUndefined();
    }
  });

  it('can() trả về boolean khớp với authorize(), không ném lỗi', async () => {
    expect(
      await can(fx.db, teacherA, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).toBe(true);

    expect(
      await can(fx.db, teacherA, { resource: 'student', action: 'read', studentId: fx.studentB1 }),
    ).toBe(false);

    expect(
      await can(fx.db, null, { resource: 'student', action: 'read', studentId: fx.studentA1 }),
    ).toBe(false);
  });

  it('học sinh đã rời lớp vẫn tự đọc được hồ sơ mình', async () => {
    await expect(
      authorize(fx.db, withdrawn, {
        resource: 'student',
        action: 'read',
        studentId: fx.studentWithdrawn,
      }),
    ).resolves.toBeUndefined();
  });

  it('giáo viên tạo được nội dung mới, học sinh thì không', async () => {
    await expect(
      authorize(fx.db, teacherA, { resource: 'curriculum', action: 'create' }),
    ).resolves.toBeUndefined();

    await expect(
      authorize(fx.db, studentA1, { resource: 'curriculum', action: 'create' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('giáo viên KHÔNG sửa được bài tập do người khác tạo', async () => {
    // Bài tập trong seed không có tác giả → chỉ quản trị viên sửa được.
    await expect(
      authorize(fx.db, teacherA, {
        resource: 'problem',
        action: 'manage',
        problemId: fx.problemId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      authorize(fx.db, admin, { resource: 'problem', action: 'manage', problemId: fx.problemId }),
    ).resolves.toBeUndefined();
  });
});
