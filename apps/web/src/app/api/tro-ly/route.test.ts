// @vitest-environment node
/**
 * Bí's guardrail-first pipeline.
 *
 * The model calls and the lock write are stubbed — both are tested on their
 * own (`lib/tro-ly-claude.test.ts`, and @dye/core against a real database).
 * What is under test is the ORDER and the consequences: a locked student never
 * reaches a model; a violation is never answered; a student is locked and
 * staff are not; a classifier that cannot decide neither answers nor punishes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const actorStub = vi.hoisted(() => vi.fn());
const biKhoaStub = vi.hoisted(() => vi.fn());
const khoaStub = vi.hoisted(() => vi.fn());
const coMoHinhStub = vi.hoisted(() => vi.fn());
const kiemDuyetStub = vi.hoisted(() => vi.fn());
const giaSuStub = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({ currentActor: actorStub }));
vi.mock('@/lib/db', () => ({ db: { la: 'db' } }));
vi.mock('@dye/core', () => ({ biKhoaTroLy: biKhoaStub, khoaTroLyViPham: khoaStub }));
vi.mock('@/lib/tro-ly-claude', () => ({
  coMoHinh: coMoHinhStub,
  kiemDuyetBangMoHinh: kiemDuyetStub,
  hoiGiaSu: giaSuStub,
}));

import { xoaGioiHanChoKiemThu } from '@/lib/gioi-han-toc-do';

import { POST, type KetQuaTroLy } from './route';

const HOC_SINH = { id: 'hs1', role: 'STUDENT', isActive: true };
const GIAO_VIEN = { id: 'gv1', role: 'TEACHER', isActive: true };

const THONG_DIEP_KHOA =
  'Quyền truy cập AI của em đã bị khóa do vi phạm. Vui lòng liên hệ giáo viên để mở lại.';

function hoi(prompt: string, init?: { origin?: string }): Request {
  return new Request('https://lms.truong.vn/api/tro-ly', {
    method: 'POST',
    headers: {
      host: 'lms.truong.vn',
      origin: init?.origin ?? 'https://lms.truong.vn',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prompt, codeContext: 'print(1)', lessonContext: 'Buổi 1' }),
  });
}

async function doc(res: Response): Promise<KetQuaTroLy> {
  return (await res.json()) as KetQuaTroLy;
}

beforeEach(() => {
  xoaGioiHanChoKiemThu();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  actorStub.mockReset().mockResolvedValue(HOC_SINH);
  biKhoaStub.mockReset().mockResolvedValue(false);
  khoaStub.mockReset().mockResolvedValue({ alertId: 'a1' });
  coMoHinhStub.mockReset().mockReturnValue(true);
  kiemDuyetStub.mockReset().mockResolvedValue({ ok: true, viPham: null });
  giaSuStub.mockReset().mockResolvedValue({ ok: true, traLoi: 'Em xem lại dòng 1 nhé?' });
});

describe('POST /api/tro-ly — khoá', () => {
  it('học sinh đang bị khoá → 403 đúng câu yêu cầu, không gọi mô hình nào', async () => {
    biKhoaStub.mockResolvedValue(true);

    const res = await POST(hoi('vòng for là gì'));

    expect(res.status).toBe(403);
    const kq = await doc(res);
    expect(kq.error).toBe(THONG_DIEP_KHOA);
    expect(kq.trangThai).toBe('bi-khoa');
    expect(kq.khoaMoi).toBe(false);
    expect(kiemDuyetStub).not.toHaveBeenCalled();
    expect(giaSuStub).not.toHaveBeenCalled();
  });

  it('không đọc được trạng thái khoá → không trả lời', async () => {
    biKhoaStub.mockRejectedValue(new Error('db down'));
    const res = await POST(hoi('vòng for là gì'));
    expect(res.status).toBe(503);
    expect(giaSuStub).not.toHaveBeenCalled();
  });
});

describe('POST /api/tro-ly — bẫy vi phạm', () => {
  it('từ trong danh sách → khoá ngay, không cần mô hình, không trả lời', async () => {
    const res = await POST(hoi('đm bài này'));

    expect(res.status).toBe(403);
    const kq = await doc(res);
    expect(kq.trangThai).toBe('bi-khoa');
    expect(kq.khoaMoi).toBe(true);
    expect(kq.error).toContain(THONG_DIEP_KHOA);

    expect(khoaStub).toHaveBeenCalledWith({ la: 'db' }, 'hs1', {
      noiDung: 'đm bài này',
      loai: 'PROFANITY',
      nguon: 'tu-khoa',
    });
    expect(kiemDuyetStub).not.toHaveBeenCalled();
    expect(giaSuStub).not.toHaveBeenCalled();
  });

  it('bộ phân loại bắt được → khoá với nguồn "mo-hinh", gia sư không được gọi', async () => {
    kiemDuyetStub.mockResolvedValue({ ok: true, viPham: 'INSULT' });

    const res = await POST(hoi('bot vô dụng hết sức'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('bi-khoa');
    expect(khoaStub).toHaveBeenCalledWith({ la: 'db' }, 'hs1', {
      noiDung: 'bot vô dụng hết sức',
      loai: 'INSULT',
      nguon: 'mo-hinh',
    });
    expect(giaSuStub).not.toHaveBeenCalled();
  });

  it('bộ phân loại chỉ thấy câu hỏi, không thấy code hay bài học', async () => {
    await POST(hoi('vòng for là gì'));
    expect(kiemDuyetStub).toHaveBeenCalledWith('vòng for là gì');
  });

  it('giáo viên vi phạm → bị từ chối nhưng KHÔNG bị khoá', async () => {
    actorStub.mockResolvedValue(GIAO_VIEN);

    const res = await POST(hoi('đm thử bộ lọc'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('tu-choi');
    expect(khoaStub).not.toHaveBeenCalled();
    expect(giaSuStub).not.toHaveBeenCalled();
  });

  it('ghi khoá thất bại → vẫn không trả lời', async () => {
    khoaStub.mockRejectedValue(new Error('db down'));

    const res = await POST(hoi('đm bài này'));

    expect(res.status).toBe(403);
    expect((await doc(res)).trangThai).toBe('tu-choi');
    expect(giaSuStub).not.toHaveBeenCalled();
  });

  it('bộ phân loại không quyết được → không trả lời, không phạt', async () => {
    kiemDuyetStub.mockResolvedValue({ ok: false, loi: 'Bí không kết nối được lúc này.' });

    const res = await POST(hoi('vòng for là gì'));

    expect(res.status).toBe(503);
    expect((await doc(res)).trangThai).toBe('loi');
    expect(khoaStub).not.toHaveBeenCalled();
    expect(giaSuStub).not.toHaveBeenCalled();
  });
});

describe('POST /api/tro-ly — trả lời', () => {
  it('câu hỏi sạch → kiểm duyệt TRƯỚC, rồi mới hỏi gia sư', async () => {
    const res = await POST(hoi('vòng for là gì'));

    expect(res.status).toBe(200);
    expect(await doc(res)).toEqual({ trangThai: 'tra-loi', traLoi: 'Em xem lại dòng 1 nhé?' });
    expect(giaSuStub).toHaveBeenCalledWith({
      cauHoi: 'vòng for là gì',
      maCuaEm: 'print(1)',
      baiHoc: 'Buổi 1',
    });
    expect(kiemDuyetStub.mock.invocationCallOrder[0]).toBeLessThan(
      giaSuStub.mock.invocationCallOrder[0]!,
    );
  });

  it('chưa cấu hình mô hình → câu trả lời tạm trung thực, nhưng danh sách từ vẫn khoá', async () => {
    coMoHinhStub.mockReturnValue(false);

    const sach = await POST(hoi('vòng for là gì'));
    expect(sach.status).toBe(200);
    expect((await doc(sach)).traLoi).toMatch(/chưa được bật/);

    xoaGioiHanChoKiemThu();
    const ban = await POST(hoi('vcl'));
    expect(ban.status).toBe(403);
    expect(khoaStub).toHaveBeenCalledTimes(1);
    expect(kiemDuyetStub).not.toHaveBeenCalled();
  });

  it('gia sư lỗi → câu dễ hiểu, 503', async () => {
    giaSuStub.mockResolvedValue({ ok: false, loi: 'Bí đang bận mất rồi 😵' });
    const res = await POST(hoi('vòng for là gì'));
    expect(res.status).toBe(503);
    expect((await doc(res)).traLoi).toBe('Bí đang bận mất rồi 😵');
  });
});

describe('POST /api/tro-ly — chốt chặn đầu vào', () => {
  it('khác nguồn → 403 trước mọi thứ', async () => {
    const res = await POST(hoi('x', { origin: 'https://ke-gian.example' }));
    expect(res.status).toBe(403);
    expect(actorStub).not.toHaveBeenCalled();
  });

  it('chưa đăng nhập → 401', async () => {
    actorStub.mockResolvedValue(null);
    expect((await POST(hoi('x'))).status).toBe(401);
  });

  it('hỏi liên tục trong 3 giây → 429, không gọi mô hình lần hai', async () => {
    await POST(hoi('vòng for là gì'));
    const res = await POST(hoi('còn while?'));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^[1-3]$/);
    expect(kiemDuyetStub).toHaveBeenCalledTimes(1);
  });
});
