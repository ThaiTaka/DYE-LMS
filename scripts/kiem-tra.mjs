/**
 * Preflight: does the environment agree with the containers that are running?
 *
 *     npm run doctor
 *
 * ── The failure this exists to name ──────────────────────────────────────────
 * Prisma reports a port problem as:
 *
 *     P1001: Can't reach database server at `localhost:5432`
 *
 * which is true and useless. It cannot distinguish the three completely
 * different things that produce it:
 *
 *   1. The container is not running.               → start it
 *   2. DATABASE_URL names the wrong port.          → edit .env
 *   3. The stack is running on an OLD port mapping, because POSTGRES_PORT was
 *      changed in .env but `docker compose up` was never re-run.  → recreate it
 *
 * Case 3 is the nasty one: `.env` and `docker-compose.yml` agree perfectly, so
 * reading them proves nothing, and the container really is up. Only comparing
 * against what Docker has ACTUALLY published finds it.
 *
 * ── Why the two ports can disagree at all ────────────────────────────────────
 * The host port is stated twice, by design:
 *
 *     POSTGRES_PORT=5442                       ← what compose publishes
 *     DATABASE_URL=…@localhost:5442/dye_lms    ← what every client dials
 *
 * compose needs a bare number and Prisma needs a full URL, so neither can be
 * derived from the other without a build step. That is defensible — but nothing
 * checked that they still matched, and a person changing one because 5442 was
 * already taken has no reason to suspect the other exists.
 */
import { createConnection } from 'node:net';
import { execFileSync, execSync } from 'node:child_process';

import { GOC_KHO, napEnv } from './moi-truong.mjs';

const ketQua = napEnv();

/** ANSI, but only when stdout is a terminal. */
const mau = process.stdout.isTTY
  ? { do: '[31m', xanh: '[32m', vang: '[33m', mo: '[2m', het: '[0m' }
  : { do: '', xanh: '', vang: '', mo: '', het: '' };

const OK = `${mau.xanh}OK${mau.het}`;
const HONG = `${mau.do}HỎNG${mau.het}`;
const CANH = `${mau.vang}CHÚ Ý${mau.het}`;

/**
 * What we expect to be reachable, and where each half of the answer comes from.
 *
 * `bienCong` is the number compose publishes with; `bienUrl` is the URL clients
 * dial. `container` is matched against the running container names so a stale
 * mapping can be spotted.
 */
const DICH_VU = [
  {
    ten: 'PostgreSQL',
    bienCong: 'POSTGRES_PORT',
    congMacDinh: '5442',
    bienUrl: 'DATABASE_URL',
    container: 'postgres',
    congTrongContainer: '5432',
  },
  {
    ten: 'Redis',
    bienCong: 'REDIS_PORT',
    congMacDinh: '6389',
    bienUrl: 'REDIS_URL',
    container: 'redis',
    congTrongContainer: '6379',
  },
  {
    ten: 'MinIO',
    bienCong: 'MINIO_PORT',
    congMacDinh: '9010',
    bienUrl: 'S3_ENDPOINT',
    container: 'minio',
    congTrongContainer: '9000',
  },
];

/** Port out of a URL, with the scheme's default filled in. */
function congTuUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.port) return u.port;
    if (u.protocol === 'postgresql:' || u.protocol === 'postgres:') return '5432';
    if (u.protocol === 'redis:') return '6379';
    if (u.protocol === 'https:') return '443';
    if (u.protocol === 'http:') return '80';
    return null;
  } catch {
    return null;
  }
}

function hostTuUrl(raw) {
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

/** Is something listening? Short timeout — this is a preflight, not a monitor. */
function dangNghe(host, cong, hetGioMs = 1500) {
  return new Promise((giaiQuyet) => {
    const socket = createConnection({ host, port: Number(cong) });
    const xong = (kq) => {
      socket.destroy();
      giaiQuyet(kq);
    };
    socket.setTimeout(hetGioMs);
    socket.once('connect', () => xong(true));
    socket.once('timeout', () => xong(false));
    socket.once('error', () => xong(false));
  });
}

/**
 * Host ports Docker has ACTUALLY published, per container.
 *
 * Reads the live daemon rather than the compose file on purpose — the whole
 * point is to catch a stack still running an older mapping. Returns null when
 * Docker is unavailable, which is a legitimate state (bare-metal Postgres, or a
 * managed database) and must not be reported as a failure.
 */
function congDocker() {
  try {
    const raw = execFileSync('docker', ['ps', '--format', '{{.Names}}\t{{.Ports}}'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });

    const theoTen = new Map();
    for (const dong of raw.split('\n')) {
      const [ten, ports] = dong.split('\t');
      if (!ten || !ports) continue;
      // "0.0.0.0:5442->5432/tcp, [::]:5442->5432/tcp"
      const cap = [...ports.matchAll(/:(\d+)->(\d+)\/tcp/g)].map((m) => ({
        host: m[1],
        trong: m[2],
      }));
      theoTen.set(ten, cap);
    }
    return theoTen;
  } catch {
    return null;
  }
}

/**
 * Variables that must parse as a URL if they are set at all.
 *
 * A malformed value here does not fail where it is written — it fails deep
 * inside whatever consumes it. A markdown link pasted as AUTH_URL, for
 * instance, surfaces as `TypeError: Invalid URL` with a stack pointing at
 * `auth.ts`, and every page in the app answers 500. The value itself never
 * appears in the error, so the trail leads to the consumer and stops.
 */
const BIEN_URL = [
  'DATABASE_URL',
  'DATABASE_URL_DOCKER',
  'DIRECT_URL',
  'REDIS_URL',
  'REDIS_URL_DOCKER',
  'S3_ENDPOINT',
  'S3_ENDPOINT_DOCKER',
  'AUTH_URL',
  'NEXTAUTH_URL',
];

/** Diagnose a value that is set but cannot be parsed. */
function chanDoanUrl(gia) {
  // [https://x](https://x) — a markdown link pasted straight out of a chat.
  const md = /^\[(\S+)\]\((\S+)\)$/.exec(gia);
  if (md) {
    return {
      viSao: 'đây là một liên kết Markdown, không phải URL',
      suaThanh: md[2],
    };
  }
  if (/^["'].*["']$/.test(gia)) {
    return { viSao: 'giá trị còn kẹp trong dấu nháy', suaThanh: gia.slice(1, -1) };
  }
  if (/\s/.test(gia)) {
    return { viSao: 'giá trị có khoảng trắng', suaThanh: gia.replace(/\s+/g, '') };
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(gia)) {
    return { viSao: 'thiếu phần scheme (https:// , postgresql:// …)', suaThanh: null };
  }
  return { viSao: 'không phân tích được', suaThanh: null };
}

/** Every URL-shaped variable that is set must actually parse. */
function kiemTraUrl() {
  let loi = 0;
  const hong = [];

  for (const khoa of BIEN_URL) {
    const gia = process.env[khoa];
    if (!gia) continue;
    try {
      new URL(gia);
    } catch {
      hong.push([khoa, gia]);
      loi += 1;
    }
  }

  if (hong.length === 0) return 0;

  console.log('  Biến dạng URL');
  for (const [khoa, gia] of hong) {
    const { viSao, suaThanh } = chanDoanUrl(gia);
    console.log(`    ${HONG}  ${khoa} không phải URL hợp lệ — ${viSao}.`);
    if (suaThanh) console.log(`           Sửa thành: ${khoa}=${suaThanh}`);
  }
  console.log('');
  return loi;
}

/**
 * Values the loader had to repair on the way in.
 *
 * A warning rather than an error: the process WILL run, because the value was
 * fixed in memory. But the file on disk is still wrong, and the next tool that
 * reads it without going through this loader — `docker compose`, for one, which
 * parses `.env` itself — will still get the broken version.
 */
function baoCaoDaSua() {
  const sua = ketQua.daSua ?? [];
  if (sua.length === 0) return 0;

  console.log('  Giá trị đã được sửa tạm khi nạp');
  for (const s of sua) {
    const viSao =
      s.kieu === 'markdown' ? 'giá trị đang ở dạng liên kết Markdown' : 'giá trị có dạng lạ';
    console.log(`    ${CANH} ${s.khoa} trong ${s.tep}: ${viSao}.`);
    console.log(`           Đang chạy tạm với: ${s.khoa}=${s.sau}`);
    console.log(`           Hãy sửa hẳn trong ${s.tep} — docker compose đọc tệp đó trực tiếp,`);
    console.log('           không đi qua bộ nạp này, nên vẫn nhận giá trị hỏng.');
  }
  console.log('');
  return sua.length;
}

/**
 * Are there migrations the database has not had applied?
 *
 * A schema one migration behind fails at QUERY time, on whichever page happens
 * to touch the new column first, as "column does not exist" — a message that
 * reads like a code bug rather than a deploy step that was skipped. Asking
 * before anything starts is far cheaper than finding out from a student.
 *
 * `migrate status` exits non-zero for "pending", so the exit code carries the
 * answer and stdout carries the detail.
 */
function kiemTraMigration(dbKetNoiDuoc) {
  if (!process.env['DATABASE_URL']) return 0;

  console.log('  Migration cơ sở dữ liệu');

  /*
   * Skipped rather than guessed when the port probe already failed.
   *
   * Running it anyway would spend 30 seconds timing out and then print a second
   * scary message about the same single fault — and an operator who is told two
   * things are broken starts fixing the wrong one.
   */
  if (!dbKetNoiDuoc) {
    console.log(`    ${CANH} Bỏ qua — chưa kết nối được cơ sở dữ liệu (xem phần trên).`);
    console.log('');
    return 0;
  }

  let ra = '';
  let ma = 0;
  try {
    // execSync, not execFileSync: on Windows `npm` is `npm.cmd` and needs a
    // shell to resolve. Passing the command as ONE string avoids the
    // DEP0190 warning Node emits for execFileSync with `shell: true` — which
    // would otherwise print inside this report and read as a fault of its own.
    //
    // Without a shell at all it threw ENOENT with EMPTY stdout, which this
    // function read as "migrations pending" and sent the operator to run a
    // migration that was not needed.
    ra = execSync('npm run --silent db:status', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
      cwd: GOC_KHO,
    });
  } catch (e) {
    ra = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    ma = e.status ?? 1;
  }

  if (/Database schema is up to date/i.test(ra)) {
    console.log(`    ${OK}    Lược đồ đã cập nhật, không còn migration nào chờ.`);
    console.log('');
    return 0;
  }

  const cho = ra.match(/(\d+)\s+migrations?\s+have not yet been applied/i);
  if (cho) {
    console.log(`    ${HONG}  Còn ${cho[1]} migration chưa chạy.`);
    console.log('           Chạy: npm run db:migrate');
    console.log('');
    return 1;
  }

  if (/P1001|Can't reach database/i.test(ra)) {
    console.log(`    ${CANH} Không kết nối được để kiểm tra — xem phần cổng ở trên.`);
    console.log('');
    return 0;
  }

  if (/have not yet been applied|following migration/i.test(ra)) {
    console.log(`    ${HONG}  Có migration chưa chạy.`);
    console.log('           Chạy: npm run db:migrate');
    console.log('');
    return 1;
  }

  if (/drift|schema is not in sync/i.test(ra)) {
    console.log(`    ${HONG}  Lược đồ trong cơ sở dữ liệu lệch so với thư mục migrations.`);
    console.log('           Xem chi tiết: npm run db:status');
    console.log('');
    return 1;
  }

  console.log(`    ${CANH} Không đọc được trạng thái migration (mã thoát ${ma}).`);
  console.log('           Xem chi tiết: npm run db:status');
  console.log('');
  return 0;
}

async function main() {
  console.log('');
  console.log('  DYE LMS — kiểm tra môi trường');
  console.log('  ' + '─'.repeat(64));
  console.log(
    `  Tệp .env đã đọc: ${ketQua.tepDaDoc.length > 0 ? ketQua.tepDaDoc.join(', ') : mau.vang + 'không có' + mau.het}`,
  );
  console.log('');

  const docker = congDocker();
  if (docker === null) {
    console.log(`  ${mau.mo}Không hỏi được Docker — bỏ qua phần đối chiếu cổng đã công bố.${mau.het}`);
    console.log('');
  }

  let dbKetNoiDuoc = false;
  let loi = kiemTraUrl();
  let canhBao = baoCaoDaSua();

  for (const d of DICH_VU) {
    const congKhaiBao = process.env[d.bienCong] ?? d.congMacDinh;
    const url = process.env[d.bienUrl];
    const congUrl = congTuUrl(url);
    const host = hostTuUrl(url ?? '') ?? 'localhost';

    console.log(`  ${d.ten}`);

    if (!url) {
      console.log(`    ${HONG}  ${d.bienUrl} chưa được đặt.`);
      loi += 1;
      console.log('');
      continue;
    }

    // ── 1. Does the declared host port match the URL the clients dial? ──────
    if (congUrl !== congKhaiBao) {
      console.log(
        `    ${HONG}  ${d.bienCong}=${congKhaiBao} nhưng ${d.bienUrl} trỏ tới cổng ${congUrl}.`,
      );
      console.log(
        `           Docker công bố cổng ${congKhaiBao}, còn ứng dụng gọi vào cổng ${congUrl} — không gặp nhau.`,
      );
      console.log(
        `           Sửa trong .env: đổi cổng trong ${d.bienUrl} thành ${congKhaiBao}, hoặc đặt ${d.bienCong}=${congUrl}.`,
      );
      loi += 1;
    } else {
      console.log(`    ${OK}    ${d.bienCong} và ${d.bienUrl} cùng dùng cổng ${congKhaiBao}.`);
    }

    // ── 2. Is the RUNNING stack actually on that port? ──────────────────────
    if (docker) {
      const khop = [...docker.entries()].filter(([ten]) => ten.includes(d.container));

      if (khop.length === 0) {
        console.log(
          `    ${CANH} Không thấy container nào tên chứa "${d.container}" đang chạy.`,
        );
        console.log(`           Nếu dùng Docker: chạy \`npm run infra:up\`.`);
        canhBao += 1;
      } else {
        for (const [ten, cap] of khop) {
          const congNay = cap.find((c) => c.trong === d.congTrongContainer);
          if (!congNay) continue;

          if (congNay.host !== congKhaiBao) {
            console.log(
              `    ${HONG}  Container ${ten} đang công bố cổng ${congNay.host}, không phải ${congKhaiBao}.`,
            );
            console.log(
              `           Stack đang chạy từ TRƯỚC khi ${d.bienCong} được đổi. Dựng lại:`,
            );
            console.log(`             docker compose up -d --force-recreate ${d.container}`);
            loi += 1;
          } else {
            console.log(
              `    ${OK}    Container ${ten} công bố ${congNay.host}->${congNay.trong}.`,
            );
          }
        }
      }
    }

    // ── 3. Is anything actually answering? ──────────────────────────────────
    const song = await dangNghe(host, congUrl ?? congKhaiBao);
    if (d.bienUrl === 'DATABASE_URL') dbKetNoiDuoc = song;
    if (song) {
      console.log(`    ${OK}    ${host}:${congUrl} có phản hồi.`);
    } else {
      console.log(`    ${HONG}  ${host}:${congUrl} không ai trả lời.`);
      loi += 1;
    }

    console.log('');
  }

  loi += kiemTraMigration(dbKetNoiDuoc);

  console.log('  ' + '─'.repeat(64));
  if (loi === 0 && canhBao === 0) {
    console.log(`  ${mau.xanh}✓${mau.het} Môi trường khớp với các dịch vụ đang chạy.`);
    console.log('');
    return;
  }

  console.log(
    `  ${loi > 0 ? mau.do + '✗' + mau.het : mau.vang + '!' + mau.het} ${loi} lỗi, ${canhBao} cảnh báo.`,
  );
  console.log('');
  if (loi > 0) process.exitCode = 1;
}

await main();
