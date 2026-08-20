/**
 * The monorepo's one root-`.env` loader.
 *
 * ── The problem this solves ──────────────────────────────────────────────────
 * Every tool in this repo looks for `.env` in its own working directory, and in
 * a workspace that directory is never the repo root:
 *
 *     next dev      cwd = apps/web            → looks in apps/web
 *     tsx src/…     cwd = apps/judge-worker   → looks nowhere, tsx loads nothing
 *     prisma …      cwd = packages/db         → looks in packages/db
 *
 * The single `.env` lives at the root, so all three miss it. The answer is NOT
 * to copy the file into each package — that scatters secrets across the repo and
 * guarantees they drift.
 *
 * ── Why this file exists rather than a third copy of the same function ───────
 * This loader had already been written twice, independently: once inside
 * `apps/web/next.config.mjs` and once inside `packages/db/prisma/chay-voi-env.mjs`.
 * `apps/judge-worker` never got a copy, so it was the one package that started
 * with no DATABASE_URL and died on its first Prisma call:
 *
 *     error: Environment variable not found: DATABASE_URL.
 *
 * The web app survived only because its copy of the loader happened to run
 * first — not because Next.js handles env differently in any way that helps.
 *
 * The two copies had also already diverged: the db one honoured
 * `.env.production` and the web one did not, so on a VPS the same variable could
 * legitimately hold two different values in two processes. Consolidating them
 * fixes that quietly-dangerous mismatch as well.
 *
 * ── Precedence, in order ─────────────────────────────────────────────────────
 *   1. The real process environment ALWAYS wins. A value exported by the shell,
 *      by systemd, by pm2 or by Docker is never overwritten by a file on disk.
 *   2. `.env.production`, when present.
 *   3. `.env`.
 *
 * First writer wins, so a key set in `.env.production` is not re-read from
 * `.env`. That ordering is what lets a VPS keep a committed-safe `.env` for
 * local defaults while `.env.production` carries the real values.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 * As a module, at the top of a process entry point:
 *
 *     import { napEnv } from '../../../scripts/moi-truong.mjs';
 *     napEnv();
 *
 * As a command wrapper, for anything this repo spawns:
 *
 *     node scripts/moi-truong.mjs turbo run dev
 *     node scripts/moi-truong.mjs --dat SEED_DEMO=yes prisma db seed
 *     node scripts/moi-truong.mjs --bo-qua-loi npm run db:generate
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repo root. This file lives in `<root>/scripts`, so root is one level up. */
export const GOC_KHO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Files read, in order. Earlier files win. */
const TEP_ENV = ['.env.production', '.env'];

/**
 * Variables a file is NEVER allowed to set.
 *
 * `NODE_ENV` belongs to the tool being run, not to a file on disk: `next dev`
 * sets development, `next build` sets production, and `vitest` sets test. This
 * repo's `.env` carries `NODE_ENV=development` for local work, so a loader that
 * honoured it would hand a PRODUCTION build the string "development".
 *
 * That is not cosmetic. `next.config.mjs` picks the Content-Security-Policy from
 * this exact value, and development needs `unsafe-eval` for Fast Refresh — so a
 * production build with a leaked `NODE_ENV=development` ships `unsafe-eval` to
 * real users, silently. It also broke the `/500` prerender outright, which is
 * how it was noticed at all.
 *
 * The comment in next.config.mjs already warned about this and defended against
 * it by reading NODE_ENV before loading the file. That defence only works when
 * the loader runs INSIDE the Next process; once loading moved up to a wrapper
 * that spawns turbo, the value arrived pre-set and the guard had nothing left to
 * protect. Enforcing it here covers every caller instead of one.
 */
const KHONG_NAP_TU_TEP = new Set(['NODE_ENV']);

/**
 * Parse one `.env` line.
 *
 * Deliberately small: this repo's `.env` is `KEY=value` with `#` comments, and a
 * full dotenv parser would be a dependency plus a set of quoting rules nobody
 * here relies on. Surrounding quotes are stripped because a value pasted from a
 * connection string often arrives wrapped in them, and a quoted DATABASE_URL
 * fails in a way that reads like a network problem rather than a quoting one.
 */
function docDong(dong) {
  const sach = dong.trim();
  if (!sach || sach.startsWith('#')) return null;

  const bang = sach.indexOf('=');
  if (bang === -1) return null;

  const khoa = sach.slice(0, bang).trim();
  if (!khoa) return null;

  let gia = sach.slice(bang + 1).trim();
  if (
    (gia.startsWith('"') && gia.endsWith('"') && gia.length >= 2) ||
    (gia.startsWith("'") && gia.endsWith("'") && gia.length >= 2)
  ) {
    gia = gia.slice(1, -1);
  }

  return { khoa, gia };
}

/**
 * Load the root env files into `process.env`.
 *
 * Never overwrites a variable that already has a value, so calling it twice is
 * harmless and a real deployment variable always beats a file.
 */
export function napEnv(goc = GOC_KHO) {
  const tepDaDoc = [];
  const bienDaDat = [];

  for (const ten of TEP_ENV) {
    const duongDan = resolve(goc, ten);
    if (!existsSync(duongDan)) continue;

    tepDaDoc.push(ten);

    for (const dong of readFileSync(duongDan, 'utf8').split('\n')) {
      const cap = docDong(dong);
      if (!cap) continue;
      if (KHONG_NAP_TU_TEP.has(cap.khoa)) continue;
      if (process.env[cap.khoa] !== undefined) continue;

      process.env[cap.khoa] = cap.gia;
      bienDaDat.push(cap.khoa);
    }
  }

  return { tepDaDoc, bienDaDat, soBien: bienDaDat.length };
}

/**
 * Refuse to continue when a required variable is missing.
 *
 * The message names the variable, says where the loader looked, and says what to
 * do about it. Prisma's own error — "Environment variable not found:
 * DATABASE_URL" pointing at `schema.prisma:17` — is technically accurate and
 * tells an operator nothing about the fact that the file exists one directory up
 * and was never read.
 */
export function doiBienMoiTruong(ten, ketQua = { tepDaDoc: [] }) {
  const thieu = ten.filter((k) => !process.env[k]);
  if (thieu.length === 0) return;

  const daDoc =
    ketQua.tepDaDoc.length > 0 ? ketQua.tepDaDoc.join(', ') : 'không tìm thấy tệp .env nào';

  console.error('');
  console.error(`  ✗ Thiếu biến môi trường: ${thieu.join(', ')}`);
  console.error('');
  console.error(`    Đã tìm trong ${GOC_KHO}`);
  console.error(`    Tệp đã đọc: ${daDoc}`);
  console.error('');
  console.error('    Cách sửa:');
  console.error('      cp .env.example .env     rồi điền giá trị thật');
  console.error('    Hoặc export biến đó trước khi chạy (systemd, pm2, Docker).');
  console.error('');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// Command wrapper
// ═══════════════════════════════════════════════════════════════════════════

/** Run directly? Then load the env and spawn whatever came after the flags. */
const laChayTrucTiep =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (laChayTrucTiep) {
  const argv = process.argv.slice(2);

  /*
   * `SEED_DEMO=yes prisma db seed` is the obvious way to write an inline
   * assignment and does not work in an npm script on Windows: cmd.exe reads the
   * prefix as a command name rather than as an assignment. Passing it as a flag
   * keeps one script definition working on both platforms without pulling in
   * cross-env.
   *
   * These are set unconditionally, unlike the file-loaded values: the caller
   * asked for them on the command line, which is more specific than a file.
   */
  const datTruoc = [];
  let boQuaLoi = false;

  while (argv[0] === '--dat' || argv[0] === '--bo-qua-loi') {
    if (argv[0] === '--bo-qua-loi') {
      boQuaLoi = true;
      argv.shift();
      continue;
    }

    const cap = argv[1];
    if (!cap || !cap.includes('=')) {
      console.error('--dat cần dạng KEY=VALUE');
      process.exit(1);
    }
    datTruoc.push(cap);
    argv.splice(0, 2);
  }

  napEnv();

  for (const cap of datTruoc) {
    const bang = cap.indexOf('=');
    process.env[cap.slice(0, bang)] = cap.slice(bang + 1);
  }

  const [lenh, ...thamSo] = argv;
  if (!lenh) {
    console.error(
      'Cách dùng: node scripts/moi-truong.mjs [--bo-qua-loi] [--dat KEY=VALUE] <lệnh> [tham số...]',
    );
    process.exit(1);
  }

  // shell: true so the npm-provided node_modules/.bin is on PATH for `turbo`,
  // `prisma` and `tsx`, on Windows as well as Linux.
  const con = spawn(lenh, thamSo, { stdio: 'inherit', shell: true });

  con.on('exit', (ma, tinHieu) => {
    if (boQuaLoi) {
      process.exit(0);
      return;
    }
    process.exit(tinHieu ? 1 : (ma ?? 0));
  });

  con.on('error', (err) => {
    console.error(`Không chạy được "${lenh}":`, err.message);
    process.exit(boQuaLoi ? 0 : 1);
  });
}
