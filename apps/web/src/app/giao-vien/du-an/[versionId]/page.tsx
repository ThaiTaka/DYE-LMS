import { notFound, redirect } from 'next/navigation';

import { XemXetDuAn } from '@/components/du-an/xem-xet';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole, xemDuoc } from '@/lib/guard';
import { banDeDuyet, NHAN_TRANG_THAI } from '@/lib/project-data';

export default async function TrangDuyetMotBan({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { versionId } = await params;

  const kq = await xemDuoc(banDeDuyet(actor, versionId));
  if (!kq.ok) redirect('/khong-co-quyen');

  const ban = kq.du;
  if (!ban) notFound();

  const tt = NHAN_TRANG_THAI[ban.duAn.status];

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan
        muc={[
          { nhan: 'Tổng quan', href: '/giao-vien' },
          { nhan: 'Dự án game', href: '/giao-vien/du-an' },
          { nhan: `${ban.duAn.tenHocSinh} · bản ${ban.version}` },
        ]}
      />

      <header className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-3xl font-bold">{ban.duAn.title}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${tt.lop}`}>
            {tt.nhan}
          </span>
        </div>
        <p className="m-0 text-chu-phu">
          {ban.duAn.tenHocSinh} · bản {ban.version} · nộp lúc{' '}
          {ban.submittedAt.toLocaleString('vi-VN')} · {ban.tep.length} tệp
        </p>
      </header>

      {ban.note ? (
        <section
          aria-label="Lời nhắn của học sinh"
          className="mb-6 rounded-the border-s-4 border-chinh bg-chinh-nhat p-4"
        >
          <p className="mt-0 mb-1 text-sm font-bold text-chinh">
            💬 {ban.duAn.tenHocSinh} nhắn
          </p>
          <p className="m-0 whitespace-pre-wrap">{ban.note}</p>
        </section>
      ) : null}

      <XemXetDuAn
        projectId={ban.duAn.id}
        versionId={versionId}
        version={ban.version}
        tep={ban.tep}
        nhanXetCu={ban.nhanXet.map((n) => ({
          id: n.id,
          comment: n.comment,
          tenGiaoVien: n.tenGiaoVien,
          luc: n.luc.toISOString(),
        }))}
      />
    </VoGiaoVien>
  );
}
