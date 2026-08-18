import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireRole, xemDuoc } from '@/lib/guard';
import { duLieuLop } from '@/lib/teacher-data';

export default async function TrangLop({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ khoa?: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { id } = await params;
  const { khoa } = await searchParams;

  // `duLieuLop` authorizes before it reads. A teacher requesting another
  // teacher's class id is refused here, not shown an empty roster — and the
  // refusal lands on a real page rather than a 500.
  const kq = await xemDuoc(duLieuLop(actor, id, khoa));
  if (!kq.ok) redirect('/khong-co-quyen');

  const lop = kq.du;
  if (!lop) notFound();

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan
        muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: lop.name }]}
      />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">{lop.name}</h1>
        <p className="m-0 text-chu-phu">
          {lop.code}
          {lop.term ? ` · ${lop.term}` : ''} · {lop.hocSinh.length} học sinh · trung bình{' '}
          <strong className="text-chu">{lop.tiLeTrungBinh}%</strong>
        </p>
      </header>

      {lop.courses.length > 1 ? (
        <nav aria-label="Chọn khoá học" className="mb-6 flex flex-wrap gap-2">
          {lop.courses.map((c) => {
            const dangXem = c.courseId === lop.khoaHienTai?.courseId;
            return (
              <Link
                key={c.courseId}
                href={`/giao-vien/lop/${lop.classId}?khoa=${c.courseId}`}
                aria-current={dangXem ? 'page' : undefined}
                className={`flex min-h-cham items-center gap-2 rounded-nut border px-4 py-2 text-sm font-medium ${
                  dangXem
                    ? 'border-chinh bg-chinh-nhat text-chinh'
                    : 'border-vien text-chu-phu hover:border-vien-dam hover:text-chu'
                }`}
              >
                <span aria-hidden="true">{c.iconEmoji}</span>
                {c.title}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {lop.khoaHienTai === null ? (
        <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
          Lớp này chưa được gắn khoá học nào.
        </p>
      ) : lop.hocSinh.length === 0 ? (
        <p className="rounded-the border border-vien bg-the p-6 text-chu-phu">
          Lớp này chưa có học sinh nào đang theo học.
        </p>
      ) : (
        <section aria-labelledby="danh-sach-lop">
          <h2 id="danh-sach-lop" className="mt-0 mb-4 text-xl font-bold">
            Danh sách · {lop.khoaHienTai.title}
          </h2>

          {/* The table scrolls inside its own box rather than pushing the page
              sideways — teachers do open this on a tablet in class. */}
          <div className="overflow-x-auto rounded-the border border-vien bg-the">
            <table className="w-full border-collapse text-base">
              <caption className="sr-only">
                Học sinh lớp {lop.name}, tiến độ và nhánh học trong khoá {lop.khoaHienTai.title}
              </caption>
              <thead>
                <tr className="border-b border-vien bg-the-mo text-start">
                  <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
                    Học sinh
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
                    Nhánh
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
                    Phần bắt buộc
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-sm font-semibold">
                    Làm thêm
                  </th>
                  <th scope="col" className="px-4 py-3 text-end text-sm font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lop.hocSinh.map((h) => {
                  const kieu = KIEU_NHANH[h.tier];
                  return (
                    <tr key={h.studentId} className="border-b border-vien last:border-b-0">
                      <th scope="row" className="px-4 py-3 text-start font-medium">
                        {h.displayName}
                        <span className="block text-sm font-normal text-chu-nhat">
                          {h.username}
                          {!h.isActive ? ' · đã ngưng hoạt động' : ''}
                        </span>
                      </th>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${kieu.nen} ${kieu.chu} ${kieu.vien}`}
                        >
                          <span aria-hidden="true">{kieu.icon}</span>
                          {kieu.nhan}
                        </span>
                      </td>

                      <td className="w-56 px-4 py-3">
                        <ThanhTienDo
                          nhan={`Tiến độ của ${h.displayName}`}
                          phanTram={h.progress.required.percent}
                          daXong={h.progress.required.completed}
                          tong={h.progress.required.total}
                          chuaGiao={!h.progress.hasRequiredWork}
                        />
                      </td>

                      <td className="px-4 py-3 text-sm text-chu-phu tabular-nums">
                        {h.progress.optional.completed > 0
                          ? `🌟 ${h.progress.optional.completed}`
                          : '—'}
                        {h.soCanThiep > 0 ? (
                          <span className="mt-1 block text-xs text-mo-rong">
                            {h.soCanThiep} can thiệp
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-end">
                        <Link
                          href={`/giao-vien/hoc-sinh/${h.studentId}?khoa=${lop.khoaHienTai?.courseId}`}
                          className="inline-flex min-h-cham items-center rounded-nut border border-vien px-3.5 py-2 text-sm font-medium whitespace-nowrap text-chu-phu hover:border-chinh hover:text-chinh"
                        >
                          Xem &amp; điều chỉnh
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </VoGiaoVien>
  );
}
