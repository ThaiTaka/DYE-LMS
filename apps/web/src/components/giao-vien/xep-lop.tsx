'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';

import { xepLopHocSinh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

function NutXep() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang xếp lớp…' : 'Xếp vào lớp này'}
    </button>
  );
}

/**
 * The class picker shown on a student who is in no class.
 *
 * ── Why it lives on the student's own page ───────────────────────────────────
 * This is where the teacher already is when they discover the problem: they
 * clicked the child's name expecting a progress page and got told there is
 * nothing to show. Sending them somewhere else to fix it is how the gap stayed
 * open — the account list has no per-student class control either, so before
 * this component there was no screen in the app that could do it at all.
 *
 * ── Single select, not multi ─────────────────────────────────────────────────
 * `Enrollment` is many-to-many and a child may legitimately sit in several
 * classes, but this control exists for the "in none" case. One class is the
 * answer to that, and a multi-select invites a teacher to bulk-assign from a
 * screen that shows none of the consequences.
 *
 * The server re-checks `class:manage` on whatever id arrives, so a stale option
 * in this list is refused rather than honoured — the filtering here only keeps
 * a teacher from being offered a class they would be told off for choosing.
 */
export function XepLop({
  studentId,
  lop,
}: {
  studentId: string;
  lop: Array<{ id: string; ten: string; ma: string }>;
}) {
  const [ketQua, action] = useActionState(xepLopHocSinh, CHUA_LAM);
  const id = useId();
  const chonId = `${id}-lop`;

  if (lop.length === 0) {
    return (
      <p className="m-0 text-chu-phu">
        Hiện chưa có lớp nào đang mở để xếp em vào. Tạo lớp ở trang{' '}
        <a href="/giao-vien/lop" className="font-semibold text-chinh hover:underline">
          Lớp học
        </a>{' '}
        trước, rồi quay lại đây.
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="studentId" value={studentId} />

      <label htmlFor={chonId} className="mb-2 block text-sm font-semibold">
        Chọn lớp cho em
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <select
          id={chonId}
          name="classId"
          defaultValue={lop.length === 1 ? lop[0]!.id : ''}
          className="min-h-cham rounded-nut border border-vien bg-the px-3 py-2 text-sm"
        >
          {lop.length === 1 ? null : (
            <option value="">— chọn lớp —</option>
          )}
          {lop.map((l) => (
            <option key={l.id} value={l.id}>
              {l.ten} ({l.ma})
            </option>
          ))}
        </select>

        <NutXep />
      </div>

      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={ketQua} />
      </div>
    </form>
  );
}
