'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { xuLyCanhBaoTapTrung } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface CanhBaoHang {
  id: string;
  studentId: string;
  tenHocSinh: string;
  username: string;
  tenLop: string | null;
  buoi: number;
  tenBai: string;
  tenKhoa: string;
  soLan: number;
  tongVangGiay: number;
  state: 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED';
  luc: string;
  nguoiXuLy: string | null;
}

/** "2 phút", "1 giờ 5 phút" — never a bare second count nobody reads. */
function docThoiLuong(giay: number): string {
  if (giay < 60) return `${giay} giây`;
  const phut = Math.floor(giay / 60);
  if (phut < 60) return `${phut} phút`;
  const gio = Math.floor(phut / 60);
  const con = phut % 60;
  return con === 0 ? `${gio} giờ` : `${gio} giờ ${con} phút`;
}

function Nut({ nhan, kieu = 'phu' }: { nhan: string; kieu?: 'phu' | 'chinh' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-cham rounded-nut px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        kieu === 'chinh'
          ? 'bg-chinh text-white hover:bg-chinh-dam'
          : 'border border-vien text-chu-phu hover:border-vien-dam hover:text-chu'
      }`}
    >
      {pending ? 'Đang lưu…' : nhan}
    </button>
  );
}

/**
 * One alert.
 *
 * ── The tone is the feature ──────────────────────────────────────────────────
 * Everything here is amber, never red, and the actions are "Đã hỏi thăm"
 * (I checked in with them) and "Bỏ qua" — not "confirm violation" and not
 * "penalise". Red and the word "gian lận" would turn a signal that the system
 * genuinely cannot interpret into a verdict a child then has to argue against.
 *
 * What the row actually reports is narrow and it says so: this student left the
 * lesson tab N times. It does not know where they went, and the copy repeats
 * that, because a teacher reading a list of alerts at the end of a long day will
 * fill in the blank themselves otherwise.
 *
 * ── Nothing is deleted ───────────────────────────────────────────────────────
 * Both buttons record a name and a time against the alert. An alert about a
 * child that was silently cleared is worse than one nobody looked at, so
 * "Bỏ qua" is itself an entry in the record rather than an erasure of one.
 */
export function HangCanhBao({ canhBao }: { canhBao: CanhBaoHang }) {
  const [kq, action] = useActionState(xuLyCanhBaoTapTrung, CHUA_LAM);
  const dangMo = canhBao.state === 'OPEN';

  return (
    <li
      className={`rounded-the border p-4 ${
        dangMo ? 'border-thu-lai/40 bg-thu-lai-nen' : 'border-vien bg-the'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h3 className="mt-0 mb-1 flex flex-wrap items-center gap-2 text-base font-semibold">
            <Link href={`/giao-vien/hoc-sinh/${canhBao.studentId}`} className="hover:underline">
              {canhBao.tenHocSinh}
            </Link>
            <span className="rounded-full bg-the px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
              rời tab {canhBao.soLan} lần
            </span>
            {canhBao.state === 'ACKNOWLEDGED' ? (
              <span className="rounded-full bg-dung-nen px-2.5 py-0.5 text-xs font-semibold text-dung">
                ✓ Đã hỏi thăm
              </span>
            ) : null}
            {canhBao.state === 'DISMISSED' ? (
              <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold text-chu-phu">
                Đã bỏ qua
              </span>
            ) : null}
          </h3>

          <p className="m-0 text-sm text-chu-phu">
            {canhBao.username}
            {canhBao.tenLop ? ` · ${canhBao.tenLop}` : ' · không rõ lớp'} · {canhBao.tenKhoa} ·
            Buổi {canhBao.buoi}: {canhBao.tenBai}
          </p>

          <p className="mt-1 mb-0 text-sm text-chu-nhat">
            {canhBao.luc}
            {canhBao.tongVangGiay > 0
              ? ` · tổng thời gian ở ngoài tab: ${docThoiLuong(canhBao.tongVangGiay)}`
              : ''}
            {canhBao.nguoiXuLy ? ` · ${canhBao.nguoiXuLy} đã xử lý` : ''}
          </p>
        </div>

        {dangMo ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={action}>
              <input type="hidden" name="alertId" value={canhBao.id} />
              <input type="hidden" name="hanhDong" value="da-hoi-tham" />
              <Nut nhan="Đã hỏi thăm em" kieu="chinh" />
            </form>
            <form action={action}>
              <input type="hidden" name="alertId" value={canhBao.id} />
              <input type="hidden" name="hanhDong" value="bo-qua" />
              <Nut nhan="Bỏ qua" />
            </form>
          </div>
        ) : null}
      </div>

      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kq} />
      </div>
    </li>
  );
}
