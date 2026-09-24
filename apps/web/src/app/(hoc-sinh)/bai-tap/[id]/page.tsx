import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { KhuBaiTapVeNha } from '@/components/hoc-sinh/khu-bai-tap-ve-nha';
import { TRANG_THAI_BAI_TAP } from '@/components/hoc-sinh/the-bai-tap';
import { BieuTuong } from '@/components/ui/bieu-tuong';
import { SAC_THAI } from '@/components/ui/sac-thai';
import { ChuNeon } from '@/components/ui/the-kinh';
import { requireSession, xemDuoc } from '@/lib/guard';
import { VanBan } from '@/lib/markdown';
import { duLieuBaiTap } from '@/lib/student-data';
import { conLai, hienThiHan, hienThiLuc } from '@/lib/thoi-gian';

/**
 * One homework: the brief, the teacher's feedback once there is some, and the
 * editor.
 *
 * Feedback sits ABOVE the editor. A child opening a graded homework came to
 * read what the teacher said, and the code it is about is right underneath.
 */
export default async function TrangMotBaiTap({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireSession();
  const { id } = await params;
  if (actor.role !== 'STUDENT') redirect(`/giao-vien/bai-tap/${id}`);

  // A homework from a class the child has left, or a mistyped id, is a normal
  // event: refused by `authorize` inside, turned into a redirect here.
  const kq = await xemDuoc(duLieuBaiTap(actor, id));
  if (!kq.ok) redirect('/khong-co-quyen');
  const bai = kq.du;

  const tt = TRANG_THAI_BAI_TAP[bai.trangThai];
  const han = conLai(bai.hanNop, new Date());
  const chuaNop = bai.trangThai === 'chua-nop' || bai.trangThai === 'qua-han';

  return (
    <>
      <DuongDan
        muc={[
          { nhan: 'Trang chính', href: '/bang-dieu-khien' },
          { nhan: 'Bài tập về nhà', href: '/bai-tap' },
          { nhan: bai.tieuDe },
        ]}
      />

      <header className="mb-6">
        <p className="m-0 inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-chinh-sang uppercase">
          <BieuTuong ten="baiTap" className="size-5" />
          Bài tập về nhà · {bai.tenLop}
        </p>
        <h1 className="mt-1 mb-3 text-3xl leading-tight font-extrabold sm:text-4xl">
          <ChuNeon>{bai.tieuDe}</ChuNeon>
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SAC_THAI[tt.sac]}`}
          >
            <span aria-hidden="true">{tt.icon}</span>
            {tt.nhan}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-chu-phu">
            <BieuTuong ten="dongHo" className="size-4 text-chu-nhat" />
            Hạn nộp: <span className="text-chu">{hienThiHan(bai.hanNop)}</span>
            {chuaNop ? (
              <span
                className={`font-semibold ${han.gap || han.quaHan ? 'text-thu-lai' : 'text-chu-nhat'}`}
              >
                · {han.chu}
              </span>
            ) : null}
          </span>
          {bai.baiHoc ? (
            <Link
              href={`/bai-hoc/${bai.baiHoc.slug}`}
              className="inline-flex min-h-cham items-center gap-1 text-sm font-medium text-chinh-sang hover:underline"
            >
              Ôn lại Buổi {bai.baiHoc.buoi}
              <BieuTuong ten="muiTen" className="size-4" />
            </Link>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6">
        <section
          aria-labelledby="de-bai"
          className="rounded-the border border-white/10 bg-the p-5 sm:p-6"
        >
          <h2 id="de-bai" className="mt-0 mb-3 text-lg font-bold">
            Đề bài
          </h2>
          <VanBan>{bai.moTa}</VanBan>
        </section>

        {bai.baiNop?.daCham ? (
          <section
            aria-labelledby="nhan-xet"
            className="rounded-the border border-dung/25 bg-dung/[0.06] p-5 sm:p-6"
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 id="nhan-xet" className="m-0 text-lg font-bold">
                <span aria-hidden="true">💬 </span>Thầy cô nhận xét
              </h2>
              {bai.baiNop.chamLuc ? (
                <span className="text-sm font-medium text-chu-nhat">
                  {hienThiLuc(bai.baiNop.chamLuc)}
                </span>
              ) : null}
            </div>
            <p className="m-0 leading-relaxed whitespace-pre-wrap">{bai.baiNop.nhanXet}</p>
          </section>
        ) : null}

        <KhuBaiTapVeNha
          homeworkId={bai.id}
          tieuDe={bai.tieuDe}
          maMau={bai.maMau}
          baiNop={
            bai.baiNop
              ? {
                  code: bai.baiNop.code,
                  nopLuc: bai.baiNop.nopLuc,
                  nopMuon: bai.baiNop.nopMuon,
                  daCham: bai.baiNop.daCham,
                }
              : null
          }
          hocSinhId={actor.id}
        />
      </div>
    </>
  );
}
