import Link from 'next/link';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole } from '@/lib/guard';
import { hangMicrobitChoCham } from '@/lib/teacher-data';

export default async function TrangHangMicrobit() {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const hang = await hangMicrobitChoCham(actor);

  const choCham = hang.filter((h) => !h.daCham);
  const daCham = hang.filter((h) => h.daCham);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan muc={[{ nhan: 'Tổng quan', href: '/giao-vien' }, { nhan: 'Bài Micro:bit' }]} />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">Bài Micro:bit chờ chấm</h1>
        <p className="m-0 text-chu-phu">
          Bài Micro:bit <strong className="text-chu">không chấm tự động được</strong> — chương trình
          chạy trên board thật, không có đầu ra nào để máy so sánh. Nếu không có ai chấm, bài của
          học sinh sẽ nằm đây mãi mà em không nhận được phản hồi nào.
        </p>
      </header>

      <Nhom
        id="cho-cham"
        tieuDe="Chờ thầy cô chấm"
        icon="📥"
        rong="Không còn bài nào chờ. Thầy cô đã chấm hết rồi."
        danhSach={choCham}
      />

      {daCham.length > 0 ? (
        <div className="mt-8">
          <Nhom id="da-cham" tieuDe="Đã chấm" icon="✅" rong="" danhSach={daCham} />
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
  danhSach: Awaited<ReturnType<typeof hangMicrobitChoCham>>;
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
          {danhSach.map((h) => (
            <li key={h.submissionId}>
              <Link
                href={`/giao-vien/microbit/${h.submissionId}`}
                className="block rounded-the border border-vien bg-the p-4 transition-colors hover:border-chinh"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold text-chu">
                    {h.tenHocSinh} · {h.problemTitle}
                  </span>
                  {h.daCham ? (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
                        h.verdict === 'ACCEPTED'
                          ? 'bg-dung-nen text-dung'
                          : 'bg-thu-lai-nen text-thu-lai'
                      }`}
                    >
                      {h.verdict === 'ACCEPTED' ? 'Đạt' : 'Chưa đạt'}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 mb-0 text-sm text-chu-nhat">
                  {h.lessonOrder > 0 ? `Buổi ${h.lessonOrder} · ` : ''}
                  {h.lessonTitle} · lần nộp {h.attemptNo} ·{' '}
                  {h.nopLuc.toLocaleString('vi-VN')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
