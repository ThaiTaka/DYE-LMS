/**
 * Project workspace engine, against real Postgres.
 *
 * Covers the mandated structure case — a student creates `main.py` and
 * `assets/player.png` and the system stores and retrieves that shape — plus the
 * version lifecycle that makes teacher feedback point at bytes which cannot
 * change afterwards.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenError } from './errors';
import {
  bamNoiDung,
  banLamViec,
  danhSachTep,
  doiTenTep,
  ghiNhanXet,
  ghiTep,
  khoaLuuTru,
  moDuAn,
  moDuAnDeSua,
  nopMoc,
  taoDuAn,
  xoaTep,
  type KhoLuuTru,
} from './projects';
import { GIOI_HAN_TEP_BYTE, SO_TEP_TOI_DA } from './upload-guard';
import { actorFor, createFixture, type Fixture } from './testing/fixtures';

import type { Actor } from './session';

/** In-memory blob store: the port is real, the backend is not the thing tested. */
function khoTam(): KhoLuuTru & { so: () => number } {
  const map = new Map<string, Uint8Array>();
  return {
    ghi: async (k, d) => void map.set(k, d),
    doc: async (k) => map.get(k) ?? null,
    xoa: async (k) => void map.delete(k),
    so: () => map.size,
  };
}

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]);
const chu = (s: string): Uint8Array => new TextEncoder().encode(s);

let fx: Fixture;
let kho: ReturnType<typeof khoTam>;
let hocSinh: Actor;
let giaoVienA: Actor;
let giaoVienB: Actor;
let projectId: string;
let versionId: string;
let pygameCourseId: string;

beforeAll(async () => {
  fx = await createFixture();
  hocSinh = await actorFor(fx.db, fx.studentA1);
  giaoVienA = await actorFor(fx.db, fx.teacherA);
  giaoVienB = await actorFor(fx.db, fx.teacherB);

  const pygame = await fx.db.course.findUniqueOrThrow({
    where: { slug: 'lap-trinh-game-pygame' },
    select: { id: true },
  });
  pygameCourseId = pygame.id;
});

beforeEach(async () => {
  kho = khoTam();
  await fx.db.gameProject.deleteMany({ where: { studentId: fx.studentA1 } });

  const duAn = await taoDuAn(fx.db, fx.studentA1, pygameCourseId, 'Trò chơi của em', 'PONG');
  projectId = duAn.id;
  versionId = (await banLamViec(fx.db, projectId)).versionId;
});

afterAll(async () => {
  await fx.db.gameProject.deleteMany({ where: { studentId: { in: [fx.studentA1, fx.studentA2] } } });
  await fx.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════

describe('Tạo dự án', () => {
  it('tạo kèm một bản làm việc rỗng', async () => {
    const ban = await banLamViec(fx.db, projectId);
    expect(ban.version).toBe(1);
    expect(ban.soTep).toBe(0);
  });

  it('gọi banLamViec nhiều lần vẫn ra cùng một bản', async () => {
    const a = await banLamViec(fx.db, projectId);
    const b = await banLamViec(fx.db, projectId);
    expect(b.versionId).toBe(a.versionId);
  });

  it('tên rỗng thì lấy tên mẫu', async () => {
    const d = await taoDuAn(fx.db, fx.studentA2, pygameCourseId, '   ', 'MAZE');
    const row = await fx.db.gameProject.findUniqueOrThrow({
      where: { id: d.id },
      select: { title: true },
    });
    expect(row.title).toBe('Mê cung kho báu');
    await fx.db.gameProject.delete({ where: { id: d.id } });
  });
});

describe('Cấu trúc tệp', () => {
  it('lưu và đọc lại đúng cấu trúc main.py + assets/player.png', async () => {
    // The mandated structure case.
    const a = await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    const b = await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);

    const tep = await danhSachTep(fx.db, versionId);
    expect(tep.map((t) => t.path)).toEqual(['assets/player.png', 'main.py']);

    const anh = tep.find((t) => t.path === 'assets/player.png')!;
    expect(anh.sniffedMime).toBe('image/png');
    expect(anh.sizeBytes).toBe(PNG.length);
    expect(anh.suaDuoc).toBe(false);

    const code = tep.find((t) => t.path === 'main.py')!;
    expect(code.suaDuoc).toBe(true);
  });

  it('giữ nguyên byte của tệp nhị phân', async () => {
    await ghiTep(fx.db, kho, versionId, 'am-thanh/bum.wav', WAV);
    const tep = (await danhSachTep(fx.db, versionId))[0]!;

    const lai = await kho.doc(tep.storageKey);
    expect(lai).not.toBeNull();
    expect(Array.from(lai!)).toEqual(Array.from(WAV));
  });

  it('khoá lưu trữ suy ra từ nội dung, KHÔNG từ tên tệp học sinh đặt', async () => {
    await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);
    const tep = (await danhSachTep(fx.db, versionId))[0]!;

    expect(tep.sha256).toBe(bamNoiDung(PNG));
    expect(tep.storageKey).toBe(khoaLuuTru(tep.sha256));
    // No part of the student's chosen name reaches the storage layer.
    expect(tep.storageKey).not.toContain('player');
    expect(tep.storageKey).not.toContain('assets');
  });

  it('hai tệp cùng nội dung dùng chung một blob', async () => {
    await ghiTep(fx.db, kho, versionId, 'a.png', PNG);
    await ghiTep(fx.db, kho, versionId, 'assets/b.png', PNG);

    expect((await danhSachTep(fx.db, versionId))).toHaveLength(2);
    expect(kho.so()).toBe(1);
  });

  it('ghi đè tệp cùng đường dẫn thay vì tạo bản trùng', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('print(1)\n'));
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('print(2)\n'));

    const tep = await danhSachTep(fx.db, versionId);
    expect(tep).toHaveLength(1);

    const noiDung = await kho.doc(tep[0]!.storageKey);
    expect(new TextDecoder().decode(noiDung!)).toBe('print(2)\n');
  });

  it('xoá được tệp', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('print(1)\n'));
    expect(await xoaTep(fx.db, versionId, 'main.py')).toBe(true);
    expect(await danhSachTep(fx.db, versionId)).toHaveLength(0);
  });

  it('xoá tệp KHÔNG xoá blob — bản đã nộp có thể đang dùng chung', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('print(1)\n'));
    const truoc = kho.so();
    await xoaTep(fx.db, versionId, 'main.py');

    // Deleting the blob here would silently corrupt a frozen snapshot a teacher
    // already reviewed.
    expect(kho.so()).toBe(truoc);
  });

  it('đổi tên giữ nguyên nội dung', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('print(1)\n'));
    const kq = await doiTenTep(fx.db, versionId, 'main.py', 'tro-choi.py');

    expect(kq.ok).toBe(true);
    expect(kq.tep?.path).toBe('tro-choi.py');
    expect(kq.tep?.sha256).toBe(bamNoiDung(chu('print(1)\n')));
  });

  it('đổi tên KHÔNG được đổi đuôi tệp', async () => {
    await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);
    const kq = await doiTenTep(fx.db, versionId, 'assets/player.png', 'assets/player.py');

    // Otherwise renaming is a way to turn an image into something the editor
    // treats as a script.
    expect(kq.ok).toBe(false);
  });

  it('đổi tên sang tên đã tồn tại bị từ chối', async () => {
    await ghiTep(fx.db, kho, versionId, 'a.py', chu('print(1)\n'));
    await ghiTep(fx.db, kho, versionId, 'b.py', chu('print(2)\n'));

    expect((await doiTenTep(fx.db, versionId, 'a.py', 'b.py')).ok).toBe(false);
  });
});

describe('Từ chối tệp xấu ngay ở tầng nghiệp vụ', () => {
  it('không ghi gì khi tệp bị từ chối', async () => {
    const kq = await ghiTep(fx.db, kho, versionId, 'x.exe', new Uint8Array([0x4d, 0x5a, 0x90]));

    expect(kq.ok).toBe(false);
    // Refused means no blob, no row, no half-created folder.
    expect(kho.so()).toBe(0);
    expect(await danhSachTep(fx.db, versionId)).toHaveLength(0);
  });

  it('chặn thoát thư mục', async () => {
    const kq = await ghiTep(fx.db, kho, versionId, '../../../etc/passwd', chu('x'));
    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('duong-dan');
  });

  it('chặn khi vượt quá số tệp tối đa', async () => {
    for (let i = 0; i < SO_TEP_TOI_DA; i += 1) {
      await ghiTep(fx.db, kho, versionId, `t${i}.py`, chu(`# ${i}\n`));
    }
    const kq = await ghiTep(fx.db, kho, versionId, 'them.py', chu('# them\n'));

    expect(kq.ok).toBe(false);
    expect(kq.ma).toBe('qua-nhieu-tep');
  });

  it('ghi đè tệp cũ không tính thêm vào hạn mức', async () => {
    const to = new Uint8Array(GIOI_HAN_TEP_BYTE);
    to.set(PNG, 0);

    expect((await ghiTep(fx.db, kho, versionId, 'a.png', to)).ok).toBe(true);
    // Replacing frees the old bytes, so the same-size replacement fits.
    expect((await ghiTep(fx.db, kho, versionId, 'a.png', to)).ok).toBe(true);
  });
});

describe('Nộp mốc', () => {
  it('đóng băng bản hiện tại và mở bản mới', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);

    const kq = await nopMoc(fx.db, projectId, 'Xong phần di chuyển');

    expect(kq.ok).toBe(true);
    expect(kq.versionDaNop).toBe(1);
    expect(kq.versionMoi).toBe(2);

    const daNop = await fx.db.projectVersion.findFirstOrThrow({
      where: { projectId, version: 1 },
      select: { submittedAt: true, note: true, files: { select: { path: true } } },
    });
    expect(daNop.submittedAt).not.toBeNull();
    expect(daNop.note).toBe('Xong phần di chuyển');
    expect(daNop.files).toHaveLength(2);
  });

  it('bản mới mang theo đúng các tệp cũ', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);
    await nopMoc(fx.db, projectId, '');

    const ban2 = await banLamViec(fx.db, projectId);
    const tep = await danhSachTep(fx.db, ban2.versionId);

    // The student carries on from where they were, not from an empty folder.
    expect(tep.map((t) => t.path)).toEqual(['assets/player.png', 'main.py']);
  });

  it('sửa bản mới KHÔNG làm đổi bản đã nộp', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('BAN GOC\n'));
    await nopMoc(fx.db, projectId, '');

    const ban2 = await banLamViec(fx.db, projectId);
    await ghiTep(fx.db, kho, ban2.versionId, 'main.py', chu('DA SUA\n'));

    const cu = await fx.db.projectVersion.findFirstOrThrow({
      where: { projectId, version: 1 },
      select: { files: { select: { storageKey: true, path: true } } },
    });
    const noiDung = await kho.doc(cu.files.find((f) => f.path === 'main.py')!.storageKey);

    // Teacher feedback must point at bytes that cannot change under them.
    expect(new TextDecoder().decode(noiDung!)).toBe('BAN GOC\n');
  });

  it('dự án rỗng không nộp được', async () => {
    const kq = await nopMoc(fx.db, projectId, '');
    expect(kq.ok).toBe(false);
    expect(kq.lyDo).toContain('chưa có tệp');
  });

  it('dự án không có tệp .py nào thì không nộp được', async () => {
    await ghiTep(fx.db, kho, versionId, 'assets/player.png', PNG);
    const kq = await nopMoc(fx.db, projectId, '');

    expect(kq.ok).toBe(false);
    expect(kq.lyDo).toContain('.py');
  });

  it('nộp xong thì trạng thái dự án là SUBMITTED', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await nopMoc(fx.db, projectId, '');

    const row = await fx.db.gameProject.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(row.status).toBe('SUBMITTED');
  });
});

describe('Quyền truy cập dự án', () => {
  it('chủ sở hữu mở và sửa được', async () => {
    expect((await moDuAn(fx.db, hocSinh, projectId)).id).toBe(projectId);
    expect((await moDuAnDeSua(fx.db, hocSinh, projectId)).id).toBe(projectId);
  });

  it('giáo viên dạy em đó xem được nhưng KHÔNG sửa', async () => {
    expect((await moDuAn(fx.db, giaoVienA, projectId)).id).toBe(projectId);
    // A teacher reviews; they do not edit a child's work under their name.
    await expect(moDuAnDeSua(fx.db, giaoVienA, projectId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('giáo viên KHÔNG dạy em đó thì không xem được', async () => {
    await expect(moDuAn(fx.db, giaoVienB, projectId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh khác không xem được', async () => {
    const khac = await actorFor(fx.db, fx.studentA2);
    await expect(moDuAn(fx.db, khac, projectId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('id không tồn tại bị từ chối chứ không báo "không tìm thấy"', async () => {
    // Which ids exist is itself information.
    await expect(moDuAn(fx.db, hocSinh, 'khong-co-that')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('tài khoản bị vô hiệu hoá mất quyền ngay', async () => {
    const treo: Actor = { ...hocSinh, isActive: false };
    await expect(moDuAn(fx.db, treo, projectId)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('Nhận xét của giáo viên', () => {
  it('ghi được nhận xét lên bản đã nộp và đổi trạng thái', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await nopMoc(fx.db, projectId, '');

    const banDaNop = await fx.db.projectVersion.findFirstOrThrow({
      where: { projectId, version: 1 },
      select: { id: true },
    });

    await ghiNhanXet(fx.db, giaoVienA, banDaNop.id, 'Em làm tốt phần điều khiển.', 'APPROVED');

    const fb = await fx.db.feedback.findFirst({
      where: { projectVersionId: banDaNop.id },
      select: { comment: true, authorId: true },
    });
    expect(fb?.comment).toContain('làm tốt');
    expect(fb?.authorId).toBe(fx.teacherA);

    const duAn = await fx.db.gameProject.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    });
    expect(duAn.status).toBe('APPROVED');
  });

  it('không nhận xét được bản chưa nộp', async () => {
    // Commenting on a draft would be commenting on bytes the student is still
    // changing.
    await expect(
      ghiNhanXet(fx.db, giaoVienA, versionId, 'x', 'APPROVED'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('học sinh không tự nhận xét dự án của mình', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await nopMoc(fx.db, projectId, '');
    const banDaNop = await fx.db.projectVersion.findFirstOrThrow({
      where: { projectId, version: 1 },
      select: { id: true },
    });

    await expect(
      ghiNhanXet(fx.db, hocSinh, banDaNop.id, 'tu khen', 'APPROVED'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('giáo viên không dạy em đó thì không nhận xét được', async () => {
    await ghiTep(fx.db, kho, versionId, 'main.py', chu('import pygame\n'));
    await nopMoc(fx.db, projectId, '');
    const banDaNop = await fx.db.projectVersion.findFirstOrThrow({
      where: { projectId, version: 1 },
      select: { id: true },
    });

    await expect(
      ghiNhanXet(fx.db, giaoVienB, banDaNop.id, 'x', 'APPROVED'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
