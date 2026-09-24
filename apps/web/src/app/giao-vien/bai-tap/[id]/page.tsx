import { redirect } from 'next/navigation';

import { HangChamBaiTap } from '@/components/giao-vien/cham-bai-tap';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { requireRole, xemDuoc } from '@/lib/guard';
import { VanBan } from '@/lib/markdown';
import { duLieuMotBaiTapGiaoVien } from '@/lib/teacher-data';
import { hienThiHan } from '@/lib/thoi-gian';

/**
 * One homework, and the whole class against it.
 *
 * The roster, not only the hand-ins: "who has NOT handed in?" is the first
 * question a teacher asks. Rows arrive ordered as a queue — waiting to be
 * graded, then graded, then not handed in — so the work is at the top.
 */
export default async function TrangMotBaiTapGiaoVien({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { id } = await params;

  // Authorized inside, through the homework's CLASS: a teacher who does not run
  // that class is refused, whoever wrote the homework.
  const kq = await xemDuoc(duLieuMotBaiTapGiaoVien(actor, id));
  if (!kq.ok) redirect('/khong-co-quyen');
  const bai = kq.du;

  const daNop = bai.hocSinh.filter((h) => h.baiNop !== null).length;
  const choCham = bai.hocSinh.filter((h) => h.baiNop && !h.baiNop.daCham).length;

  return (
    <VoGiaoVien
      tenHienThi={actor.displayName}
      vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}
    >
      <DuongDan
        muc={[
          { nhan: 'Tổng quan', href: '/giao-vien' },
          { nhan: 'Bài tập về nhà', href: '/giao-vien/bai-tap' },
          { nhan: bai.tieuDe },
        ]}
      />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">{bai.tieuDe}</h1>
        <p className="m-0 text-chu-phu">
          Lớp {bai.tenLop}
          {bai.baiHoc ? ` · sau Buổi ${bai.baiHoc.buoi}` : ''} · Hạn{' '}
          <span className="text-chu">{hienThiHan(bai.hanNop)}</span> · Giao bởi {bai.tacGia}
        </p>
        <p className="mt-2 mb-0 text-sm font-semibold">
          <span className="tabular-nums">
            {daNop}/{bai.hocSinh.length}
          </span>{' '}
          em đã nộp
          {choCham > 0 ? <span className="text-thu-lai"> · {choCham} bài chờ chấm</span> : null}
        </p>
      </header>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="de-bai" className="rounded-the border border-white/10 bg-the p-5">
          <h2 id="de-bai" className="mt-0 mb-3 text-lg font-bold">
            Đề bài
          </h2>
          <VanBan>{bai.moTa}</VanBan>
        </section>

        <section aria-labelledby="ma-mau" className="rounded-the border border-white/10 bg-the p-5">
          <h2 id="ma-mau" className="mt-0 mb-3 text-lg font-bold">
            Mã mẫu
          </h2>
          {bai.maMau.trim() ? (
            <pre className="m-0 max-h-80 overflow-auto rounded-nut border border-white/10 bg-nen-sau p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              {bai.maMau}
            </pre>
          ) : (
            <p className="m-0 text-sm text-chu-phu">Không có — các em bắt đầu từ ô trống.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="bai-nop">
        <h2 id="bai-nop" className="mt-0 mb-1 text-xl font-bold">
          Bài nộp của lớp
        </h2>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Chấm xong thì bài được khoá lại, để nhận xét luôn khớp với đúng đoạn code em đã nộp. Nhận
          xét vẫn sửa được sau.
        </p>

        {bai.hocSinh.length === 0 ? (
          <p className="m-0 rounded-nut border border-white/10 bg-the p-4 text-chu-phu">
            Lớp này chưa có học sinh nào.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {bai.hocSinh.map((h) => (
              <HangChamBaiTap key={h.studentId} hang={h} />
            ))}
          </ul>
        )}
      </section>
    </VoGiaoVien>
  );
}
