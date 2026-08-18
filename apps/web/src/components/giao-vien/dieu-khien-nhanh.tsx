'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { datNhanh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';
import { KIEU_NHANH } from '@/components/ui/nhanh';

import type { Tier } from '@prisma/client';

const THANG: Tier[] = ['CO_BAN', 'THU_THACH', 'NANG_CAO', 'MO_RONG'];

/**
 * What each tier means, written for the teacher.
 *
 * Note what these say and what they carefully do not. Each one describes the
 * WORK the student will be given, never the student. There is no bottom of this
 * scale that reads as a verdict: "Cơ bản" is the guaranteed floor of the lesson
 * plan, which every child is entitled to finish and call it done.
 */
const MO_TA: Record<Tier, string> = {
  CO_BAN: 'Phần nền tảng của giáo án. Hoàn thành là đã nắm trọn công cụ cốt lõi.',
  THU_THACH: 'Thêm một bậc: cùng nội dung, bài tập đẩy xa hơn một chút.',
  NANG_CAO: 'Mở thêm các khối nâng cao trong bài, ví dụ phần lượng giác ở Buổi 17.',
  MO_RONG: 'Vượt ra ngoài giáo án, dành cho em muốn đi xa hơn nữa.',
};

function NutLuu() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang lưu…' : 'Lưu nhánh học'}
    </button>
  );
}

/**
 * Assign a student's differentiation tier for one course.
 *
 * Deliberately a plain form with a radio group rather than a dropdown: all four
 * options and their meanings stay visible, so choosing is an informed decision
 * instead of a guess at what a label implies.
 */
export function DieuKhienNhanh({
  studentId,
  courseId,
  tierHienTai,
  ghiChu,
  tenHocSinh,
}: {
  studentId: string;
  courseId: string;
  tierHienTai: Tier;
  ghiChu: string | null;
  tenHocSinh: string;
}) {
  const [ketQua, formAction] = useActionState(datNhanh, CHUA_LAM);

  return (
    <form action={formAction} className="rounded-the border border-vien bg-the p-5 sm:p-6">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="courseId" value={courseId} />

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1 text-lg font-bold">Nhánh học</legend>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Chọn phần nội dung {tenHocSinh} sẽ làm trong khoá này. Đổi lại lúc nào cũng được, và các
          bạn cùng lớp không nhìn thấy lựa chọn này.
        </p>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {THANG.map((tier) => {
            const kieu = KIEU_NHANH[tier];
            const dangChon = tier === tierHienTai;
            return (
              <label
                key={tier}
                className={`flex cursor-pointer gap-3 rounded-nut border-2 p-3.5 transition-colors ${
                  dangChon ? `${kieu.vien} ${kieu.nen}` : 'border-vien bg-the hover:border-vien-dam'
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={tier}
                  defaultChecked={dangChon}
                  className="mt-1.5 size-5 shrink-0 accent-[var(--color-chinh)]"
                />
                <span>
                  <span className={`flex items-center gap-1.5 font-semibold ${kieu.chu}`}>
                    <span aria-hidden="true">{kieu.icon}</span>
                    {kieu.nhan}
                  </span>
                  <span className="mt-0.5 block text-sm text-chu-phu">{MO_TA[tier]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="ghi-chu-nhanh" className="mb-1.5 block text-sm font-semibold">
          Ghi chú riêng của thầy cô{' '}
          <span className="font-normal text-chu-nhat">(học sinh không nhìn thấy)</span>
        </label>
        <input
          id="ghi-chu-nhanh"
          name="note"
          type="text"
          defaultValue={ghiChu ?? ''}
          placeholder="ví dụ: đang tăng tốc, tuần sau thử Nâng cao"
          className="min-h-cham w-full rounded-nut border border-vien bg-the px-3.5 py-2.5 text-base"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <NutLuu />
        <PhanHoi ketQua={ketQua} />
      </div>
    </form>
  );
}

/**
 * Action feedback.
 *
 * `role="status"` so the outcome is announced without stealing focus — the
 * teacher is often mid-keyboard-navigation through a roster.
 */
export function PhanHoi({
  ketQua,
}: {
  ketQua: { trangThai: string; thongDiep: string };
}) {
  if (ketQua.trangThai === 'chua-lam' || !ketQua.thongDiep) return null;

  const thanhCong = ketQua.trangThai === 'thanh-cong';
  return (
    <p
      role="status"
      className={`m-0 text-sm font-medium ${thanhCong ? 'text-dung' : 'text-thu-lai'}`}
    >
      <span aria-hidden="true">{thanhCong ? '✓ ' : '! '}</span>
      {ketQua.thongDiep}
    </p>
  );
}
