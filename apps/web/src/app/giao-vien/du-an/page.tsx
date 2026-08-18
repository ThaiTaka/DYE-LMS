import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { hangChoDuyet, NHAN_TRANG_THAI } from '@/lib/project-data';

export default async function TrangDuyetDuAn() {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const hang = await hangChoDuyet(actor);

  const chuaXem = hang.filter((h) => !h.daCoNhanXet);
  const daXem = hang.filter((h) => h.daCoNhanXet);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Dự án game' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Dự án game của học sinh</h1>
        <p className="m-0 text-chu-phu">
          Các bản học sinh đã nộp. Mỗi bản là một bản chụp cố định — nội dung không đổi sau khi
          nộp, nên nhận xét của thầy cô luôn đúng với thứ mình đã xem.
        </p>
      </header>

      <Nhom
        id="chua-xem"
        tieuDe="Chờ thầy cô xem"
        icon="📥"
        rong="Không còn bản nào chờ. Thầy cô đã xem hết rồi."
        danhSach={chuaXem}
      />

      {daXem.length > 0 ? (
        <div className="mt-8">
          <Nhom
            id="da-xem"
            tieuDe="Đã nhận xét"
            icon="✅"
            rong=""
            danhSach={daXem}
          />
        </div>
      ) : null}
    </VoGiaoVien>
  );
}

function Nhom({
  id,
  tieuDe,
  icon,
  rong,
  danhSach,
}: {
  id: string;
  tieuDe: string;
  icon: string;
  rong: string;
  danhSach: Awaited<ReturnType<typeof hangChoDuyet>>;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mt-0 mb-4 flex items-center gap-2 text-xl font-bold">
        <span aria-hidden="true">{icon}</span>
        {tieuDe}
        <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-sm font-semibold text-chu-phu">
          {danhSach.length}
        </span>
      </h2>

      {danhSach.length === 0 ? (
        <p className="m-0 rounded-the border border-vien bg-the p-6 text-chu-phu">{rong}</p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {danhSach.map((h) => {
            const tt = NHAN_TRANG_THAI[h.status];
            return (
              <li key={h.versionId}>
                <Link
                  href={`/giao-vien/du-an/${h.versionId}`}
                  className="block rounded-the border border-vien bg-the p-4 transition-colors hover:border-chinh"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-semibold text-chu">
                      {h.tenHocSinh} · {h.title}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tt.lop}`}
                    >
                      {tt.nhan}
                    </span>
                  </div>

                  <p className="mt-1 mb-0 text-sm text-chu-nhat">
                    Bản {h.version} · {h.soTep} tệp ·{' '}
                    {h.submittedAt.toLocaleString('vi-VN')}
                  </p>

                  {h.note ? (
                    <p className="mt-2 mb-0 text-sm text-chu-phu">“{h.note}”</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
