/**
 * Output comparison.
 *
 * The single most important rule here comes from the audience, not from
 * computer science: **a beginner must never fail on whitespace they cannot
 * see.** A 12-year-old who prints the right answer with a trailing space and is
 * told "WRONG" learns that the machine is arbitrary and unfair, and that lesson
 * sticks far longer than the exercise does.
 *
 * So trailing whitespace is trimmed per line and at the end of the output by
 * default, and the comparison rules are stored per test case in Phase 2's
 * `comparison` JSON, which already defaults to `trimTrailing: true`.
 *
 * What is NOT forgiven: interior spacing and line order. "1 2 3" and "123" are
 * genuinely different answers, and pretending otherwise would teach the wrong
 * thing.
 */

export interface LuatSoSanh {
  trimTrailing: boolean;
  ignoreCase: boolean;
  /** Absolute tolerance for numeric comparison, or null for exact text. */
  floatTolerance: number | null;
}

export const LUAT_MAC_DINH: LuatSoSanh = {
  trimTrailing: true,
  ignoreCase: false,
  floatTolerance: null,
};

/** Read the per-test-case rules out of JSONB without trusting their shape. */
export function docLuat(raw: unknown): LuatSoSanh {
  if (typeof raw !== 'object' || raw === null) return LUAT_MAC_DINH;
  const o = raw as Record<string, unknown>;

  return {
    trimTrailing: typeof o['trimTrailing'] === 'boolean' ? o['trimTrailing'] : true,
    ignoreCase: typeof o['ignoreCase'] === 'boolean' ? o['ignoreCase'] : false,
    floatTolerance:
      typeof o['floatTolerance'] === 'number' && Number.isFinite(o['floatTolerance'])
        ? o['floatTolerance']
        : null,
  };
}

/**
 * Normalise output for comparison.
 *
 * Also normalises CRLF: a student on a Windows machine whose file has \r\n is
 * not making a mistake about the algorithm.
 */
export function chuanHoa(text: string, luat: LuatSoSanh): string {
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (luat.trimTrailing) {
    s = s
      .split('\n')
      .map((d) => d.replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\n+$/, '');
  }

  if (luat.ignoreCase) s = s.toLowerCase();
  return s;
}

/** Compare as numbers when a tolerance is set, token by token. */
function soSanhSo(a: string, b: string, dungSai: number): boolean {
  const ta = a.split(/\s+/).filter(Boolean);
  const tb = b.split(/\s+/).filter(Boolean);
  if (ta.length !== tb.length) return false;

  for (let i = 0; i < ta.length; i += 1) {
    const x = Number(ta[i]);
    const y = Number(tb[i]);

    if (Number.isNaN(x) || Number.isNaN(y)) {
      // Not numeric — fall back to exact text for this token.
      if (ta[i] !== tb[i]) return false;
      continue;
    }
    if (Math.abs(x - y) > dungSai) return false;
  }
  return true;
}

export interface KetQuaSoSanh {
  khop: boolean;
  /** Set when the only difference was whitespace we chose to forgive. */
  chiKhacKhoangTrang: boolean;
}

export function soSanhDauRa(
  thucTe: string,
  mongDoi: string,
  luat: LuatSoSanh = LUAT_MAC_DINH,
): KetQuaSoSanh {
  const a = chuanHoa(thucTe, luat);
  const b = chuanHoa(mongDoi, luat);

  const khop =
    luat.floatTolerance !== null ? soSanhSo(a, b, luat.floatTolerance) : a === b;

  // Reported so a teacher can see how close a failing answer was, and so the
  // student-facing message can say "kiểm tra lại khoảng trắng" when that is
  // genuinely the difference.
  const chiKhacKhoangTrang =
    !khop && thucTe.replace(/\s+/g, '') === mongDoi.replace(/\s+/g, '');

  return { khop, chiKhacKhoangTrang };
}
