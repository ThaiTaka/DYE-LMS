/**
 * Upload validation for the Pygame project workspace.
 *
 * ── Threat model ─────────────────────────────────────────────────────────────
 * Students upload sprites, sounds and their own Python files. The uploader is a
 * child, not an attacker — but the endpoint is reachable by anyone with an
 * account, and a shared school machine means an account is not the same thing as
 * a person. Everything here assumes the bytes are hostile.
 *
 * ── Why the declared type is ignored ─────────────────────────────────────────
 * A browser sends `Content-Type` from the file extension. Both are attacker
 * controlled and neither says anything about the bytes. `player.png` can be an
 * ELF binary, and a `.png` with a shebang is still a script to anything that
 * later decides to run it. So the CONTENT decides, via magic bytes, and the
 * declared name only has to agree with what the content turned out to be.
 *
 * ── The rule this module exists to enforce ───────────────────────────────────
 * Uploaded bytes are DATA. Nothing in this system ever executes them on the
 * host. `.py` files are stored and shown so a teacher can read them and a
 * student can edit them; they run in the Phase 8 sandbox or not at all.
 */

/** 5 MB per file. A 12-year-old's sprite sheet does not need more. */
export const GIOI_HAN_TEP_BYTE = 5 * 1024 * 1024;

/** 50 MB per project, counted across the whole working set. */
export const GIOI_HAN_DU_AN_BYTE = 50 * 1024 * 1024;

/** Longest display path we will store, including folders. */
export const DAI_DUONG_DAN_TOI_DA = 200;

/** Most files one project may hold, so a loop cannot create a million rows. */
export const SO_TEP_TOI_DA = 200;

export type LoaiTep = 'python' | 'anh' | 'am-thanh' | 'du-lieu' | 'van-ban';

export interface DinhDang {
  duoi: string;
  loai: LoaiTep;
  mime: string;
  /** True when the bytes are text and may be opened in the code editor. */
  laVanBan: boolean;
}

/**
 * The allowlist. Anything not named here is refused.
 *
 * An allowlist rather than a blocklist because a blocklist is a promise to have
 * thought of everything, and nobody has. New formats get added deliberately.
 */
export const DINH_DANG_CHO_PHEP: DinhDang[] = [
  { duoi: 'py', loai: 'python', mime: 'text/x-python', laVanBan: true },
  { duoi: 'png', loai: 'anh', mime: 'image/png', laVanBan: false },
  { duoi: 'jpg', loai: 'anh', mime: 'image/jpeg', laVanBan: false },
  { duoi: 'jpeg', loai: 'anh', mime: 'image/jpeg', laVanBan: false },
  { duoi: 'gif', loai: 'anh', mime: 'image/gif', laVanBan: false },
  { duoi: 'bmp', loai: 'anh', mime: 'image/bmp', laVanBan: false },
  { duoi: 'wav', loai: 'am-thanh', mime: 'audio/wav', laVanBan: false },
  { duoi: 'ogg', loai: 'am-thanh', mime: 'audio/ogg', laVanBan: false },
  { duoi: 'mp3', loai: 'am-thanh', mime: 'audio/mpeg', laVanBan: false },
  { duoi: 'json', loai: 'du-lieu', mime: 'application/json', laVanBan: true },
  { duoi: 'txt', loai: 'van-ban', mime: 'text/plain', laVanBan: true },
  { duoi: 'md', loai: 'van-ban', mime: 'text/markdown', laVanBan: true },
  { duoi: 'csv', loai: 'du-lieu', mime: 'text/csv', laVanBan: true },
];

export function timDinhDang(duoi: string): DinhDang | null {
  return DINH_DANG_CHO_PHEP.find((d) => d.duoi === duoi.toLowerCase()) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Magic bytes
// ═══════════════════════════════════════════════════════════════════════════

interface ChuKy {
  mime: string;
  /** Byte prefix. `null` entries match any byte at that offset. */
  bytes: Array<number | null>;
  offset?: number;
}

const CHU_KY: ChuKy[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/bmp', bytes: [0x42, 0x4d] },
  // RIFF....WAVE — the middle four bytes are the chunk size.
  {
    mime: 'audio/wav',
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x41, 0x56, 0x45],
  },
  { mime: 'audio/ogg', bytes: [0x4f, 0x67, 0x67, 0x53] },
  { mime: 'audio/mpeg', bytes: [0x49, 0x44, 0x33] },
  { mime: 'audio/mpeg', bytes: [0xff, 0xfb] },
];

/**
 * Byte signatures that must NEVER be stored, whatever they are called.
 *
 * These are checked before the allowlist, so a PE binary renamed `player.png`
 * is refused as an executable rather than as a broken image — the message an
 * administrator needs is "someone uploaded a binary", not "bad PNG".
 */
const CHU_KY_THUC_THI: Array<{ ten: string; bytes: number[] }> = [
  { ten: 'ELF', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { ten: 'PE/EXE', bytes: [0x4d, 0x5a] },
  { ten: 'Mach-O', bytes: [0xcf, 0xfa, 0xed, 0xfe] },
  { ten: 'Mach-O', bytes: [0xce, 0xfa, 0xed, 0xfe] },
  { ten: 'Java class', bytes: [0xca, 0xfe, 0xba, 0xbe] },
  { ten: 'WASM', bytes: [0x00, 0x61, 0x73, 0x6d] },
  // Archives: a zip is how you smuggle everything above past a naive check,
  // and nothing in this workspace has a legitimate reason to be one.
  { ten: 'ZIP', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ten: 'GZIP', bytes: [0x1f, 0x8b] },
  { ten: 'RAR', bytes: [0x52, 0x61, 0x72, 0x21] },
  { ten: '7z', bytes: [0x37, 0x7a, 0xbc, 0xaf] },
];

function khop(data: Uint8Array, bytes: Array<number | null>, offset = 0): boolean {
  if (data.length < offset + bytes.length) return false;
  return bytes.every((b, i) => b === null || data[offset + i] === b);
}

/** The executable format these bytes are, or null. */
export function nhanDangThucThi(data: Uint8Array): string | null {
  for (const { ten, bytes } of CHU_KY_THUC_THI) {
    if (khop(data, bytes)) return ten;
  }
  return null;
}

/** Sniff a binary MIME from magic bytes, or null when the bytes are not binary. */
export function nguiMime(data: Uint8Array): string | null {
  for (const c of CHU_KY) {
    if (khop(data, c.bytes, c.offset ?? 0)) return c.mime;
  }
  return null;
}

/**
 * Does this look like a shell script?
 *
 * A `#!` at byte zero is what makes a file executable to a kernel, whatever its
 * extension. A student's Python file has no reason to carry one — they run their
 * code through the workspace, never by execute bit — so refusing it costs
 * nothing and removes a whole class of confusion later.
 */
export function coShebang(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x23 && data[1] === 0x21;
}

/** Valid UTF-8 that contains no NUL — our definition of "a text file". */
export function laVanBanUtf8(data: Uint8Array): boolean {
  if (data.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return true;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Paths
// ═══════════════════════════════════════════════════════════════════════════

/** Segments that must never appear, on any platform. */
const TEN_CAM = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

export interface KetQuaDuongDan {
  ok: boolean;
  duongDan: string;
  lyDo: string;
}

/**
 * Validate a display path such as `assets/player.png`.
 *
 * This is belt AND braces: the result is only ever a label stored in a column,
 * because the bytes live under a content-addressed key derived from their own
 * hash. Even so it is validated as if it were going to be joined onto a
 * filesystem root, because one day someone will write code that does exactly
 * that, and the traversal has to already be impossible by then.
 */
export function kiemTraDuongDan(raw: string): KetQuaDuongDan {
  const xau = (lyDo: string): KetQuaDuongDan => ({ ok: false, duongDan: '', lyDo });

  // Normalise separators first so `assets\..\..\x` is seen for what it is.
  const chuanHoa = raw.replace(/\\/g, '/').trim();

  if (!chuanHoa) return xau('Tên tệp không được để trống.');
  if (chuanHoa.length > DAI_DUONG_DAN_TOI_DA) {
    return xau(`Đường dẫn quá dài (tối đa ${DAI_DUONG_DAN_TOI_DA} ký tự).`);
  }
  if (chuanHoa.startsWith('/')) return xau('Đường dẫn phải là tương đối.');
  // Windows drive letters, and anything else that reads as absolute.
  if (/^[a-zA-Z]:/.test(chuanHoa)) return xau('Đường dẫn phải là tương đối.');
  if (chuanHoa.includes('\0')) return xau('Đường dẫn chứa ký tự không hợp lệ.');

  const phan = chuanHoa.split('/').filter((p) => p !== '');
  if (phan.length === 0) return xau('Tên tệp không hợp lệ.');
  if (phan.length > 6) return xau('Thư mục lồng quá sâu (tối đa 6 cấp).');

  for (const p of phan) {
    if (p === '.' || p === '..') return xau('Đường dẫn không được chứa "." hoặc "..".');
    if (TEN_CAM.has(p.toLowerCase().split('.')[0] ?? '')) {
      return xau(`"${p}" là tên dành riêng của hệ điều hành.`);
    }
    /*
     * Control characters, plus the characters Windows refuses outright.
     *
     * The control range is the point of this check, not an accident: a newline
     * or a NUL inside a filename is how a name gets truncated or split by
     * something downstream that was not expecting one.
     */
    // eslint-disable-next-line no-control-regex
    if (/[ -<>:"|?*]/.test(p)) {
      return xau(`"${p}" chứa ký tự không dùng được trong tên tệp.`);
    }
    if (p.endsWith('.') || p.endsWith(' ')) {
      return xau('Tên tệp không được kết thúc bằng dấu chấm hoặc dấu cách.');
    }
  }

  return { ok: true, duongDan: phan.join('/'), lyDo: '' };
}

/** Lowercase extension without the dot, or '' when there is none. */
export function layDuoi(duongDan: string): string {
  const ten = duongDan.split('/').pop() ?? '';
  const i = ten.lastIndexOf('.');
  return i <= 0 ? '' : ten.slice(i + 1).toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
// The whole check
// ═══════════════════════════════════════════════════════════════════════════

export interface KetQuaKiemTra {
  ok: boolean;
  /** Sanitised path, only when ok. */
  duongDan: string;
  dinhDang: DinhDang | null;
  /** MIME decided by content, not by the client. */
  mime: string;
  lyDo: string;
  /** Short machine-readable code, for tests and logs. */
  ma:
    | 'ok'
    | 'duong-dan'
    | 'duoi-khong-cho-phep'
    | 'qua-lon'
    | 'rong'
    | 'thuc-thi'
    | 'shebang'
    | 'khong-khop-noi-dung'
    | 'khong-phai-van-ban';
}

/**
 * Accept or refuse one uploaded file.
 *
 * Order matters and is deliberate: executable content is checked BEFORE the
 * extension allowlist, so a disguised binary is reported as what it actually is.
 */
export function kiemTraTepTai(
  duongDanRaw: string,
  data: Uint8Array,
  gioiHanByte: number = GIOI_HAN_TEP_BYTE,
): KetQuaKiemTra {
  const xau = (ma: KetQuaKiemTra['ma'], lyDo: string): KetQuaKiemTra => ({
    ok: false,
    duongDan: '',
    dinhDang: null,
    mime: '',
    lyDo,
    ma,
  });

  const dd = kiemTraDuongDan(duongDanRaw);
  if (!dd.ok) return xau('duong-dan', dd.lyDo);

  if (data.length === 0) return xau('rong', 'Tệp rỗng.');
  if (data.length > gioiHanByte) {
    const mb = (gioiHanByte / 1024 / 1024).toFixed(0);
    return xau('qua-lon', `Tệp lớn hơn ${mb} MB. Em thử giảm kích thước rồi tải lại nhé.`);
  }

  // Before anything else: is this an executable pretending to be an asset?
  const thucThi = nhanDangThucThi(data);
  if (thucThi) {
    return xau('thuc-thi', `Đây là tệp thực thi (${thucThi}), không phải tài nguyên trò chơi.`);
  }
  if (coShebang(data)) {
    return xau('shebang', 'Tệp bắt đầu bằng "#!" nên bị coi là tệp lệnh. Em bỏ dòng đó đi nhé.');
  }

  const duoi = layDuoi(dd.duongDan);
  const dinhDang = timDinhDang(duoi);
  if (!dinhDang) {
    const cho = DINH_DANG_CHO_PHEP.map((d) => `.${d.duoi}`).join(', ');
    return xau(
      'duoi-khong-cho-phep',
      `Không nhận tệp .${duoi || '(không có đuôi)'}. Chỉ nhận: ${cho}.`,
    );
  }

  if (dinhDang.laVanBan) {
    if (!laVanBanUtf8(data)) {
      return xau(
        'khong-phai-van-ban',
        `Tệp .${duoi} phải là văn bản UTF-8. Tệp này chứa dữ liệu nhị phân.`,
      );
    }
    return { ok: true, duongDan: dd.duongDan, dinhDang, mime: dinhDang.mime, lyDo: '', ma: 'ok' };
  }

  // Binary: the bytes have to actually be the format the name claims.
  const ngui = nguiMime(data);
  if (!ngui) {
    return xau('khong-khop-noi-dung', `Nội dung tệp không phải định dạng .${duoi} hợp lệ.`);
  }
  if (ngui !== dinhDang.mime) {
    return xau(
      'khong-khop-noi-dung',
      `Tên tệp là .${duoi} nhưng nội dung bên trong là ${ngui}. Em đổi lại đuôi cho đúng nhé.`,
    );
  }

  return { ok: true, duongDan: dd.duongDan, dinhDang, mime: ngui, lyDo: '', ma: 'ok' };
}

/** Would adding `themByte` push the project over its budget? */
export function conDuDungLuong(
  dangDungByte: number,
  themByte: number,
  gioiHan: number = GIOI_HAN_DU_AN_BYTE,
): { ok: boolean; lyDo: string } {
  if (dangDungByte + themByte <= gioiHan) return { ok: true, lyDo: '' };

  const mb = (gioiHan / 1024 / 1024).toFixed(0);
  const dung = (dangDungByte / 1024 / 1024).toFixed(1);
  return {
    ok: false,
    lyDo: `Dự án đã dùng ${dung} MB trên ${mb} MB. Em xoá bớt tệp không dùng rồi tải lại nhé.`,
  };
}
