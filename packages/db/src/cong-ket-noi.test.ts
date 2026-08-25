/**
 * The host port is stated in two places, and they must agree.
 *
 * ── Why this test exists ─────────────────────────────────────────────────────
 * A host port appears twice in this repo, necessarily:
 *
 *     POSTGRES_PORT=5442                          compose publishes with a bare number
 *     DATABASE_URL=…@localhost:5442/dye_lms       Prisma dials a full URL
 *
 * Neither can be derived from the other without a build step, so both are
 * written out. Nothing enforced that they still matched, and the person who
 * changes one — because 5442 was already taken on their box — has no reason to
 * suspect the other exists. The result is:
 *
 *     P1001: Can't reach database server at `localhost:5432`
 *
 * ── Why the TEMPLATE specifically ────────────────────────────────────────────
 * `.env` is gitignored, so a fix to it never leaves the machine it was made on.
 * `.env.example` is the file a new deployment copies, which makes it the only
 * place a consistency guarantee can actually be shipped. If the template is
 * coherent, `cp .env.example .env` always produces a working stack.
 *
 * `npm run doctor` is the other half: it diagnoses an ALREADY-diverged `.env`,
 * including the case this test cannot see — a stack still running an older port
 * mapping because `docker compose up` was never re-run.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const mauEnv = readFileSync(resolve(GOC, '.env.example'), 'utf8');
const compose = readFileSync(resolve(GOC, 'docker-compose.yml'), 'utf8');

/** Read a KEY=value out of the template. */
function bien(khoa: string): string {
  const m = mauEnv.match(new RegExp(`^${khoa}=(.*)$`, 'm'));
  if (!m || m[1] === undefined) throw new Error(`.env.example thiếu ${khoa}`);
  return m[1].trim();
}

function cong(url: string): string {
  const u = new URL(url);
  return u.port;
}

function host(url: string): string {
  return new URL(url).hostname;
}

/**
 * The default compose falls back to when the variable is unset:
 * `- '${POSTGRES_PORT:-5442}:5432'`
 */
function macDinhCompose(khoa: string): { host: string; trong: string } {
  const m = compose.match(
    new RegExp(`\\$\\{${khoa}:-(\\d+)\\}:(\\d+)`),
  );
  if (!m || !m[1] || !m[2]) throw new Error(`docker-compose.yml không ánh xạ ${khoa}`);
  return { host: m[1], trong: m[2] };
}

/** host-port variable → the URL that must dial the same port. */
const CAP_CONG: Array<{ ten: string; bienCong: string; bienUrl: string }> = [
  { ten: 'PostgreSQL', bienCong: 'POSTGRES_PORT', bienUrl: 'DATABASE_URL' },
  { ten: 'Redis', bienCong: 'REDIS_PORT', bienUrl: 'REDIS_URL' },
  { ten: 'MinIO', bienCong: 'MINIO_PORT', bienUrl: 'S3_ENDPOINT' },
];

describe('Cổng trong .env.example khớp nhau', () => {
  for (const { ten, bienCong, bienUrl } of CAP_CONG) {
    it(`${ten}: ${bienCong} bằng đúng cổng trong ${bienUrl}`, () => {
      expect(cong(bien(bienUrl)), `${bienUrl} phải dùng cổng ${bien(bienCong)}`).toBe(
        bien(bienCong),
      );
    });
  }

  it('URL dành cho máy chủ (host) trỏ về localhost, không phải tên service', () => {
    // Dialled from the host, where "postgres" and "redis" do not resolve.
    expect(host(bien('DATABASE_URL'))).toBe('localhost');
    expect(host(bien('REDIS_URL'))).toBe('localhost');
    expect(host(bien('S3_ENDPOINT'))).toBe('localhost');
  });
});

describe('Cổng trong .env.example khớp docker-compose.yml', () => {
  for (const { ten, bienCong } of CAP_CONG) {
    it(`${ten}: mặc định trong compose bằng ${bienCong} của mẫu`, () => {
      // So that someone with no .env at all still gets a coherent stack.
      expect(macDinhCompose(bienCong).host).toBe(bien(bienCong));
    });
  }

  it('MINIO_CONSOLE_PORT cũng khớp', () => {
    expect(macDinhCompose('MINIO_CONSOLE_PORT').host).toBe(bien('MINIO_CONSOLE_PORT'));
  });
});

describe('Biến _DOCKER dùng cổng BÊN TRONG mạng compose', () => {
  /*
   * These are dialled container-to-container, where the published host port
   * does not exist and the service name is the hostname. Getting this backwards
   * produces a connection failure that looks identical to a wrong host port,
   * which is exactly why it is asserted rather than assumed.
   */
  it('DATABASE_URL_DOCKER trỏ tới postgres:5432', () => {
    const u = bien('DATABASE_URL_DOCKER');
    expect(host(u)).toBe('postgres');
    expect(cong(u)).toBe(macDinhCompose('POSTGRES_PORT').trong);
  });

  it('REDIS_URL_DOCKER trỏ tới redis:6379', () => {
    const u = bien('REDIS_URL_DOCKER');
    expect(host(u)).toBe('redis');
    expect(cong(u)).toBe(macDinhCompose('REDIS_PORT').trong);
  });

  it('S3_ENDPOINT_DOCKER trỏ tới minio:9000', () => {
    const u = bien('S3_ENDPOINT_DOCKER');
    expect(host(u)).toBe('minio');
    expect(cong(u)).toBe(macDinhCompose('MINIO_PORT').trong);
  });

  it('bản _DOCKER và bản host KHÔNG được giống nhau', () => {
    // If they are, one of the two is wrong for its context.
    expect(bien('DATABASE_URL_DOCKER')).not.toBe(bien('DATABASE_URL'));
    expect(bien('REDIS_URL_DOCKER')).not.toBe(bien('REDIS_URL'));
  });
});

describe('Thông tin đăng nhập trong .env.example nhất quán', () => {
  it('DATABASE_URL dùng đúng POSTGRES_USER / POSTGRES_DB', () => {
    // A mismatch here authenticates against a database that does not exist, and
    // reports as "role does not exist" rather than as a typo in a template.
    const u = new URL(bien('DATABASE_URL'));
    expect(u.username).toBe(bien('POSTGRES_USER'));
    expect(u.pathname.replace(/^\//, '')).toBe(bien('POSTGRES_DB'));
  });

  it('cả hai URL Postgres đều khai báo schema=public', () => {
    for (const k of ['DATABASE_URL', 'DATABASE_URL_DOCKER']) {
      expect(new URL(bien(k)).searchParams.get('schema')).toBe('public');
    }
  });
});
