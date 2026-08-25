/**
 * The shared root-`.env` loader.
 *
 * Lives in @dye/db because DATABASE_URL is this package's concern — the loader
 * exists precisely so `prisma` and the seed can find the root .env from
 * packages/db, and `chay-voi-env.mjs` next door is its oldest caller.
 *
 * The NODE_ENV case is the one that matters most. It is not a style rule: the
 * production Content-Security-Policy is chosen from `process.env.NODE_ENV`, so a
 * loader that let a checked-in `.env` set it would ship `unsafe-eval` to real
 * users from a production build. That exact regression happened while this
 * loader was being written — the build's `/500` prerender broke, which is the
 * only reason it was caught — and the existing CSP test could not see it,
 * because that test sets NODE_ENV itself before importing the config.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { napEnv } from '../../../scripts/moi-truong.mjs';

let thuMuc: string;
let envGoc: NodeJS.ProcessEnv;

beforeEach(() => {
  thuMuc = mkdtempSync(join(tmpdir(), 'dye-env-'));
  envGoc = { ...process.env };
});

afterEach(() => {
  rmSync(thuMuc, { recursive: true, force: true });
  // Restore exactly, including deletions the loader made.
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, envGoc);
});

const viet = (ten: string, noiDung: string): void =>
  writeFileSync(join(thuMuc, ten), noiDung);

describe('Nạp .env từ gốc kho', () => {
  it('đọc được biến từ .env', () => {
    viet('.env', 'DATABASE_URL=postgresql://tu-tep\n');
    delete process.env['DATABASE_URL'];

    const kq = napEnv(thuMuc);

    expect(process.env['DATABASE_URL']).toBe('postgresql://tu-tep');
    expect(kq.tepDaDoc).toEqual(['.env']);
  });

  it('KHÔNG ghi đè biến đã có trong môi trường thật', () => {
    // systemd, pm2 and Docker all set variables this way. A file on disk must
    // never win against them.
    viet('.env', 'DATABASE_URL=postgresql://tu-tep\n');
    process.env['DATABASE_URL'] = 'postgresql://tu-systemd';

    napEnv(thuMuc);

    expect(process.env['DATABASE_URL']).toBe('postgresql://tu-systemd');
  });

  it('.env.production thắng .env', () => {
    viet('.env', 'DATABASE_URL=postgresql://local\n');
    viet('.env.production', 'DATABASE_URL=postgresql://that\n');
    delete process.env['DATABASE_URL'];

    const kq = napEnv(thuMuc);

    expect(process.env['DATABASE_URL']).toBe('postgresql://that');
    expect(kq.tepDaDoc).toEqual(['.env.production', '.env']);
  });

  it('KHÔNG BAO GIỜ đặt NODE_ENV từ tệp', () => {
    /*
     * The regression this whole file exists for.
     *
     * `.env` in this repo carries NODE_ENV=development for local work. Letting
     * that reach `next build` makes it emit the DEVELOPMENT CSP — the one with
     * `unsafe-eval`, needed for Fast Refresh — into a production artefact.
     */
    viet('.env', 'NODE_ENV=development\nDATABASE_URL=postgresql://x\n');
    delete process.env['NODE_ENV'];
    // Cleared too: turbo passes the REAL DATABASE_URL through to this process,
    // and the loader is right to refuse to overwrite it. That refusal has its
    // own test above; here it would just mask what this one is checking.
    delete process.env['DATABASE_URL'];

    const kq = napEnv(thuMuc);

    expect(process.env['NODE_ENV']).toBeUndefined();
    expect(kq.bienDaDat).not.toContain('NODE_ENV');
    // The rest of the file still loads.
    expect(process.env['DATABASE_URL']).toBe('postgresql://x');
  });

  it('bỏ qua dòng trống và dòng chú thích', () => {
    viet('.env', '\n# một chú thích\n\nA_VAR=1\n  # thụt lề\nB_VAR=2\n');
    delete process.env['A_VAR'];
    delete process.env['B_VAR'];

    napEnv(thuMuc);

    expect(process.env['A_VAR']).toBe('1');
    expect(process.env['B_VAR']).toBe('2');
  });

  it('bóc dấu nháy quanh giá trị', () => {
    // A connection string pasted from a dashboard often arrives wrapped in
    // quotes, and a quoted DATABASE_URL fails like a network problem.
    viet('.env', 'Q_ONE=\'postgresql://a\'\nQ_TWO="postgresql://b"\n');
    delete process.env['Q_ONE'];
    delete process.env['Q_TWO'];

    napEnv(thuMuc);

    expect(process.env['Q_ONE']).toBe('postgresql://a');
    expect(process.env['Q_TWO']).toBe('postgresql://b');
  });

  it('giữ nguyên dấu = bên trong giá trị', () => {
    // Passwords and connection strings contain '='.
    viet('.env', 'KEY_WITH_EQ=abc=def=ghi\n');
    delete process.env['KEY_WITH_EQ'];

    napEnv(thuMuc);

    expect(process.env['KEY_WITH_EQ']).toBe('abc=def=ghi');
  });

  it('sửa được liên kết Markdown dán nhầm, và ghi nhận đã sửa', () => {
    /*
     * `AUTH_URL=[https://x](https://x)` is what a pasted tunnel URL looks like.
     * Auth.js calls `new URL()` on it, so leaving it broken takes every page in
     * the app down with `TypeError: Invalid URL` pointing at auth.ts — a stack
     * that never shows the offending value.
     */
    viet('.env', 'AUTH_URL=[https://abc.trycloudflare.com](https://abc.trycloudflare.com)\n');
    delete process.env['AUTH_URL'];

    const kq = napEnv(thuMuc);

    expect(process.env['AUTH_URL']).toBe('https://abc.trycloudflare.com');
    expect(() => new URL(process.env['AUTH_URL'] ?? '')).not.toThrow();

    // Repaired in memory, but the file is still wrong and must be reported.
    expect(kq.daSua).toHaveLength(1);
    expect(kq.daSua[0]).toMatchObject({ khoa: 'AUTH_URL', kieu: 'markdown', tep: '.env' });
  });

  it('KHÔNG đoán khi nhãn và đích của liên kết khác nhau', () => {
    // Picking one half would be inventing configuration. Left alone, and
    // `npm run doctor` reports it as unparseable.
    const tho = '[bấm vào đây](https://that.example.com)';
    viet('.env', `AUTH_URL=${tho}\n`);
    delete process.env['AUTH_URL'];

    const kq = napEnv(thuMuc);

    expect(process.env['AUTH_URL']).toBe(tho);
    expect(kq.daSua).toHaveLength(0);
  });

  it('URL bình thường không bị đụng tới', () => {
    viet('.env', 'AUTH_URL=http://203.0.113.10:3000\nDB_X=postgresql://u:p@10.0.0.5:5442/d\n');
    delete process.env['AUTH_URL'];
    delete process.env['DB_X'];

    const kq = napEnv(thuMuc);

    expect(process.env['AUTH_URL']).toBe('http://203.0.113.10:3000');
    expect(process.env['DB_X']).toBe('postgresql://u:p@10.0.0.5:5442/d');
    expect(kq.daSua).toHaveLength(0);
  });

  it('không có tệp nào thì không hỏng, chỉ báo là chưa đọc gì', () => {
    const kq = napEnv(thuMuc);

    expect(kq.tepDaDoc).toEqual([]);
    expect(kq.soBien).toBe(0);
  });

  it('gọi hai lần vẫn an toàn', () => {
    // Entry points load it, and next.config.mjs loads it again inside the same
    // process tree.
    viet('.env', 'IDEMPOTENT=lan-mot\n');
    delete process.env['IDEMPOTENT'];

    napEnv(thuMuc);
    viet('.env', 'IDEMPOTENT=lan-hai\n');
    napEnv(thuMuc);

    expect(process.env['IDEMPOTENT']).toBe('lan-mot');
  });
});
