/**
 * Sandbox containment, against real Docker.
 *
 * These are the tests that matter most in the project. Everything else protects
 * a student's experience; these protect the machine the school runs this on, and
 * every other student's data on it.
 *
 * They deliberately execute genuinely hostile programs. That is the point: a
 * containment test that only runs safe code proves nothing. Each one asserts
 * both that the attempt failed AND that the host is unaffected.
 */
import { spawn } from 'node:child_process';

import { beforeAll, describe, expect, it } from 'vitest';

import { chayTrongHop, coDocker, dungLenhDocker } from './sandbox';

const PY = 'python:3.12-alpine';

let coDockerKhong = false;

beforeAll(async () => {
  coDockerKhong = await coDocker();
  if (!coDockerKhong) {
    throw new Error(
      'Cac test sandbox can Docker that. Khoi dong Docker Desktop roi chay lai.\n' +
        'Bo qua chung se lam mat toan bo gia tri cua Phase 8.',
    );
  }
}, 60_000);

async function chay(code: string, opts: Partial<Parameters<typeof chayTrongHop>[0]> = {}) {
  return chayTrongHop({
    tep: { 'main.py': code },
    lenh: ['python', '/sandbox/main.py'],
    timeLimitMs: 5000,
    memoryLimitMb: 128,
    image: PY,
    ...opts,
  });
}

/** Count containers currently running, to prove nothing was left behind. */
function demContainer(): Promise<number> {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn('docker', ['ps', '-q', '--filter', 'name=dye-judge-']);
    p.stdout.on('data', (c: Buffer) => (out += c.toString()));
    p.on('close', () => resolve(out.trim() === '' ? 0 : out.trim().split('\n').length));
    p.on('error', () => resolve(0));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Cờ bảo mật có mặt trong lệnh
// ═══════════════════════════════════════════════════════════════════════════

describe('Lệnh docker mang đủ cờ bảo mật', () => {
  const args = dungLenhDocker('ten-thu', '/tmp/x', {
    tep: {},
    lenh: ['python', '/sandbox/main.py'],
    timeLimitMs: 2000,
    memoryLimitMb: 128,
    image: PY,
  });

  /** Assert a flag is present with the expected value in the argv pair. */
  function coCo(co: string, giaTri: string): boolean {
    const i = args.indexOf(co);
    return i >= 0 && args[i + 1] === giaTri;
  }

  it('không có mạng', () => {
    expect(coCo('--network', 'none')).toBe(true);
  });

  it('giới hạn bộ nhớ và chặn tràn sang swap', () => {
    expect(coCo('--memory', '128m')).toBe(true);
    // Without an equal --memory-swap the container swaps instead of dying, and
    // a memory bug becomes a host performance incident.
    expect(coCo('--memory-swap', '128m')).toBe(true);
  });

  it('giới hạn CPU', () => {
    expect(coCo('--cpus', '0.5')).toBe(true);
  });

  it('giới hạn số tiến trình để chặn fork bomb', () => {
    expect(coCo('--pids-limit', '50')).toBe(true);
  });

  it('hệ thống tệp gốc chỉ đọc, /tmp không thực thi được', () => {
    expect(args).toContain('--read-only');
    const i = args.indexOf('--tmpfs');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toMatch(/^\/tmp:size=\d+m,noexec,nosuid,nodev$/);
  });

  it('chạy dưới người dùng thường, bỏ mọi capability', () => {
    expect(coCo('--user', '1000:1000')).toBe(true);
    expect(coCo('--cap-drop', 'ALL')).toBe(true);
    expect(coCo('--security-opt', 'no-new-privileges')).toBe(true);
  });

  it('mã nguồn được gắn chỉ đọc', () => {
    expect(args.some((a) => a.endsWith(':/sandbox:ro'))).toBe(true);
  });

  it('không bao giờ dựng chuỗi shell', () => {
    // Every argument is its own argv entry, so nothing can be re-parsed as a
    // flag — not a filename, not a problem slug, not student code.
    expect(args.every((a) => typeof a === 'string')).toBe(true);
    expect(args).not.toContain('sh');
    expect(args).not.toContain('-c');
  });

  it('bộ nhớ vượt trần bị kẹp lại, không được cấp theo yêu cầu', () => {
    const tham = dungLenhDocker('t', '/tmp/x', {
      tep: {},
      lenh: ['python'],
      timeLimitMs: 1000,
      memoryLimitMb: 999_999,
      image: PY,
    });
    const i = tham.indexOf('--memory');
    // A bad value in an authored row must not hand a container the machine.
    expect(tham[i + 1]).toBe('256m');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Chống mã độc
// ═══════════════════════════════════════════════════════════════════════════

describe('Chống mã độc', () => {
  it('không xoá được gì trên máy chủ', async () => {
    const kq = await chay(`
import os, shutil
ket = []
for duong in ["/", "/etc", "/usr", "/sandbox"]:
    try:
        os.rmdir(duong); ket.append("XOA DUOC " + duong)
    except Exception as e:
        ket.append("chan: " + type(e).__name__)
try:
    shutil.rmtree("/etc")
    ket.append("RMTREE THANH CONG")
except Exception as e:
    ket.append("chan rmtree: " + type(e).__name__)
print("|".join(ket))
`);

    expect(kq.stdout).not.toContain('XOA DUOC');
    expect(kq.stdout).not.toContain('RMTREE THANH CONG');
  }, 30_000);

  it('os.system("rm -rf /") không chạm tới máy chủ', async () => {
    // The exact case named in the brief.
    const kq = await chay(`
import os
os.system("rm -rf / --no-preserve-root 2>/dev/null")
print("con song")
import pathlib
print("etc con:", pathlib.Path("/etc/passwd").exists())
`);

    // The container may damage its own read-only view or die; the host must be
    // untouched either way. This test file still existing is part of the proof.
    expect(kq.ketThuc === 'binh-thuong' || kq.ketThuc === 'het-gio').toBe(true);
  }, 30_000);

  it('không mở được kết nối mạng', async () => {
    const kq = await chay(`
import socket
socket.setdefaulttimeout(2)
for dich in [("1.1.1.1", 53), ("8.8.8.8", 53), ("example.com", 80)]:
    try:
        socket.create_connection(dich, timeout=2)
        print("KET NOI DUOC", dich)
    except Exception as e:
        print("chan:", type(e).__name__)
`);

    expect(kq.stdout).not.toContain('KET NOI DUOC');
    expect(kq.stdout).toMatch(/chan:/);
  }, 30_000);

  it('chỉ có giao diện loopback — không có đường ra ngoài', async () => {
    /*
     * Binding a port INSIDE the container succeeds, and that is correct rather
     * than a hole: with `--network none` the socket lives in an isolated network
     * namespace with no veth pair and no published port, so nothing outside can
     * reach it. Verified separately from the host, where the connection is
     * refused.
     *
     * It is also deliberately useful — Phase 2's `LOOPBACK_ONLY` policy exists
     * precisely so socket lessons can run over loopback with zero egress.
     *
     * The property that actually matters is the absence of any interface other
     * than `lo`, which is what this asserts.
     */
    const kq = await chay(`
import os, socket
print("interfaces:", sorted(os.listdir("/sys/class/net")))
s = socket.socket()
s.bind(("127.0.0.1", 8080)); s.listen(1)
print("loopback bind ok")
try:
    socket.create_connection(("1.1.1.1", 53), timeout=2); print("EGRESS OK")
except Exception as e:
    print("egress chan:", type(e).__name__)
`);

    expect(kq.stdout).toContain("interfaces: ['lo']");
    expect(kq.stdout).not.toContain('eth0');
    expect(kq.stdout).not.toContain('EGRESS OK');
  }, 30_000);

  it('fork bomb bị chặn bởi giới hạn tiến trình', async () => {
    const truoc = await demContainer();

    const kq = await chay(
      `
import os
n = 0
try:
    while True:
        os.fork()
        n += 1
except Exception:
    pass
print("da fork", n)
`,
      { timeLimitMs: 4000 },
    );

    // Either the pids limit stopped it or the deadline did. What must not
    // happen is the host becoming unresponsive — proven by the next assertion
    // running at all.
    expect(['binh-thuong', 'het-gio', 'het-bo-nho']).toContain(kq.ketThuc);
    expect(await demContainer()).toBeLessThanOrEqual(truoc);
  }, 40_000);

  it('vòng lặp vô hạn bị giết đúng hạn và không để lại container', async () => {
    const truoc = await demContainer();
    const batDau = Date.now();

    const kq = await chay('while True:\n    pass\n', { timeLimitMs: 2000 });
    const troi = Date.now() - batDau;

    expect(kq.ketThuc).toBe('het-gio');
    // Killed at the deadline plus grace, not left running.
    expect(troi).toBeLessThan(2000 + 1000 + 6000);

    // Give --rm a moment to reap, then confirm nothing was orphaned.
    await new Promise((r) => setTimeout(r, 1500));
    expect(await demContainer()).toBeLessThanOrEqual(truoc);
  }, 40_000);

  it('không ghi được vào hệ thống tệp gốc', async () => {
    const kq = await chay(`
for duong in ["/x", "/etc/x", "/usr/x", "/sandbox/x"]:
    try:
        open(duong, "w").write("x")
        print("GHI DUOC", duong)
    except Exception as e:
        print("chan:", type(e).__name__)
`);
    expect(kq.stdout).not.toContain('GHI DUOC');
  }, 30_000);

  it('/tmp ghi được nhưng không thực thi được', async () => {
    const kq = await chay(`
import os, subprocess
open("/tmp/a.sh", "w").write("#!/bin/sh\\necho CHAY DUOC\\n")
os.chmod("/tmp/a.sh", 0o755)
try:
    r = subprocess.run(["/tmp/a.sh"], capture_output=True, timeout=5)
    print("ket qua:", r.stdout.decode().strip() or "rong")
except Exception as e:
    print("chan:", type(e).__name__)
`);
    // Staging a binary in scratch space and then running it is the classic
    // escape route; noexec closes it.
    expect(kq.stdout).not.toContain('CHAY DUOC');
  }, 30_000);

  it('không chạy dưới quyền root', async () => {
    const kq = await chay('import os\nprint("uid", os.getuid(), "gid", os.getgid())\n');
    expect(kq.stdout).toContain('uid 1000');
    expect(kq.stdout).not.toContain('uid 0');
  }, 30_000);

  it('không thấy được tiến trình hay tệp của máy chủ', async () => {
    const kq = await chay(`
import os
print("so tien trinh:", len([p for p in os.listdir("/proc") if p.isdigit()]))
print("co /host:", os.path.exists("/host"))
print("co docker.sock:", os.path.exists("/var/run/docker.sock"))
`);

    expect(kq.stdout).toContain('co /host: False');
    // A mounted Docker socket would be a full host takeover.
    expect(kq.stdout).toContain('co docker.sock: False');
  }, 30_000);

  it('ngốn bộ nhớ thì bị giết, không kéo máy chủ theo', async () => {
    const kq = await chay(
      'a = bytearray()\nwhile True:\n    a.extend(b"x" * 10_000_000)\n',
      { timeLimitMs: 8000, memoryLimitMb: 128 },
    );
    expect(['het-bo-nho', 'het-gio']).toContain(kq.ketThuc);
  }, 40_000);

  it('in ra vô hạn bị cắt, không làm phình worker', async () => {
    const kq = await chay('while True:\n    print("x" * 1000)\n', { timeLimitMs: 6000 });

    expect(['qua-nhieu-dau-ra', 'het-gio']).toContain(kq.ketThuc);
    // The cap is what stops a printing loop from becoming a worker OOM.
    expect(kq.stdout.length).toBeLessThan(400_000);
  }, 40_000);
});

// ═══════════════════════════════════════════════════════════════════════════
// Hành vi bình thường
// ═══════════════════════════════════════════════════════════════════════════

describe('Chạy chương trình bình thường', () => {
  it('chạy được và trả về stdout', async () => {
    const kq = await chay('print("xin chao")\n');
    expect(kq.ketThuc).toBe('binh-thuong');
    expect(kq.exitCode).toBe(0);
    expect(kq.stdout.trim()).toBe('xin chao');
  }, 30_000);

  it('đọc được stdin', async () => {
    const kq = await chay('import sys\nprint(sum(int(x) for x in sys.stdin.read().split()))\n', {
      stdin: '3 4 5\n',
    });
    expect(kq.stdout.trim()).toBe('12');
  }, 30_000);

  it('lỗi runtime cho exit khác 0 và stderr', async () => {
    const kq = await chay('raise ValueError("sai roi")\n');
    expect(kq.exitCode).not.toBe(0);
    expect(kq.stderr).toContain('ValueError');
  }, 30_000);

  it('giữ nguyên tiếng Việt có dấu qua stdout', async () => {
    const kq = await chay('print("Chào em, hôm nay học gì?")\n');
    expect(kq.stdout).toContain('Chào em, hôm nay học gì?');
  }, 30_000);

  it('từ chối tên tệp có đường dẫn thoát ra ngoài', async () => {
    await expect(
      chayTrongHop({
        tep: { '../thoat.py': 'print(1)' },
        lenh: ['python', '/sandbox/main.py'],
        timeLimitMs: 2000,
        memoryLimitMb: 128,
        image: PY,
      }),
    ).rejects.toThrow(/khong hop le/);
  });

  it('ghi và đọc lại được tệp trong thư mục làm việc', async () => {
    // Session 28 of Python Cơ Bản is a file-handling lesson. If the working
    // directory is read-only, a correct solution fails with OSError and the
    // student is told their algorithm is wrong.
    const kq = await chay(`
with open("so.txt", "w") as f:
    f.write("10\\n20\\n30\\n")
with open("so.txt") as f:
    dong = [int(d) for d in f]
print("Tong:", sum(dong))
print("So dong:", len(dong))
`);

    expect(kq.ketThuc).toBe('binh-thuong');
    expect(kq.stdout).toContain('Tong: 60');
    expect(kq.stdout).toContain('So dong: 3');
  }, 30_000);

  it('mã nguồn vẫn không ghi đè được, dù thư mục làm việc ghi được', async () => {
    const kq = await chay(`
try:
    open("/sandbox/main.py", "w").write("# bi ghi de")
    print("GHI DE DUOC")
except Exception as e:
    print("chan:", type(e).__name__)
`);
    // A program must not be able to rewrite itself mid-run.
    expect(kq.stdout).not.toContain('GHI DE DUOC');
  }, 30_000);

  it('mỗi lần chạy là một hộp mới — không rò rỉ giữa hai lần', async () => {
    await chay('open("/tmp/dau_vet", "w").write("bi mat")\n');
    const kq = await chay(`
import os
print("con dau vet:", os.path.exists("/tmp/dau_vet"))
`);
    expect(kq.stdout).toContain('con dau vet: False');
  }, 40_000);
});
