/**
 * Create (or reset) the administrator account.
 *
 * A production seed deliberately creates no accounts — see `nenTaoDuLieuDemo` in
 * seed.ts — which leaves a fresh server holding the full curriculum and nobody
 * able to log in. This script is the way in.
 *
 *   npm run db:admin
 *
 * Username and display name default to the values below. The password is NOT
 * defaulted and never appears in this file: it is read from ADMIN_PASSWORD,
 * which lives in `.env` (development) or `.env.production` (server) — both
 * gitignored. This repository is public, and an admin password committed to it
 * would be an admin password published to everyone, on a system holding
 * children's records.
 *
 *   ADMIN_PASSWORD='...' npm run db:admin          # one-off override
 *   ADMIN_USERNAME=... ADMIN_DISPLAY_NAME=... ...  # a different account
 *
 * Upsert on username: running it twice does not create two admins, and a re-run
 * resets the password of the existing one. That is the intended way to recover
 * a forgotten admin password.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

/** Defaults for this deployment. Not secrets — a username is not a credential. */
const MAC_DINH_USERNAME = 'ThaiTaka';
const MAC_DINH_TEN_HIEN_THI = 'Quản Trị Viên';

/**
 * Must stay identical to PASSWORD_PARAMS in @dye/core/password.
 *
 * Duplicated rather than imported because @dye/db does not depend on @dye/core —
 * the migration image installs only this workspace. Mismatched parameters would
 * not fail loudly; the hash would simply never verify at login.
 */
const ARGON_OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Longer than the student minimum of 8. This account can read every child's record. */
const DO_DAI_TOI_THIEU = 12;

/**
 * Load the monorepo-root `.env`.
 *
 * Without this the script only works when the caller has already exported
 * DATABASE_URL, which makes `npm run db:admin` fail from a clean shell for a
 * reason that has nothing to do with the account being created. Existing
 * process env always wins, so a real deployment variable is never overwritten.
 */
function napEnvGoc(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const ten of ['.env.production', '.env']) {
    const duongDan = resolve(here, '../../../..', ten);
    if (!existsSync(duongDan)) continue;

    for (const dong of readFileSync(duongDan, 'utf8').split('\n')) {
      const sach = dong.trim();
      if (!sach || sach.startsWith('#')) continue;

      const bang = sach.indexOf('=');
      if (bang === -1) continue;

      const khoa = sach.slice(0, bang).trim();
      if (process.env[khoa] === undefined) process.env[khoa] = sach.slice(bang + 1).trim();
    }
  }
}

async function main(): Promise<void> {
  napEnvGoc();

  const password = process.env['ADMIN_PASSWORD'];
  if (!password) {
    throw new Error(
      'Thiếu ADMIN_PASSWORD.\n' +
        '    Đặt trong .env (máy cá nhân) hoặc .env.production (máy chủ),\n' +
        '    hoặc truyền trực tiếp: ADMIN_PASSWORD=... npm run db:admin',
    );
  }

  if (password.length < DO_DAI_TOI_THIEU) {
    throw new Error(
      `Mật khẩu quản trị phải có ít nhất ${DO_DAI_TOI_THIEU} ký tự (đang có ${password.length}).`,
    );
  }

  /*
   * Lowercased on purpose.
   *
   * `xacThucDangNhap` in @dye/core normalises the typed username with
   * `.trim().toLowerCase()` before looking it up, so a row stored with capitals
   * could never be matched and the account would be impossible to log into.
   * Storing it lowercase means "ThaiTaka", "thaitaka" and "THAITAKA" all work at
   * the login form.
   */
  const username = (process.env['ADMIN_USERNAME'] ?? MAC_DINH_USERNAME).trim().toLowerCase();
  const displayName = process.env['ADMIN_DISPLAY_NAME']?.trim() || MAC_DINH_TEN_HIEN_THI;

  const db = new PrismaClient();
  try {
    const dangCo = await db.user.findUnique({ where: { username }, select: { id: true } });
    const passwordHash = await hash(password, ARGON_OPTS);

    const user = await db.user.upsert({
      where: { username },
      create: { username, passwordHash, displayName, role: 'ADMIN', isActive: true },
      update: { passwordHash, displayName, role: 'ADMIN', isActive: true },
      select: { username: true, displayName: true, role: true },
    });

    console.log('');
    console.log(dangCo ? '  ✓ Đã cập nhật tài khoản quản trị' : '  ✓ Đã tạo tài khoản quản trị');
    console.log(`    Tên đăng nhập : ${user.username}`);
    console.log(`    Hiển thị      : ${user.displayName}`);
    console.log(`    Quyền         : ${user.role}`);
    console.log('');
    console.log('    Mật khẩu lấy từ ADMIN_PASSWORD, không in ra ở đây.');
    console.log('');
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('');
  console.error('  ✗ Không tạo được tài khoản quản trị:');
  console.error(`    ${error instanceof Error ? error.message : String(error)}`);
  console.error('');
  process.exit(1);
});
