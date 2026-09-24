/**
 * The review milestones' pure rules: the boss fight's arithmetic, the
 * presentation's shape, and the window a boss reviews.
 *
 * No database. These are the functions the browser and the server both call,
 * so a disagreement between them — a button that lights up for slides the
 * server then refuses, a fight that runs out of questions mid-battle — would
 * show up here first.
 */
import { describe, expect, it } from 'vitest';

import { stageOf, validateLessonFlow } from './curriculum/flow';
import { khoangOnTap } from './on-tap';
import {
  batDauTran,
  danhMotLuot,
  MAU_HOC_SINH_TOI_DA,
  phanTramMau,
  SO_CAU_MOI_TRAN,
} from './tran-boss';
import {
  kiemTraThuyetTrinh,
  moTaLoiThuyetTrinh,
  NOI_DUNG_TRANG_TOI_DA,
  SO_TRANG_THUYET_TRINH,
  TIEU_DE_TRANG_TOI_DA,
} from './trang-thuyet-trinh';

// ═══════════════════════════════════════════════════════════════════════════
// Boss fight
// ═══════════════════════════════════════════════════════════════════════════

describe('batDauTran', () => {
  it('trận mặc định: 10 câu → boss 6 máu, em 3 tim', () => {
    const t = batDauTran(SO_CAU_MOI_TRAN);
    expect(t).toMatchObject({ mauBoss: 6, mauHocSinh: 3, ketQua: 'dang-danh', daHoi: 0 });
  });

  it('trận LUÔN kết thúc trước khi hết câu hỏi, với mọi cỡ bộ câu', () => {
    // The invariant the bars are sized by: the most answers a fight can take
    // is mauBoss + mauHocSinh - 1, and that must fit in the pool.
    for (let n = 1; n <= 40; n += 1) {
      const t = batDauTran(n);
      expect(t.mauBoss + t.mauHocSinh - 1, `n=${n}`).toBeLessThanOrEqual(n);
      expect(t.mauBoss, `n=${n}`).toBeGreaterThan(0);
      expect(t.mauHocSinh, `n=${n}`).toBeGreaterThan(0);
      expect(t.mauHocSinh, `n=${n}`).toBeLessThanOrEqual(MAU_HOC_SINH_TOI_DA);
    }
  });

  it('không có câu nào → không có trận, không phải thua', () => {
    const t = batDauTran(0);
    expect(t.mauBossToiDa).toBe(0);
    expect(t.ketQua).not.toBe('thua');
  });
});

describe('danhMotLuot', () => {
  it('đúng trừ máu boss, sai trừ tim của em', () => {
    const t0 = batDauTran(10);
    const t1 = danhMotLuot(t0, true);
    expect(t1.mauBoss).toBe(t0.mauBoss - 1);
    expect(t1.mauHocSinh).toBe(t0.mauHocSinh);

    const t2 = danhMotLuot(t1, false);
    expect(t2.mauHocSinh).toBe(t0.mauHocSinh - 1);
    expect(t2.daHoi).toBe(2);
  });

  it('hạ đủ máu boss → thắng', () => {
    let t = batDauTran(10);
    for (let i = 0; i < 6; i += 1) t = danhMotLuot(t, true);
    expect(t.ketQua).toBe('thang');
    expect(t.mauBoss).toBe(0);
  });

  it('hết tim → trận kết thúc', () => {
    let t = batDauTran(10);
    for (let i = 0; i < 3; i += 1) t = danhMotLuot(t, false);
    expect(t.ketQua).toBe('thua');
  });

  it('trận đã xong thì bấm thêm cũng không đổi gì (bấm đúp câu cuối)', () => {
    let t = batDauTran(3);
    t = danhMotLuot(danhMotLuot(t, true), true);
    expect(t.ketQua).toBe('thang');
    expect(danhMotLuot(t, false)).toBe(t);
  });

  it('mọi chuỗi đúng/sai đều kết thúc trong số câu đã rút', () => {
    // Exhaustive over every right/wrong sequence for a small pool.
    const n = 6;
    for (let mau = 0; mau < 2 ** n; mau += 1) {
      let t = batDauTran(n);
      for (let i = 0; i < n && t.ketQua === 'dang-danh'; i += 1) {
        t = danhMotLuot(t, ((mau >> i) & 1) === 1);
      }
      expect(t.ketQua, `mẫu ${mau.toString(2)}`).not.toBe('dang-danh');
    }
  });
});

describe('phanTramMau', () => {
  it('kẹp trong 0–100 và chịu được mẫu số 0', () => {
    expect(phanTramMau(3, 6)).toBe(50);
    expect(phanTramMau(-1, 6)).toBe(0);
    expect(phanTramMau(9, 6)).toBe(100);
    expect(phanTramMau(0, 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Review window
// ═══════════════════════════════════════════════════════════════════════════

describe('khoangOnTap', () => {
  it('mặc định: năm buổi kết thúc ở chính buổi của khối', () => {
    expect(khoangOnTap({}, 10)).toEqual({ tuBuoi: 6, denBuoi: 10 });
    expect(khoangOnTap(null, 5)).toEqual({ tuBuoi: 1, denBuoi: 5 });
  });

  it('không bao giờ ôn buổi em chưa tới, dù nội dung ghi thế nào', () => {
    expect(khoangOnTap({ tuBuoi: 1, denBuoi: 30 }, 5)).toEqual({ tuBuoi: 1, denBuoi: 5 });
  });

  it('không lùi quá buổi 1 và không đảo ngược khoảng', () => {
    expect(khoangOnTap({}, 3)).toEqual({ tuBuoi: 1, denBuoi: 3 });
    expect(khoangOnTap({ tuBuoi: 9, denBuoi: 4 }, 10)).toEqual({ tuBuoi: 4, denBuoi: 4 });
  });

  it('bỏ qua giá trị không phải số nguyên', () => {
    expect(khoangOnTap({ tuBuoi: '2', denBuoi: 7.5 }, 10)).toEqual({ tuBuoi: 6, denBuoi: 10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Presentation
// ═══════════════════════════════════════════════════════════════════════════

const duTrang = () =>
  Array.from({ length: SO_TRANG_THUYET_TRINH }, (_, i) => ({
    tieuDe: `Trang ${i + 1}`,
    noiDung: `- Điều em học được số ${i + 1}`,
  }));

describe('kiemTraThuyetTrinh', () => {
  it('đủ 8 trang có tiêu đề và nội dung → hợp lệ, đã cắt khoảng trắng', () => {
    const slides = duTrang();
    slides[0] = { tieuDe: '  Mở đầu  ', noiDung: '\n Xin chào \n' };
    const kq = kiemTraThuyetTrinh(slides);
    expect(kq.ok).toBe(true);
    if (kq.ok) expect(kq.trang[0]).toEqual({ tieuDe: 'Mở đầu', noiDung: 'Xin chào' });
  });

  it('thiếu hoặc thừa trang → báo đúng số trang', () => {
    expect(kiemTraThuyetTrinh(duTrang().slice(0, 7))).toEqual({
      ok: false,
      loi: { loai: 'sai-so-trang', soTrang: 7 },
    });
    expect(kiemTraThuyetTrinh([...duTrang(), duTrang()[0]])).toMatchObject({
      ok: false,
      loi: { loai: 'sai-so-trang', soTrang: 9 },
    });
    expect(kiemTraThuyetTrinh('không phải mảng')).toMatchObject({ ok: false });
  });

  it('trang trống (kể cả chỉ có khoảng trắng) → chỉ ra trang nào, đếm từ 1', () => {
    const slides = duTrang();
    slides[3] = { tieuDe: 'Vòng lặp', noiDung: '    ' };
    const kq = kiemTraThuyetTrinh(slides);
    expect(kq).toEqual({ ok: false, loi: { loai: 'trang-trong', trang: 4, thieu: 'noi-dung' } });
    if (!kq.ok) expect(moTaLoiThuyetTrinh(kq.loi)).toBe('Trang 4 chưa có nội dung.');
  });

  it('quá dài → từ chối, không cắt ngầm', () => {
    const slides = duTrang();
    slides[1] = { tieuDe: 'x'.repeat(TIEU_DE_TRANG_TOI_DA + 1), noiDung: 'ok' };
    expect(kiemTraThuyetTrinh(slides)).toMatchObject({
      ok: false,
      loi: { loai: 'qua-dai', trang: 2, truong: 'tieu-de' },
    });

    const slides2 = duTrang();
    slides2[7] = { tieuDe: 'Kết', noiDung: 'y'.repeat(NOI_DUNG_TRANG_TOI_DA + 1) };
    expect(kiemTraThuyetTrinh(slides2)).toMatchObject({
      ok: false,
      loi: { loai: 'qua-dai', trang: 8, truong: 'noi-dung' },
    });
  });

  it('bỏ qua trường lạ, không để chúng lọt vào dữ liệu lưu', () => {
    const slides = duTrang().map((t) => ({ ...t, html: '<script>' }));
    const kq = kiemTraThuyetTrinh(slides);
    expect(kq.ok).toBe(true);
    if (kq.ok) expect(Object.keys(kq.trang[0] ?? {})).toEqual(['tieuDe', 'noiDung']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Flow
// ═══════════════════════════════════════════════════════════════════════════

describe('Luồng bài học với hai loại khối mới', () => {
  it('boss và thuyết trình thuộc chặng Thử thách', () => {
    expect(stageOf('MINIGAME_BOSS')).toBe('THU_THACH');
    expect(stageOf('PRESENTATION')).toBe('THU_THACH');
  });

  it('boss là phần đánh giá: không được đứng ngay sau lý thuyết', () => {
    const kq = validateLessonFlow([
      { order: 0, type: 'THEORY' },
      { order: 1, type: 'MINIGAME_BOSS' },
    ]);
    expect(kq.violations.map((v) => v.code)).toEqual(['theory-then-assessment']);
  });

  it('boss ở cuối một buổi đúng luồng thì hợp lệ', () => {
    const kq = validateLessonFlow([
      { order: 0, type: 'THEORY' },
      { order: 1, type: 'INTERACTIVE_EXAMPLE' },
      { order: 2, type: 'MINI_CHALLENGE' },
      { order: 3, type: 'MINIGAME_BOSS' },
      { order: 4, type: 'PRESENTATION' },
    ]);
    expect(kq.valid).toBe(true);
  });
});
