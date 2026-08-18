import { notFound, redirect } from 'next/navigation';

import { ChamMicrobit, XemKhoiLenh } from '@/components/giao-vien/cham-microbit';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole, xemDuoc } from '@/lib/guard';
import { VanBan } from '@/lib/markdown';
import { baiMicrobitDeCham } from '@/lib/teacher-data';

export default async function TrangChamMotBai({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { id } = await params;

  const kq = await xemDuoc(baiMicrobitDeCham(actor, id));
  if (!kq.ok) redirect('/khong-co-quyen');

  const bai = kq.du;
  if (!bai) notFound();

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan
        muc={[
          { nhan: 'Tổng quan', href: '/giao-vien' },
          { nhan: 'Bài Micro:bit', href: '/giao-vien/microbit' },
          { nhan: `${bai.tenHocSinh} · ${bai.problemTitle}` },
        ]}
      />

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-3xl font-bold">{bai.problemTitle}</h1>
          {bai.daCham ? (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                bai.verdict === 'ACCEPTED'
                  ? 'bg-dung-nen text-dung'
                  : 'bg-thu-lai-nen text-thu-lai'
              }`}
            >
              {bai.verdict === 'ACCEPTED' ? `Đã chấm đạt · ${bai.score} điểm` : 'Đã chấm: chưa đạt'}
            </span>
          ) : (
            <span className="rounded-full bg-chinh-nhat px-3 py-1 text-sm font-semibold text-chinh">
              Chờ chấm
            </span>
          )}
        </div>
        <p className="m-0 text-chu-phu">
          {bai.tenHocSinh} · lần nộp {bai.attemptNo} · {bai.nopLuc.toLocaleString('vi-VN')}
        </p>
      </header>

      <section
        aria-label="Đề bài"
        className="mb-6 rounded-the border border-vien bg-the-mo p-5"
      >
        <h2 className="mt-0 mb-2 text-base font-bold">Đề bài</h2>
        <VanBan>{bai.problemStatement}</VanBan>
      </section>

      <div className="mb-6">
        <XemKhoiLenh blocksXml={bai.blocksXml} loiGiaiMau={bai.loiGiaiMau} />
      </div>

      <div className="mb-6">
        <ChamMicrobit
          submissionId={bai.submissionId}
          tenHocSinh={bai.tenHocSinh}
          totalPoints={bai.totalPoints}
          diemHienTai={bai.score}
          daCham={bai.daCham}
        />
      </div>

      {bai.nhanXet.length > 0 ? (
        <section aria-labelledby="nx-cu">
          <h2 id="nx-cu" className="mt-0 mb-3 text-lg font-bold">
            Nhận xét trước đó
          </h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {bai.nhanXet.map((n) => (
              <li key={n.id} className="rounded-nut border border-vien bg-the p-3 text-sm">
                <p className="mt-0 mb-1 font-semibold">
                  {n.tenGiaoVien}
                  <span className="ms-2 font-normal text-chu-nhat">
                    {n.luc.toLocaleString('vi-VN')}
                  </span>
                </p>
                <p className="m-0 whitespace-pre-wrap">{n.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </VoGiaoVien>
  );
}
