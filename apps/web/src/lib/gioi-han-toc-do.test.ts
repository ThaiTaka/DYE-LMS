import { beforeEach, describe, expect, it } from 'vitest';

import { thongDiepChoLai, thuChiemLuot, xoaGioiHanChoKiemThu } from './gioi-han-toc-do';

beforeEach(() => {
  xoaGioiHanChoKiemThu();
});

describe('thuChiemLuot', () => {
  it('lần đầu được, lần hai trong cửa sổ bị từ chối kèm thời gian còn lại', () => {
    expect(thuChiemLuot('nop', 'hs1', 5000, 1_000)).toEqual({ duocPhep: true, conLaiMs: 0 });
    expect(thuChiemLuot('nop', 'hs1', 5000, 3_000)).toEqual({ duocPhep: false, conLaiMs: 3000 });
  });

  it('hết cửa sổ thì được lại', () => {
    thuChiemLuot('nop', 'hs1', 5000, 1_000);
    expect(thuChiemLuot('nop', 'hs1', 5000, 6_000).duocPhep).toBe(true);
  });

  it('lần bị từ chối không kéo dài cửa sổ', () => {
    thuChiemLuot('nop', 'hs1', 5000, 1_000);
    thuChiemLuot('nop', 'hs1', 5000, 5_999);
    expect(thuChiemLuot('nop', 'hs1', 5000, 6_000).duocPhep).toBe(true);
  });

  it('mỗi học sinh một cửa sổ, mỗi nhóm một cửa sổ', () => {
    thuChiemLuot('nop', 'hs1', 5000, 1_000);
    expect(thuChiemLuot('nop', 'hs2', 5000, 1_000).duocPhep).toBe(true);
    expect(thuChiemLuot('tro-ly', 'hs1', 3000, 1_000).duocPhep).toBe(true);
  });
});

describe('thongDiepChoLai', () => {
  it('làm tròn lên và không bao giờ nói "0 giây"', () => {
    expect(thongDiepChoLai(4001)).toMatch(/Chờ 5 giây/);
    expect(thongDiepChoLai(1)).toMatch(/Chờ 1 giây/);
    expect(thongDiepChoLai(0)).toMatch(/Chờ 1 giây/);
  });
});
