'use client';

import { useEffect, useId, useState, useTransition } from 'react';

import { nopBaiTap, type KetQuaNopBaiTapUI } from '@/app/(hoc-sinh)/bai-tap/actions';
import { hienThiLuc } from '@/lib/thoi-gian';

import { docBanSao, khoaBanSao, nenKhoiPhuc, useBanSaoCucBo } from './ban-sao-cuc-bo';
import { HuongDanBanPhim, SoanThao } from './soan-thao';

export interface KhuBaiTapVeNhaProps {
  homeworkId: string;
  tieuDe: string;
  /** The teacher's template. What the editor opens with before a first hand-in. */
  maMau: string;
  /** The hand-in on record, if any. */
  baiNop: { code: string; nopLuc: string; nopMuon: boolean; daCham: boolean } | null;
  /** Keys the browser backup; see `ban-sao-cuc-bo.ts` for why it is per child. */
  hocSinhId: string;
}

/**
 * Where a student writes and hands in a homework.
 *
 * ── What it deliberately is not ──────────────────────────────────────────────
 * Not the lesson workspace (`KhuLamBai`). Homework is never judged, so there
 * is no Run, no verdict and no version history — a child writes, hands in, and
 * may hand in again until the teacher has read it. Reusing the lesson
 * workspace would have put a "Chạy thử" button on screen that could only fail.
 *
 * ── The editor opens on the most recent thing the child typed ────────────────
 * In order: an unsent browser backup newer than the hand-in on record, then
 * the hand-in, then the teacher's template. The backup is restored after
 * hydration (storage does not exist on the server) and the child is told.
 *
 * ── Frozen once graded ───────────────────────────────────────────────────────
 * After grading the editor is read-only and the button is gone: the teacher's
 * feedback is about this code, and the server refuses to replace it anyway.
 */
export function KhuBaiTapVeNha({
  homeworkId,
  tieuDe,
  maMau,
  baiNop,
  hocSinhId,
}: KhuBaiTapVeNhaProps) {
  const id = useId();
  const maMayChu = baiNop?.code ?? maMau;
  const [ma, setMa] = useState(maMayChu);
  const [nopLuc, setNopLuc] = useState<string | null>(baiNop?.nopLuc ?? null);
  const [nopMuon, setNopMuon] = useState(baiNop?.nopMuon ?? false);
  const [ketQua, setKetQua] = useState<KetQuaNopBaiTapUI | null>(null);
  const [daKhoiPhuc, setDaKhoiPhuc] = useState(false);
  const [xacNhanDatLai, setXacNhanDatLai] = useState(false);
  const [dangNop, batDau] = useTransition();

  const daCham = baiNop?.daCham ?? false;
  const khoa = daCham ? null : khoaBanSao(hocSinhId, `bai-tap:${homeworkId}`);
  const banSao = useBanSaoCucBo(khoa, nopLuc);

  useEffect(() => {
    if (!khoa) return;
    const cu = docBanSao(khoa);
    if (nenKhoiPhuc(cu, maMayChu, baiNop?.nopLuc ?? null) && cu) {
      setMa(cu.code);
      setDaKhoiPhuc(true);
    }
    // Once, on arrival: later changes to these come from this component itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doiMa(moi: string) {
    setMa(moi);
    banSao.ghiNhan(moi);
    if (ketQua && ketQua.trangThai !== 'da-nop') setKetQua(null);
  }

  function nop() {
    setKetQua(null);
    const guiDi = ma;
    batDau(async () => {
      const kq = await nopBaiTap(homeworkId, guiDi).catch((): KetQuaNopBaiTapUI => ({
        trangThai: 'loi',
        thongDiep:
          'Chưa nộp được — có thể mạng đang chập chờn. Em thử lại nhé, code vẫn còn trong ô.',
        nopLuc: null,
        nopMuon: false,
      }));
      setKetQua(kq);
      if (kq.trangThai === 'da-nop' && kq.nopLuc) {
        setNopLuc(kq.nopLuc);
        setNopMuon(kq.nopMuon);
        banSao.daDongBo(guiDi);
      }
    });
  }

  const banPhimId = `${id}-ban-phim`;
  const coMau = maMau.trim() !== '';

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="rounded-the border border-white/10 bg-be-mat shadow-mem"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <h2 id={`${id}-tieu-de`} className="m-0 text-lg font-bold">
          {daCham ? 'Bài em đã nộp' : 'Bài làm của em'}
        </h2>
        <p aria-live="polite" className="m-0 text-sm text-chu-nhat">
          {nopLuc ? (
            <>
              <span aria-hidden="true">📬 </span>
              Đã nộp lúc <span className="whitespace-nowrap">{hienThiLuc(nopLuc)}</span>
              {nopMuon ? ' · nộp sau hạn' : ''}
            </>
          ) : (
            'Chưa nộp'
          )}
        </p>
      </div>

      <div className="p-3 sm:p-4">
        <SoanThao
          giaTri={ma}
          onDoi={doiMa}
          nhan={`Code bài tập: ${tieuDe}`}
          moTaBoi={banPhimId}
          chiDoc={daCham}
          soDongToiThieu={14}
        />
        <HuongDanBanPhim id={banPhimId} className="mt-2" />
      </div>

      {daCham ? (
        <p className="m-0 border-t border-white/10 px-4 py-3 text-sm text-chu-phu sm:px-5">
          Thầy cô đã chấm bài này nên không sửa được nữa. Nhận xét ở ngay phía trên.
        </p>
      ) : (
        <div className="border-t border-white/10 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={nop} disabled={dangNop} className="nut-neon">
              <span aria-hidden="true">📤</span>
              {dangNop ? 'Đang nộp…' : nopLuc ? 'Nộp lại bài' : 'Nộp bài'}
            </button>

            {coMau && ma !== maMau ? (
              <button
                type="button"
                onClick={() => setXacNhanDatLai((v) => !v)}
                aria-expanded={xacNhanDatLai}
                aria-controls={`${id}-dat-lai`}
                disabled={dangNop}
                className="nut-vien text-sm"
              >
                Đặt lại về mẫu…
              </button>
            ) : null}

            {daKhoiPhuc ? (
              <p className="m-0 text-sm text-chu-nhat">
                <span aria-hidden="true">💾 </span>Đã mở lại phần em đang viết dở trên máy này.
              </p>
            ) : null}
          </div>

          {xacNhanDatLai && coMau && ma !== maMau ? (
            <div
              id={`${id}-dat-lai`}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-nut border-l-4 border-canh-bao bg-canh-bao/10 px-4 py-3"
            >
              <p className="m-0 text-sm text-canh-bao-chu">
                Code trong ô sẽ được thay bằng mã mẫu của thầy cô. Bài em đã nộp thì không bị đổi.
              </p>
              <button
                type="button"
                onClick={() => {
                  doiMa(maMau);
                  setXacNhanDatLai(false);
                }}
                className="min-h-cham rounded-nut border border-canh-bao px-3 py-1.5 text-sm font-semibold text-canh-bao-chu hover:bg-canh-bao/15"
              >
                Đặt lại
              </button>
            </div>
          ) : null}

          {ketQua ? (
            <p
              role={ketQua.trangThai === 'da-nop' ? 'status' : 'alert'}
              className={`mt-3 mb-0 text-sm font-medium ${ketQua.trangThai === 'da-nop' ? 'text-dung' : 'text-thu-lai'}`}
            >
              <span aria-hidden="true">{ketQua.trangThai === 'da-nop' ? '✓ ' : '! '}</span>
              {ketQua.thongDiep}
            </p>
          ) : (
            <p className="mt-3 mb-0 text-sm text-chu-nhat">
              Nộp rồi em vẫn sửa và nộp lại được, cho tới khi thầy cô chấm bài.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
