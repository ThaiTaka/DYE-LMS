/**
 * Dates as a Vietnamese classroom reads them — for homework deadlines.
 *
 * ── Why the time zone is written down ────────────────────────────────────────
 * A deadline is typed into `<input type="datetime-local">`, which submits
 * "2026-09-26T18:00": a wall-clock time with no zone. `new Date()` on that
 * string uses the SERVER's zone, and the production containers set no `TZ`, so
 * it would be filed as 18:00 UTC — 01:00 the next morning in Đà Lạt — and every
 * card would show a deadline seven hours late. A developer on a laptop set to
 * Asia/Saigon would never see it.
 *
 * So both directions name the zone. Vietnam has kept UTC+7 with no daylight
 * saving since 1975, which is what makes a fixed offset exact here rather than
 * an approximation.
 *
 * Client-safe: server pages format with it and the teacher's form fills its
 * `min` and default value with it.
 */

export const MUI_GIO = 'Asia/Ho_Chi_Minh';

const LECH_MS = 7 * 60 * 60 * 1000;
const PHUT_MS = 60 * 1000;
const GIO_MS = 60 * PHUT_MS;
const NGAY_MS = 24 * GIO_MS;

/** The instant → "2026-09-26T18:00" on a Vietnamese wall clock. */
export function thanhGioViecNam(d: Date): string {
  return new Date(d.getTime() + LECH_MS).toISOString().slice(0, 16);
}

/**
 * "2026-09-26T18:00" read on a Vietnamese wall clock → the instant.
 *
 * Null for anything else, including dates that do not exist: `Date.UTC`
 * silently rolls 31/02 over into March, so the result is converted back and
 * must match what was typed.
 */
export function docGioViecNam(chuoi: string): Date | null {
  const s = chuoi.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;

  const [nam, thang, ngay, gio, phut] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const d = new Date(Date.UTC(nam, thang - 1, ngay, gio, phut) - LECH_MS);
  return thanhGioViecNam(d) === s ? d : null;
}

function thanhNgay(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

/** "18:00 · Thứ Bảy, 26/09" — a deadline, as the card prints it. */
export function hienThiHan(d: Date | string): string {
  const x = thanhNgay(d);
  const gio = x.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: MUI_GIO,
  });
  const ngay = x.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: MUI_GIO,
  });
  return `${gio} · ${ngay}`;
}

/** "15:30 24/09" — when something was handed in or graded. */
export function hienThiLuc(d: Date | string): string {
  return thanhNgay(d).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    timeZone: MUI_GIO,
  });
}

export interface ConLai {
  /** "còn 2 ngày", "còn 5 giờ", "quá hạn 1 ngày". */
  chu: string;
  /** Under a day left, and not yet past. */
  gap: boolean;
  quaHan: boolean;
}

/**
 * How long until a deadline, in the largest unit that is at least one.
 *
 * Rounded DOWN while time remains ("còn 1 ngày" at 47 hours), so the card
 * never promises a child more time than they have.
 */
export function conLai(han: Date | string, bayGio: Date = new Date()): ConLai {
  const lech = thanhNgay(han).getTime() - bayGio.getTime();
  const quaHan = lech < 0;
  const abs = Math.abs(lech);

  const ngay = Math.floor(abs / NGAY_MS);
  const gio = Math.floor(abs / GIO_MS);
  const phut = Math.max(1, Math.floor(abs / PHUT_MS));
  const khoang = ngay >= 1 ? `${ngay} ngày` : gio >= 1 ? `${gio} giờ` : `${phut} phút`;

  return {
    chu: quaHan ? `quá hạn ${khoang}` : `còn ${khoang}`,
    gap: !quaHan && lech < NGAY_MS,
    quaHan,
  };
}
