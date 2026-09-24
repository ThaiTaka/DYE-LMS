'use client';

import { demSoChu, SO_CHU_TOI_THIEU_SUY_NGAM, SUY_NGAM_TOI_DA_KY_TU } from '@dye/core/dem-chu';
import { useEffect, useId, useState, useTransition, type FormEvent } from 'react';

import {
  nopBaiTuLuanHocTap,
  type KetQuaTuLuanHocTapUI,
} from '@/app/(hoc-sinh)/bai-hoc/[slug]/actions';
import { hienThiLuc } from '@/lib/thoi-gian';

import { docBanSao, khoaBanSao, useBanSaoCucBo } from './ban-sao-cuc-bo';
import { SAC_THAI } from '../ui/sac-thai';
import { TheKinh } from '../ui/the-kinh';

/**
 * Three questions to write from.
 *
 * 150 words is a lot of blank page for a ten-year-old. These are not required
 * sections — nothing checks for them — they are somewhere to start when the
 * box is empty and the cursor is blinking.
 */
const GOI_Y = [
  'Hôm nay em đã học được điều gì mới?',
  'Phần nào khó nhất, và em đã vượt qua nó thế nào?',
  'Em muốn dùng điều vừa học để làm gì?',
];

export interface TuLuanHocTapDaGui {
  noiDung: string;
  soChu: number;
  /** ISO. */
  nopLuc: string;
}

export interface KhoiTuLuanHocTapProps {
  lessonId: string;
  /**
   * Keys the browser backup of an unfinished reflection. Without it there is
   * no backup at all — on a shared laptop, a copy keyed only by lesson would
   * be offered to whichever child sat down next.
   */
  hocSinhId?: string | undefined;
  /** The reflection on record, read by the server with the page. */
  daNop: TuLuanHocTapDaGui | null;
  /** A teacher previewing the lesson: the box is shown, never sent. */
  xemTruoc?: boolean | undefined;
  /** An integrity lock is in force; the server would refuse, so say so first. */
  biKhoa?: boolean | undefined;
}

/**
 * "Hôm nay em đã học được gì?" — the post-lesson reflection.
 *
 * ── The 150-word rule, on both sides ─────────────────────────────────────────
 * The counter and the server both call `demSoChu` from `@dye/core/dem-chu`, so
 * "150/150" on this screen is exactly what `nopTuLuanHocTap` will accept. The
 * button stays disabled until then. That is a courtesy — the server refuses
 * 149 words on its own — but it is the courtesy that matters: the child sees
 * how far they have to go before they press anything, instead of after.
 *
 * ── Nothing a child wrote is lost ────────────────────────────────────────────
 * The text is backed up to this browser as it is typed (the same helper the
 * code editor uses), restored on the next visit, and dropped only once the
 * server has it. A refusal of any kind leaves the text in the box.
 *
 * ── Once ─────────────────────────────────────────────────────────────────────
 * One reflection per lesson. After sending, the box becomes the reflection,
 * read-only — and because `daNop` comes from the server, that survives a
 * reload rather than living in this component's state.
 */
export function KhoiTuLuanHocTap({
  lessonId,
  hocSinhId,
  daNop,
  xemTruoc = false,
  biKhoa = false,
}: KhoiTuLuanHocTapProps) {
  const id = useId();
  const [noiDung, setNoiDung] = useState('');
  const [guiTrongPhien, setGuiTrongPhien] = useState<TuLuanHocTapDaGui | null>(null);
  const [ketQua, setKetQua] = useState<KetQuaTuLuanHocTapUI | null>(null);
  const [daKhoiPhuc, setDaKhoiPhuc] = useState(false);
  const [dangGui, batDau] = useTransition();

  const khoa = hocSinhId && !xemTruoc ? khoaBanSao(hocSinhId, `tu-luan-hoc-tap:${lessonId}`) : null;
  const banSao = useBanSaoCucBo(khoa, null);

  /*
   * Restore after hydration, never during render: storage does not exist on
   * the server, and reading it in the first render would make the page the
   * browser paints disagree with the HTML it was sent.
   */
  useEffect(() => {
    if (!khoa || daNop) return;
    const cu = docBanSao(khoa);
    if (cu && cu.code.trim() !== '') {
      setNoiDung(cu.code);
      setDaKhoiPhuc(true);
    }
  }, [khoa, daNop]);

  const daCo = daNop ?? guiTrongPhien;
  if (daCo) return <TuLuanDaGui baiViet={daCo} />;

  const soChu = demSoChu(noiDung);
  const du = soChu >= SO_CHU_TOI_THIEU_SUY_NGAM;
  const conThieu = Math.max(0, SO_CHU_TOI_THIEU_SUY_NGAM - soChu);
  const phanTram = Math.min(100, Math.round((soChu / SO_CHU_TOI_THIEU_SUY_NGAM) * 100));
  const guiDuoc = du && !dangGui && !xemTruoc && !biKhoa;

  const tieuDeId = `${id}-tieu-de`;
  const demId = `${id}-dem`;
  const goiYId = `${id}-goi-y`;

  function gui(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!guiDuoc) return;
    setKetQua(null);

    const vanBan = noiDung;
    batDau(async () => {
      const kq = await nopBaiTuLuanHocTap(lessonId, vanBan).catch((): KetQuaTuLuanHocTapUI => ({
        trangThai: 'loi',
        thongDiep:
          'Chưa gửi được — có thể mạng đang chập chờn. Em thử lại nhé, bài vẫn còn trong ô.',
      }));
      setKetQua(kq);
      if (kq.trangThai === 'da-nhan') {
        banSao.xoa();
        setGuiTrongPhien({
          noiDung: vanBan.trim(),
          soChu: demSoChu(vanBan),
          nopLuc: new Date().toISOString(),
        });
      }
    });
  }

  return (
    <TheKinh as="section" noiBat aria-labelledby={tieuDeId} className="p-5 sm:p-7">
      <p className="m-0 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-chinh-sang uppercase">
        <span aria-hidden="true">✍️</span> Tổng kết buổi học
      </p>
      <h2 id={tieuDeId} className="mt-1 mb-2 text-2xl font-extrabold">
        Hôm nay em đã học được gì?
      </h2>
      <p className="mt-0 mb-4 text-chu-phu">
        Viết ít nhất <strong className="text-chu">{SO_CHU_TOI_THIEU_SUY_NGAM} chữ</strong> bằng lời
        của chính em — không cần hay, chỉ cần thật. Thầy cô sẽ đọc bài này.
      </p>

      <div id={goiYId} className="mb-4">
        <p className="mt-0 mb-2 text-sm font-semibold text-chu">
          Chưa biết bắt đầu từ đâu? Thử trả lời:
        </p>
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
          {GOI_Y.map((g) => (
            <li
              key={g}
              className="rounded-nut border border-white/10 bg-be-mat px-3 py-2 text-sm text-chu-phu"
            >
              {g}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={gui} noValidate>
        <label htmlFor={`${id}-o`} className="mb-2 block text-sm font-semibold">
          Bài tự luận của em
        </label>
        <textarea
          id={`${id}-o`}
          value={noiDung}
          onChange={(e) => {
            setNoiDung(e.target.value);
            banSao.ghiNhan(e.target.value);
            if (ketQua && ketQua.trangThai !== 'da-nhan') setKetQua(null);
          }}
          rows={9}
          maxLength={SUY_NGAM_TOI_DA_KY_TU}
          readOnly={dangGui}
          spellCheck
          lang="vi"
          aria-describedby={`${demId} ${goiYId}`}
          placeholder="Hôm nay em đã học…"
          className="block min-h-56 w-full resize-y rounded-nut border border-white/10 bg-nen-sau/70 p-4 text-base leading-relaxed text-chu placeholder:text-chu-nhat focus:border-chinh-sang"
        />

        {/*
          The counter.

          Violet while climbing, green at the line, and never amber: amber in
          this app means "try again", and a reflection that is not finished yet
          has not been tried. It is part of the textarea's description, so a
          screen reader hears it on focus; the live region below speaks only
          when the line is crossed, not on every keystroke.
        */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p id={demId} className="m-0 text-sm font-medium">
            <span className={`font-bold tabular-nums ${du ? 'text-dung' : 'text-chinh-sang'}`}>
              {soChu}/{SO_CHU_TOI_THIEU_SUY_NGAM} chữ
            </span>
            <span className="text-chu-phu">
              {du ? ' · Đủ rồi, em gửi được rồi!' : ` · Cần thêm ${conThieu} chữ nữa để gửi bài`}
            </span>
          </p>
          <div
            aria-hidden="true"
            className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08] sm:w-56"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${du ? 'bg-dung' : 'bg-linear-to-r from-chinh to-hong'}`}
              style={{ width: `${phanTram}%` }}
            />
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {du ? `Đã đủ ${SO_CHU_TOI_THIEU_SUY_NGAM} chữ. Em có thể gửi bài.` : ''}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button type="submit" disabled={!guiDuoc} className="nut-neon text-lg">
            <span aria-hidden="true">🚀</span>
            {dangGui ? 'Đang gửi…' : 'Gửi bài tự luận'}
          </button>

          {xemTruoc ? (
            <p className="m-0 text-sm text-chu-nhat">
              Thầy cô đang xem trước — chỉ học sinh mới gửi được bài này.
            </p>
          ) : biKhoa ? (
            <p className="m-0 text-sm text-chu-nhat">
              Bài học đang bị khoá nên chưa gửi được. Em vẫn viết tiếp được, bài sẽ được giữ lại.
            </p>
          ) : daKhoiPhuc ? (
            <p className="m-0 text-sm text-chu-nhat">
              <span aria-hidden="true">💾 </span>Đã mở lại phần em đang viết dở.
            </p>
          ) : null}
        </div>

        {ketQua && ketQua.trangThai !== 'da-nhan' ? (
          <p
            role="alert"
            className="mt-4 mb-0 rounded-nut border-l-4 border-canh-bao bg-canh-bao/10 px-4 py-3 text-sm text-canh-bao-chu"
          >
            {ketQua.thongDiep}
          </p>
        ) : null}
      </form>
    </TheKinh>
  );
}

/** The reflection once sent: read-only, with when and how long. */
function TuLuanDaGui({ baiViet }: { baiViet: TuLuanHocTapDaGui }) {
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="rounded-the border border-dung/25 bg-the p-5 shadow-mem sm:p-7"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`${id}-tieu-de`} className="m-0 text-xl font-bold">
          <span aria-hidden="true">✅ </span>Bài tự luận của em
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.dung}`}>
          Đã gửi · {baiViet.soChu} chữ
        </span>
        <span className="text-sm font-medium text-chu-nhat">{hienThiLuc(baiViet.nopLuc)}</span>
      </div>
      <p role="status" className="mt-0 mb-4 text-sm text-chu-phu">
        Cảm ơn em! Thầy cô sẽ đọc bài này. Mỗi buổi học em gửi một bài tự luận.
      </p>
      <div className="max-h-80 overflow-auto rounded-nut border border-white/10 bg-be-mat p-4">
        <p className="m-0 leading-relaxed whitespace-pre-wrap">{baiViet.noiDung}</p>
      </div>
    </section>
  );
}
