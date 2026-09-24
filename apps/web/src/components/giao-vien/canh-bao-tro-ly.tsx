'use client';

import Link from 'next/link';
import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { moKhoaTroLyHocSinh } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface CanhBaoTroLyHang {
  id: string;
  studentId: string;
  tenHocSinh: string;
  username: string;
  noiDung: string;
  loai: 'PROFANITY' | 'INSULT' | 'NSFW';
  nguon: 'tu-khoa' | 'mo-hinh';
  daXuLy: boolean;
  conKhoa: boolean;
  luc: string;
  nguoiXuLy: string | null;
}

const NHAN_LOAI: Record<CanhBaoTroLyHang['loai'], string> = {
  PROFANITY: 'Chửi thề',
  INSULT: 'Xúc phạm người khác',
  NSFW: 'Nội dung người lớn',
};

/**
 * Who judged it, in words a teacher weighs differently. A keyword hit is
 * mechanical and cannot read context; a model judgement read the whole
 * sentence but can still be wrong.
 */
const NHAN_NGUON: Record<CanhBaoTroLyHang['nguon'], string> = {
  'tu-khoa': 'bộ lọc từ khoá phát hiện',
  'mo-hinh': 'AI kiểm duyệt đánh giá',
};

function NutMoKhoa() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
    >
      {pending ? 'Đang mở…' : 'Mở lại trợ lý cho em'}
    </button>
  );
}

/**
 * One message that locked a student's tutor.
 *
 * ── The message is shown, verbatim ───────────────────────────────────────────
 * The teacher is the person deciding whether the machine was right, and they
 * cannot decide that from a label. It sits in a quote block so it reads as
 * something the student wrote, not something the app is saying.
 *
 * ── Amber, not red ───────────────────────────────────────────────────────────
 * Same tone rule as the focus alerts: this is a prompt for a conversation with
 * a child, not a verdict on one.
 */
function HangCanhBaoTroLy({ canhBao }: { canhBao: CanhBaoTroLyHang }) {
  const [kq, action] = useActionState(moKhoaTroLyHocSinh, CHUA_LAM);
  const [moForm, setMoForm] = useState(false);
  const id = useId();
  const dangMo = !canhBao.daXuLy;

  return (
    <li
      className={`rounded-the border p-4 ${
        dangMo ? 'border-thu-lai/40 bg-thu-lai-nen' : 'border-vien bg-the'
      }`}
    >
      <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
        <Link href={`/giao-vien/hoc-sinh/${canhBao.studentId}`} className="hover:underline">
          {canhBao.tenHocSinh}
        </Link>
        <span className="rounded-full bg-the px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
          {NHAN_LOAI[canhBao.loai]}
        </span>
        {canhBao.daXuLy ? (
          <span className="rounded-full bg-dung-nen px-2.5 py-0.5 text-xs font-semibold text-dung">
            ✓ Đã mở khoá
          </span>
        ) : null}
      </h3>

      <p className="m-0 text-sm text-chu-phu">
        {canhBao.username} · {NHAN_NGUON[canhBao.nguon]} · {canhBao.luc}
        {canhBao.nguoiXuLy ? ` · ${canhBao.nguoiXuLy} đã xử lý` : ''}
      </p>

      <blockquote className="mx-0 mt-3 mb-0 rounded-nut border-s-4 border-vien-dam bg-the px-3 py-2 text-sm break-words whitespace-pre-wrap text-chu">
        {canhBao.noiDung}
      </blockquote>

      {dangMo ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMoForm((v) => !v)}
            aria-expanded={moForm}
            aria-controls={`${id}-mo-khoa`}
            className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh-sang"
          >
            {moForm ? 'Đóng' : 'Mở khoá trợ lý…'}
          </button>
          {moForm ? (
            <form id={`${id}-mo-khoa`} action={action} className="mt-3 border-t border-vien pt-3">
              <input type="hidden" name="studentId" value={canhBao.studentId} />
              <label htmlFor={`${id}-ly-do`} className="mb-1.5 block text-sm font-semibold">
                Lý do mở khoá (ghi vào nhật ký)
              </label>
              <input
                id={`${id}-ly-do`}
                name="ghiChu"
                required
                minLength={3}
                placeholder="VD: Đã nói chuyện với em; em hiểu và hứa dùng lời lẽ đúng mực."
                className="mb-3 min-h-cham w-full rounded-nut border border-vien px-3 py-2 text-sm"
              />
              <NutMoKhoa />
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

export function CanhBaoTroLy({ canhBao }: { canhBao: CanhBaoTroLyHang[] }) {
  return (
    <ul className="m-0 list-none space-y-3 p-0">
      {canhBao.map((c) => (
        <HangCanhBaoTroLy key={c.id} canhBao={c} />
      ))}
    </ul>
  );
}
