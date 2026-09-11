'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { moLaiBaiTuLuan } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

function NutMoLai() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut border border-thu-lai px-4 py-2 text-sm font-semibold text-thu-lai hover:bg-thu-lai-nen disabled:opacity-60"
    >
      {pending ? 'Đang mở…' : 'Mở lại cho em làm lại'}
    </button>
  );
}

/**
 * One essay that has already been marked.
 *
 * Read-only by design: a grade is changed by REOPENING the answer, not by
 * editing the number in place. Reopening deletes the row and writes an audit
 * entry (see `moLaiTuLuan` in @dye/core), so a changed mark always has a trail
 * and the student always writes again rather than being silently re-scored.
 *
 * A zero from the integrity lock is labelled as such. It was imposed by the
 * system, not by a person, and a teacher reading "0/10" with no reason next to
 * it has no way to know that — or to know that lifting the lock on the
 * student's page is the remedy, not reopening the essay here.
 */
export function TuLuanDaChamHang({
  answerId,
  tenHocSinh,
  prompt,
  noiDung,
  diem,
  diemToiDa,
  dat,
  khoaViPham,
  lessonTitle,
  lessonOrder,
  chamLuc,
}: {
  answerId: string;
  tenHocSinh: string;
  prompt: string;
  noiDung: string;
  diem: number;
  diemToiDa: number;
  dat: boolean;
  khoaViPham: boolean;
  lessonTitle: string;
  lessonOrder: number;
  chamLuc: string;
}) {
  const [kqMo, actionMo] = useActionState(moLaiBaiTuLuan, CHUA_LAM);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [moBai, setMoBai] = useState(false);
  const id = useId();

  return (
    <li className="rounded-nut border border-vien bg-the p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="m-0 font-semibold">{tenHocSinh}</p>
          <p className="m-0 text-sm text-chu-phu">
            Buổi {lessonOrder} · {lessonTitle} · chấm lúc {chamLuc}
          </p>
        </div>

        <p
          className={`m-0 shrink-0 text-sm font-semibold ${
            khoaViPham ? 'text-thu-lai' : dat ? 'text-dung' : 'text-chu-phu'
          }`}
        >
          {khoaViPham ? (
            <>
              <span aria-hidden="true">🔒 </span>0/{diemToiDa} · bị khoá do rời tab
            </>
          ) : (
            <>
              {diem}/{diemToiDa} điểm · {dat ? 'Đạt' : 'Chưa đạt'}
            </>
          )}
        </p>
      </div>

      <p className="mt-3 mb-1 text-sm font-semibold text-chu-phu">Đề bài</p>
      <p className="m-0 text-sm">{prompt}</p>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setMoBai((v) => !v)}
          aria-expanded={moBai}
          aria-controls={`${id}-bai`}
          className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
        >
          {moBai ? 'Ẩn bài làm' : 'Xem bài làm'}
        </button>
        {moBai ? (
          <blockquote
            id={`${id}-bai`}
            className="mt-3 mb-0 rounded-nut border-s-4 border-vien bg-the-mo p-4 text-sm whitespace-pre-wrap"
          >
            {noiDung}
          </blockquote>
        ) : null}
      </div>

      {khoaViPham ? (
        <p className="mt-4 mb-0 text-sm text-chu-phu">
          Điểm này do hệ thống đặt khi khoá bài. Muốn trả lại điểm, thầy cô mở khoá ở trang của
          học sinh — không cần mở lại bài tự luận.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setMoXacNhan((v) => !v)}
              aria-expanded={moXacNhan}
              aria-controls={`${id}-mo-lai`}
              className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-thu-lai hover:text-thu-lai"
            >
              {moXacNhan ? 'Đóng' : 'Chấm lại / yêu cầu làm lại…'}
            </button>
          </div>

          {moXacNhan ? (
            <div id={`${id}-mo-lai`} className="mt-4 border-t border-vien pt-4">
              <p className="mt-0 mb-3 text-sm text-chu-phu">
                Mở lại sẽ <strong className="text-chu">xoá bài đã nộp và điểm đã chấm</strong> để
                em viết lại từ đầu. Nhật ký kiểm toán vẫn giữ lại việc này.
              </p>
              <form action={actionMo}>
                <input type="hidden" name="answerId" value={answerId} />
                <NutMoLai />
              </form>
              <div className="mt-3 empty:mt-0">
                <PhanHoi ketQua={kqMo} />
              </div>
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}
