// @vitest-environment node
/**
 * The .hex upload endpoint's guards.
 *
 * Runs under Node, not jsdom: a route handler executes in the Node runtime,
 * and under jsdom `Request.formData()` cannot parse multipart at all — the
 * runtime's parser (undici) asserts on jsdom's `File` / `FormData` globals.
 * For the same reason the route never tests `instanceof File`.
 *
 * The storage-and-database half (`nhanTepHex`) is exercised against a real
 * database by the @dye/core tests for `nopBaiMicrobitHex`; here it is a stub.
 * What is under test is everything the route decides BEFORE calling it — who
 * may post, from where, how big, whether a hand-in is still available — and
 * that every answer, refusal included, is a JSON `KetQuaNop` the upload
 * component can read a sentence out of.
 *
 * The access gate (`moKhoiCode`, `kiemTraConLuot`) is stubbed the same way:
 * both are exercised against a real database in @dye/core; here what matters
 * is that the route calls them before reading the body and turns a refusal
 * into the right status with the rule's own sentence.
 */
import { ForbiddenError, GIOI_HAN_HEX_BYTE, HetLuotNopError } from '@dye/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actorStub = vi.hoisted(() => vi.fn());
const nhanStub = vi.hoisted(() => vi.fn());
const moKhoiStub = vi.hoisted(() => vi.fn());
const conLuotStub = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ currentActor: actorStub }));
vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@dye/core', async () => {
  const that = await vi.importActual<typeof Core>('@dye/core');
  return { ...that, moKhoiCode: moKhoiStub, kiemTraConLuot: conLuotStub };
});
vi.mock('@/lib/nop-hex', async () => {
  const that = await vi.importActual<typeof NopHex>('@/lib/nop-hex');
  return { LOI_HEX_CHU: that.LOI_HEX_CHU, nhanTepHex: nhanStub };
});
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { xoaGioiHanChoKiemThu } from '@/lib/gioi-han-toc-do';

import { POST } from './route';

import type * as Core from '@dye/core';
import type * as NopHex from '@/lib/nop-hex';

const HOC_SINH = {
  id: 'hs1',
  username: 'hs1',
  displayName: 'Học sinh 1',
  role: 'STUDENT',
  isActive: true,
  mustChangePassword: false,
};

const ctx = { params: Promise.resolve({ blockId: 'b1' }) };

/**
 * A multipart body written by hand, as the browser would put it on the wire.
 *
 * Not `new FormData()`: under jsdom that is jsdom's FormData, which the
 * runtime's `Request` (undici) does not accept as a body — it would be
 * stringified to "[object FormData]" and every test would fail on parsing
 * rather than on what it meant to test.
 */
const RANH = '----dye-hex-test';

function multipart(phan: { name: string; filename?: string; noiDung: string }[]): string {
  let body = '';
  for (const p of phan) {
    body += `--${RANH}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename) body += `; filename="${p.filename}"\r\nContent-Type: application/octet-stream`;
    body += `\r\n\r\n${p.noiDung}\r\n`;
  }
  return `${body}--${RANH}--\r\n`;
}

const TEP_HOP_LE = multipart([{ name: 'tep', filename: 'den-nhay.hex', noiDung: ':00000001FF\n' }]);

function yeuCau(init?: {
  origin?: string | null;
  host?: string;
  contentLength?: string;
  body?: string;
}): Request {
  const headers = new Headers({
    host: init?.host ?? 'lms.truong.vn',
    'content-type': `multipart/form-data; boundary=${RANH}`,
  });
  if (init?.origin !== null) headers.set('origin', init?.origin ?? 'https://lms.truong.vn');
  if (init?.contentLength) headers.set('content-length', init.contentLength);

  return new Request('https://lms.truong.vn/api/khoi/b1/hex', {
    method: 'POST',
    headers,
    body: init?.body ?? TEP_HOP_LE,
  });
}

beforeEach(() => {
  // One press per test; the cooldown has its own test.
  xoaGioiHanChoKiemThu();
  actorStub.mockReset();
  actorStub.mockResolvedValue(HOC_SINH);
  moKhoiStub.mockReset();
  moKhoiStub.mockResolvedValue({ problemId: 'p1' });
  conLuotStub.mockReset();
  conLuotStub.mockResolvedValue(undefined);
  nhanStub.mockReset();
  nhanStub.mockResolvedValue({
    trangThai: 'da-nhan',
    submissionId: 's1',
    attemptNo: 1,
    thongDiep: 'Đã nhận tệp.',
  });
});

describe('POST /api/khoi/[blockId]/hex', () => {
  it('bấm nộp lần hai trong 5 giây → 429 kèm câu học sinh đọc được, không đọc tệp', async () => {
    await POST(yeuCau(), ctx);
    const res = await POST(yeuCau(), ctx);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^[1-5]$/);
    const kq = (await res.json()) as { trangThai: string; thongDiep: string };
    expect(kq.trangThai).toBe('tu-choi');
    expect(kq.thongDiep).toMatch(/Chờ \d+ giây/);
    // Refused before the access check and before the body was read.
    expect(moKhoiStub).toHaveBeenCalledTimes(1);
    expect(nhanStub).toHaveBeenCalledTimes(1);
  });

  it('học sinh nộp tệp cùng nguồn → 200, JSON đúng dạng KetQuaNop', async () => {
    const res = await POST(yeuCau(), ctx);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    await expect(res.json()).resolves.toEqual({
      trangThai: 'da-nhan',
      submissionId: 's1',
      attemptNo: 1,
      thongDiep: 'Đã nhận tệp.',
    });

    // The file reached the storage layer as a File, for the student in the
    // session — never an id from the request.
    const [studentId, blockId, tep] = nhanStub.mock.calls[0] as [string, string, File];
    expect(studentId).toBe('hs1');
    expect(blockId).toBe('b1');
    expect(tep).toBeInstanceOf(File);
    expect(tep.name).toBe('den-nhay.hex');
  });

  it('nguồn khác (cross-site) → 403, chưa đọc tệp', async () => {
    const res = await POST(yeuCau({ origin: 'https://ke-gian.example' }), ctx);
    expect(res.status).toBe(403);
    expect(nhanStub).not.toHaveBeenCalled();
    expect(moKhoiStub).not.toHaveBeenCalled();
  });

  it('đã hết lượt nộp → 403 với đúng câu của luật, TRƯỚC khi đọc thân yêu cầu', async () => {
    // The one-attempt rule, refused by the same sentence the editor shows.
    conLuotStub.mockRejectedValue(new HetLuotNopError());
    const res = await POST(yeuCau(), ctx);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      trangThai: 'tu-choi',
      thongDiep: 'Em đã hết lượt nộp bài. Vui lòng nhờ Giáo viên mở khóa.',
    });
    expect(moKhoiStub).toHaveBeenCalledWith({}, 'hs1', 'b1');
    expect(conLuotStub).toHaveBeenCalledWith({}, 'hs1', 'p1');
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('không mở được khối (chưa đến lượt, bị khoá) → 403, chưa đọc tệp', async () => {
    moKhoiStub.mockRejectedValue(new ForbiddenError('lesson-locked'));
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(403);
    expect(conLuotStub).not.toHaveBeenCalled();
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('khối không có bài tập → 400', async () => {
    moKhoiStub.mockResolvedValue({ problemId: null });
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(400);
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('so với x-forwarded-host khi đứng sau proxy / tunnel', async () => {
    const req = new Request('http://127.0.0.1:3000/api/khoi/b1/hex', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3000',
        'x-forwarded-host': 'lms.truong.vn',
        origin: 'https://lms.truong.vn',
        'content-type': `multipart/form-data; boundary=${RANH}`,
      },
      body: TEP_HOP_LE,
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
  });

  it('chưa đăng nhập → 401 với câu nói được', async () => {
    actorStub.mockResolvedValue(null);
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(401);
    const kq = (await res.json()) as { trangThai: string; thongDiep: string };
    expect(kq.trangThai).toBe('tu-choi');
    expect(kq.thongDiep).toMatch(/đăng nhập/);
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('giáo viên → 403 — chỉ học sinh nộp bài', async () => {
    actorStub.mockResolvedValue({ ...HOC_SINH, role: 'TEACHER' });
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(403);
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('Content-Length vượt giới hạn → 413 TRƯỚC khi đọc thân yêu cầu, và trước cả truy vấn', async () => {
    const res = await POST(yeuCau({ contentLength: String(GIOI_HAN_HEX_BYTE + 1024 * 1024) }), ctx);
    expect(res.status).toBe(413);
    const kq = (await res.json()) as { thongDiep: string };
    expect(kq.thongDiep).toMatch(/lớn hơn/);
    expect(nhanStub).not.toHaveBeenCalled();
    // A header is free; the database is not. Oversize is refused first.
    expect(moKhoiStub).not.toHaveBeenCalled();
  });

  it('không có tệp trong form → 400', async () => {
    // A plain text field under the same name is not a file.
    const body = multipart([{ name: 'tep', noiDung: 'không phải tệp' }]);
    const res = await POST(yeuCau({ body }), ctx);
    expect(res.status).toBe(400);
    expect(nhanStub).not.toHaveBeenCalled();
  });

  it('thân không phải multipart → 400, không nổ', async () => {
    const req = new Request('https://lms.truong.vn/api/khoi/b1/hex', {
      method: 'POST',
      headers: { host: 'lms.truong.vn', origin: 'https://lms.truong.vn' },
      body: 'rác',
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it('tầng lưu trữ từ chối → 422, mang nguyên câu của nó', async () => {
    nhanStub.mockResolvedValue({
      trangThai: 'tu-choi',
      submissionId: null,
      attemptNo: null,
      thongDiep: 'Tệp .hex bị hỏng. Em tải lại từ MakeCode rồi nộp lần nữa nhé.',
    });
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(422);
    const kq = (await res.json()) as { thongDiep: string };
    expect(kq.thongDiep).toMatch(/bị hỏng/);
  });

  it('lỗi hệ thống → 500, vẫn là JSON', async () => {
    nhanStub.mockResolvedValue({
      trangThai: 'loi',
      submissionId: null,
      attemptNo: null,
      thongDiep: 'Chưa lưu được tệp.',
    });
    const res = await POST(yeuCau(), ctx);
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ trangThai: 'loi' });
  });
});
