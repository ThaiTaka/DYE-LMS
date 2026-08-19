/**
 * Run a command with the monorepo-root `.env` loaded.
 *
 * ── The bug this exists to kill ──────────────────────────────────────────────
 * Every `db:*` script runs with cwd = `packages/db`. Prisma looks for a `.env`
 * beside the schema and in the current directory, and this workspace has
 * neither — the single `.env` lives at the repo root. So from a clean shell
 * every one of them failed with:
 *
 *     error: Environment variable not found: DATABASE_URL.
 *       -->  schema.prisma:17
 *
 * That error names `schema.prisma`, but the stack trace it arrives with points
 * at whatever query happened to run first — `seed/upsert.ts:217`, which is a
 * flat scalar upsert. It reads exactly like a malformed query and is not one.
 * Nothing was wrong with the seed; it simply had no database to talk to.
 *
 * Loading here rather than in each script means the Prisma CLI *and* the seed
 * process it spawns both inherit the variables, which a loader inside
 * `seed.ts` could never do for `migrate` or `studio`.
 *
 *   node prisma/chay-voi-env.mjs prisma migrate deploy
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const goc = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * `.env.production` first, then `.env`.
 *
 * First writer wins and real process env always beats both, so a value already
 * exported by the caller — or by Docker — is never overwritten.
 */
function napEnv() {
  for (const ten of ['.env.production', '.env']) {
    const duongDan = resolve(goc, ten);
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

napEnv();

const [lenh, ...thamSo] = process.argv.slice(2);
if (!lenh) {
  console.error('Cách dùng: node prisma/chay-voi-env.mjs <lệnh> [tham số...]');
  process.exit(1);
}

if (!process.env['DATABASE_URL']) {
  console.error('');
  console.error('  ✗ Không tìm thấy DATABASE_URL.');
  console.error(`    Đã tìm trong ${resolve(goc, '.env')} và .env.production.`);
  console.error('    Sao chép .env.example thành .env rồi điền DATABASE_URL.');
  console.error('');
  process.exit(1);
}

// shell: true so the npm-provided node_modules/.bin is on PATH for `prisma`
// and `tsx`, on Windows as well as Linux.
const con = spawn(lenh, thamSo, { stdio: 'inherit', shell: true });
con.on('exit', (ma, tinHieu) => process.exit(tinHieu ? 1 : (ma ?? 0)));
con.on('error', (err) => {
  console.error(`Không chạy được "${lenh}":`, err.message);
  process.exit(1);
});
