/**
 * The root administrator account.
 *
 * Shared by the seed (step 4) and by `prisma/scripts/tao-quan-tri.ts`, so the
 * Argon2 parameters and the username rule exist once. Two copies of a password
 * hasher is how one of them quietly drifts and stops verifying at login.
 */
import { hash } from '@node-rs/argon2';

import type { PrismaClient } from '@prisma/client';

/** Defaults for this deployment. A username is not a credential. */
export const MAC_DINH_USERNAME = 'thaitaka';
export const MAC_DINH_TEN_HIEN_THI = 'Quản Trị Viên';

/**
 * Must stay identical to PASSWORD_PARAMS in @dye/core/password.
 *
 * Duplicated rather than imported because @dye/db does not depend on @dye/core —
 * the migration image installs only this workspace. A mismatch would not fail
 * loudly; the hash would simply never verify, and the account would look correct
 * while being impossible to log into.
 */
const ARGON_OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Longer than the student minimum of 8. This account can read every child's record. */
export const DO_DAI_MAT_KHAU_TOI_THIEU = 12;

export interface KetQuaQuanTri {
  username: string;
  displayName: string;
  /** False when the account already existed and its password was reset. */
  laMoi: boolean;
}

/**
 * Create or reset the root admin.
 *
 * Upsert on username, so running it twice does not make two admins and a re-run
 * resets the password — the intended recovery path for a forgotten one.
 *
 * The password is never defaulted in code. This repository is public, so a literal
 * here would be an admin password published to everyone, on a system holding
 * children's records. It comes from ADMIN_PASSWORD, which lives in `.env` or
 * `.env.production` — both gitignored.
 */
export async function taoQuanTriGoc(
  db: PrismaClient,
  input: { username?: string | undefined; password: string; displayName?: string | undefined },
): Promise<KetQuaQuanTri> {
  if (!input.password) {
    throw new Error(
      'Thiếu ADMIN_PASSWORD.\n' +
        '    Đặt trong .env (máy cá nhân) hoặc .env.production (máy chủ),\n' +
        '    hoặc truyền trực tiếp: ADMIN_PASSWORD=... npm run db:seed',
    );
  }

  if (input.password.length < DO_DAI_MAT_KHAU_TOI_THIEU) {
    throw new Error(
      `Mật khẩu quản trị phải có ít nhất ${DO_DAI_MAT_KHAU_TOI_THIEU} ký tự ` +
        `(đang có ${input.password.length}).`,
    );
  }

  /*
   * Lowercased on purpose.
   *
   * `xacThucDangNhap` in @dye/core normalises the typed username with
   * `.trim().toLowerCase()` before the lookup, so a row stored with capitals
   * could never be matched: the account would be created successfully and be
   * permanently impossible to log into. Stored lowercase, "ThaiTaka", "thaitaka"
   * and "THAITAKA" all work at the login form.
   */
  const username = (input.username ?? MAC_DINH_USERNAME).trim().toLowerCase();
  const displayName = input.displayName?.trim() || MAC_DINH_TEN_HIEN_THI;

  const dangCo = await db.user.findUnique({ where: { username }, select: { id: true } });
  const passwordHash = await hash(input.password, ARGON_OPTS);

  const user = await db.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      displayName,
      role: 'ADMIN',
      isActive: true,
      // The root account is set up deliberately by whoever runs the seed, so it
      // does not need the first-login change that provisioned accounts get.
      mustChangePassword: false,
    },
    update: { passwordHash, displayName, role: 'ADMIN', isActive: true },
    select: { username: true, displayName: true },
  });

  return { username: user.username, displayName: user.displayName, laMoi: !dangCo };
}
