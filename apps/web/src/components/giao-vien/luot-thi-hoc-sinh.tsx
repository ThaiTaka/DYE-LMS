'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { huyLuotThiHocSinh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

import type { LuotThiCuaHocSinh } from '@dye/core';

const NHAN_TRANG_THAI: Record<LuotThiCuaHocSinh['state'], { chu: string; mau: string }> = {
  IN_PROGRESS: { chu: 'Đang làm', mau: 'text-thu-lai' },
  SUBMITTED: { chu: 'Đã nộp', mau: 'text-chu-phu' },
  LOCKED_CHEATING: { chu: 'Bị khoá — 0 điểm', mau: 'text-loi' },
  VOIDED: { chu: 'Đã huỷ (được thi lại)', mau: 'text-chu-nhat' },
};

const NHAN_LOAI: Record<LuotThiCuaHocSinh['strikes'][number]['kind'], string> = {
  FULLSCREEN_EXIT: 'thoát toàn màn hình',
  TAB_HIDDEN: 'chuyển tab / thu nhỏ',
  WINDOW_BLUR: 'chuyển cửa sổ',
};

function gioPhut(d: Date | string): string {
  return new Date(d).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function NutHuy() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut border border-thu-lai px-4 py-2 text-sm font-semibold text-thu-lai hover:bg-thu-lai-nen disabled:opacity-60"
    >
      {pending ? 'Đang huỷ…' : 'Huỷ lượt này — cho em thi lại'}
    </button>
  );
}

/**
 * One exam sitting on the teacher's student page.
 *
 * The strike log is shown with timestamps to the second, on purpose. Whether
 * two "chuyển cửa sổ" entries eight seconds apart were a student checking
 * answers or Unikey stealing focus twice is a judgement only a person can
 * make, and the seconds are what they make it from.
 */
function HangLuotThi({ luot }: { luot: LuotThiCuaHocSinh }) {
  const [kq, action] = useActionState(huyLuotThiHocSinh, CHUA_LAM);
  const [moForm, setMoForm] = useState(false);
  const id = useId();
  const nhan = NHAN_TRANG_THAI[luot.state];
  const huyDuoc = luot.state !== 'VOIDED';

  return (
    <li id={`bai-thi-${luot.attemptId}`} className="rounded-nut border border-vien bg-the p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <p className="m-0 font-semibold">
            {luot.examTitle}
            <span className="ms-2 text-sm font-normal text-chu-phu">lần {luot.attemptNo}</span>
          </p>
          <p className="m-0 text-sm text-chu-phu">
            Bắt đầu {gioPhut(luot.startedAt)}
            {luot.submittedAt ? ` · nộp ${gioPhut(luot.submittedAt)}` : ''}
          </p>
        </div>
        <div className="text-end">
          <p className={`m-0 text-sm font-semibold ${nhan.mau}`}>{nhan.chu}</p>
          {luot.state === 'SUBMITTED' ? (
            <p className="m-0 text-sm text-chu-phu">
              {luot.score}/{luot.maxScore} · {luot.isPassed ? 'Đạt' : 'Chưa đạt'}
            </p>
          ) : null}
        </div>
      </div>

      {luot.strikes.length > 0 ? (
        <details className="mt-3">
          <summary className="min-h-cham cursor-pointer text-sm font-medium text-chu-phu">
            {luot.strikes.length} lần rời màn hình
          </summary>
          <ol className="mt-2 mb-0 list-decimal space-y-1 ps-5 text-sm">
            {luot.strikes.map((s) => (
              <li key={s.strikeNo}>
                {NHAN_LOAI[s.kind]} · <span className="tabular-nums">{gioPhut(s.luc)}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {luot.state === 'VOIDED' ? (
        <p className="mt-3 mb-0 text-sm text-chu-phu">
          Huỷ bởi {luot.nguoiHuy ?? 'giáo viên'}
          {luot.voidNote ? `: “${luot.voidNote}”` : ''}
        </p>
      ) : null}

      {huyDuoc ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMoForm((v) => !v)}
            aria-expanded={moForm}
            aria-controls={`${id}-huy`}
            className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-thu-lai hover:text-thu-lai"
          >
            {moForm ? 'Đóng' : 'Huỷ lượt thi…'}
          </button>
          {moForm ? (
            <form id={`${id}-huy`} action={action} className="mt-3 border-t border-vien pt-3">
              <input type="hidden" name="attemptId" value={luot.attemptId} />
              <label htmlFor={`${id}-ly-do`} className="mb-1.5 block text-sm font-semibold">
                Lý do huỷ (em và phụ huynh có thể được xem)
              </label>
              <input
                id={`${id}-ly-do`}
                name="ghiChu"
                required
                minLength={3}
                placeholder="VD: Em bật Unikey, popup lấy mất focus — không phải gian lận."
                className="mb-3 min-h-cham w-full rounded-nut border border-vien px-3 py-2 text-sm"
              />
              <NutHuy />
              <div className="mt-3 empty:mt-0">
                <PhanHoi ketQua={kq} />
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function LuotThiHocSinh({ luot }: { luot: LuotThiCuaHocSinh[] }) {
  if (luot.length === 0) return null;
  return (
    <section aria-labelledby="bai-thi" className="mb-6 rounded-the border border-vien bg-the p-5">
      <h2 id="bai-thi" className="mt-0 mb-1 text-xl font-bold">
        Bài kiểm tra lớn
      </h2>
      <p className="mt-0 mb-4 text-sm text-chu-phu">
        Một lượt bị khoá nghĩa là em rời khỏi màn hình thi tới ngưỡng. Máy chỉ đếm lần rời đi —
        không biết em đã mở gì. Nếu là nhầm, huỷ lượt để em thi lại; lượt cũ vẫn giữ trong hồ sơ.
      </p>
      <ul className="m-0 list-none space-y-3 p-0">
        {luot.map((l) => (
          <HangLuotThi key={l.attemptId} luot={l} />
        ))}
      </ul>
    </section>
  );
}
