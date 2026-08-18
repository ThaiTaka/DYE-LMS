/**
 * Create the first administrator account.
 *
 * A production seed deliberately creates no accounts (see `nenTaoDuLieuDemo` in
 * seed.ts), which leaves a fresh server with a full curriculum and nobody able
 * to log in. This script is the way in.
 *
 *   ADMIN_USERNAME=hieutruong \
 *   ADMIN_PASSWORD='...' \
 *   ADMIN_DISPLAY_NAME='Nguyễn Văn A' \
 *   npm run db:admin --workspace @dye/db
 *
 * Idempotent on username: running it twice does not create two admins. It
 * refuses to change an existing account's password unless ADMIN_FORCE_RESET=yes,
 * so a re-run during a deploy cannot silently take over a live account.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

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

function batBuoc(ten: string): string {
  const giaTri = process.env[ten];
  if (!giaTri) throw new Error(`Thiếu biến môi trường ${ten}.`);
  return giaTri;
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const username = batBuoc('ADMIN_USERNAME').trim().toLowerCase();
    const password = batBuoc('ADMIN_PASSWORD');
    const displayName = process.env['ADMIN_DISPLAY_NAME']?.trim() || 'Quản trị viên';

    if (password.length < DO_DAI_TOI_THIEU) {
      throw new Error(
        `Mật khẩu quản trị phải có ít nhất ${DO_DAI_TOI_THIEU} ký tự (đang có ${password.length}).`,
      );
    }

    const dangCo = await db.user.findUnique({
      where: { username },
      select: { id: true, role: true },
    });

    if (dangCo && process.env['ADMIN_FORCE_RESET'] !== 'yes') {
      console.log('');
      console.log(`  Tài khoản "${username}" đã tồn tại — không thay đổi gì.`);
      console.log('  Đặt ADMIN_FORCE_RESET=yes nếu thực sự muốn đặt lại mật khẩu.');
      console.log('');
      return;
    }

    const passwordHash = await hash(password, ARGON_OPTS);

    const user = await db.user.upsert({
      where: { username },
      create: { username, passwordHash, displayName, role: 'ADMIN', isActive: true },
      // An existing account keeps its displayName; only access is restored.
      update: { passwordHash, role: 'ADMIN', isActive: true },
      select: { id: true, username: true, displayName: true },
    });

    console.log('');
    console.log(dangCo ? '  ✓ Đã đặt lại mật khẩu quản trị' : '  ✓ Đã tạo tài khoản quản trị');
    console.log(`    ${user.username} · ${user.displayName}`);
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
