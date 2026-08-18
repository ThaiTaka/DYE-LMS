import { bocMarkdown, STAGE_LABEL } from '@dye/core';
import { notFound, redirect } from 'next/navigation';

import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { KIEU_NHANH } from '@/components/ui/nhanh';
import { requireRole, xemDuoc } from '@/lib/guard';
import { VanBan } from '@/lib/markdown';
import { duLieuGiaoTrinh, type BaiHocGiaoVien } from '@/lib/teacher-data';

import type { Tier } from '@prisma/client';

const NHAN_TRANG_THAI: Record<string, { nhan: string; lop: string }> = {
  REQUIRED: { nhan: 'Bắt buộc', lop: 'bg-chinh-nhat text-chinh' },
  RECOMMENDED: { nhan: 'Nên làm', lop: 'bg-thu-thach-nen text-thu-thach' },
  OPTIONAL: { nhan: 'Tuỳ chọn', lop: 'bg-the-mo text-chu-phu' },
  ADVANCED: { nhan: 'Nâng cao', lop: 'bg-nang-cao-nen text-nang-cao' },
};

export default async function TrangGiaoTrinh({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { slug } = await params;

  const kq = await xemDuoc(duLieuGiaoTrinh(actor, slug));
  if (!kq.ok) redirect('/khong-co-quyen');

  const gt = kq.du;
  if (!gt) notFound();

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan
        muc={[
          { nhan: 'Tổng quan', href: '/giao-vien' },
          { nhan: 'Giáo trình', href: '/giao-vien/giao-trinh' },
          { nhan: gt.title },
        ]}
      />

      <header className="mb-7">
        <h1 className="mt-0 mb-2 flex items-center gap-3 text-3xl font-bold">
          <span aria-hidden="true">{gt.iconEmoji}</span>
          {gt.title}
        </h1>
        <p className="mt-0 mb-3 text-lg text-chu-phu">{gt.subtitle}</p>
        <p className="m-0 text-sm text-chu-nhat">
          {gt.totalSessions} buổi · {gt.modules.length} chương · {gt.soBuoiCoGhiChu} buổi có ghi chú
          giáo án
        </p>
      </header>

      {gt.modules.map((m) => (
        <section key={m.moduleId} aria-labelledby={`mod-${m.moduleId}`} className="mb-8">
          <h2 id={`mod-${m.moduleId}`} className="mt-0 mb-1 text-xl font-bold">
            {m.title}
          </h2>
          <p className="mt-0 mb-4 text-sm text-chu-phu">
            Buổi {m.sessionFrom}–{m.sessionTo} · {m.description}
          </p>

          <div className="space-y-3">
            {m.baiHoc.map((bai) => (
              <TheBaiHoc key={bai.lessonId} bai={bai} />
            ))}
          </div>
        </section>
      ))}
    </VoGiaoVien>
  );
}

/**
 * One session, collapsed by default.
 *
 * A 30-session course fully expanded is unusable, so the summary carries what a
 * teacher scans for — session number, title, status, and whether there is an
 * instructional note — and the body carries the detail.
 */
function TheBaiHoc({ bai }: { bai: BaiHocGiaoVien }) {
  const tt = NHAN_TRANG_THAI[bai.status] ?? { nhan: bai.status, lop: 'bg-the-mo text-chu-phu' };
  const nhanhCoNoiDung = (Object.entries(bai.soKhoiTheoNhanh) as Array<[Tier, number]>).filter(
    ([, n]) => n > 0,
  );

  return (
    <details className="group rounded-the border border-vien bg-the">
      <summary className="flex min-h-cham cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 p-4 font-medium">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-the-mo text-sm font-bold tabular-nums">
          {bai.order}
        </span>

        {/* Titles are Markdown in the database. In a heading slot the syntax is
            stripped, so "`calendar`" reads as a word instead of showing
            backticks and being spoken as one by a screen reader. */}
        <span className="min-w-0 flex-1">{bocMarkdown(bai.title)}</span>

        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tt.lop}`}
        >
          {tt.nhan}
        </span>

        {bai.teacherNotes ? (
          <span className="rounded-full bg-mo-rong-nen px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-mo-rong">
            📌 Có ghi chú
          </span>
        ) : null}

        {!bai.isPublished ? (
          <span className="rounded-full bg-the-mo px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-chu-phu">
            Chưa mở
          </span>
        ) : null}
      </summary>

      <div className="border-t border-vien p-4 pt-4">
        <p className="mt-0 mb-4 text-chu-phu">{bai.summary}</p>

        {/*
          The instructional note comes first and is visually loudest. These are
          verbatim from the source lesson plan and are treated as binding
          requirements, not suggestions — "no print() in session 1" is the whole
          reason session 1 looks the way it does.
        */}
        {bai.teacherNotes ? (
          <section
            aria-label="Ghi chú giáo án"
            className="mb-5 rounded-nut border-s-4 border-mo-rong bg-mo-rong-nen p-4"
          >
            <h3 className="mt-0 mb-2 flex items-center gap-2 text-sm font-bold text-mo-rong">
              <span aria-hidden="true">📌</span>
              Ghi chú giáo án · yêu cầu giảng dạy
            </h3>
            <VanBan>{bai.teacherNotes}</VanBan>
            <p className="mt-3 mb-0 text-xs text-chu-nhat">
              Học sinh không nhìn thấy phần này.
            </p>
          </section>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mt-0 mb-2 text-sm font-bold">Mục tiêu buổi học</h3>
            {bai.objectives.length > 0 ? (
              <ul className="m-0 list-disc space-y-1 ps-5 text-sm text-chu-phu">
                {bai.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-chu-nhat">Chưa ghi mục tiêu.</p>
            )}
          </div>

          <div>
            <h3 className="mt-0 mb-2 text-sm font-bold">Thông tin giảng dạy</h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-chu-nhat">Thời lượng</dt>
              <dd className="m-0">{bai.estimatedMinutes} phút</dd>

              <dt className="text-chu-nhat">Độ khó</dt>
              <dd className="m-0">
                <span aria-hidden="true">{'●'.repeat(bai.difficulty)}</span>
                <span className="sr-only">{bai.difficulty} trên 5</span>
                <span className="text-chu-nhat"> {'○'.repeat(5 - bai.difficulty)}</span>
                <span className="ms-2 text-xs text-chu-nhat">(chỉ để thầy cô lên kế hoạch)</span>
              </dd>

              <dt className="text-chu-nhat">Bài trước</dt>
              <dd className="m-0">
                {bai.tienQuyet.length > 0
                  ? bai.tienQuyet.map((t) => `Buổi ${t.order}`).join(', ')
                  : 'Không có'}
              </dd>

              {bai.isDerived ? (
                <>
                  <dt className="text-chu-nhat">Nguồn</dt>
                  <dd className="m-0 text-chu-phu">
                    Buổi dựng thêm để đủ {30} buổi, chưa liệt kê rõ trong giáo án gốc
                  </dd>
                </>
              ) : null}
            </dl>
          </div>
        </div>

        {/* Tier composition: how this one session serves four audiences. */}
        {nhanhCoNoiDung.length > 0 ? (
          <div className="mt-5">
            <h3 className="mt-0 mb-2 text-sm font-bold">
              Phân bố nội dung theo nhánh ({bai.khoi.length} khối)
            </h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {nhanhCoNoiDung.map(([tier, soKhoi]) => {
                const kieu = KIEU_NHANH[tier];
                return (
                  <li
                    key={tier}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${kieu.nen} ${kieu.chu} ${kieu.vien}`}
                  >
                    <span aria-hidden="true">{kieu.icon}</span>
                    {kieu.nhan}: {soKhoi}
                  </li>
                );
              })}
            </ul>

            <ol className="mt-3 mb-0 list-none space-y-1.5 p-0 text-sm">
              {bai.khoi.map((k) => {
                const kieu = KIEU_NHANH[k.tier];
                return (
                  <li key={k.blockId} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-chu-nhat tabular-nums">{k.order}.</span>
                    <span aria-hidden="true">{kieu.icon}</span>
                    <span className="font-medium">{k.title}</span>
                    <span className="text-chu-nhat">
                      {STAGE_LABEL[k.stage]} · {k.estimatedMinutes} phút
                      {k.isOptional ? ' · tuỳ chọn' : ''}
                      {k.coTracNghiem ? ' · có trắc nghiệm' : ''}
                      {k.coBaiTap ? ' · có bài tập' : ''}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>
    </details>
  );
}
