'use client';

import {
  batDauTran,
  danhMotLuot,
  phanTramMau,
  type KetQuaTran,
  type TranBoss,
} from '@dye/core/tran-boss';
import { useEffect, useId, useRef, useState } from 'react';

import {
  danhBoss,
  danhDauKhoiXong,
  type KetQuaDanhBossUI,
} from '@/app/(hoc-sinh)/bai-hoc/[slug]/actions';

import { CauVoiChoTrong } from './bai-trac-nghiem';
import { HinhBaiHoc } from './hinh-bai-hoc';
import { NutDaDocXong } from './nut-da-doc-xong';

import type { CauHoiOnTap } from '@dye/core';

/**
 * Ôn tập — the review boss fight that closes every fifth session.
 *
 * ── The rules are not decided here ───────────────────────────────────────────
 * HP, hearts and "who won" come from `@dye/core/tran-boss`, the same pure
 * module the tests pin down: whatever the pool size, a fight ends before the
 * questions run out. This component only draws the state and asks the server
 * whether an answer was right. It never knows the answer before it asks —
 * `danhBoss` marks on the server, and the questions it was given are ones the
 * student has already answered in their home lesson (see `deOnTap`), so the
 * fight cannot be used to probe a question that is still open.
 *
 * ── Tone ─────────────────────────────────────────────────────────────────────
 * It is a game, so there is a winner — but the student's side is never red and
 * never says "thua". A miss costs a heart and shows the right answer, because
 * seeing it is the review. Running out of hearts ends one fight, not the
 * lesson: the block completes either way (effort counts, as everywhere else),
 * and "Đấu lại" is the biggest thing on the screen.
 */

interface PhanHoiDon {
  dung: boolean;
  dapAnDung: string | null;
  giaiThich: string | null;
}

/** Fisher–Yates, for a rematch. Runs in a click handler, never during render. */
function tron<T>(ds: readonly T[]): T[] {
  const kq = [...ds];
  for (let i = kq.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [kq[i], kq[j]] = [kq[j] as T, kq[i] as T];
  }
  return kq;
}

export function KhoiDanhBoss({
  blockId,
  tenBoss,
  bieuTuong,
  tuBuoi,
  denBuoi,
  cauHoi,
  daXong,
}: {
  blockId: string;
  tenBoss: string;
  bieuTuong: string;
  tuBuoi: number;
  denBuoi: number;
  /** Server-shuffled, answer key stripped. Empty when there is nothing to review yet. */
  cauHoi: CauHoiOnTap[];
  /** The block is already complete on the server. */
  daXong: boolean;
}) {
  const id = useId();
  // The server's order for the first fight, so the first render matches the
  // HTML; a rematch reshuffles in its click handler.
  const [thuTu, setThuTu] = useState(cauHoi);
  const [tran, setTran] = useState<TranBoss>(() => batDauTran(cauHoi.length));
  /*
   * The question ON SCREEN — not `tran.daHoi`. The fight counts an answer the
   * moment it is marked, but the answered question has to stay up, with its
   * verdict under it, until the student asks for the next one. Deriving the
   * question from the count swapped it out under its own feedback.
   */
  const [chiSo, setChiSo] = useState(0);
  const [vaoTran, setVaoTran] = useState(false);
  const [phanHoi, setPhanHoi] = useState<PhanHoiDon | null>(null);
  const [dangGui, setDangGui] = useState(false);
  const [nhapTay, setNhapTay] = useState('');
  const [loi, setLoi] = useState<string | null>(null);
  /** Bumped on every hit so the shake and the "−1" replay by remounting. */
  const [don, setDon] = useState<{ so: number; trung: 'boss' | 'em' } | null>(null);
  const [daGhiNhan, setDaGhiNhan] = useState(daXong);
  const daGhiRef = useRef(daXong);

  const ketThuc = tran.ketQua !== 'dang-danh';
  const cauHienTai = thuTu[chiSo];

  /*
   * A finished fight completes the block, win or lose — once per mount, and
   * the server upsert is idempotent anyway. Effort is what counts; a child who
   * lost three fights has still reviewed thirty questions.
   */
  useEffect(() => {
    if (!vaoTran || !ketThuc || daGhiRef.current) return;
    daGhiRef.current = true;
    void danhDauKhoiXong(blockId)
      .then((kq) => setDaGhiNhan(kq.daGhi))
      .catch(() => undefined);
  }, [vaoTran, ketThuc, blockId]);

  // ── Nothing to review yet ───────────────────────────────────────────────────
  if (cauHoi.length === 0) {
    return (
      <div className="rounded-the border border-vien bg-be-mat nen-luoi p-5 sm:p-6">
        <p className="m-0 flex items-start gap-3">
          <span aria-hidden="true" className="text-4xl leading-none">
            {bieuTuong}
          </span>
          <span>
            <strong className="block text-chu">{tenBoss} đang ngủ say 😴</strong>
            <span className="text-sm text-chu-phu">
              Trận ôn tập lấy câu hỏi từ các bài trắc nghiệm em đã làm ở Buổi {tuBuoi}–{denBuoi}. Em
              chưa có câu nào ở đó nên chưa đấu được — cứ học tiếp nhé!
            </span>
          </span>
        </p>
        <NutDaDocXong blockId={blockId} daXong={daXong} nhan="Em đã xem xong" />
      </div>
    );
  }

  async function traLoi(giaTri: string) {
    if (!cauHienTai || dangGui || phanHoi || ketThuc || giaTri.trim() === '') return;
    setDangGui(true);
    setLoi(null);
    try {
      const kq: KetQuaDanhBossUI = await danhBoss(blockId, cauHienTai.id, giaTri).catch(() => ({
        trangThai: 'tu-choi' as const,
        thongDiep: 'Mạng đang chập chờn nên chưa gửi được. Em bấm lại nhé.',
      }));
      if (kq.trangThai === 'tu-choi') {
        setLoi(kq.thongDiep);
        return;
      }
      setPhanHoi({ dung: kq.dung, dapAnDung: kq.dapAnDung, giaiThich: kq.giaiThich });
      setTran((t) => danhMotLuot(t, kq.dung));
      setDon((d) => ({ so: (d?.so ?? 0) + 1, trung: kq.dung ? 'boss' : 'em' }));
    } finally {
      setDangGui(false);
    }
  }

  function tiepTuc() {
    setChiSo((i) => i + 1);
    setPhanHoi(null);
    setNhapTay('');
    setLoi(null);
  }

  function dauLai() {
    setThuTu(tron(cauHoi));
    setTran(batDauTran(cauHoi.length));
    setChiSo(0);
    setPhanHoi(null);
    setNhapTay('');
    setLoi(null);
    setDon(null);
    setVaoTran(true);
  }

  const soDung = tran.mauBossToiDa - tran.mauBoss;
  const bossGuc = tran.ketQua === 'thang';
  const tieuDeId = `${id}-tieu-de`;

  return (
    <section
      aria-labelledby={tieuDeId}
      className="overflow-hidden rounded-the border border-chinh/40 bg-be-mat nen-luoi shadow-[var(--shadow-neon)]"
    >
      {/* ── The arena: boss vs student ───────────────────────────────────── */}
      <div className="border-b border-white/10 p-5 sm:p-6">
        {/* The boss's name is on its side of the arena; the heading names the fight. */}
        <h3
          id={tieuDeId}
          className="mt-0 mb-4 text-xs font-semibold tracking-widest text-ngoc uppercase"
        >
          <span aria-hidden="true">⚔️ </span>Trận ôn tập · Buổi {tuBuoi}–{denBuoi}
        </h3>

        <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <DauSi
            ten={tenBoss}
            chanDung={bieuTuong}
            nhanMau="HP Boss"
            con={tran.mauBoss}
            toiDa={tran.mauBossToiDa}
            tone="boss"
            gucNga={bossGuc}
            trungDon={don?.trung === 'boss' ? don.so : null}
          />
          <p aria-hidden="true" className="m-0 text-center text-2xl font-black text-hong-sang">
            VS
          </p>
          <DauSi
            ten="Em"
            chanDung="🛡️"
            nhanMau="Tim của em"
            con={tran.mauHocSinh}
            toiDa={tran.mauHocSinhToiDa}
            tone="em"
            gucNga={false}
            trungDon={don?.trung === 'em' ? don.so : null}
          />
        </div>
      </div>

      {/* ── The fight ─────────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6">
        {!vaoTran ? (
          <div>
            <p className="mt-0 mb-4 text-chu-phu">
              Trả lời đúng <strong className="text-chu">{tran.mauBossToiDa} câu</strong> để hạ gục{' '}
              {tenBoss}. Em có <strong className="text-chu">{tran.mauHocSinhToiDa} tim</strong> —
              mỗi câu sai mất một tim. Câu hỏi lấy từ những bài em đã làm, nên em làm được!
            </p>
            <button type="button" onClick={() => setVaoTran(true)} className="nut-neon text-lg">
              <span aria-hidden="true">⚔️</span> Vào trận
            </button>
          </div>
        ) : ketThuc ? (
          <KetQuaCuoiTran
            ketQua={tran.ketQua}
            tenBoss={tenBoss}
            soDung={soDung}
            soCau={tran.daHoi}
            daGhiNhan={daGhiNhan}
            onDauLai={dauLai}
            phanHoiCuoi={phanHoi}
          />
        ) : cauHienTai ? (
          <CauHoiTranDau
            key={`${cauHienTai.id}-${chiSo}`}
            cau={cauHienTai}
            soDon={chiSo + 1}
            tenBoss={tenBoss}
            dangGui={dangGui}
            phanHoi={phanHoi}
            nhapTay={nhapTay}
            onNhap={setNhapTay}
            onTraLoi={(v) => void traLoi(v)}
            onTiepTuc={tiepTuc}
          />
        ) : null}

        {loi ? (
          <p
            role="alert"
            className="mt-4 mb-0 rounded-nut border-l-4 border-canh-bao bg-canh-bao/10 px-4 py-3 text-sm text-canh-bao-chu"
          >
            {loi}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One side of the arena: portrait, name and bar.
 *
 * The boss's bar is the brand gradient; the student's is green, turning amber
 * on the last heart. Never red — red in this app means "the system broke",
 * and a missed question is not that.
 */
function DauSi({
  ten,
  chanDung,
  nhanMau,
  con,
  toiDa,
  tone,
  gucNga,
  trungDon,
}: {
  ten: string;
  chanDung: string;
  nhanMau: string;
  con: number;
  toiDa: number;
  tone: 'boss' | 'em';
  gucNga: boolean;
  /** A counter while this side has just been hit, so the effects replay. */
  trungDon: number | null;
}) {
  const phanTram = phanTramMau(con, toiDa);
  const nguyCo = tone === 'em' && con <= 1;
  const mauThanh =
    tone === 'boss'
      ? 'bg-linear-to-r from-chinh to-hong shadow-[0_0_12px_rgba(236,72,153,0.55)]'
      : nguyCo
        ? 'bg-thu-lai shadow-[0_0_12px_rgba(251,191,36,0.5)]'
        : 'bg-dung shadow-[0_0_12px_rgba(52,211,153,0.5)]';

  return (
    <div
      className={`flex items-center gap-3 ${tone === 'em' ? 'sm:flex-row-reverse sm:text-end' : ''}`}
    >
      <div className="relative shrink-0">
        <span
          key={trungDon ?? 'yen'}
          aria-hidden="true"
          className={`grid size-16 place-items-center rounded-full border-2 bg-nen-sau text-4xl sm:size-20 sm:text-5xl ${
            tone === 'boss' ? 'border-hong/60' : 'border-ngoc/50'
          } ${trungDon !== null ? 'animate-rung motion-reduce:animate-none' : ''} ${
            gucNga ? 'opacity-40 grayscale' : ''
          }`}
        >
          {chanDung}
        </span>
        {trungDon !== null ? (
          <span
            key={`so-${trungDon}`}
            aria-hidden="true"
            className={`pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 animate-bay-so text-lg font-black opacity-0 ${
              tone === 'boss' ? 'text-hong-sang' : 'text-thu-lai'
            }`}
          >
            −1
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-bold text-chu">{ten}</p>
        <div
          role="progressbar"
          aria-label={nhanMau}
          aria-valuemin={0}
          aria-valuemax={toiDa}
          aria-valuenow={con}
          aria-valuetext={`${con} trên ${toiDa}`}
          className="mt-1.5 h-3 overflow-hidden rounded-full border border-white/10 bg-nen-sau"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${mauThanh}`}
            style={{ width: `${phanTram}%` }}
          />
        </div>
        <p className="mt-1 mb-0 text-xs font-semibold text-chu-nhat tabular-nums">
          {tone === 'em' ? (
            <>
              <span aria-hidden="true">{'❤️'.repeat(Math.max(0, con))}</span>
              <span aria-hidden="true" className="opacity-30">
                {'🤍'.repeat(Math.max(0, toiDa - con))}
              </span>
              <span className="sr-only">
                {nhanMau}: {con}/{toiDa}
              </span>
            </>
          ) : (
            <>
              {nhanMau} {con}/{toiDa}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function CauHoiTranDau({
  cau,
  soDon,
  tenBoss,
  dangGui,
  phanHoi,
  nhapTay,
  onNhap,
  onTraLoi,
  onTiepTuc,
}: {
  cau: CauHoiOnTap;
  soDon: number;
  tenBoss: string;
  dangGui: boolean;
  phanHoi: PhanHoiDon | null;
  nhapTay: string;
  onNhap: (v: string) => void;
  onTraLoi: (v: string) => void;
  onTiepTuc: () => void;
}) {
  const id = useId();
  const [daChon, setDaChon] = useState<string | null>(null);
  const nutTiep = useRef<HTMLButtonElement | null>(null);
  const tracNghiem = cau.type === 'MULTIPLE_CHOICE' || cau.type === 'TRUE_FALSE';
  const daTraLoi = phanHoi !== null;

  // After the verdict, the next action is one keypress away.
  useEffect(() => {
    if (daTraLoi) nutTiep.current?.focus();
  }, [daTraLoi]);

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-3 p-0 text-lg leading-relaxed font-semibold">
        <span className="me-2 inline-block rounded-full border border-chinh-sang/30 bg-chinh-sang/10 px-2.5 py-0.5 align-middle text-xs font-bold text-chinh-sang">
          Đòn {soDon}
          {cau.buoi ? ` · Buổi ${cau.buoi}` : ''}
        </span>
        {cau.prompt}
      </legend>

      {cau.mediaUrl ? (
        <div className="mb-3">
          <HinhBaiHoc src={cau.mediaUrl} alt="" />
        </div>
      ) : null}

      {cau.template ? <CauVoiChoTrong template={cau.template} /> : null}

      {tracNghiem ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {cau.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={dangGui || daTraLoi}
              aria-pressed={daChon === c.id}
              onClick={() => {
                setDaChon(c.id);
                onTraLoi(c.id);
              }}
              className={`flex min-h-cham w-full items-center gap-3 rounded-nut border px-4 py-3 text-start text-base transition-colors ${
                daChon === c.id
                  ? 'border-chinh-sang bg-chinh-nhat font-semibold shadow-[var(--shadow-neon)]'
                  : 'border-white/10 bg-the hover:border-chinh-sang hover:bg-chinh-nhat'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {c.text}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onTraLoi(nhapTay);
          }}
        >
          <label htmlFor={`${id}-nhap`} className="sr-only">
            Câu trả lời của em
          </label>
          <input
            id={`${id}-nhap`}
            type="text"
            value={nhapTay}
            disabled={dangGui || daTraLoi}
            onChange={(e) => onNhap(e.target.value)}
            placeholder="Nhập câu trả lời…"
            autoComplete="off"
            maxLength={200}
            className="min-h-cham flex-1 rounded-nut border border-white/10 bg-nen-sau/70 px-4 py-2.5 text-base text-chu placeholder:text-chu-nhat focus:border-chinh-sang"
          />
          <button
            type="submit"
            disabled={dangGui || daTraLoi || nhapTay.trim() === ''}
            className="nut-neon"
          >
            <span aria-hidden="true">⚡</span> Tung đòn
          </button>
        </form>
      )}

      {dangGui ? (
        <p className="mt-3 mb-0 text-sm font-medium text-chu-nhat" role="status">
          Đang tung đòn…
        </p>
      ) : null}

      {phanHoi ? (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-nut border p-4 ${
            phanHoi.dung ? 'border-dung/30 bg-dung-nen' : 'border-thu-lai/30 bg-thu-lai-nen'
          }`}
        >
          <p className={`mt-0 mb-1 font-bold ${phanHoi.dung ? 'text-dung' : 'text-thu-lai'}`}>
            {phanHoi.dung
              ? `💥 Trúng đòn! ${tenBoss} mất 1 máu.`
              : '🛡️ Hụt mất rồi — em mất 1 tim.'}
          </p>
          {!phanHoi.dung && phanHoi.dapAnDung ? (
            <p className="mt-0 mb-1.5 text-sm">
              Đáp án đúng là: <strong>{phanHoi.dapAnDung}</strong>
            </p>
          ) : null}
          {phanHoi.giaiThich ? (
            <p className="mt-0 mb-0 text-sm text-chu-phu">{phanHoi.giaiThich}</p>
          ) : null}
          <button ref={nutTiep} type="button" onClick={onTiepTuc} className="nut-vien mt-3">
            Đòn tiếp theo <span aria-hidden="true">➜</span>
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * How the fight ended.
 *
 * The last answer's feedback is shown here too — the fight can end on a miss,
 * and that miss's right answer is still the most useful line on the screen.
 */
function KetQuaCuoiTran({
  ketQua,
  tenBoss,
  soDung,
  soCau,
  daGhiNhan,
  onDauLai,
  phanHoiCuoi,
}: {
  ketQua: KetQuaTran;
  tenBoss: string;
  soDung: number;
  soCau: number;
  daGhiNhan: boolean;
  onDauLai: () => void;
  phanHoiCuoi: PhanHoiDon | null;
}) {
  const thang = ketQua === 'thang';

  return (
    <div role="status" aria-live="polite">
      {phanHoiCuoi && !phanHoiCuoi.dung && phanHoiCuoi.dapAnDung ? (
        <p className="mt-0 mb-4 rounded-nut border border-thu-lai/30 bg-thu-lai-nen p-3 text-sm">
          Câu vừa rồi, đáp án đúng là: <strong>{phanHoiCuoi.dapAnDung}</strong>
          {phanHoiCuoi.giaiThich ? (
            <span className="mt-1 block text-chu-phu">{phanHoiCuoi.giaiThich}</span>
          ) : null}
        </p>
      ) : null}

      {thang ? (
        <div className="rounded-the border border-dung/30 bg-dung-nen p-5 text-center">
          <p className="m-0 text-4xl" aria-hidden="true">
            🏆
          </p>
          <p className="mt-2 mb-1 text-xl font-extrabold text-dung">Em đã hạ gục {tenBoss}!</p>
          <p className="m-0 text-sm text-chu-phu">
            Đúng {soDung}/{soCau} câu. Kiến thức mấy buổi vừa qua em nắm chắc rồi đó!
          </p>
        </div>
      ) : (
        <div className="rounded-the border border-thu-lai/30 bg-thu-lai-nen p-5 text-center">
          <p className="m-0 text-4xl" aria-hidden="true">
            💪
          </p>
          <p className="mt-2 mb-1 text-xl font-extrabold text-thu-lai">
            {tenBoss} vẫn còn đứng vững!
          </p>
          <p className="m-0 text-sm text-chu-phu">
            Em đã ôn {soCau} câu và trả lời đúng {soDung} câu — thế là có ích rồi. Xem lại đáp án
            rồi đấu lại nhé!
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={onDauLai}
          className={thang ? 'nut-vien' : 'nut-neon text-lg'}
        >
          <span aria-hidden="true">⚔️</span> {thang ? 'Đấu lại để luyện thêm' : 'Đấu lại'}
        </button>
        {daGhiNhan ? (
          <span className="text-sm font-semibold text-dung">✓ Phần ôn tập đã được ghi nhận</span>
        ) : null}
      </div>
    </div>
  );
}
