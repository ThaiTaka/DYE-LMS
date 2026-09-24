// @vitest-environment node
/**
 * The class chat's moderation-first pipeline.
 *
 * The database, the classifier and the core writers are stubbed — each is
 * tested on its own (`tro-ly-claude.test.ts`, `kiem-duyet.test.ts`, and
 * @dye/core against a real database). What is under test here is the ORDER
 * and the consequences the brief sets out for a violation:
 *
 *   a) the message is NOT saved,
 *   b) + c) the student is locked and an alert filed — one call, channel CLASS_CHAT,
 *   d) the response is a 403 the page turns into a warning.
 *
 * Plus the structural rule that makes (a) hold for good: `guiTinNhanLop` is
 * called from this route only, and only after `kiemDuyetTinNhan`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ForbiddenError } = vi.hoisted(() => {
  class ForbiddenError extends Error {
    readonly reason: string;
    constructor(reason: string) {
      super('Bạn không có quyền thực hiện thao tác này.');
      this.reason = reason;
    }
  }
  return { ForbiddenError };
});

const actorStub = vi.hoisted(() => vi.fn());
const authorizeStub = vi.hoisted(() => vi.fn());
const biKhoaStub = vi.hoisted(() => vi.fn());
const khoaStub = vi.hoisted(() => vi.fn());
const guiStub = vi.hoisted(() => vi.fn());
const docStub = vi.hoisted(() => vi.fn());
const coMoHinhStub = vi.hoisted(() => vi.fn());
const kiemDuyetMoHinhStub = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ currentActor: actorStub }));
vi.mock('@/lib/db', () => ({ db: { la: 'db' } }));
vi.mock('@dye/core', () => ({
  authorize: authorizeStub,
  biKhoaTroLy: biKhoaStub,
  ForbiddenError,
  GIOI_HAN_TIN_NHAN: 500,
  guiTinNhanLop: guiStub,
  khoaTroLyViPham: khoaStub,
}));
vi.mock('@/lib/tro-ly-claude', () => ({
  coMoHinh: coMoHinhStub,
  kiemDuyetBangMoHinh: kiemDuyetMoHinhStub,
}));
vi.mock('@/lib/thao-luan-data', () => ({
  docThaoLuan: docStub,
  thanhGuiDi: (t: { id: string; noiDung: string; luc: Date; tacGia: unknown }) => ({
    ...t,
    luc: t.luc.toISOString(),
  }),
}));

import { xoaGioiHanChoKiemThu } from '@/lib/gioi-han-toc-do';
import type { KetQuaGuiThaoLuan } from '@/lib/thao-luan-data';

import { GET, POST } from './route';

const HOC_SINH = { id: 'hs1', role: 'STUDENT', isActive: true };
const GIAO_VIEN = { id: 'gv1', role: 'TEACHER', isActive: true };

function nhan(noiDung: string, init?: { origin?: string; lop?: string }): Request {
  return new Request('https://lms.truong.vn/api/chat', {
    method: 'POST',
    headers: {
      host: 'lms.truong.vn',
      origin: init?.origin ?? 'https://lms.truong.vn',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ lop: init?.lop ?? 'lop1', noiDung }),
  });
}

async function doc(res: Response): Promise<KetQuaGuiThaoLuan> {
  return (await res.json()) as KetQuaGuiThaoLuan;
}

beforeEach(() => {
  xoaGioiHanChoKiemThu();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  actorStub.mockReset().mockResolvedValue(HOC_SINH);
  authorizeStub.mockReset().mockResolvedValue(undefined);
  biKhoaStub.mockReset().mockResolvedValue(false);
  khoaStub.mockReset().mockResolvedValue({ alertId: 'a1' });
  guiStub.mockReset().mockResolvedValue({
    trangThai: 'da-gui',
    tinNhan: {
      id: 'm1',
      noiDung: 'chào cả lớp',
      luc: new Date('2026-09-25T01:00:00Z'),
      tacGia: { id: 'hs1', ten: 'Minh', anh: null },
    },
  });
  docStub.mockReset();
  coMoHinhStub.mockReset().mockReturnValue(true);
  kiemDuyetMoHinhStub.mockReset().mockResolvedValue({ ok: true, viPham: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// Violations
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — tin nhắn vi phạm', () => {
  it('từ trong danh sách: KHÔNG lưu, khoá + cảnh báo kênh CLASS_CHAT, trả 403', async () => {
    const res = await POST(nhan('đm thằng kia'));

    expect(res.status).toBe(403);
    const kq = await doc(res);
    expect(kq.trangThai).toBe('vi-pham');
    expect(kq.thongDiep).toContain('KHÔNG được gửi');

    // a) never saved
    expect(guiStub).not.toHaveBeenCalled();
    // b) + c) the lock and the alert, one transaction, tagged with where it was typed
    expect(khoaStub).toHaveBeenCalledWith({ la: 'db' }, 'hs1', {
      noiDung: 'đm thằng kia',
      loai: 'PROFANITY',
      nguon: 'tu-khoa',
      kenh: 'CLASS_CHAT',
    });
    // The word list is enough; no paid call is made.
    expect(kiemDuyetMoHinhStub).not.toHaveBeenCalled();
  });

  it('bộ phân loại bắt được → khoá với nguồn "mo-hinh", không lưu', async () => {
    kiemDuyetMoHinhStub.mockResolvedValue({ ok: true, viPham: 'INSULT' });

    const res = await POST(nhan('mày học dốt thế'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('vi-pham');
    expect(khoaStub).toHaveBeenCalledWith({ la: 'db' }, 'hs1', {
      noiDung: 'mày học dốt thế',
      loai: 'INSULT',
      nguon: 'mo-hinh',
      kenh: 'CLASS_CHAT',
    });
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('ghi khoá thất bại → tin nhắn VẪN bị chặn', async () => {
    khoaStub.mockRejectedValue(new Error('db down'));

    const res = await POST(nhan('đm'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('vi-pham');
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('bộ phân loại không quyết được → không lưu, không phạt', async () => {
    kiemDuyetMoHinhStub.mockResolvedValue({ ok: false, loi: 'mạng' });

    const res = await POST(nhan('bài 3 làm sao vậy'));

    expect(res.status).toBe(503);
    expect(guiStub).not.toHaveBeenCalled();
    expect(khoaStub).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gates before moderation
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — chốt chặn trước kiểm duyệt', () => {
  it('đang bị khoá → 403 bi-khoa, không kiểm duyệt, không lưu', async () => {
    biKhoaStub.mockResolvedValue(true);

    const res = await POST(nhan('chào cả lớp'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('bi-khoa');
    expect(kiemDuyetMoHinhStub).not.toHaveBeenCalled();
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('không đọc được trạng thái khoá → không gửi', async () => {
    biKhoaStub.mockRejectedValue(new Error('db down'));
    const res = await POST(nhan('chào cả lớp'));
    expect(res.status).toBe(503);
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('không ở trong lớp → 403 trước khi tốn một lần kiểm duyệt', async () => {
    authorizeStub.mockRejectedValue(new ForbiddenError('student-not-enrolled'));

    const res = await POST(nhan('đm'));

    expect(res.status).toBe(403);
    expect(authorizeStub).toHaveBeenCalledWith({ la: 'db' }, HOC_SINH, {
      resource: 'class',
      action: 'read',
      classId: 'lop1',
    });
    expect(khoaStub).not.toHaveBeenCalled();
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('giáo viên không gửi được ở đây', async () => {
    actorStub.mockResolvedValue(GIAO_VIEN);
    const res = await POST(nhan('chào các em'));
    expect(res.status).toBe(403);
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('khác nguồn → 403 trước mọi thứ', async () => {
    const res = await POST(nhan('chào', { origin: 'https://ke-xau.vn' }));
    expect(res.status).toBe(403);
    expect(actorStub).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập → 401', async () => {
    actorStub.mockResolvedValue(null);
    expect((await POST(nhan('chào'))).status).toBe(401);
  });

  it('quá dài → từ chối, không cắt, không kiểm duyệt', async () => {
    const res = await POST(nhan('a'.repeat(501)));
    expect(res.status).toBe(400);
    expect(kiemDuyetMoHinhStub).not.toHaveBeenCalled();
    expect(guiStub).not.toHaveBeenCalled();
  });

  it('gửi liên tục trong 2 giây → 429, không gọi mô hình lần hai', async () => {
    expect((await POST(nhan('một'))).status).toBe(201);
    const res = await POST(nhan('hai'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(kiemDuyetMoHinhStub).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Clean messages
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/chat — tin nhắn sạch', () => {
  it('kiểm duyệt TRƯỚC, rồi mới lưu → 201 kèm tin nhắn', async () => {
    const thuTu: string[] = [];
    kiemDuyetMoHinhStub.mockImplementation(async () => {
      thuTu.push('kiem-duyet');
      return { ok: true, viPham: null };
    });
    guiStub.mockImplementation(async () => {
      thuTu.push('luu');
      return {
        trangThai: 'da-gui',
        tinNhan: {
          id: 'm1',
          noiDung: 'x',
          luc: new Date(),
          tacGia: { id: 'hs1', ten: 'M', anh: null },
        },
      };
    });

    const res = await POST(nhan('bài 3 dùng vòng for hả các bạn?'));

    expect(res.status).toBe(201);
    expect((await doc(res)).tinNhan?.id).toBe('m1');
    expect(thuTu).toEqual(['kiem-duyet', 'luu']);
    expect(guiStub).toHaveBeenCalledWith(
      { la: 'db' },
      HOC_SINH,
      'lop1',
      'bài 3 dùng vòng for hả các bạn?',
    );
  });

  it('chưa cấu hình mô hình → vẫn chạy danh sách từ, tin sạch thì lưu', async () => {
    coMoHinhStub.mockReturnValue(false);

    expect((await POST(nhan('chào cả lớp'))).status).toBe(201);
    expect(kiemDuyetMoHinhStub).not.toHaveBeenCalled();

    xoaGioiHanChoKiemThu();
    const res = await POST(nhan('đm'));
    expect(res.status).toBe(403);
    expect(khoaStub).toHaveBeenCalledTimes(1);
  });

  it('bị khoá giữa chừng (tab khác vừa vi phạm) → 403 bi-khoa', async () => {
    guiStub.mockResolvedValue({ trangThai: 'bi-khoa' });
    const res = await POST(nhan('chào'));
    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('bi-khoa');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/chat', () => {
  const hoi = (qs: string) => GET(new Request(`https://lms.truong.vn/api/chat?${qs}`));

  it('trả luồng tin nhắn của lớp', async () => {
    docStub.mockResolvedValue({
      tinNhan: [],
      toi: 'hs1',
      coTheGui: true,
      biKhoa: false,
      daLuuTru: false,
    });
    const res = await hoi('lop=lop1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(docStub).toHaveBeenCalledWith(HOC_SINH, 'lop1', undefined);
  });

  it('`sau` lùi lại 10 giây để không lỡ tin ghi trễ', async () => {
    docStub.mockResolvedValue({
      tinNhan: [],
      toi: 'hs1',
      coTheGui: true,
      biKhoa: false,
      daLuuTru: false,
    });
    await hoi('lop=lop1&sau=2026-09-25T01:00:10.000Z');
    const tu = docStub.mock.calls[0]?.[2] as Date;
    expect(tu.toISOString()).toBe('2026-09-25T01:00:00.000Z');
  });

  it('lớp không phải của em → 403', async () => {
    docStub.mockRejectedValue(new ForbiddenError('student-not-enrolled'));
    expect((await hoi('lop=lop-khac')).status).toBe(403);
  });

  it('chưa đăng nhập → 401; thiếu lớp → 400', async () => {
    actorStub.mockResolvedValueOnce(null);
    expect((await hoi('lop=lop1')).status).toBe(401);
    expect((await hoi('')).status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Structural: the only way into ClassMessage is through the filter
// ═══════════════════════════════════════════════════════════════════════════

describe('Chỉ có một đường ghi tin nhắn lớp, và nó đi qua kiểm duyệt', () => {
  const GOC = join(import.meta.dirname, '..', '..', '..');

  function moiTep(thuMuc: string): string[] {
    return readdirSync(thuMuc).flatMap((ten) => {
      const p = join(thuMuc, ten);
      if (statSync(p).isDirectory()) return moiTep(p);
      return /\.(ts|tsx)$/.test(ten) && !ten.includes('.test.') ? [p] : [];
    });
  }

  const khongChuThich = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('guiTinNhanLop chỉ được gọi từ api/chat/route.ts', () => {
    const goi = moiTep(GOC)
      .filter((p) => khongChuThich(readFileSync(p, 'utf8')).includes('guiTinNhanLop('))
      .map((p) => relative(GOC, p).replace(/\\/g, '/'));
    expect(goi).toEqual(['app/api/chat/route.ts']);
  });

  it('…và chỉ sau kiemDuyetTinNhan', () => {
    const src = khongChuThich(readFileSync(join(GOC, 'app', 'api', 'chat', 'route.ts'), 'utf8'));
    const kiem = src.indexOf('kiemDuyetTinNhan(');
    expect(kiem).toBeGreaterThan(-1);
    expect(src.indexOf('guiTinNhanLop(')).toBeGreaterThan(kiem);
  });
});
