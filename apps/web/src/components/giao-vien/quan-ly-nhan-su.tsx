'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { chuyenGiao, phanCongLop, voHieuHoa, xoaNhanVien } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface NhanVienHienThi {
  id: string;
  username: string;
  displayName: string;
  role: 'TEACHER' | 'ADMIN' | 'STUDENT';
  isActive: boolean;
  soLop: number;
  laToi: boolean;
  tenLop: string[];
}

export interface NguoiNhan {
  id: string;
  username: string;
  displayName: string;
}

/** An open class and who runs it today. */
export interface LopCoTheGiao {
  id: string;
  ten: string;
  ma: string;
  chuId: string;
  chuTen: string;
}

function Nut({
  nhan: nhanCho,
  kieu = 'phu',
}: {
  nhan: string;
  kieu?: 'phu' | 'chinh' | 'canh-bao';
}) {
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
      {pending ? 'Đang xử lý…' : nhanCho}
    </button>
  );
}

/**
 * One staff row, with the retirement controls.
 *
 * The order of the controls is the argument. "Ngưng quyền truy cập" is the
 * primary button because it is almost always the right answer: it stops access
 * immediately and keeps every pedagogical decision attached to the person who
 * made it. Deletion is behind a disclosure, needs a named successor, and says
 * out loud that handing over classes hands over access to children.
 */
export function HangNhanSu({
  nv,
  nguoiNhan,
  lopDangMo = [],
}: {
  nv: NhanVienHienThi;
  nguoiNhan: NguoiNhan[];
  lopDangMo?: LopCoTheGiao[];
}) {
  const [moXoa, setMoXoa] = useState(false);
  const [moLop, setMoLop] = useState(false);

  const [kqVoHieu, actionVoHieu] = useActionState(voHieuHoa, CHUA_LAM);
  const [kqChuyen, actionChuyen] = useActionState(chuyenGiao, CHUA_LAM);
  const [kqXoa, actionXoa] = useActionState(xoaNhanVien, CHUA_LAM);
  const [kqLop, actionLop] = useActionState(phanCongLop, CHUA_LAM);

  const vungId = `xoa-${nv.id}`;
  const vungLopId = `lop-${nv.id}`;

  /*
   * Only classes this person does NOT already run.
   *
   * `Class.teacherId` cannot be null, so this form can only ADD: unticking a
   * class would have to mean assigning it to nobody. Taking a class away is done
   * by giving it to someone else, from their own row.
   */
  const lopCoTheGiao = lopDangMo.filter((l) => l.chuId !== nv.id);

  // Remount the class form after each success so nothing stays ticked. The list
  // itself shrinks on its own: a revalidated page no longer offers a class this
  // person now runs.
  const [soLanGiao, setSoLanGiao] = useState(0);
  useEffect(() => {
    if (kqLop.trangThai === 'thanh-cong') setSoLanGiao((n) => n + 1);
  }, [kqLop]);

  return (
    <li className="rounded-the border border-vien bg-the p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-lg font-semibold">
            {nv.displayName}
            <span className="rounded-full bg-chinh-nhat px-2.5 py-0.5 text-xs font-semibold text-chinh">
              {nv.role === 'ADMIN' ? 'Quản trị' : 'Giáo viên'}
            </span>
            {nv.laToi ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đây là bạn
              </span>
            ) : null}
            {!nv.isActive ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đã ngưng hoạt động
              </span>
            ) : null}
          </h3>
          <p className="m-0 text-sm text-chu-nhat">
            {nv.username} · phụ trách {nv.soLop} lớp
            {nv.tenLop.length > 0 ? `: ${nv.tenLop.join(', ')}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/*
            Outside the `laToi` guard, unlike the retirement controls: an admin
            may not deactivate or delete themselves, but taking a class is a
            perfectly ordinary thing for them to do.
          */}
          {nv.isActive && lopCoTheGiao.length > 0 ? (
            <button
              type="button"
              onClick={() => setMoLop((v) => !v)}
              aria-expanded={moLop}
              aria-controls={vungLopId}
              className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
            >
              {moLop ? 'Đóng' : 'Phân công lớp…'}
            </button>
          ) : null}

          {!nv.laToi ? (
            <>
              {nv.isActive ? (
                <form action={actionVoHieu}>
                  <input type="hidden" name="targetId" value={nv.id} />
                  <Nut nhan="Ngưng quyền truy cập" kieu="chinh" />
                </form>
              ) : null}

              <button
                type="button"
                onClick={() => setMoXoa((v) => !v)}
                aria-expanded={moXoa}
                aria-controls={vungId}
                className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
              >
                {moXoa ? 'Đóng' : 'Bàn giao hoặc xoá…'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <PhanHoi ketQua={kqVoHieu} />

      {/* Kept outside the panel so the outcome survives the remount that clears
          the boxes, and stays readable after the panel is closed again. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqLop} />
      </div>

      {moLop && nv.isActive ? (
        <div id={vungLopId} className="mt-4 border-t border-vien pt-4">
          <form key={soLanGiao} action={actionLop}>
            <input type="hidden" name="targetId" value={nv.id} />

            <h4 className="mt-0 mb-2 text-sm font-bold">
              Giao lớp cho {nv.displayName}
            </h4>
            <p className="mt-0 mb-3 text-sm text-chu-phu">
              Mỗi lớp luôn có đúng một người phụ trách, nên giao lớp là{' '}
              <strong className="text-chu">chuyển</strong> lớp từ người đang phụ trách sang thầy
              cô này.{' '}
              <strong className="text-chu">
                Người nhận lớp sẽ xem được dữ liệu của các em trong lớp đó, và người giao thì
                không còn xem được nữa.
              </strong>
            </p>

            <fieldset className="m-0 mb-3 border-0 p-0">
              <legend className="mb-2 text-sm font-semibold">Chọn lớp để giao</legend>
              <div className="space-y-2">
                {lopCoTheGiao.map((l) => (
                  <label key={l.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="classIds"
                      value={l.id}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      {l.ten}{' '}
                      <span className="text-chu-phu">
                        ({l.ma} · đang do {l.chuTen} phụ trách)
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Nut nhan="Giao các lớp đã chọn" kieu="chinh" />
          </form>
        </div>
      ) : null}

      {moXoa && !nv.laToi ? (
        <div id={vungId} className="mt-4 border-t border-vien pt-4">
          <div className="mb-4 rounded-nut bg-thu-lai-nen p-4 text-sm">
            <p className="mt-0 mb-2 font-semibold text-thu-lai">
              Nên cân nhắc trước khi xoá
            </p>
            <p className="m-0 text-chu-phu">
              Xoá tài khoản sẽ gỡ bỏ vĩnh viễn người chịu trách nhiệm khỏi các quyết định sư phạm
              về từng em học sinh. Trong hầu hết trường hợp,{' '}
              <strong className="text-chu">ngưng quyền truy cập</strong> là lựa chọn đúng: cắt
              truy cập ngay lập tức mà vẫn giữ nguyên hồ sơ.
            </p>
          </div>

          {/* ── Transfer ─────────────────────────────────────────────────── */}
          <form action={actionChuyen} className="mb-5">
            <input type="hidden" name="fromId" value={nv.id} />

            <h4 className="mt-0 mb-2 text-sm font-bold">1. Bàn giao hồ sơ giảng dạy</h4>
            <p className="mt-0 mb-3 text-sm text-chu-phu">
              Chuyển lớp, phân nhánh, can thiệp bài học, thông báo và nhận xét sang một thầy cô
              khác.{' '}
              <strong className="text-chu">
                Người nhận sẽ có quyền xem dữ liệu của các em trong những lớp đó.
              </strong>
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={`nhan-${nv.id}`} className="mb-1.5 block text-sm font-semibold">
                  Bàn giao cho
                </label>
                <select
                  id={`nhan-${nv.id}`}
                  name="toId"
                  required
                  defaultValue=""
                  className="min-h-cham rounded-nut border border-vien bg-the px-3 py-2 text-base"
                >
                  <option value="" disabled>
                    — Chọn thầy cô —
                  </option>
                  {nguoiNhan
                    .filter((n) => n.id !== nv.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.displayName} ({n.username})
                      </option>
                    ))}
                </select>
              </div>
              <Nut nhan="Bàn giao" />
            </div>

            <PhanHoi ketQua={kqChuyen} />
          </form>

          {/* ── Delete ───────────────────────────────────────────────────── */}
          <form action={actionXoa}>
            <input type="hidden" name="targetId" value={nv.id} />

            <h4 className="mt-0 mb-2 text-sm font-bold">2. Xoá vĩnh viễn</h4>
            <p className="mt-0 mb-3 text-sm text-chu-phu">
              Chỉ thực hiện được khi tài khoản không còn hồ sơ nào. Nếu chưa bàn giao, hệ thống sẽ
              nói rõ còn vướng những gì thay vì xoá một nửa.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor={`ban-giao-${nv.id}`}
                  className="mb-1.5 block text-sm font-semibold"
                >
                  Bàn giao kèm khi xoá{' '}
                  <span className="font-normal text-chu-nhat">(không bắt buộc)</span>
                </label>
                <select
                  id={`ban-giao-${nv.id}`}
                  name="chuyenGiaoCho"
                  defaultValue=""
                  className="min-h-cham rounded-nut border border-vien bg-the px-3 py-2 text-base"
                >
                  <option value="">— Không bàn giao —</option>
                  {nguoiNhan
                    .filter((n) => n.id !== nv.id)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.displayName} ({n.username})
                      </option>
                    ))}
                </select>
              </div>
              <Nut nhan="Xoá tài khoản" kieu="canh-bao" />
            </div>

            <PhanHoi ketQua={kqXoa} />
          </form>
        </div>
      ) : null}
    </li>
  );
}
