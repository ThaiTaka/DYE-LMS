import Link from 'next/link';

import { BieuTuong } from '@/components/ui/bieu-tuong';
import { SAC_THAI, type SacThai } from '@/components/ui/sac-thai';
import { conLai, hienThiHan, hienThiLuc } from '@/lib/thoi-gian';

import { TheNoi } from './chuyen-dong';

import type { TheBaiTap } from '@/lib/student-data';
import type { TrangThaiBaiTap } from '@dye/core';

/**
 * Status, in the student's words — with an icon, never colour alone.
 *
 * Overdue is AMBER and says the door is still open ("vẫn nộp được"): late work
 * is accepted, and a red "Quá hạn" on a ten-year-old's dashboard reads as a
 * verdict on them rather than a nudge about the work.
 */
export const TRANG_THAI_BAI_TAP: Record<
  TrangThaiBaiTap,
  { nhan: string; icon: string; sac: SacThai; hanhDong: string }
> = {
  'chua-nop': { nhan: 'Chưa nộp', icon: '📝', sac: 'chinh', hanhDong: 'Làm bài' },
  'qua-han': { nhan: 'Quá hạn · vẫn nộp được', icon: '⏰', sac: 'thuLai', hanhDong: 'Làm bài' },
  'da-nop': { nhan: 'Đã nộp · chờ chấm', icon: '⏳', sac: 'trung', hanhDong: 'Xem hoặc sửa' },
  'da-cham': { nhan: 'Đã có nhận xét', icon: '💬', sac: 'dung', hanhDong: 'Đọc nhận xét' },
};

function vietHoaDau(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One homework card.
 *
 * A server component: `bayGio` is the render time, passed down rather than
 * read here, so a list of cards agrees with itself about what "còn 2 ngày"
 * means and no client clock is involved — nothing to mismatch on hydration.
 *
 * The whole card is the link. Title, class, deadline and status are the four
 * things the brief asks for; the relative time ("còn 5 giờ") is what a child
 * actually reads first, so it sits beside the absolute one, not instead of it.
 */
export function TheBaiTapVeNha({ bai, bayGio }: { bai: TheBaiTap; bayGio: Date }) {
  const tt = TRANG_THAI_BAI_TAP[bai.trangThai];
  const han = conLai(bai.hanNop, bayGio);
  const chuaNop = bai.trangThai === 'chua-nop' || bai.trangThai === 'qua-han';
  // Urgency is only worth saying about work that is still to do.
  const nhanManh = chuaNop && (han.gap || han.quaHan);

  return (
    <TheNoi className="h-full">
      <Link
        href={`/bai-tap/${bai.id}`}
        className="group flex h-full flex-col rounded-the border border-white/10 bg-be-mat p-5 transition-colors hover:border-chinh-sang/60"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI[tt.sac]}`}
          >
            <span aria-hidden="true">{tt.icon}</span>
            {tt.nhan}
          </span>
          {chuaNop && han.gap ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI.thuLai}`}>
              <span aria-hidden="true">🔥 </span>Sắp hết hạn
            </span>
          ) : null}
        </div>

        <h3 className="mt-0 mb-1 text-lg leading-snug font-semibold text-chu transition-colors group-hover:text-chinh-sang">
          {bai.tieuDe}
        </h3>
        <p className="m-0 text-sm text-chu-phu">
          {bai.tenLop}
          {bai.baiHoc ? ` · sau Buổi ${bai.baiHoc.buoi}` : ''}
        </p>

        <div className="mt-auto pt-4">
          {/*
            Work still to do leads with the countdown — "Còn 4 giờ" is what a
            child reads first — and the exact deadline sits under it. Work
            already handed in has no countdown to show, so the deadline leads.
          */}
          {chuaNop ? (
            <p
              className={`m-0 flex items-center gap-1.5 text-sm font-semibold ${nhanManh ? 'text-thu-lai' : 'text-chu'}`}
            >
              <BieuTuong ten="dongHo" className="size-4 shrink-0" />
              {vietHoaDau(han.chu)}
            </p>
          ) : null}
          <p className={`m-0 text-sm text-chu-phu ${chuaNop ? 'mt-0.5 ps-5.5' : ''}`}>
            Hạn: <span className="whitespace-nowrap">{hienThiHan(bai.hanNop)}</span>
          </p>
          {bai.nopLuc ? (
            <p className="mt-1 mb-0 text-sm text-chu-nhat">
              Nộp lúc <span className="whitespace-nowrap">{hienThiLuc(bai.nopLuc)}</span>
              {bai.nopMuon ? ' · nộp sau hạn' : ''}
            </p>
          ) : null}

          <p className="mt-3 mb-0 inline-flex items-center gap-1.5 text-sm font-semibold text-chinh-sang">
            {tt.hanhDong}
            <BieuTuong
              ten="muiTen"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </p>
        </div>
      </Link>
    </TheNoi>
  );
}

/** A grid of homework cards. Two across from `sm`, like the course cards. */
export function LuoiBaiTap({ baiTap, bayGio }: { baiTap: TheBaiTap[]; bayGio: Date }) {
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {baiTap.map((b) => (
        <li key={b.id}>
          <TheBaiTapVeNha bai={b} bayGio={bayGio} />
        </li>
      ))}
    </ul>
  );
}
