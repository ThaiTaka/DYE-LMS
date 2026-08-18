/**
 * Standing security gates.
 *
 * A security audit that runs once decays the moment someone adds a file. These
 * are the audit, written so it runs on every commit.
 *
 * Two kinds of check live here:
 *   1. Structural — every server action resolves an actor and authorizes, and
 *      no route handler skips the guard. Source is read and parsed, so a new
 *      action written without a guard fails CI rather than shipping.
 *   2. Behavioural — the specific exploit found during the Phase 12 audit stays
 *      closed, proven against a real database.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaClient } from '@prisma/client';

const GOC = join(import.meta.dirname, '..');

function moiTep(thuMuc: string, duoi: string[]): string[] {
  const ket: string[] = [];
  for (const ten of readdirSync(thuMuc)) {
    const p = join(thuMuc, ten);
    if (statSync(p).isDirectory()) ket.push(...moiTep(p, duoi));
    else if (duoi.some((d) => ten.endsWith(d))) ket.push(p);
  }
  return ket;
}

const TEP_NGUON = moiTep(GOC, ['.ts', '.tsx']).filter((p) => !p.includes('.test.'));

/**
 * Source with comments removed.
 *
 * Without this, a rule fires on the comment that explains why the thing it bans
 * is not used — which is how a useful gate becomes a gate people switch off.
 */
function maKhongChuThich(duongDan: string): string {
  return readFileSync(duongDan, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Server actions
// ═══════════════════════════════════════════════════════════════════════════

/** Anything that resolves who is asking. */
const CACH_LAY_ACTOR = ['currentActor()', 'hocSinhHienTai()', 'await ai()'];

/** Guards called directly in the action body. */
const KIEM_QUYEN_TRUC_TIEP = [
  'authorize(',
  'moDuAn(',
  'moDuAnDeSua(',
  'moKhoiCode(',
];

/**
 * @dye/core functions that perform their OWN authorization internally.
 *
 * An action delegating to one of these is guarded; the check simply lives one
 * call deeper. The list is not taken on trust — the test below re-reads each of
 * these in the core source and fails if it stopped guarding.
 */
const UY_QUYEN_CHO_CORE: Record<string, string> = {
  'luuNhap(': 'moKhoiCode',
  'docNhap(': 'moKhoiCode',
  'lichSuMa(': 'moKhoiCode',
  'xemBanLuu(': 'moKhoiCode',
  'khoiPhucBanLuu(': 'moKhoiCode',
  'nopBai(': 'moKhoiCode',
  'nopBaiMicrobit(': 'moKhoiCode',
  'ghiNhanXet(': 'moDuAn',
  'chamTay(': 'ForbiddenError',
  'voHieuHoaNhanVien(': 'requireAdminActingOnOther',
  'chuyenGiaoHoSoGiangDay(': 'requireAdminActingOnOther',
  'xoaTaiKhoanNhanVien(': 'requireAdminActingOnOther',
  'khoiPhucNhanVien(': 'requireAdminActingOnOther',
};

const CACH_KIEM_QUYEN = [...KIEM_QUYEN_TRUC_TIEP, ...Object.keys(UY_QUYEN_CHO_CORE)];

/**
 * Actions that legitimately have no actor.
 *
 * Exactly one: logging in is how a person BECOMES an actor. Every addition to
 * this list has to be argued for in review, which is the point of it being a
 * list rather than a pattern.
 */
const MIEN_TRU = new Set([
  // Logging in is how a person BECOMES an actor.
  'dangNhap',
  // Creates a project for `actor.id` only, after a role check — there is no id
  // from the request that could point at another child.
  'taoDuAnMoi',
]);

interface HanhDong {
  tep: string;
  ten: string;
  coActor: boolean;
  coQuyen: boolean;
}

function docHanhDong(): HanhDong[] {
  const ket: HanhDong[] = [];

  for (const tep of TEP_NGUON) {
    const src = readFileSync(tep, 'utf8');
    if (!src.includes("'use server'")) continue;

    // Split on each exported async function; the tail of each chunk is its body.
    const phan = src.split(/^export async function /m).slice(1);
    for (const p of phan) {
      const ten = p.slice(0, p.indexOf('(')).trim();
      ket.push({
        tep: relative(GOC, tep),
        ten,
        coActor: CACH_LAY_ACTOR.some((c) => p.includes(c)),
        coQuyen: CACH_KIEM_QUYEN.some((c) => p.includes(c)),
      });
    }
  }
  return ket;
}

describe('Mọi server action đều biết ai đang gọi', () => {
  const hanhDong = docHanhDong();

  it('tìm thấy các server action để kiểm tra', () => {
    // A refactor that moves the actions elsewhere must not turn this whole file
    // into a silent no-op.
    expect(hanhDong.length).toBeGreaterThan(15);
  });

  it('mọi action đều xác định người gọi', () => {
    const thieu = hanhDong.filter((h) => !h.coActor && !MIEN_TRU.has(h.ten));
    expect(thieu.map((h) => `${h.tep}:${h.ten}`)).toEqual([]);
  });

  it('mọi action đều kiểm tra quyền, không chỉ kiểm tra đăng nhập', () => {
    // Being logged in is not the same as being allowed. This is the check that
    // caught `danhDauKhoiXong` writing progress into a locked lesson.
    const thieu = hanhDong.filter((h) => !h.coQuyen && !MIEN_TRU.has(h.ten));
    expect(thieu.map((h) => `${h.tep}:${h.ten}`)).toEqual([]);
  });

  it('danh sách miễn trừ vẫn nhỏ và có lý do', () => {
    // Every entry costs an argument in review. Growth here is the signal to
    // look at, not the individual entries.
    expect([...MIEN_TRU].sort()).toEqual(['dangNhap', 'taoDuAnMoi']);
  });

  it('các hàm core được uỷ quyền THẬT SỰ có kiểm tra bên trong', () => {
    // The delegation list above is only safe if it is true. Read the core source
    // and prove each named function still guards.
    const coreDir = join(GOC, '..', '..', '..', 'packages', 'core', 'src');
    const coreSrc = moiTep(coreDir, ['.ts'])
      .filter((p) => !p.includes('.test.'))
      .map((p) => readFileSync(p, 'utf8'))
      .join('\n');

    for (const [ham, chot] of Object.entries(UY_QUYEN_CHO_CORE)) {
      const ten = ham.slice(0, -1);
      const i = coreSrc.indexOf(`export async function ${ten}`);
      expect(i, `khong tim thay ${ten} trong core`).toBeGreaterThan(-1);

      const than = coreSrc.slice(i, i + 2500);
      expect(than, `${ten} khong con kiem tra quyen`).toContain(chot);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Route handlers
// ═══════════════════════════════════════════════════════════════════════════

describe('Mọi route handler đều có chốt chặn', () => {
  const routes = TEP_NGUON.filter((p) => p.endsWith(`route.ts`) && p.includes(`api`));

  it('tìm thấy các route handler', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('không route nào trả dữ liệu mà bỏ qua kiểm tra quyền', () => {
    const hong: string[] = [];

    for (const r of routes) {
      const src = readFileSync(r, 'utf8');
      // Auth.js owns its own routes; everything else must guard explicitly.
      if (src.includes('handlers')) continue;

      const coActor = CACH_LAY_ACTOR.some((c) => src.includes(c));
      const coQuyen = CACH_KIEM_QUYEN.some((c) => src.includes(c));
      if (!coActor || !coQuyen) hong.push(relative(GOC, r));
    }

    expect(hong).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Data-shape rules
// ═══════════════════════════════════════════════════════════════════════════

describe('Không rò rỉ qua tầng dữ liệu', () => {
  it('tầng dựng view model không bao giờ chọn Choice.isCorrect', () => {
    /*
     * Scoped to lib/, where view models are built. `isCorrect` IS read in the
     * quiz answer-checking action — that is the entire job of that action, and it
     * returns only a boolean. The leak this guards against is the field reaching
     * a payload the browser receives.
     */
    const viewModels = TEP_NGUON.filter(
      (p) => p.endsWith('-data.ts'),
    );
    expect(viewModels.length).toBeGreaterThan(0);

    const hong = viewModels.filter((p) => maKhongChuThich(p).includes('isCorrect'));
    expect(hong.map((p) => relative(GOC, p))).toEqual([]);
  });

  it('không dùng dangerouslySetInnerHTML ở bất kỳ đâu', () => {
    // Lesson content is authored by teachers from Phase 6. Every path to raw
    // HTML is a stored-XSS risk on a page children log into.
    const hong = TEP_NGUON.filter((p) => maKhongChuThich(p).includes('dangerouslySetInnerHTML'));
    expect(hong.map((x) => relative(GOC, x))).toEqual([]);
  });

  it('không dùng truy vấn SQL thô — Prisma tham số hoá mọi thứ', () => {
    // $queryRawUnsafe / $executeRawUnsafe interpolate strings straight into SQL.
    const hong = TEP_NGUON.filter((p) => {
      const src = maKhongChuThich(p);
      return src.includes('$queryRawUnsafe') || src.includes('$executeRawUnsafe');
    });
    expect(hong.map((x) => relative(GOC, x))).toEqual([]);
  });

  it('không có bí mật nào bị viết cứng trong mã nguồn', () => {
    const hong: string[] = [];
    for (const p of TEP_NGUON) {
      const src = maKhongChuThich(p);
      // A real secret assigned to a literal, as opposed to read from env.
      if (/(?:AUTH_SECRET|PASSWORD|SECRET_KEY)\s*=\s*['"][A-Za-z0-9+/=]{16,}['"]/.test(src)) {
        hong.push(relative(GOC, p));
      }
    }
    expect(hong).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. The Phase 12 finding, kept closed
// ═══════════════════════════════════════════════════════════════════════════

const { PrismaClient: Client } = await import('@prisma/client');
const db = new Client({
  datasources: { db: { url: process.env['DATABASE_URL'] ?? '' } },
  log: ['error'],
}) as PrismaClient;

let studentId: string;
let blockKhoa: string;

beforeAll(async () => {
  const hs = await db.user.findFirstOrThrow({
    where: { username: 'hs.dung' },
    select: { id: true },
  });
  studentId = hs.id;

  const bai = await db.lesson.findFirstOrThrow({
    where: { course: { slug: 'python-co-ban' }, order: 28 },
    select: { id: true, blocks: { select: { id: true }, take: 1 } },
  });
  blockKhoa = bai.blocks[0]!.id;
});

afterAll(async () => {
  await db.blockProgress.deleteMany({ where: { studentId, blockId: blockKhoa } });
  await db.$disconnect();
});

describe('Không ghi được tiến độ vào bài đang khoá', () => {
  it('bài dùng cho phép thử này thật sự đang khoá', async () => {
    const { resolveLessonAccess } = await import('@dye/core');
    const bai = await db.lessonBlock.findUniqueOrThrow({
      where: { id: blockKhoa },
      select: { lessonId: true },
    });
    const access = await resolveLessonAccess(db, studentId, bai.lessonId);

    // If this ever stops being locked the test below proves nothing.
    expect(access?.unlocked).toBe(false);
  });

  it('moKhoiCode từ chối khối trong bài đang khoá', async () => {
    const { moKhoiCode, ForbiddenError } = await import('@dye/core');
    // The guard `danhDauKhoiXong` was missing. Marking a block complete inside a
    // locked lesson would have walked straight past the gating engine.
    await expect(moKhoiCode(db, studentId, blockKhoa)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('danhDauKhoiXong dùng moKhoiCode, không tra cứu trần', async () => {
    const src = readFileSync(
      join(GOC, 'app', 'bai-hoc', '[slug]', 'actions.ts'),
      'utf8',
    );
    const than = src.slice(src.indexOf('export async function danhDauKhoiXong'));

    expect(than).toContain('moKhoiCode(');
    // The unguarded lookup this replaced.
    expect(than).not.toMatch(/db\.lessonBlock\.findUnique/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Client bundle isolation
// ═══════════════════════════════════════════════════════════════════════════

describe('Bundle phía client không chứa mã máy chủ', () => {
  const chunkDir = join(GOC, '..', '.next', 'static', 'chunks');
  const daBuild = existsSync(chunkDir);

  it.runIf(daBuild)('không có phụ thuộc máy chủ nào lọt vào bundle trình duyệt', () => {
    /*
     * Twice now a client component has imported from the @dye/core root barrel
     * and dragged `node:crypto` into the browser build — Phase 7 and Phase 9.
     * Both times the build failed loudly, which was luck rather than design:
     * a dependency that happens to bundle cleanly would ship server code to a
     * child's laptop instead.
     */
    const CAM = ['node:crypto', 'PrismaClient', 'bullmq', '@node-rs/argon2'];
    const chunks = moiTep(chunkDir, ['.js']);
    expect(chunks.length).toBeGreaterThan(0);

    const hong: string[] = [];
    for (const c of chunks) {
      const src = readFileSync(c, 'utf8');
      for (const t of CAM) {
        if (src.includes(t)) hong.push(`${relative(chunkDir, c)} chứa ${t}`);
      }
    }
    expect(hong).toEqual([]);
  });

  it.runIf(daBuild)('CodeMirror không nằm trong chunk mà mọi trang đều tải', () => {
    /*
     * `cm-content` rather than the package name: module specifiers do not
     * survive minification, and a marker that is always absent would make this
     * assertion pass forever without checking anything.
     *
     * The editor is ~145 kB. A lesson page needs it; a dashboard must not pay
     * for it — which is why every non-editor route is ~106 kB First Load while
     * the lesson route is ~255 kB.
     */
    const chunks = moiTep(chunkDir, ['.js']);
    const coEditor = chunks.filter((c) => readFileSync(c, 'utf8').includes('cm-content'));

    // Present somewhere, or the marker is wrong and this proves nothing.
    expect(coEditor.length).toBeGreaterThan(0);

    // Absent from the chunks Next.js loads on every single page.
    const chungChoMoiTrang = coEditor.filter((c) =>
      /(framework|main-app|polyfills)-/.test(relative(chunkDir, c)),
    );
    expect(chungChoMoiTrang.map((c) => relative(chunkDir, c))).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. 'use server' module rules
// ═══════════════════════════════════════════════════════════════════════════

describe("Tệp 'use server' chỉ export hàm async", () => {
  it('không tệp nào export giá trị không phải hàm', () => {
    /*
     * Next.js enforces this at RUNTIME, not at build time:
     *
     *   A "use server" file can only export async functions, found object.
     *
     * And it does not disable just the offending export — it takes down every
     * action in the file. A `CHUA_LAM` constant exported alongside the teacher
     * actions broke the whole lesson-override feature in production, and it
     * survived a page-level smoke test because the page renders fine; only
     * CLICKING the button reaches the action.
     *
     * Types and interfaces are erased at compile time and are safe.
     */
    const hong: string[] = [];

    for (const tep of TEP_NGUON) {
      // Comment-stripped: a file that merely EXPLAINS this rule in prose is not
      // itself a server module, and flagging it would make the gate noise.
      const ma = maKhongChuThich(tep);
      if (!/^\s*['"]use server['"]/.test(ma.trimStart())) continue;

      for (const m of ma.matchAll(
        /^export\s+(const|let|var|class|enum)\s+(\w+)/gm,
      )) {
        hong.push(`${relative(GOC, tep)} export ${m[1]} ${m[2]}`);
      }
    }

    expect(hong).toEqual([]);
  });
});
