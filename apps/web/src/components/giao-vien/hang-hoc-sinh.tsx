'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { doiTruyCapHocSinh, xoaHocSinh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface HocSinhHienThi {
  id: string;
  username: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lop: string[];
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
 * One student row, with the account controls.
 *
 * ── Two different permissions on one row ─────────────────────────────────────
 * "Ngưng truy cập" is open to the teacher who teaches the child: a student who
 * has to be locked out mid-lesson should not require finding an admin first.
 * Deleting is admin-only, so `laQuanTri` decides whether that disclosure exists
 * at all — and the server refuses it regardless, because a hidden button is not
 * access control.
 *
 * ── Why deletion is the loudest thing on the page ────────────────────────────
 * A student account is the opposite of a teacher account: nothing BLOCKS the
 * delete. Every row pointing at a child — submissions, drafts, snapshots, quiz
 * attempts, badges, projects, progress — cascades away silently in one
 * statement. There is no foreign key to catch a mistake, so the confirmation is
 * the only thing standing between a misclick and a term of a child's work.
 */
export function HangHocSinh({
  hs,
  laQuanTri,
}: {
  hs: HocSinhHienThi;
  laQuanTri: boolean;
}) {
  const [moXoa, setMoXoa] = useState(false);
  const [kqTruyCap, actionTruyCap] = useActionState(doiTruyCapHocSinh, CHUA_LAM);
  const [kqXoa, actionXoa] = useActionState(xoaHocSinh, CHUA_LAM);

  const id = useId();
  const vungId = `${id}-xoa`;

  return (
    <li className="rounded-the border border-vien bg-the p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
            <Link href={`/giao-vien/hoc-sinh/${hs.id}`} className="hover:underline">
              {hs.displayName}
            </Link>
            {!hs.isActive ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đã ngưng
              </span>
            ) : null}
            {hs.mustChangePassword ? (
              <span className="rounded-full bg-chinh-nhat px-2.5 py-0.5 text-xs font-semibold text-chinh">
                Chưa đổi mật khẩu
              </span>
            ) : null}
          </h3>
          <p className="m-0 text-sm text-chu-phu">
            {hs.username}
            {hs.lop.length > 0 ? ` · ${hs.lop.join(', ')}` : ' · chưa xếp lớp'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={actionTruyCap}>
            <input type="hidden" name="studentId" value={hs.id} />
            <input type="hidden" name="bat" value={hs.isActive ? 'khong' : 'co'} />
            <Nut nhan={hs.isActive ? 'Ngưng truy cập' : 'Mở lại truy cập'} />
          </form>

          {laQuanTri ? (
            <button
              type="button"
              onClick={() => setMoXoa((v) => !v)}
              aria-expanded={moXoa}
              aria-controls={vungId}
              className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
            >
              {moXoa ? 'Đóng' : 'Xoá tài khoản…'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqTruyCap} />
      </div>

      {moXoa && laQuanTri ? (
        <div id={vungId} className="mt-4 border-t border-vien pt-4">
          <div className="mb-4 rounded-nut bg-thu-lai-nen p-4 text-sm">
            <p className="mt-0 mb-2 font-semibold text-thu-lai">
              Gần như lúc nào “Ngưng truy cập” cũng là lựa chọn đúng
            </p>
            <p className="m-0 text-chu-phu">
              Ngưng truy cập chặn em đăng nhập ngay lập tức mà{' '}
              <strong className="text-chu">giữ lại toàn bộ bài làm</strong>, và bật lại được. Xoá
              tài khoản thì <strong className="text-chu">mất hẳn</strong> mọi bài nộp, bản nháp,
              huy hiệu và tiến độ của em — không khôi phục được, kể cả từ bản sao lưu gần nhất.
              Chỉ nên xoá khi tài khoản tạo nhầm, bị trùng, hoặc gia đình yêu cầu xoá dữ liệu.
            </p>
          </div>

          <form action={actionXoa}>
            <input type="hidden" name="studentId" value={hs.id} />

            <p className="m-0 mb-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="xacNhan" value="co" className="mt-0.5 h-4 w-4" />
                <span>
                  Tôi hiểu rằng tài khoản <strong>{hs.displayName}</strong> ({hs.username}) và toàn
                  bộ bài làm của em sẽ bị xoá vĩnh viễn.
                </span>
              </label>
            </p>

            <Nut nhan="Xoá tài khoản này" kieu="canh-bao" />

            <div className="mt-3 empty:mt-0">
              <PhanHoi ketQua={kqXoa} />
            </div>
          </form>
        </div>
      ) : null}
    </li>
  );
}
