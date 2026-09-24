/**
 * Deadlines in Vietnamese time, whatever zone the server runs in.
 *
 * The production containers set no TZ, so a deadline typed as "18:00" and
 * parsed with `new Date()` would land seven hours late. These pin the parse
 * to UTC+7 explicitly — they pass on a laptop in Asia/Saigon AND in CI on UTC,
 * which is the point.
 */
import { describe, expect, it } from 'vitest';

import { conLai, docGioViecNam, hienThiHan, thanhGioViecNam } from './thoi-gian';

describe('docGioViecNam', () => {
  it('18:00 giờ Việt Nam là 11:00 UTC', () => {
    expect(docGioViecNam('2026-09-26T18:00')?.toISOString()).toBe('2026-09-26T11:00:00.000Z');
  });

  it('00:30 giờ Việt Nam là 17:30 UTC ngày hôm trước', () => {
    expect(docGioViecNam('2026-10-01T00:30')?.toISOString()).toBe('2026-09-30T17:30:00.000Z');
  });

  it('từ chối ngày không tồn tại thay vì lặng lẽ lùi sang tháng sau', () => {
    expect(docGioViecNam('2026-02-31T10:00')).toBeNull();
    expect(docGioViecNam('2026-09-26T24:00')).toBeNull();
  });

  it('từ chối chuỗi sai dạng', () => {
    expect(docGioViecNam('')).toBeNull();
    expect(docGioViecNam('26/09/2026 18:00')).toBeNull();
    expect(docGioViecNam('2026-09-26T18:00:00Z')).toBeNull();
  });
});

describe('thanhGioViecNam', () => {
  it('là phép ngược của docGioViecNam', () => {
    for (const s of ['2026-09-26T18:00', '2026-12-31T23:59', '2027-01-01T00:00']) {
      expect(thanhGioViecNam(docGioViecNam(s)!)).toBe(s);
    }
  });
});

describe('hienThiHan', () => {
  it('in giờ và thứ theo giờ Việt Nam', () => {
    expect(hienThiHan('2026-09-26T11:00:00.000Z')).toBe('18:00 · Thứ Bảy, 26/09');
  });
});

describe('conLai', () => {
  const bayGio = new Date('2026-09-24T12:00:00.000Z');

  it('làm tròn XUỐNG khi còn hạn — không hứa thêm thời gian', () => {
    expect(conLai(new Date(bayGio.getTime() + 47 * 3_600_000), bayGio)).toEqual({
      chu: 'còn 1 ngày',
      gap: false,
      quaHan: false,
    });
  });

  it('dưới một ngày là gấp', () => {
    expect(conLai(new Date(bayGio.getTime() + 5 * 3_600_000), bayGio)).toMatchObject({
      chu: 'còn 5 giờ',
      gap: true,
    });
  });

  it('qua hạn thì nói là quá hạn, và không còn là "gấp"', () => {
    expect(conLai(new Date(bayGio.getTime() - 2 * 86_400_000), bayGio)).toEqual({
      chu: 'quá hạn 2 ngày',
      gap: false,
      quaHan: true,
    });
  });

  it('dưới một phút vẫn nói "1 phút", không bao giờ "0 phút"', () => {
    expect(conLai(new Date(bayGio.getTime() + 10_000), bayGio).chu).toBe('còn 1 phút');
  });
});
