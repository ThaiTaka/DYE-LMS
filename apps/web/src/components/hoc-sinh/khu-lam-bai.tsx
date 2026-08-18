'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import {
  khoiPhuc,
  layLichSu,
  layLichSuNop,
  layNoiDungBanLuu,
  nop,
  type BaiDaNopHienThi,
  type BanLuuHienThi,
} from '@/app/bai-hoc/[slug]/code-actions';

import { useTuLuu, type TrangThaiLuu } from './dung-tu-luu';
import { SoSanhMa } from './so-sanh-ma';
import { SoanThao } from './soan-thao';

const NHAN_LY_DO: Record<BanLuuHienThi['reason'], string> = {
  AUTO: 'tự lưu',
  SUBMIT: 'em nộp bài',
  RESTORE: 'trước khi quay lại bản cũ',
};

const NHAN_KET_QUA: Record<string, string> = {
  PENDING: 'Đang chờ chấm',
  RUNNING: 'Đang chấm',
  ACCEPTED: 'Đúng rồi 🎉',
  WRONG_ANSWER: 'Chưa khớp kết quả',
  TIME_LIMIT_EXCEEDED: 'Chạy hơi lâu',
  MEMORY_LIMIT_EXCEEDED: 'Dùng quá nhiều bộ nhớ',
  OUTPUT_LIMIT_EXCEEDED: 'In ra quá nhiều',
  RUNTIME_ERROR: 'Chương trình dừng giữa chừng',
  COMPILE_ERROR: 'Cú pháp chưa đúng',
  INTERNAL_ERROR: 'Lỗi hệ thống',
  SKIPPED: 'Chưa chấm',
};

function gioPhut(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Autosave indicator.
 *
 * `aria-live="polite"` so it is announced without interrupting typing, and the
 * wording never blames the student: a failed save says the system will retry,
 * because it will, and because a child cannot fix a network problem.
 */
function DauLuu({
  trangThai,
  luuLuc,
  thongDiep,
}: {
  trangThai: TrangThaiLuu;
  luuLuc: Date | null;
  thongDiep: string;
}) {
  const chu =
    trangThai === 'dang-luu'
      ? 'Đang lưu…'
      : trangThai === 'cho'
        ? 'Sắp lưu…'
        : trangThai === 'loi'
          ? thongDiep || 'Chưa lưu được. Hệ thống sẽ tự thử lại.'
          : luuLuc
            ? `Đã lưu lúc ${luuLuc.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
            : 'Bài của em được lưu tự động';

  const mau = trangThai === 'loi' ? 'text-thu-lai' : 'text-chu-nhat';

  return (
    <p aria-live="polite" className={`m-0 text-sm ${mau}`}>
      <span aria-hidden="true">{trangThai === 'loi' ? '⚠ ' : '💾 '}</span>
      {chu}
    </p>
  );
}

export interface KhuLamBaiProps {
  blockId: string;
  /** Draft (or starter code) resolved on the server. */
  maBanDau: string;
  /** True when the server sent back a saved draft rather than starter code. */
  coBanNhap: boolean;
  luuLucBanDau: string | null;
  /** False for a Code Playground: nothing to hand in. */
  coBaiTap: boolean;
  nhan: string;
  mucTieu?: string | undefined;
}

/**
 * The student's coding workspace.
 *
 * Editor, autosave, version history and submission in one place, because they
 * are one activity. The pieces below are separate components so each can be
 * tested on its own, but a student should experience this as a single surface.
 */
export function KhuLamBai({
  blockId,
  maBanDau,
  coBanNhap,
  luuLucBanDau,
  coBaiTap,
  nhan,
  mucTieu,
}: KhuLamBaiProps) {
  const [ma, setMa] = useState(maBanDau);
  const [moLichSu, setMoLichSu] = useState(false);
  const [banLuu, setBanLuu] = useState<BanLuuHienThi[]>([]);
  const [chonBan, setChonBan] = useState<number | null>(null);
  const [maBanChon, setMaBanChon] = useState<string>('');
  const [baiNop, setBaiNop] = useState<BaiDaNopHienThi[]>([]);
  const [thongBao, setThongBao] = useState('');
  const [dangGui, batDauGui] = useTransition();

  const tuLuu = useTuLuu(blockId);
  const id = useId();
  const maRef = useRef(ma);
  maRef.current = ma;

  const doiMa = useCallback(
    (moi: string) => {
      setMa(moi);
      tuLuu.ghiNhan(moi);
    },
    [tuLuu],
  );

  const napLichSu = useCallback(async () => {
    const [ls, nopLs] = await Promise.all([layLichSu(blockId), layLichSuNop(blockId)]);
    setBanLuu(ls.banLuu);
    setBaiNop(nopLs.baiNop);
  }, [blockId]);

  useEffect(() => {
    if (moLichSu) void napLichSu();
  }, [moLichSu, napLichSu]);

  const xemBan = useCallback(
    async (version: number) => {
      setChonBan(version);
      const kq = await layNoiDungBanLuu(blockId, version);
      setMaBanChon(kq.code);
    },
    [blockId],
  );

  const quayLai = useCallback(
    async (version: number) => {
      const kq = await khoiPhuc(blockId, version);
      if (kq.trangThai === 'ok') {
        setMa(kq.code);
        setThongBao(kq.thongDiep);
        setChonBan(null);
        await napLichSu();
      } else {
        setThongBao(kq.thongDiep);
      }
    },
    [blockId, napLichSu],
  );

  const nopBaiLam = useCallback(() => {
    batDauGui(async () => {
      // Flush the draft first so what is stored matches what was handed in even
      // if the submit itself fails.
      await tuLuu.luuNgay(maRef.current);
      const kq = await nop(blockId, maRef.current);
      setThongBao(kq.thongDiep);
      if (kq.trangThai === 'da-nhan') await napLichSu();
    });
  }, [blockId, napLichSu, tuLuu]);

  return (
    <div className="rounded-nut border border-vien bg-the">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-vien px-4 py-2.5">
        <span className="text-sm font-semibold">{nhan}</span>
        <DauLuu
          trangThai={tuLuu.trangThai}
          luuLuc={tuLuu.luuLuc ?? (luuLucBanDau ? new Date(luuLucBanDau) : null)}
          thongDiep={tuLuu.thongDiep}
        />
      </div>

      {coBanNhap ? (
        <p className="m-0 border-b border-vien bg-chinh-nhat px-4 py-2 text-sm text-chinh">
          <span aria-hidden="true">↩ </span>
          Đây là bài em đang làm dở. Em cứ tiếp tục nhé.
        </p>
      ) : null}

      <SoanThao giaTri={ma} onDoi={doiMa} nhan={nhan} moTaBoi={`${id}-ban-phim`} />

      {/*
        Stated in visible text, not only in aria-describedby: a sighted keyboard
        user needs this exactly as much as a screen-reader user does.
      */}
      <p id={`${id}-ban-phim`} className="m-0 border-t border-vien px-4 py-2 text-sm text-chu-nhat">
        <kbd className="rounded border border-vien bg-the-mo px-1.5 py-0.5 font-mono text-xs">
          Tab
        </kbd>{' '}
        để thụt lề ·{' '}
        <kbd className="rounded border border-vien bg-the-mo px-1.5 py-0.5 font-mono text-xs">
          Esc
        </kbd>{' '}
        rồi{' '}
        <kbd className="rounded border border-vien bg-the-mo px-1.5 py-0.5 font-mono text-xs">
          Tab
        </kbd>{' '}
        để ra khỏi khung soạn thảo
      </p>

      <div className="flex flex-wrap items-center gap-3 border-t border-vien px-4 py-3">
        <button
          type="button"
          disabled
          title="Chạy thử trong sandbox sẽ có ở bản cập nhật sau"
          className="min-h-cham cursor-not-allowed rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-nhat"
        >
          ▶ Chạy thử
        </button>

        {coBaiTap ? (
          <button
            type="button"
            onClick={nopBaiLam}
            disabled={dangGui}
            className="min-h-cham rounded-nut bg-chinh px-5 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
          >
            {dangGui ? 'Đang gửi…' : 'Nộp bài'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setMoLichSu((v) => !v)}
          aria-expanded={moLichSu}
          aria-controls={`${id}-lich-su`}
          className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
        >
          🕘 {moLichSu ? 'Đóng lịch sử' : 'Lịch sử bài làm'}
        </button>
      </div>

      {thongBao ? (
        <p
          role="status"
          className="m-0 border-t border-vien bg-dung-nen px-4 py-2.5 text-sm text-dung"
        >
          <span aria-hidden="true">✓ </span>
          {thongBao}
        </p>
      ) : null}

      {mucTieu ? (
        <p className="m-0 border-t border-vien px-4 py-2.5 text-sm">
          <strong>Mục tiêu:</strong> {mucTieu}
        </p>
      ) : null}

      {moLichSu ? (
        <div id={`${id}-lich-su`} className="border-t border-vien p-4">
          <LichSuBanLuu
            banLuu={banLuu}
            chonBan={chonBan}
            maBanChon={maBanChon}
            maHienTai={ma}
            onXem={xemBan}
            onQuayLai={quayLai}
            onDong={() => setChonBan(null)}
          />

          {coBaiTap ? <LichSuNop baiNop={baiNop} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function LichSuBanLuu({
  banLuu,
  chonBan,
  maBanChon,
  maHienTai,
  onXem,
  onQuayLai,
  onDong,
}: {
  banLuu: BanLuuHienThi[];
  chonBan: number | null;
  maBanChon: string;
  maHienTai: string;
  onXem: (v: number) => void;
  onQuayLai: (v: number) => void;
  onDong: () => void;
}) {
  return (
    <section aria-labelledby="ls-ban-luu">
      <h3 id="ls-ban-luu" className="mt-0 mb-1 text-base font-bold">
        Các bản em đã lưu
      </h3>
      <p className="mt-0 mb-3 text-sm text-chu-phu">
        Hệ thống tự lưu lại bài của em theo thời gian. Em có thể xem lại hoặc quay về bản cũ bất cứ
        lúc nào — quay lại không làm mất bản hiện tại.
      </p>

      {banLuu.length === 0 ? (
        <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
          Chưa có bản lưu nào. Em cứ làm bài, hệ thống sẽ tự lưu giúp em.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {banLuu.map((b) => (
            <li
              key={b.version}
              className={`rounded-nut border p-3 ${
                chonBan === b.version ? 'border-chinh bg-chinh-nhat' : 'border-vien'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span>
                  <span className="font-semibold">Bản {b.version}</span>
                  <span className="ms-2 text-sm text-chu-phu">
                    {gioPhut(b.luuLuc)} · {b.soDong} dòng · {NHAN_LY_DO[b.reason]}
                  </span>
                </span>

                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (chonBan === b.version ? onDong() : onXem(b.version))}
                    className="min-h-cham rounded-nut border border-vien px-3.5 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
                  >
                    {chonBan === b.version ? 'Ẩn so sánh' : 'So sánh'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuayLai(b.version)}
                    className="min-h-cham rounded-nut border border-vien px-3.5 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
                  >
                    Quay lại bản này
                  </button>
                </span>
              </div>

              {chonBan === b.version ? (
                <div className="mt-3 border-t border-vien pt-3">
                  <SoSanhMa
                    cu={maBanChon}
                    moi={maHienTai}
                    nhanCu={`Bản ${b.version}`}
                    nhanMoi="bài em đang làm"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LichSuNop({ baiNop }: { baiNop: BaiDaNopHienThi[] }) {
  if (baiNop.length === 0) return null;

  return (
    <section aria-labelledby="ls-nop" className="mt-6 border-t border-vien pt-4">
      <h3 id="ls-nop" className="mt-0 mb-3 text-base font-bold">
        Bài em đã nộp ({baiNop.length})
      </h3>

      <ul className="m-0 list-none space-y-2 p-0">
        {baiNop.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-nut border border-vien p-3 text-sm"
          >
            <span>
              <span className="font-semibold">Lần {s.attemptNo}</span>
              <span className="ms-2 text-chu-phu">{gioPhut(s.nopLuc)}</span>
            </span>

            <span
              className={
                s.dangCho
                  ? 'text-chu-phu'
                  : s.verdict === 'ACCEPTED'
                    ? 'font-semibold text-dung'
                    : 'text-thu-lai'
              }
            >
              {s.dangCho ? <span aria-hidden="true">⏳ </span> : null}
              {NHAN_KET_QUA[s.verdict] ?? s.verdict}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 mb-0 text-sm text-chu-nhat">
        Phần chấm bài tự động đang được xây. Bài của em đã được lưu lại đầy đủ và sẽ được chấm ngay
        khi tính năng này mở.
      </p>
    </section>
  );
}
