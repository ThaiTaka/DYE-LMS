'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { doiLuuTruLop, xoaLop } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface LopHienThi {
  id: string;
  ten: string;
  ma: string;
  term: string | null;
  giaoVien: string;
  soHocSinh: number;
  daLuuTru: boolean;
}

function Nut({ nhan, kieu = 'phu' }: { nhan: string; kieu?: 'phu' | 'chinh' | 'canh-bao' }) {
  const { pending } = useFormStatus();
  const lop =
    kieu === 'chinh'
      ? 'bg-chinh text-white hover:bg-chinh-dam'
      : kieu === 'canh-bao'
        ? 'border border-loi text-loi hover:bg-loi-nen'
        : 'border border-vien text-chu-phu hover:border-vien-dam hover:text-chu';

  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-cham rounded-nut px-4 py-2 text-sm font-semibold disabled:opacity-60 ${lop}`}
    >
      {pending ? 'Đang xử lý…' : nhan}
    </button>
  );
}

/**
 * One class row, with the removal controls.
 *
 * ── The order of the controls is the argument ────────────────────────────────
 * "Lưu trữ" comes first and is the plain button, because it is almost always
 * what an admin actually wants: the term ended, the class should stop appearing
 * in the working lists, and every student's progress, every announcement and
 * every override stays exactly where it is. It reverses with one click.
 *
 * Deleting is behind a disclosure, needs a ticked confirmation when the class
 * still holds children, and states in plain words what survives — because
 * "xoá lớp" reads as though it might take the students with it, and an admin who
 * half-believes that will avoid the feature entirely and leave dead classes
 * cluttering every dropdown in the app instead.
 *
 * The confirmation is a CHECKBOX inside the form rather than a `window.confirm`.
 * A native confirm cannot be styled, cannot be read in Vietnamese by every
 * browser, cannot say which class or how many children, and is dismissed by
 * muscle memory. A tick box that sits next to a sentence naming the class is
 * slower on purpose.
 */
export function HangLop({ lop }: { lop: LopHienThi }) {
  const [moXoa, setMoXoa] = useState(false);
  const [kqXoa, actionXoa] = useActionState(xoaLop, CHUA_LAM);
  const [kqLuuTru, actionLuuTru] = useActionState(doiLuuTruLop, CHUA_LAM);

  const id = useId();
  const vungId = `${id}-xoa`;

  return (
    <li className="rounded-the border border-vien bg-the p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
            <Link href={`/giao-vien/lop/${lop.id}`} className="hover:underline">
              {lop.ten}
            </Link>
            {lop.daLuuTru ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đã lưu trữ
              </span>
            ) : null}
          </h3>
          <p className="m-0 text-sm text-chu-phu">
            {lop.ma} · {lop.giaoVien} · {lop.soHocSinh} học sinh
            {lop.term ? ` · ${lop.term}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={actionLuuTru}>
            <input type="hidden" name="classId" value={lop.id} />
            <input type="hidden" name="luuTru" value={lop.daLuuTru ? 'khong' : 'co'} />
            <Nut nhan={lop.daLuuTru ? 'Mở lại lớp' : 'Lưu trữ'} />
          </form>

          <button
            type="button"
            onClick={() => setMoXoa((v) => !v)}
            aria-expanded={moXoa}
            aria-controls={vungId}
            className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
          >
            {moXoa ? 'Đóng' : 'Xoá lớp…'}
          </button>
        </div>
      </div>

      {/* Outside the panel, so the outcome stays readable after it is closed. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqLuuTru} />
      </div>

      {moXoa ? (
        <div id={vungId} className="mt-4 border-t border-vien pt-4">
          <div className="mb-4 rounded-nut bg-thu-lai-nen p-4 text-sm">
            <p className="mt-0 mb-2 font-semibold text-thu-lai">
              Cân nhắc “Lưu trữ” trước khi xoá
            </p>
            <p className="mt-0 mb-2 text-chu-phu">
              Lưu trữ đưa lớp ra khỏi các danh sách đang dùng mà{' '}
              <strong className="text-chu">giữ nguyên mọi thứ</strong>, và mở lại được bất cứ lúc
              nào. Xoá thì không khôi phục được.
            </p>
            <p className="m-0 text-chu-phu">
              Xoá lớp sẽ gỡ{' '}
              <strong className="text-chu">{lop.soHocSinh} em</strong> ra khỏi lớp, và xoá các khoá
              học đã gắn, can thiệp bài học và thông báo của lớp này.{' '}
              <strong className="text-chu">
                Tài khoản của từng em, bài nộp, bản nháp và tiến độ đều được giữ nguyên
              </strong>{' '}
              — các em chỉ cần được xếp vào một lớp khác.
            </p>
          </div>

          <form action={actionXoa}>
            <input type="hidden" name="classId" value={lop.id} />

            <p className="m-0 mb-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="xacNhan" value="co" className="mt-0.5 h-4 w-4" />
                <span>
                  Tôi hiểu rằng lớp <strong>{lop.ten}</strong> ({lop.ma}) sẽ bị xoá vĩnh viễn và{' '}
                  {lop.soHocSinh} em sẽ được gỡ khỏi lớp.
                </span>
              </label>
            </p>

            <Nut nhan="Xoá lớp này" kieu="canh-bao" />

            <div className="mt-3 empty:mt-0">
              <PhanHoi ketQua={kqXoa} />
            </div>
          </form>
        </div>
      ) : null}
    </li>
  );
}
