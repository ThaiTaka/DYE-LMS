/**
 * The sandbox: the only place in this system that executes code a child wrote.
 *
 * ── Threat model ─────────────────────────────────────────────────────────────
 * The code is not assumed to be hostile on purpose — it is written by 12-year-olds
 * — but it must be treated exactly as if it were. A student who pastes something
 * from the internet, or a compromised account, or simply a runaway `while True`,
 * all arrive here as "untrusted program". The container is the boundary, and the
 * flags below are the boundary's whole substance.
 *
 * ── What is enforced, and why each one ───────────────────────────────────────
 *   --network none              no egress, no sockets, no DNS. Verified by test.
 *   --memory / --memory-swap    equal values, so the process cannot escape the
 *                               cap into swap and thrash the host instead.
 *   --cpus                      one runaway loop must not starve the machine.
 *   --pids-limit                defeats fork bombs. Without it, `os.fork()` in a
 *                               loop takes down the host, not the container.
 *   --read-only                 no writes to the image filesystem.
 *   --tmpfs /tmp noexec,nosuid  scratch space that cannot be used to stage and
 *                               then run a second binary.
 *   --user 1000:1000            never root, even inside the container.
 *   --cap-drop ALL              no capabilities at all.
 *   --security-opt no-new-privileges
 *                               setuid binaries cannot raise privileges.
 *   -v ...:ro                   the student's own code is mounted read-only, so
 *                               a program cannot rewrite itself mid-run.
 *
 * ── Two things this deliberately does NOT do ─────────────────────────────────
 * It never builds a shell string. Every argument is a separate argv entry, so no
 * amount of creativity in a filename or a problem slug can inject a flag.
 *
 * It never trusts the container to stop itself. `timeout` inside the container
 * can be ignored; the kill is issued from here, by name, from the host.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GIOI_HAN } from './config';

export type KetThuc =
  | 'binh-thuong'
  | 'het-gio'
  | 'het-bo-nho'
  | 'qua-nhieu-dau-ra'
  | 'khong-chay-duoc';

export interface KetQuaChay {
  ketThuc: KetThuc;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Wall-clock milliseconds, measured on the host around the container. */
  thoiGianMs: number;
  /** True when output was cut at the cap. */
  daCatBot: boolean;
}

export interface YeuCauChay {
  /** Files written into the sandbox directory. Keys are relative filenames. */
  tep: Record<string, string>;
  /** argv INSIDE the container, e.g. ['python', '/sandbox/main.py']. */
  lenh: string[];
  stdin?: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  image: string;
  /**
   * Network policy. Anything other than 'none' must have been authorised by a
   * teacher upstream; this function refuses to widen it on its own.
   */
  mang?: 'none' | 'loopback';
  /**
   * Output cap for this run. Defaults to the global limit.
   *
   * PERFORMANCE problems raise it: a sorting exercise at N = 100 000 prints
   * roughly 800 KB by design, and failing it for that would be the judge
   * misunderstanding the exercise rather than the student getting it wrong.
   */
  gioiHanDauRaByte?: number;
}

/** Docker image for each seeded RuntimeImage value. */
export const ANH_CHAY: Record<string, string> = {
  PY_BASE: 'python:3.12-alpine',
  PY_TEST: 'dye-judge-pytest:3.12',
  PY_WEB: 'dye-judge-web:3.12',
};

/**
 * Build the argv for `docker run`.
 *
 * Exported so the security flags can be asserted directly in tests. A test that
 * only checks behaviour would pass if `--network none` were silently dropped on
 * a platform where the sandbox still happened to have no route out.
 */
export function dungLenhDocker(
  ten: string,
  thuMuc: string,
  yeuCau: YeuCauChay,
): string[] {
  const boNho = Math.max(
    GIOI_HAN.BO_NHO_TOI_THIEU_MB,
    Math.min(yeuCau.memoryLimitMb || GIOI_HAN.BO_NHO_MAC_DINH_MB, GIOI_HAN.BO_NHO_TOI_DA_MB),
  );

  return [
    'run',
    '--rm',
    '-i',
    '--name',
    ten,

    // ── Isolation ──────────────────────────────────────────────────────────
    '--network',
    yeuCau.mang === 'loopback' ? 'none' : 'none',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    '1000:1000',

    // ── Resources ──────────────────────────────────────────────────────────
    '--memory',
    `${boNho}m`,
    // Equal to --memory: without this the container swaps instead of being
    // killed, and a memory bug becomes a host performance incident.
    '--memory-swap',
    `${boNho}m`,
    '--cpus',
    String(GIOI_HAN.CPU),
    '--pids-limit',
    String(GIOI_HAN.PIDS),

    // ── Filesystem ─────────────────────────────────────────────────────────
    '--read-only',
    '--tmpfs',
    `/tmp:size=${GIOI_HAN.TMPFS_MB}m,noexec,nosuid,nodev`,
    '-v',
    `${thuMuc}:/sandbox:ro`,
    /*
     * Working directory is the writable tmpfs, NOT the read-only code mount.
     *
     * Session 28 of Python Cơ Bản teaches file handling — `open("so.txt", "w")`
     * is the exercise. With the cwd on a read-only mount, a correct solution
     * fails with OSError and the student is told their algorithm is wrong.
     *
     * This costs nothing in containment: /tmp is a size-capped tmpfs mounted
     * noexec,nosuid,nodev and destroyed with the container. Imports still
     * resolve because Python puts the SCRIPT's directory on sys.path, not the
     * cwd, and the script lives in /sandbox.
     */
    '--workdir',
    '/tmp',

    // ── Python hygiene ─────────────────────────────────────────────────────
    // The rootfs is read-only, so bytecode writing would fail noisily.
    '-e',
    'PYTHONDONTWRITEBYTECODE=1',
    // Without this, output buffered at kill time is lost — and the output of a
    // program we had to kill is exactly the output worth having.
    '-e',
    'PYTHONUNBUFFERED=1',
    '-e',
    'HOME=/tmp',

    yeuCau.image,
    ...yeuCau.lenh,
  ];
}

/** Host path in the form the local Docker daemon expects. */
function duongDanHost(p: string): string {
  // Docker Desktop on Windows accepts a native path in -v; POSIX needs none.
  return p;
}

/**
 * Run one program in a fresh container.
 *
 * Always cleans up: the temp directory is removed in `finally`, and the
 * container is killed by name if it outlived its deadline. `--rm` handles the
 * ordinary case; the explicit kill handles the case that matters.
 */
export async function chayTrongHop(yeuCau: YeuCauChay): Promise<KetQuaChay> {
  const ten = `dye-judge-${randomBytes(8).toString('hex')}`;
  const thuMuc = await mkdtemp(join(tmpdir(), 'dye-judge-'));

  try {
    for (const [tenTep, noiDung] of Object.entries(yeuCau.tep)) {
      // Defence in depth: filenames come from this codebase, never from a
      // student, but a traversal here would write outside the sandbox dir.
      if (tenTep.includes('..') || tenTep.includes('/') || tenTep.includes('\\')) {
        throw new Error(`ten tep khong hop le: ${tenTep}`);
      }
      await writeFile(join(thuMuc, tenTep), noiDung, 'utf8');
    }

    const args = dungLenhDocker(ten, duongDanHost(thuMuc), yeuCau);
    return await thucThi(ten, args, yeuCau);
  } finally {
    await rm(thuMuc, { recursive: true, force: true }).catch(() => undefined);
  }
}

function thucThi(ten: string, args: string[], yeuCau: YeuCauChay): Promise<KetQuaChay> {
  return new Promise<KetQuaChay>((resolve) => {
    const batDau = Date.now();

    // argv array, never a shell string: nothing here can be re-parsed as a flag.
    const con = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let daCatBot = false;
    let hetGio = false;
    let xong = false;

    const capDauRa = yeuCau.gioiHanDauRaByte ?? GIOI_HAN.DAU_RA_BYTE;

    const gom = (chunk: Buffer, vao: 'out' | 'err'): void => {
      const s = chunk.toString('utf8');
      if (vao === 'out') {
        if (stdout.length + s.length > capDauRa) {
          stdout += s.slice(0, Math.max(0, capDauRa - stdout.length));
          daCatBot = true;
          // A program printing in an infinite loop must not fill the worker's
          // heap while we wait for its deadline.
          giet();
        } else {
          stdout += s;
        }
      } else if (stderr.length < GIOI_HAN.LOI_BYTE) {
        stderr += s.slice(0, GIOI_HAN.LOI_BYTE - stderr.length);
      }
    };

    con.stdout.on('data', (c: Buffer) => gom(c, 'out'));
    con.stderr.on('data', (c: Buffer) => gom(c, 'err'));

    /** Kill from the HOST, by container name. The container is not asked nicely. */
    const giet = (): void => {
      spawn('docker', ['kill', ten], { stdio: 'ignore' }).on('error', () => undefined);
    };

    const dongHo = setTimeout(() => {
      hetGio = true;
      giet();
      // Backstop: if `docker kill` itself is wedged, stop waiting on the client.
      setTimeout(() => {
        if (!xong) {
          con.kill('SIGKILL');
        }
      }, GIOI_HAN.CHO_SAU_KHI_GIET_MS);
    }, yeuCau.timeLimitMs + GIOI_HAN.AN_HAN_MS);

    con.on('error', () => {
      if (xong) return;
      xong = true;
      clearTimeout(dongHo);
      resolve({
        ketThuc: 'khong-chay-duoc',
        exitCode: null,
        stdout,
        stderr,
        thoiGianMs: Date.now() - batDau,
        daCatBot,
      });
    });

    con.on('close', (code) => {
      if (xong) return;
      xong = true;
      clearTimeout(dongHo);

      const thoiGianMs = Date.now() - batDau;

      let ketThuc: KetThuc;
      if (hetGio) {
        ketThuc = 'het-gio';
      } else if (daCatBot) {
        ketThuc = 'qua-nhieu-dau-ra';
      } else if (code === 137) {
        // 137 = 128 + SIGKILL. We did not issue a kill, so this is the cgroup
        // OOM killer. Distinguishing it from our own timeout kill is the whole
        // reason `hetGio` is tracked.
        ketThuc = 'het-bo-nho';
      } else if (code === 125) {
        // Docker itself refused to start the container.
        ketThuc = 'khong-chay-duoc';
      } else {
        ketThuc = 'binh-thuong';
      }

      resolve({ ketThuc, exitCode: code, stdout, stderr, thoiGianMs, daCatBot });
    });

    if (yeuCau.stdin !== undefined) con.stdin.write(yeuCau.stdin);
    con.stdin.end();
  });
}

/** Is a working Docker daemon reachable? Used to skip sandbox tests cleanly. */
export async function coDocker(): Promise<boolean> {
  return new Promise((resolve) => {
    const con = spawn('docker', ['version', '--format', '{{.Server.Version}}'], {
      stdio: 'ignore',
    });
    con.on('error', () => resolve(false));
    con.on('close', (code) => resolve(code === 0));
  });
}
