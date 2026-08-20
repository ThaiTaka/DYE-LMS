import Link from 'next/link';

import { HangCanhBao, type CanhBaoHang } from '@/components/giao-vien/danh-sach-canh-bao';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { duLieuCanhBao } from '@/lib/teacher-data';

/**
 * The focus-alert feed.
 *
 * ── Who sees what ────────────────────────────────────────────────────────────
 * A TEACHER sees alerts for students they actually teach, through
 * `Class.teacherId → Enrollment → student`. An ADMIN sees every alert in the
 * system, which is what the brief asks for. Neither decision is made on this
 * page: the scope is built in `canhBaoTapTrung` in @dye/core, so this list and
 * the student detail page cannot disagree about who is visible.
 *
 * ── Why the explanation sits above the list ──────────────────────────────────
 * A page of alerts about children, read at the end of a teaching day, will be
 * interpreted in whatever direction the surrounding copy points. So the framing
 * comes first and states the limits plainly: what the number counts, what the
 * system cannot know, and that the intended response is a conversation.
 */
export default async function TrangCanhBao({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { tat_ca } = await searchParams;
  const xemTatCa = tat_ca === 'co';

  const data = await duLieuCanhBao(actor, { chiChuaXuLy: !xemTatCa });

  const dinhDangGio = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const danhSach: CanhBaoHang[] = data.canhBao.map((c) => ({
    id: c.id,
    studentId: c.studentId,
    tenHocSinh: c.tenHocSinh,
    username: c.username,
    tenLop: c.tenLop,
    buoi: c.buoi,
    tenBai: c.tenBai,
    tenKhoa: c.tenKhoa,
    soLan: c.soLan,
    tongVangGiay: c.tongVangGiay,
    state: c.state,
    luc: dinhDangGio.format(c.luc),
    nguoiXuLy: c.nguoiXuLy,
  }));

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Cảnh báo' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Cảnh báo tập trung</h1>
        <p className="m-0 text-chu-phu">
          {data.toanHeThong
            ? 'Toàn hệ thống — mọi lớp, mọi giáo viên.'
            : 'Chỉ các em trong lớp thầy cô đang dạy.'}{' '}
          {data.soChuaXuLy > 0
            ? `Đang có ${data.soChuaXuLy} cảnh báo chưa xử lý.`
            : 'Không có cảnh báo nào đang chờ.'}
        </p>
      </header>

      <section
        aria-labelledby="canh-bao-nghia-la-gi"
        className="mb-7 rounded-the border border-vien bg-the p-5"
      >
        <h2 id="canh-bao-nghia-la-gi" className="mt-0 mb-2 text-lg font-bold">
          Con số này nói lên điều gì — và không nói lên điều gì
        </h2>
        <p className="mt-0 mb-3 text-chu-phu">
          Trang bài học ghi lại mỗi lần một em <strong className="text-chu">rời khỏi tab</strong>{' '}
          — chuyển tab, thu nhỏ cửa sổ, hoặc màn hình tự khoá. Khi một em rời tab từ{' '}
          <strong className="text-chu">{data.nguong} lần trở lên</strong> trong cùng một buổi, hệ
          thống báo cho thầy cô một lần. Các em đều được thông báo rõ là có ghi nhận việc này.
        </p>
        <p className="mt-0 mb-3 text-chu-phu">
          Hệ thống <strong className="text-chu">không biết em đã mở gì</strong>. Nó không đọc được
          tab khác, không lưu địa chỉ trang, không chụp màn hình. Một em tra từ điển, một em nhắn
          tin, và một em bị bố mẹ gọi ra ngoài đều tạo ra{' '}
          <em>đúng một loại tín hiệu giống hệt nhau</em>.
        </p>
        <p className="m-0 text-chu-phu">
          Vì vậy cách dùng đúng của trang này là{' '}
          <strong className="text-chu">ghé hỏi thăm em một câu</strong>. Rời tab nhiều thường có
          nghĩa là em đang bí ở một chỗ nào đó — và đó là thông tin hữu ích, dù lý do là gì đi nữa.
        </p>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold">
          {xemTatCa ? `Tất cả cảnh báo (${danhSach.length})` : `Chưa xử lý (${danhSach.length})`}
        </h2>
        <Link
          href={xemTatCa ? '/giao-vien/canh-bao' : '/giao-vien/canh-bao?tat_ca=co'}
          className="flex min-h-cham items-center rounded-nut border border-vien px-4 py-2 text-sm font-medium text-chu-phu hover:border-vien-dam hover:text-chu"
        >
          {xemTatCa ? 'Chỉ xem chưa xử lý' : 'Xem cả những cái đã xử lý'}
        </Link>
      </div>

      {danhSach.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
          {xemTatCa
            ? 'Chưa có cảnh báo nào được ghi nhận.'
            : 'Không có cảnh báo nào đang chờ xử lý. Các em đang tập trung tốt.'}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {danhSach.map((c) => (
            <HangCanhBao key={c.id} canhBao={c} />
          ))}
        </ul>
      )}
    </VoGiaoVien>
  );
}
