'use client';

import {
  kiemTraThuyetTrinh,
  moTaLoiThuyetTrinh,
  NOI_DUNG_TRANG_TOI_DA,
  SO_TRANG_THUYET_TRINH,
  TIEU_DE_TRANG_TOI_DA,
  type TrangThuyetTrinh,
} from '@dye/core/trang-thuyet-trinh';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import {
  nopBaiThuyetTrinh,
  type KetQuaThuyetTrinhUI,
} from '@/app/(hoc-sinh)/bai-hoc/[slug]/actions';
import { hienThiLuc } from '@/lib/thoi-gian';

import { docBanSao, khoaBanSao, useBanSaoCucBo } from './ban-sao-cuc-bo';
import { SAC_THAI } from '../ui/sac-thai';

/**
 * Thuyết trình — eight slides summarising fifteen sessions.
 *
 * ── Deliberately not a slide editor ──────────────────────────────────────────
 * A title and a text box per slide, and a preview that shows what the class
 * will see. Lines that start with `- ` become bullets; everything else is a
 * paragraph. No fonts, no colours, no drag handles: the work being asked for
 * is deciding WHAT to say about fifteen sessions, and a canvas full of styling
 * controls is an invitation to spend the hour on the styling instead.
 *
 * The preview is plain text laid out by React — never markdown rendered to
 * HTML — so nothing a child types can become markup.
 *
 * ── The same rule on both sides ──────────────────────────────────────────────
 * "Nộp bài" lights up exactly when `kiemTraThuyetTrinh` — the function
 * `nopThuyetTrinh` runs on the server — says the deck is complete. When it is
 * not, the first problem is printed next to the button, so a child is told
 * "Trang 4 chưa có nội dung" before pressing anything rather than after.
 *
 * ── Nothing a child wrote is lost ────────────────────────────────────────────
 * The deck is backed up to this browser as it is typed (the helper the code
 * editor and the reflection box use), restored on the next visit, and dropped
 * only once the server has it.
 */

export interface ThuyetTrinhDaGui {
  trang: TrangThuyetTrinh[];
  /** ISO. */
  nopLuc: string;
}

const trangTrong = (): TrangThuyetTrinh[] =>
  Array.from({ length: SO_TRANG_THUYET_TRINH }, () => ({ tieuDe: '', noiDung: '' }));

/** A backup from storage, if it is still the shape this version writes. */
function docBoTrang(json: string): TrangThuyetTrinh[] | null {
  try {
    const ds: unknown = JSON.parse(json);
    if (!Array.isArray(ds) || ds.length !== SO_TRANG_THUYET_TRINH) return null;
    return ds.map((t) => {
      const b = typeof t === 'object' && t !== null ? (t as Record<string, unknown>) : {};
      return {
        tieuDe: typeof b['tieuDe'] === 'string' ? b['tieuDe'] : '',
        noiDung: typeof b['noiDung'] === 'string' ? b['noiDung'] : '',
      };
    });
  } catch {
    return null;
  }
}

const xongTrang = (t: TrangThuyetTrinh) => t.tieuDe.trim() !== '' && t.noiDung.trim() !== '';

export function KhoiThuyetTrinh({
  blockId,
  tuBuoi,
  denBuoi,
  goiY,
  hocSinhId,
  daNop,
}: {
  blockId: string;
  tuBuoi: number;
  denBuoi: number;
  /** A suggested title per slide, shown as the placeholder. */
  goiY: string[];
  /** Keys the browser backup; without it there is none (see ban-sao-cuc-bo). */
  hocSinhId?: string | undefined;
  /** The deck on record, read by the server with the page. */
  daNop: ThuyetTrinhDaGui | null;
}) {
  const id = useId();
  const [trang, setTrang] = useState<TrangThuyetTrinh[]>(trangTrong);
  const [dangSua, setDangSua] = useState(0);
  const [guiTrongPhien, setGuiTrongPhien] = useState<ThuyetTrinhDaGui | null>(null);
  const [ketQua, setKetQua] = useState<KetQuaThuyetTrinhUI | null>(null);
  const [daKhoiPhuc, setDaKhoiPhuc] = useState(false);
  const [dangGui, batDau] = useTransition();

  const khoa = hocSinhId ? khoaBanSao(hocSinhId, `thuyet-trinh:${blockId}`) : null;
  const banSao = useBanSaoCucBo(khoa, null);

  // Restore after hydration: storage does not exist on the server.
  useEffect(() => {
    if (!khoa || daNop) return;
    const cu = docBanSao(khoa);
    const bo = cu ? docBoTrang(cu.code) : null;
    if (bo && bo.some((t) => t.tieuDe.trim() !== '' || t.noiDung.trim() !== '')) {
      setTrang(bo);
      setDaKhoiPhuc(true);
    }
  }, [khoa, daNop]);

  const daCo = daNop ?? guiTrongPhien;
  if (daCo) return <ThuyetTrinhDaNop bai={daCo} tuBuoi={tuBuoi} denBuoi={denBuoi} />;

  const hienTai = trang[dangSua] ?? { tieuDe: '', noiDung: '' };
  const soXong = trang.filter(xongTrang).length;
  const kiemTra = kiemTraThuyetTrinh(trang);

  function sua(truong: keyof TrangThuyetTrinh, giaTri: string) {
    const moi = trang.map((t, i) => (i === dangSua ? { ...t, [truong]: giaTri } : t));
    setTrang(moi);
    banSao.ghiNhan(JSON.stringify(moi));
    if (ketQua && ketQua.trangThai !== 'da-nhan') setKetQua(null);
  }

  function nop() {
    if (!kiemTra.ok || dangGui) return;
    setKetQua(null);
    const boTrang = kiemTra.trang;
    batDau(async () => {
      const kq = await nopBaiThuyetTrinh(blockId, boTrang).catch((): KetQuaThuyetTrinhUI => ({
        trangThai: 'loi',
        thongDiep:
          'Chưa nộp được — có thể mạng đang chập chờn. Em thử lại nhé, bài vẫn còn nguyên.',
      }));
      setKetQua(kq);
      if (kq.trangThai === 'da-nhan') {
        banSao.xoa();
        setGuiTrongPhien({ trang: boTrang, nopLuc: new Date().toISOString() });
      }
    });
  }

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="overflow-hidden rounded-the border border-chinh/40 bg-be-mat shadow-[var(--shadow-neon)]"
    >
      <header className="border-b border-white/10 p-5 sm:p-6">
        <p className="m-0 text-xs font-semibold tracking-widest text-ngoc uppercase">
          <span aria-hidden="true">🎤 </span>Cột mốc thuyết trình · Buổi {tuBuoi}–{denBuoi}
        </p>
        <h3 id={`${id}-tieu-de`} className="mt-1 mb-3 text-xl font-extrabold">
          Soạn {SO_TRANG_THUYET_TRINH} trang thuyết trình của em
        </h3>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="m-0 text-sm font-medium" aria-live="polite">
            <span
              className={`font-bold tabular-nums ${kiemTra.ok ? 'text-dung' : 'text-chinh-sang'}`}
            >
              {soXong}/{SO_TRANG_THUYET_TRINH} trang
            </span>
            <span className="text-chu-phu"> đã có tiêu đề và nội dung</span>
          </p>
          <div
            aria-hidden="true"
            className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08] sm:w-56"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${kiemTra.ok ? 'bg-dung' : 'bg-linear-to-r from-chinh to-hong'}`}
              style={{ width: `${Math.round((soXong / SO_TRANG_THUYET_TRINH) * 100)}%` }}
            />
          </div>
        </div>
        {/* Its own line: a restored draft is usually unfinished, and the
            "còn thiếu" hint by the button must not be what hides this. */}
        {daKhoiPhuc ? (
          <p role="status" className="mt-2 mb-0 text-sm text-chu-nhat">
            <span aria-hidden="true">💾 </span>Đã mở lại phần em đang soạn dở.
          </p>
        ) : null}
      </header>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[11rem_1fr]">
        {/* ── Slide rail ─────────────────────────────────────────────────── */}
        <nav aria-label="Chọn trang để soạn">
          <ol className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-8 lg:grid-cols-1">
            {trang.map((t, i) => {
              const dangChon = i === dangSua;
              const xong = xongTrang(t);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setDangSua(i)}
                    aria-current={dangChon ? 'step' : undefined}
                    className={`flex min-h-cham w-full items-center gap-2 rounded-nut border px-2.5 py-2 text-start text-sm transition-colors ${
                      dangChon
                        ? 'border-chinh-sang bg-chinh-nhat font-semibold text-chu shadow-[var(--shadow-neon)]'
                        : 'border-white/10 bg-nen-sau/60 text-chu-phu hover:border-chinh-sang'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        xong ? 'bg-dung text-nen' : 'bg-white/10 text-chu-phu'
                      }`}
                    >
                      {xong ? '✓' : i + 1}
                    </span>
                    {/* Visible title for sighted users on wide screens; the
                        sr-only line below is the one accessible name. */}
                    <span aria-hidden="true" className="hidden min-w-0 truncate lg:inline">
                      {t.tieuDe.trim() || `Trang ${i + 1}`}
                    </span>
                    <span className="sr-only">
                      {`Trang ${i + 1}${t.tieuDe.trim() ? `: ${t.tieuDe.trim()}` : ''}${xong ? ', đã xong' : ', chưa xong'}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ── Editor + preview ───────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <label htmlFor={`${id}-td`} className="mb-1.5 block text-sm font-semibold">
                Tiêu đề trang {dangSua + 1}
              </label>
              <input
                id={`${id}-td`}
                value={hienTai.tieuDe}
                onChange={(e) => sua('tieuDe', e.target.value)}
                maxLength={TIEU_DE_TRANG_TOI_DA}
                readOnly={dangGui}
                placeholder={goiY[dangSua] ?? `Trang ${dangSua + 1}`}
                autoComplete="off"
                className="min-h-cham w-full rounded-nut border border-white/10 bg-nen-sau/70 px-4 py-2.5 text-base text-chu placeholder:text-chu-nhat focus:border-chinh-sang"
              />
              {hienTai.tieuDe.trim() === '' && goiY[dangSua] ? (
                <button
                  type="button"
                  onClick={() => sua('tieuDe', goiY[dangSua] ?? '')}
                  className="mt-1.5 min-h-cham rounded text-sm font-medium text-chinh-sang underline underline-offset-2"
                >
                  Dùng tiêu đề gợi ý
                </button>
              ) : null}

              <label htmlFor={`${id}-nd`} className="mt-4 mb-1.5 block text-sm font-semibold">
                Nội dung
              </label>
              <textarea
                id={`${id}-nd`}
                value={hienTai.noiDung}
                onChange={(e) => sua('noiDung', e.target.value)}
                maxLength={NOI_DUNG_TRANG_TOI_DA}
                readOnly={dangGui}
                rows={8}
                spellCheck
                lang="vi"
                aria-describedby={`${id}-nd-goi-y`}
                placeholder={'- Ý thứ nhất\n- Ý thứ hai\nHoặc viết một đoạn ngắn.'}
                className="block w-full resize-y rounded-nut border border-white/10 bg-nen-sau/70 p-4 text-base leading-relaxed text-chu placeholder:text-chu-nhat focus:border-chinh-sang"
              />
              <p
                id={`${id}-nd-goi-y`}
                className="mt-1.5 mb-0 flex justify-between gap-3 text-xs font-medium text-chu-nhat"
              >
                <span>
                  Dòng bắt đầu bằng <code className="text-hong-sang">- </code> sẽ thành gạch đầu
                  dòng.
                </span>
                <span className="tabular-nums">
                  {hienTai.noiDung.length}/{NOI_DUNG_TRANG_TOI_DA}
                </span>
              </p>
            </div>

            <div>
              <p className="mt-0 mb-1.5 text-sm font-semibold">Xem trước</p>
              <TrangChieu trang={hienTai} so={dangSua + 1} goiYTieuDe={goiY[dangSua]} />
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              disabled={dangSua === 0}
              onClick={() => setDangSua((i) => Math.max(0, i - 1))}
              className="nut-vien disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true">←</span> Trang trước
            </button>
            <button
              type="button"
              disabled={dangSua === SO_TRANG_THUYET_TRINH - 1}
              onClick={() => setDangSua((i) => Math.min(SO_TRANG_THUYET_TRINH - 1, i + 1))}
              className="nut-vien disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trang sau <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={nop}
              disabled={!kiemTra.ok || dangGui}
              className="nut-neon text-lg"
            >
              <span aria-hidden="true">🚀</span>
              {dangGui ? 'Đang nộp…' : 'Nộp bài thuyết trình'}
            </button>
            {!kiemTra.ok ? (
              <p className="m-0 text-sm text-chu-nhat">
                Còn thiếu: {moTaLoiThuyetTrinh(kiemTra.loi)}
              </p>
            ) : (
              <p className="m-0 text-sm text-chu-nhat">
                Nộp xong sẽ không sửa được, em đọc lại một lượt nhé.
              </p>
            )}
          </div>

          {ketQua && ketQua.trangThai !== 'da-nhan' ? (
            <p
              role="alert"
              className="m-0 rounded-nut border-l-4 border-canh-bao bg-canh-bao/10 px-4 py-3 text-sm text-canh-bao-chu"
            >
              {ketQua.thongDiep}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * A slide's text, laid out: `- ` lines become one bullet list per run, other
 * lines become paragraphs. React nodes only — never an HTML string.
 */
function NoiDungTrang({ noiDung }: { noiDung: string }) {
  const khoi: ReactNode[] = [];
  let dsHienTai: string[] = [];

  const dongDs = () => {
    if (dsHienTai.length === 0) return;
    khoi.push(
      <ul
        key={`ul-${khoi.length}`}
        className="my-[0.6em] list-disc space-y-[0.35em] ps-[1.2em] marker:text-hong-sang"
      >
        {dsHienTai.map((y, i) => (
          <li key={i}>{y}</li>
        ))}
      </ul>,
    );
    dsHienTai = [];
  };

  for (const dong of noiDung.split('\n')) {
    const y = /^\s*[-*•]\s+(.*)$/.exec(dong);
    if (y) {
      dsHienTai.push(y[1] ?? '');
      continue;
    }
    dongDs();
    if (dong.trim() !== '') {
      khoi.push(
        <p key={`p-${khoi.length}`} className="my-[0.5em]">
          {dong}
        </p>,
      );
    }
  }
  dongDs();

  return <>{khoi}</>;
}

/**
 * One slide as the class will see it: 16:9, the arena grid, a gradient title.
 *
 * Sized with container units so the same markup reads on a 400px preview and
 * on a projector in full screen — with the app's 15px floor under body text,
 * so a small preview never shrinks below what a child can read.
 */
function TrangChieu({
  trang,
  so,
  goiYTieuDe,
}: {
  trang: TrangThuyetTrinh;
  so: number;
  goiYTieuDe?: string | undefined;
}) {
  const coTieuDe = trang.tieuDe.trim() !== '';
  return (
    <div className="@container">
      <div className="relative flex aspect-video w-full flex-col overflow-hidden rounded-the-nho border border-chinh/40 bg-nen-sau nen-luoi p-[5cqw] text-[max(0.9375rem,2.9cqw)] leading-snug text-chu shadow-[var(--shadow-neon)]">
        <p className="m-0 text-[max(0.9375rem,1.8cqw)] font-semibold tracking-widest text-ngoc uppercase">
          Trang {so}/{SO_TRANG_THUYET_TRINH}
        </p>
        <p
          className={`mt-[1cqw] mb-[1.5cqw] text-[max(1.25rem,5.2cqw)] leading-tight font-extrabold ${
            coTieuDe ? '' : 'text-chu-nhat italic'
          }`}
        >
          {coTieuDe ? (
            <span className="chu-neon">{trang.tieuDe}</span>
          ) : (
            (goiYTieuDe ?? 'Tiêu đề trang')
          )}
        </p>
        <div className="min-h-0 flex-1 overflow-hidden break-words">
          {trang.noiDung.trim() !== '' ? (
            <NoiDungTrang noiDung={trang.noiDung} />
          ) : (
            <p className="m-0 text-chu-nhat italic">Nội dung của trang sẽ hiện ở đây.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The deck once handed in: read-only, and presentable.
 *
 * "Trình chiếu" puts the slide in full screen on the classroom projector;
 * ← and → (or PageUp/PageDown, which clickers send) move between slides, both
 * in full screen and out of it.
 */
function ThuyetTrinhDaNop({
  bai,
  tuBuoi,
  denBuoi,
}: {
  bai: ThuyetTrinhDaGui;
  tuBuoi: number;
  denBuoi: number;
}) {
  const id = useId();
  const [so, setSo] = useState(0);
  const khung = useRef<HTMLDivElement | null>(null);
  const tong = bai.trang.length;

  const di = useCallback(
    (buoc: number) => setSo((s) => Math.min(Math.max(0, s + buoc), Math.max(0, tong - 1))),
    [tong],
  );

  const trinhChieu = () => {
    const el = khung.current;
    el?.focus();
    // Not every browser a school owns has it; the viewer works without it.
    void el?.requestFullscreen?.().catch(() => undefined);
  };

  const trangHienTai = bai.trang[so];

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="rounded-the border border-dung/25 bg-the p-5 shadow-mem sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={`${id}-tieu-de`} className="m-0 text-xl font-bold">
          <span aria-hidden="true">✅ </span>Bài thuyết trình Buổi {tuBuoi}–{denBuoi}
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.dung}`}>
          Đã nộp · {tong} trang
        </span>
        <span className="text-sm font-medium text-chu-nhat">{hienThiLuc(bai.nopLuc)}</span>
      </div>

      <div
        ref={khung}
        tabIndex={0}
        role="group"
        aria-roledescription="trình chiếu"
        aria-label={`Trang ${so + 1} trên ${tong}`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            di(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            di(-1);
          }
        }}
        className="rounded-the-nho [&:fullscreen]:grid [&:fullscreen]:place-items-center [&:fullscreen]:bg-nen [&:fullscreen]:p-6"
      >
        <div className="w-full [:fullscreen_&]:w-[min(100%,calc((100dvh-3rem)*16/9))]">
          {trangHienTai ? <TrangChieu trang={trangHienTai} so={so + 1} /> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => di(-1)}
            disabled={so === 0}
            className="nut-vien disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">←</span>
            <span className="sr-only">Trang trước</span>
          </button>
          <button
            type="button"
            onClick={() => di(1)}
            disabled={so >= tong - 1}
            className="nut-vien disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">→</span>
            <span className="sr-only">Trang sau</span>
          </button>
        </div>
        <button type="button" onClick={trinhChieu} className="nut-neon">
          <span aria-hidden="true">▶</span> Trình chiếu
        </button>
      </div>
      <p role="status" className="mt-3 mb-0 text-sm text-chu-phu">
        Thầy cô sẽ xem bài và hẹn em trình bày trước lớp. Bấm vào khung trình chiếu rồi dùng phím ←
        → để chuyển trang.
      </p>
    </section>
  );
}
