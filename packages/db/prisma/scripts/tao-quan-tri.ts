/**
 * Create (or reset) the administrator account.
 *
 *   npm run db:admin
 *
 * The seed already creates this account as its step 4, so this script is for the
 * two cases the seed does not cover: resetting a forgotten password without
 * re-running the whole seed, and adding a second admin under a different name.
 *
 * The account rules — Argon2 parameters, the lowercase username, the 12-character
 * minimum — live in `prisma/seed/quan-tri.ts` so that this and the seed cannot
 * drift. This file is the command line around them.
 *
 * Username and display name default to the values in that module. The password is
 * NOT defaulted and never appears in source: it is read from ADMIN_PASSWORD in
 * `.env` (development) or `.env.production` (server), both gitignored. This
 * repository is public, and an admin password committed to it would be an admin
 * password published to everyone, on a system holding children's records.
 *
 *   ADMIN_PASSWORD='...' npm run db:admin           # one-off override
 *   ADMIN_USERNAME=... ADMIN_DISPLAY_NAME=... ...   # a different account
 */
import { PrismaClient } from '@prisma/client';

import { taoQuanTriGoc } from '../seed/quan-tri.ts';

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const kq = await taoQuanTriGoc(db, {
      username: process.env['ADMIN_USERNAME'],
      password: process.env['ADMIN_PASSWORD'] ?? '',
      displayName: process.env['ADMIN_DISPLAY_NAME'],
    });

    console.log('');
    console.log(kq.laMoi ? '  ✓ Đã tạo tài khoản quản trị' : '  ✓ Đã cập nhật tài khoản quản trị');
    console.log(`    Tên đăng nhập : ${kq.username}`);
    console.log(`    Hiển thị      : ${kq.displayName}`);
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
