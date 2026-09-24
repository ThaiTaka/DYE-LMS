/**
 * What counts as a finished presentation — pure, and shared by both sides.
 *
 * The builder in the browser and `nopThuyetTrinh` on the server both call
 * `kiemTraThuyetTrinh`, so "Nộp bài thuyết trình" lights up on exactly the
 * input the server will accept. The button is the courtesy; the server call is
 * the rule. Exported through `@dye/core/trang-thuyet-trinh` for the browser.
 */

/** Exactly this many slides — no more, no fewer. */
export const SO_TRANG_THUYET_TRINH = 8;

/** A slide title is a headline, not a paragraph. */
export const TIEU_DE_TRANG_TOI_DA = 80;

/** Roughly what fits on one projected slide at a readable size. */
export const NOI_DUNG_TRANG_TOI_DA = 1200;

export interface TrangThuyetTrinh {
  tieuDe: string;
  noiDung: string;
}

export type LoiThuyetTrinh =
  | { loai: 'sai-so-trang'; soTrang: number }
  | { loai: 'trang-trong'; trang: number; thieu: 'tieu-de' | 'noi-dung' }
  | { loai: 'qua-dai'; trang: number; truong: 'tieu-de' | 'noi-dung'; toiDa: number };

export type KetQuaKiemTraThuyetTrinh =
  { ok: true; trang: TrangThuyetTrinh[] } | { ok: false; loi: LoiThuyetTrinh };

/**
 * Validate and normalise untrusted slides.
 *
 * Trims every field — a title of three spaces is an empty title — and reports
 * the FIRST problem, with the slide number a child would count (1-based), so
 * the message can say "Trang 4 chưa có nội dung" instead of "invalid input".
 */
export function kiemTraThuyetTrinh(dauVao: unknown): KetQuaKiemTraThuyetTrinh {
  if (!Array.isArray(dauVao) || dauVao.length !== SO_TRANG_THUYET_TRINH) {
    return {
      ok: false,
      loi: { loai: 'sai-so-trang', soTrang: Array.isArray(dauVao) ? dauVao.length : 0 },
    };
  }

  const trang: TrangThuyetTrinh[] = [];
  for (const [i, t] of dauVao.entries()) {
    const so = i + 1;
    const ban = typeof t === 'object' && t !== null ? (t as Record<string, unknown>) : {};
    const tieuDe = typeof ban['tieuDe'] === 'string' ? ban['tieuDe'].trim() : '';
    const noiDung = typeof ban['noiDung'] === 'string' ? ban['noiDung'].trim() : '';

    if (tieuDe === '')
      return { ok: false, loi: { loai: 'trang-trong', trang: so, thieu: 'tieu-de' } };
    if (noiDung === '')
      return { ok: false, loi: { loai: 'trang-trong', trang: so, thieu: 'noi-dung' } };
    if (tieuDe.length > TIEU_DE_TRANG_TOI_DA) {
      return {
        ok: false,
        loi: { loai: 'qua-dai', trang: so, truong: 'tieu-de', toiDa: TIEU_DE_TRANG_TOI_DA },
      };
    }
    if (noiDung.length > NOI_DUNG_TRANG_TOI_DA) {
      return {
        ok: false,
        loi: { loai: 'qua-dai', trang: so, truong: 'noi-dung', toiDa: NOI_DUNG_TRANG_TOI_DA },
      };
    }

    trang.push({ tieuDe, noiDung });
  }

  return { ok: true, trang };
}

/** The problem, as a sentence a student can act on. */
export function moTaLoiThuyetTrinh(loi: LoiThuyetTrinh): string {
  switch (loi.loai) {
    case 'sai-so-trang':
      return `Bài thuyết trình cần đúng ${SO_TRANG_THUYET_TRINH} trang (hiện có ${loi.soTrang}).`;
    case 'trang-trong':
      return loi.thieu === 'tieu-de'
        ? `Trang ${loi.trang} chưa có tiêu đề.`
        : `Trang ${loi.trang} chưa có nội dung.`;
    case 'qua-dai':
      return loi.truong === 'tieu-de'
        ? `Tiêu đề trang ${loi.trang} dài quá — tối đa ${loi.toiDa} ký tự.`
        : `Nội dung trang ${loi.trang} dài quá — tối đa ${loi.toiDa} ký tự.`;
    default: {
      const unreachable: never = loi;
      void unreachable;
      return 'Bài thuyết trình chưa hợp lệ.';
    }
  }
}
