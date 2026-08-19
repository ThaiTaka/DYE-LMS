'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { taoTaiKhoanMoi } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface LopDeChon {
  id: string;
  ten: string;
  ma: string;
  giaoVien: string;
}

function NutGui({ nhan }: { nhan: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang tạo…' : nhan}
    </button>
  );
}

function O({
  id,
  nhan,
  ten,
  moTa,
  batBuoc = false,
  goiY,
}: {
  id: string;
  nhan: string;
  ten: string;
  moTa: string;
  batBuoc?: boolean;
  goiY?: string;
}) {
  const idMoTa = `${id}-mo-ta`;
  return (
    <p className="m-0">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {nhan}
      </label>
      <input
        id={id}
        name={ten}
        type="text"
        required={batBuoc}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={idMoTa}
        {...(goiY ? { placeholder: goiY } : {})}
        className="min-h-cham w-full rounded-nut border border-vien bg-the px-3 py-2 text-sm"
      />
      <span id={idMoTa} className="mt-1 block text-xs text-chu-phu">
        {moTa}
      </span>
    </p>
  );
}

/**
 * Create an account.
 *
 * ── Why a disclosure rather than a modal ─────────────────────────────────────
 * A dialog has to trap focus, restore it on close, and stay reachable by
 * keyboard and screen reader. Hand-rolling that badly is worse than not having
 * it: this form is long enough to scroll, so a half-working trap would strand a
 * keyboard user inside a box they cannot leave. A disclosure gets the same
 * "hidden until asked for" behaviour from markup that is correct by default.
 *
 * The form remounts after each success, which clears every field. Provisioning
 * is repetitive — twenty students in one sitting — and leaving the previous
 * child's name in the box is how the wrong account gets created.
 */
export function TaoTaiKhoan({
  vaiTroCoDinh,
  nhanMo,
  tieuDe,
  lop = [],
}: {
  /** STUDENT locks the form to students; omitted offers teacher / admin. */
  vaiTroCoDinh?: 'STUDENT';
  nhanMo: string;
  tieuDe: string;
  lop?: LopDeChon[];
}) {
  const [mo, setMo] = useState(false);
  const [soLanXong, setSoLanXong] = useState(0);
  const [ketQua, action] = useActionState(taoTaiKhoanMoi, CHUA_LAM);

  const id = useId();
  const vungId = `${id}-vung`;
  const laHocSinh = vaiTroCoDinh === 'STUDENT';

  // Each result is a fresh object, so this counts successes rather than renders.
  // The count drives `key` on the form, which is what empties the fields.
  useEffect(() => {
    if (ketQua.trangThai === 'thanh-cong') setSoLanXong((n) => n + 1);
  }, [ketQua]);

  return (
    <section className="mb-7 rounded-the border border-vien bg-the p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold">{tieuDe}</h2>
        <button
          type="button"
          aria-expanded={mo}
          aria-controls={vungId}
          onClick={() => setMo((truoc) => !truoc)}
          className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam"
        >
          {mo ? 'Đóng biểu mẫu' : nhanMo}
        </button>
      </div>

      {/* Outside the form, so a success message survives the remount that clears
          the fields — and is still readable after the form is closed again. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={ketQua} />
      </div>

      {mo ? (
        <form key={soLanXong} id={vungId} action={action} className="mt-4 space-y-4">
          {/*
            Only rendered for the student form. Rendering it alongside the role
            radios would put an empty `role` FIRST in the FormData, and
            `form.get('role')` returns the first entry — so every staff account
            would be rejected as an invalid role.
          */}
          {laHocSinh ? <input type="hidden" name="role" value="STUDENT" /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <O
              id={`${id}-username`}
              nhan="Tên đăng nhập"
              ten="username"
              batBuoc
              goiY={laHocSinh ? 'hs.an' : 'co.lan'}
              moTa="Chữ thường không dấu, số, dấu chấm. Khi đăng nhập, gõ hoa hay thường đều được."
            />
            <O
              id={`${id}-ho-ten`}
              nhan="Họ và tên"
              ten="displayName"
              batBuoc
              goiY={laHocSinh ? 'Nguyễn Văn An' : 'Cô Lan'}
              moTa="Tên hiển thị cho các em thấy."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <O
              id={`${id}-mat-khau`}
              nhan="Mật khẩu ban đầu"
              ten="password"
              batBuoc
              moTa="Hiện rõ để thầy cô đọc cho em ghi lại. Em sẽ tự đổi ở lần đăng nhập đầu tiên."
            />
            <O
              id={`${id}-avatar`}
              nhan="Hình đại diện (không bắt buộc)"
              ten="avatarUrl"
              goiY="https://…"
              moTa="Địa chỉ ảnh http(s), hoặc đường dẫn trong trang bắt đầu bằng dấu gạch chéo."
            />
          </div>

          {laHocSinh ? (
            <fieldset className="m-0 rounded-nut border border-vien p-4">
              <legend className="px-1 text-sm font-semibold">Xếp vào lớp</legend>
              {lop.length === 0 ? (
                <p className="m-0 text-sm text-chu-phu">
                  Chưa có lớp nào đang mở. Tài khoản vẫn tạo được, và thầy cô xếp lớp sau.
                </p>
              ) : (
                <>
                  <p className="mt-0 mb-3 text-xs text-chu-phu">
                    Chọn được nhiều lớp. Bỏ trống cũng được — khi đó em chưa thuộc lớp nào.
                  </p>
                  <div className="space-y-2">
                    {lop.map((l) => (
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
                            ({l.ma} · {l.giaoVien})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          ) : (
            <fieldset className="m-0 rounded-nut border border-vien p-4">
              <legend className="px-1 text-sm font-semibold">Vai trò</legend>
              <p className="mt-0 mb-3 text-xs text-chu-phu">
                Quản trị viên đọc được hồ sơ của mọi em và quản lý được tài khoản nhân sự. Chỉ
                cấp khi thật sự cần, và mật khẩu phải dài ít nhất 12 ký tự.
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="role"
                    value="TEACHER"
                    defaultChecked
                    className="h-4 w-4"
                  />
                  Giáo viên
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="role" value="ADMIN" className="h-4 w-4" />
                  Quản trị viên
                </label>
              </div>
            </fieldset>
          )}

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="giuMatKhau" value="co" className="mt-0.5 h-4 w-4" />
            <span>
              Giữ nguyên mật khẩu này, không bắt đổi ở lần đăng nhập đầu
              <span className="mt-0.5 block text-xs text-chu-phu">
                Mặc định là bắt đổi, để mật khẩu thầy cô đọc to trong lớp không trở thành mật
                khẩu em dùng lâu dài.
              </span>
            </span>
          </label>

          <NutGui nhan={laHocSinh ? 'Tạo tài khoản học sinh' : 'Tạo tài khoản'} />
        </form>
      ) : null}
    </section>
  );
}
