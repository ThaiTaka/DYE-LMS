'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { resetStudentBlock } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

function NutMo() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut border border-chinh px-4 py-2 text-sm font-semibold text-chinh hover:bg-chinh-nhat disabled:opacity-60"
    >
      {pending ? 'Đang mở…' : 'Mở lại — xoá lịch sử, cho em nộp lại'}
    </button>
  );
}

/**
 * The teacher's key to a frozen block.
 *
 * Collapsed behind one button because a results page holds forty rows and most
 * of them are settled. Opened, it asks for a reason and says what will happen
 * — the history for this block is deleted, not hidden — before the confirm.
 */
export function MoLaiKhoi({
  studentId,
  blockId,
  tenHocSinh,
  tenBai,
}: {
  studentId: string;
  blockId: string;
  tenHocSinh: string;
  tenBai: string;
}) {
  const [kq, action] = useActionState(resetStudentBlock, CHUA_LAM);
  const [mo, setMo] = useState(false);
  const id = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        aria-expanded={mo}
        aria-controls={`${id}-form`}
        className="min-h-cham rounded-nut border border-vien px-3 py-1.5 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
      >
        <span aria-hidden="true">🔓 </span>
        {mo ? 'Đóng' : 'Mở lại lượt nộp…'}
      </button>

      {mo ? (
        <form id={`${id}-form`} action={action} className="mt-3 rounded-nut border border-vien bg-the-mo p-3">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="blockId" value={blockId} />
          <p className="mt-0 mb-2 text-sm text-chu-phu">
            Mở lại <strong className="text-chu">{tenBai}</strong> cho{' '}
            <strong className="text-chu">{tenHocSinh}</strong>: bài đã nộp và điểm của khối này sẽ bị
            xoá để em nộp lại. Bản nháp của em vẫn giữ. Nhật ký kiểm toán ghi lại việc này.
          </p>
          <label htmlFor={`${id}-ly-do`} className="mb-1 block text-sm font-semibold">
            Lý do
          </label>
          <input
            id={`${id}-ly-do`}
            name="ghiChu"
            required
            minLength={3}
            placeholder="VD: Em nộp nhầm bản chưa xong."
            className="mb-3 min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
          />
          <NutMo />
          <div className="mt-3 empty:mt-0">
            <PhanHoi ketQua={kq} />
          </div>
        </form>
      ) : null}
    </div>
  );
}
