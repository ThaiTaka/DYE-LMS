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
 * ── Why this file is now a two-line shim ─────────────────────────────────────
 * The loader that used to live here was one of two independent copies in the
 * repo; the other was inside `apps/web/next.config.mjs`. They had already
 * drifted — this one honoured `.env.production` and the web one did not — and
 * `apps/judge-worker`, which never got a copy at all, crashed on startup for
 * exactly that reason.
 *
 * The implementation now lives in `scripts/moi-truong.mjs` and is shared by all
 * three. This file stays because every `db:*` script in package.json names it,
 * and because this is where the Prisma-specific explanation belongs.
 *
 *   node prisma/chay-voi-env.mjs prisma migrate deploy
 */
import { spawn } from 'node:child_process';
import { doiBienMoiTruong, napEnv } from '../../../scripts/moi-truong.mjs';

const ketQua = napEnv();

/*
 * Leading `--dat KEY=VALUE` pairs set variables for the child.
 *
 * `SEED_DEMO=yes prisma db seed` is the obvious way to write this and does not
 * work in an npm script on Windows: cmd.exe reads the prefix as a command, not as
 * an assignment. Passing it as a flag keeps one script definition working on both
 * platforms without pulling in cross-env.
 *
 * These are set unconditionally, unlike the file-loaded values: the caller
 * asked for them on the command line, which is more specific than a `.env`.
 */
const argv = process.argv.slice(2);
while (argv[0] === '--dat') {
  const cap = argv[1];
  if (!cap || !cap.includes('=')) {
    console.error('--dat cần dạng KEY=VALUE');
    process.exit(1);
  }
  const bang = cap.indexOf('=');
  process.env[cap.slice(0, bang)] = cap.slice(bang + 1);
  argv.splice(0, 2);
}

const [lenh, ...thamSo] = argv;
if (!lenh) {
  console.error('Cách dùng: node prisma/chay-voi-env.mjs [--dat KEY=VALUE] <lệnh> [tham số...]');
  process.exit(1);
}

doiBienMoiTruong(['DATABASE_URL'], ketQua);

// shell: true so the npm-provided node_modules/.bin is on PATH for `prisma`
// and `tsx`, on Windows as well as Linux.
const con = spawn(lenh, thamSo, { stdio: 'inherit', shell: true });
con.on('exit', (ma, tinHieu) => process.exit(tinHieu ? 1 : (ma ?? 0)));
con.on('error', (err) => {
  console.error(`Không chạy được "${lenh}":`, err.message);
  process.exit(1);
});
