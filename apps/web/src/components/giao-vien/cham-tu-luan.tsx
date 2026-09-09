'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { chamBaiTuLuan, moLaiBaiTuLuan } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

function Nut({
  nhan,
  kieu,
  dangLam,
}: {
  nhan: string;
  kieu: 'dat' | 'chua-dat' | 'mo-lai';
  dangLam: string;
}) {
  const { pending } = useFormStatus();

  const lop =
    kieu === 'dat'
      ? 'border border-dung text-dung hover:bg-dung-nen'
      : kieu === 'chua-dat'
        ? 'border border-thu-lai text-thu-lai hover:bg-thu-lai-nen'
        : 'border border-vien text-chu-phu hover:border-chinh hover:text-chinh';

  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-cham rounded-nut px-4 py-2 text-sm font-semibold disabled:opacity-60 ${lop}`}
    >
      {pending ? dangLam : nhan}
    </button>
  );
}

/**
 * One essay awaiting a person, with the three things a teacher can do about it.
 *
 * ── Marking and reopening are separate buttons on purpose ────────────────────
 * "Chưa đạt" records a judgement; "Yêu cầu làm lại" hands the question back.
 * They are frequently but not always the same decision — a teacher may mark
 * work down and move on, or reopen a piece that was nearly right — so bundling
 * them would take that choice away and silently reopen every low mark.
 *
 * ── The answer is shown in full, never truncated ─────────────────────────────
 * It is the thing being judged. A clipped preview with a "xem thêm" would mean
 * marking work the teacher has not finished reading, so the panel scrolls
 * instead.
 */
export function ChamTuLuan({
  answerId,
  tenHocSinh,
  prompt,
  noiDung,
  diemToiDa,
  lessonTitle,
  lessonOrder,
  nopLuc,
}: {
  answerId: string;
  tenHocSinh: string;
  prompt: string;
  noiDung: string;
  diemToiDa: number;
  lessonTitle: string;
  lessonOrder: number;
  nopLuc: string;
}) {
  const [kqCham, actionCham] = useActionState(chamBaiTuLuan, CHUA_LAM);
  const [kqMo, actionMo] = useActionState(moLaiBaiTuLuan, CHUA_LAM);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const id = useId();

  return (
    <li className="rounded-the border border-vien bg-the p-4">
      <div className="mb-3">
        <h3 className="mt-0 mb-1 text-base font-semibold">{tenHocSinh}</h3>
        <p className="m-0 text-sm text-chu-phu">
          {lessonOrder > 0 ? `Buổi ${lessonOrder} · ` : ''}
          {lessonTitle ? `${lessonTitle} · ` : ''}
          {diemToiDa} điểm
        </p>
        <p className="m-0 mt-1 text-xs text-chu-nhat">Nộp lúc {nopLuc}</p>
      </div>

      <p className="mt-0 mb-2 text-sm font-semibold">{prompt}</p>

      <div className="mb-4 max-h-72 overflow-auto rounded-nut bg-the-mo p-3">
        <p className="m-0 text-sm whitespace-pre-wrap">{noiDung}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={actionCham}>
          <input type="hidden" name="answerId" value={answerId} />
          <input type="hidden" name="dung" value="co" />
          <Nut nhan="Đạt" kieu="dat" dangLam="Đang ghi…" />
        </form>

        <form action={actionCham}>
          <input type="hidden" name="answerId" value={answerId} />
          <input type="hidden" name="dung" value="khong" />
          <Nut nhan="Chưa đạt" kieu="chua-dat" dangLam="Đang ghi…" />
        </form>

        <button
          type="button"
          onClick={() => setMoXacNhan((v) => !v)}
          aria-expanded={moXacNhan}
          aria-controls={`${id}-mo-lai`}
          className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
        >
          {moXacNhan ? 'Đóng' : 'Yêu cầu làm lại…'}
        </button>
      </div>

      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqCham} />
      </div>

      {moXacNhan ? (
        <div id={`${id}-mo-lai`} className="mt-4 border-t border-vien pt-4">
          <p className="mt-0 mb-3 text-sm text-chu-phu">
            Mở lại sẽ <strong className="text-chu">xoá bài em đã nộp</strong> để em viết lại từ
            đầu. Nhật ký kiểm toán vẫn giữ lại việc này.
          </p>
          <form action={actionMo}>
            <input type="hidden" name="answerId" value={answerId} />
            <Nut nhan="Mở lại cho em làm lại" kieu="mo-lai" dangLam="Đang mở…" />
          </form>
          <div className="mt-3 empty:mt-0">
            <PhanHoi ketQua={kqMo} />
          </div>
        </div>
      ) : null}
    </li>
  );
}
