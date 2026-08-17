/**
 * Authentication and session integration tests — real PostgreSQL.
 *
 * The load-bearing assertions here are:
 *   • the session token is stored HASHED, so a database leak is not a session leak;
 *   • disabling an account kills live sessions on the very next request;
 *   • wrong-password and unknown-user are indistinguishable to the caller.
 */
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AUDIT, changePassword, login, logout, revokeAllForUser } from './authenticate';
import { AccountDisabledError, RateLimitedError, UnauthorizedError } from './errors';
import { hashPassword, verifyPassword } from './password';
import {
  createSession,
  deactivateUser,
  purgeExpiredSessions,
  revokeAllSessions,
  rotateSession,
  validateSession,
} from './session';
import { createFixture, TEST_PASSWORD, type Fixture } from './testing/fixtures';

let fx: Fixture;

beforeAll(async () => {
  fx = await createFixture();
});

afterAll(async () => {
  await fx?.cleanup();
});

/**
 * Run `body` with a user temporarily disabled, restoring the flag even if the
 * assertion inside fails.
 *
 * Without the `finally`, one failing assertion leaves the fixture user disabled
 * and every later test fails as collateral — which buries the real failure.
 */
async function withDisabledUser(userId: string, body: () => Promise<void>): Promise<void> {
  await fx.db.user.update({ where: { id: userId }, data: { isActive: false } });
  try {
    await body();
  } finally {
    await fx.db.user.update({ where: { id: userId }, data: { isActive: true } });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Mật khẩu
// ═══════════════════════════════════════════════════════════════════════════

describe('Băm mật khẩu Argon2id', () => {
  it('băm rồi xác minh lại được', async () => {
    const hash = await hashPassword('MatKhauRatDai#2026');
    expect(await verifyPassword('MatKhauRatDai#2026', hash)).toBe(true);
    expect(await verifyPassword('MatKhauSai#2026', hash)).toBe(false);
  });

  it('dùng Argon2id, không phải thuật toán yếu hơn', async () => {
    const hash = await hashPassword('MatKhauRatDai#2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('hai lần băm cùng mật khẩu cho hai chuỗi khác nhau (có salt)', async () => {
    const a = await hashPassword('MatKhauRatDai#2026');
    const b = await hashPassword('MatKhauRatDai#2026');
    expect(a).not.toBe(b);
  });

  it('từ chối mật khẩu quá ngắn', async () => {
    await expect(hashPassword('ngan')).rejects.toThrow();
  });

  it('hash hỏng thì trả về false, không làm sập tiến trình', async () => {
    expect(await verifyPassword('bat-ky', 'khong-phai-hash-argon2')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phiên đăng nhập
// ═══════════════════════════════════════════════════════════════════════════

describe('Phiên lưu trong cơ sở dữ liệu', () => {
  it('token được lưu dưới dạng BĂM, không phải nguyên bản', async () => {
    const { token } = await createSession(fx.db, fx.studentA1);

    // Không tìm được bằng giá trị nguyên bản...
    const byRaw = await fx.db.session.findUnique({ where: { sessionToken: token } });
    expect(byRaw).toBeNull();

    // ...nhưng tìm được bằng SHA-256 của nó.
    const digest = createHash('sha256').update(token, 'utf8').digest('hex');
    const byHash = await fx.db.session.findUnique({ where: { sessionToken: digest } });
    expect(byHash).not.toBeNull();

    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('token hợp lệ phân giải ra đúng người dùng', async () => {
    const { token } = await createSession(fx.db, fx.studentA1);
    const actor = await validateSession(fx.db, token);

    expect(actor?.id).toBe(fx.studentA1);
    expect(actor?.role).toBe('STUDENT');

    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('token không tồn tại trả về null, không ném lỗi', async () => {
    expect(await validateSession(fx.db, 'token-bia-dat')).toBeNull();
    expect(await validateSession(fx.db, null)).toBeNull();
    expect(await validateSession(fx.db, '')).toBeNull();
  });

  it('token hết hạn bị từ chối và bị xoá khỏi bảng', async () => {
    const { token } = await createSession(fx.db, fx.studentA1, {}, -1); // đã hết hạn
    expect(await validateSession(fx.db, token)).toBeNull();

    const digest = createHash('sha256').update(token, 'utf8').digest('hex');
    expect(await fx.db.session.findUnique({ where: { sessionToken: digest } })).toBeNull();
  });

  it('mỗi phiên có token riêng biệt', async () => {
    const a = await createSession(fx.db, fx.studentA1);
    const b = await createSession(fx.db, fx.studentA1);
    expect(a.token).not.toBe(b.token);
    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('xoay token giữ nguyên đăng nhập nhưng token cũ chết', async () => {
    const { token: oldToken } = await createSession(fx.db, fx.studentA1);
    const rotated = await rotateSession(fx.db, oldToken);

    expect(rotated).not.toBeNull();
    expect(rotated?.token).not.toBe(oldToken);
    expect(await validateSession(fx.db, oldToken)).toBeNull();
    expect((await validateSession(fx.db, rotated?.token ?? ''))?.id).toBe(fx.studentA1);

    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('dọn dẹp phiên hết hạn', async () => {
    await createSession(fx.db, fx.studentA1, {}, -1);
    await createSession(fx.db, fx.studentA1, {}, -1);
    const purged = await purgeExpiredSessions(fx.db);
    expect(purged).toBeGreaterThanOrEqual(2);
  });

  it('không tạo được phiên cho tài khoản đã vô hiệu hoá', async () => {
    await withDisabledUser(fx.studentA2, async () => {
      await expect(createSession(fx.db, fx.studentA2)).rejects.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Vô hiệu hoá tài khoản — yêu cầu bắt buộc của đề bài
// ═══════════════════════════════════════════════════════════════════════════

describe('Vô hiệu hoá tài khoản thu hồi quyền NGAY LẬP TỨC', () => {
  it('phiên đang sống chết ngay ở request kế tiếp sau khi bị vô hiệu hoá', async () => {
    const { token } = await createSession(fx.db, fx.studentA1);
    expect((await validateSession(fx.db, token))?.id).toBe(fx.studentA1);

    try {
      // Giáo viên vô hiệu hoá tài khoản.
      await deactivateUser(fx.db, fx.studentA1);

      // Cùng token đó, request kế tiếp: hết quyền.
      expect(await validateSession(fx.db, token)).toBeNull();
    } finally {
      await fx.db.user.update({ where: { id: fx.studentA1 }, data: { isActive: true } });
    }
  });

  it('vô hiệu hoá xoá sạch MỌI phiên, không chỉ phiên hiện tại', async () => {
    const a = await createSession(fx.db, fx.studentA1);
    const b = await createSession(fx.db, fx.studentA1);
    const c = await createSession(fx.db, fx.studentA1);

    try {
      await deactivateUser(fx.db, fx.studentA1);

      for (const s of [a, b, c]) {
        expect(await validateSession(fx.db, s.token)).toBeNull();
      }
      expect(await fx.db.session.count({ where: { userId: fx.studentA1 } })).toBe(0);
    } finally {
      await fx.db.user.update({ where: { id: fx.studentA1 }, data: { isActive: true } });
    }
  });

  it('cờ isActive=false một mình cũng đủ chặn, kể cả khi hàng phiên còn đó', async () => {
    const { token } = await createSession(fx.db, fx.studentA1);

    // Chỉ đổi cờ, KHÔNG xoá phiên — mô phỏng cập nhật từ đường khác.
    await withDisabledUser(fx.studentA1, async () => {
      expect(await validateSession(fx.db, token)).toBeNull();
    });
  });

  it('thu hồi thủ công đăng xuất mọi thiết bị và ghi audit', async () => {
    await createSession(fx.db, fx.studentA1);
    await createSession(fx.db, fx.studentA1);

    const count = await revokeAllForUser(fx.db, fx.teacherA, fx.studentA1);
    expect(count).toBeGreaterThanOrEqual(2);

    const log = await fx.db.auditLog.findFirst({
      where: { action: AUDIT.SESSIONS_REVOKED, entityId: fx.studentA1 },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect(log?.actorId).toBe(fx.teacherA);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Đăng nhập
// ═══════════════════════════════════════════════════════════════════════════

describe('Đăng nhập', () => {
  it('đăng nhập đúng thì cấp phiên dùng được', async () => {
    const result = await login(fx.db, `${fx.prefix}-student-a1`, TEST_PASSWORD);

    expect(result.actor.id).toBe(fx.studentA1);
    expect((await validateSession(fx.db, result.session.token))?.id).toBe(fx.studentA1);

    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('tên đăng nhập không phân biệt hoa thường và bỏ khoảng trắng thừa', async () => {
    const result = await login(fx.db, `  ${fx.prefix.toUpperCase()}-STUDENT-A1  `, TEST_PASSWORD);
    expect(result.actor.id).toBe(fx.studentA1);
    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('sai mật khẩu và không có tài khoản trả về CÙNG một thông báo', async () => {
    const saiMatKhau = await login(fx.db, `${fx.prefix}-student-a1`, 'SaiHoanToan#2026').catch(
      (e: unknown) => e,
    );
    const khongCoTaiKhoan = await login(
      fx.db,
      `${fx.prefix}-khong-ton-tai`,
      'SaiHoanToan#2026',
    ).catch((e: unknown) => e);

    expect(saiMatKhau).toBeInstanceOf(UnauthorizedError);
    expect(khongCoTaiKhoan).toBeInstanceOf(UnauthorizedError);
    // Cùng thông báo → không dò được tài khoản nào tồn tại.
    expect((saiMatKhau as Error).message).toBe((khongCoTaiKhoan as Error).message);
    // Nhưng nhật ký nội bộ vẫn phân biệt được.
    expect((saiMatKhau as UnauthorizedError).reason).toBe('bad-password');
    expect((khongCoTaiKhoan as UnauthorizedError).reason).toBe('unknown-user');
  });

  it('tài khoản bị vô hiệu hoá không đăng nhập được dù mật khẩu đúng', async () => {
    await withDisabledUser(fx.studentB1, async () => {
      await expect(login(fx.db, `${fx.prefix}-student-b1`, TEST_PASSWORD)).rejects.toBeInstanceOf(
        AccountDisabledError,
      );
    });
  });

  it('sai mật khẩu ở tài khoản bị vô hiệu hoá vẫn báo lỗi đăng nhập thường', async () => {
    // Nếu báo "tài khoản bị khoá" ở đây thì đã lộ rằng tên đăng nhập có thật.
    await withDisabledUser(fx.studentB1, async () => {
      const err = await login(fx.db, `${fx.prefix}-student-b1`, 'SaiHoanToan#2026').catch(
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(UnauthorizedError);
    });
  });

  it('ghi nhật ký cả lần thành công lẫn lần thất bại', async () => {
    await login(fx.db, `${fx.prefix}-student-a1`, TEST_PASSWORD);
    await login(fx.db, `${fx.prefix}-student-a1`, 'SaiHoanToan#2026').catch(() => undefined);

    const thanhCong = await fx.db.auditLog.count({
      where: { action: AUDIT.LOGIN_SUCCESS, actorId: fx.studentA1 },
    });
    const thatBai = await fx.db.auditLog.count({
      where: { action: AUDIT.LOGIN_FAILED, actorId: fx.studentA1 },
    });

    expect(thanhCong).toBeGreaterThanOrEqual(1);
    expect(thatBai).toBeGreaterThanOrEqual(1);

    await revokeAllSessions(fx.db, fx.studentA1);
  });

  it('đăng xuất làm token hết hiệu lực', async () => {
    const { session, actor } = await login(fx.db, `${fx.prefix}-student-a1`, TEST_PASSWORD);
    await logout(fx.db, session.token, actor.id);
    expect(await validateSession(fx.db, session.token)).toBeNull();
  });

  it('chặn dò mật khẩu sau nhiều lần sai liên tiếp', async () => {
    const username = `${fx.prefix}-student-a2`;

    // 8 lần sai là chạm ngưỡng mặc định.
    for (let i = 0; i < 8; i += 1) {
      await login(fx.db, username, `Sai${i}#2026`).catch(() => undefined);
    }

    // Lần thứ 9 bị chặn — kể cả khi mật khẩu ĐÚNG.
    await expect(login(fx.db, username, TEST_PASSWORD)).rejects.toBeInstanceOf(RateLimitedError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Đổi mật khẩu
// ═══════════════════════════════════════════════════════════════════════════

describe('Đổi mật khẩu', () => {
  it('đổi mật khẩu đăng xuất mọi thiết bị khác', async () => {
    const dienThoai = await createSession(fx.db, fx.teacherA);
    const mayTinh = await createSession(fx.db, fx.teacherA);

    const moi = await changePassword(fx.db, fx.teacherA, TEST_PASSWORD, 'MatKhauMoi#2026');

    // Hai phiên cũ chết.
    expect(await validateSession(fx.db, dienThoai.token)).toBeNull();
    expect(await validateSession(fx.db, mayTinh.token)).toBeNull();
    // Phiên mới sống.
    expect((await validateSession(fx.db, moi.token))?.id).toBe(fx.teacherA);

    // Trả lại mật khẩu cũ cho các test khác.
    await changePassword(fx.db, fx.teacherA, 'MatKhauMoi#2026', TEST_PASSWORD);
    await revokeAllSessions(fx.db, fx.teacherA);
  });

  it('sai mật khẩu hiện tại thì không đổi được', async () => {
    await expect(
      changePassword(fx.db, fx.teacherA, 'SaiHoanToan#2026', 'MatKhauMoi#2026'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('mật khẩu mới quá ngắn bị từ chối', async () => {
    await expect(changePassword(fx.db, fx.teacherA, TEST_PASSWORD, 'ngan')).rejects.toThrow();
  });
});
