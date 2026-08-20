import { notFound, redirect } from 'next/navigation';

import { HangCanThiep } from '@/components/giao-vien/dieu-khien-bai-hoc';
import { DieuKhienNhanh } from '@/components/giao-vien/dieu-khien-nhanh';
import { VoGiaoVien } from '@/components/giao-vien/vo';
import { DuongDan } from '@/components/hoc-sinh/duong-dan';
import { ThanhTienDo } from '@/components/ui/thanh-tien-do';
import { requireRole, xemDuoc } from '@/lib/guard';
import { duLieuHocSinh, duLieuTapTrungHocSinh } from '@/lib/teacher-data';

export default async function TrangHocSinh({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ khoa?: string }>;
}) {
  const actor = await requireRole('TEACHER', 'ADMIN');
  const { id } = await params;
  const { khoa } = await searchParams;

  // Authorized inside: refuses unless this actor genuinely teaches this student
  // through a live Class → Enrollment row.
  const kq = await xemDuoc(duLieuHocSinh(actor, id, khoa));
  if (!kq.ok) redirect('/khong-co-quyen');

  const hs = kq.du;
  if (!hs) notFound();

  const coCanThiep = new Set(hs.canThiep.map((c) => c.lessonId));

  // Loaded only after `duLieuHocSinh` has proved this actor may see this child,
  // and guarded again inside on the same permission.
  const tapTrung = await duLieuTapTrungHocSinh(actor, id);

  return (
    <VoGiaoVien tenHienThi={actor.displayName} vaiTro={actor.role === 'ADMIN' ? 'ADMIN' : 'TEACHER'}>
      <DuongDan
        muc={[
          { nhan: 'Tổng quan', href: '/giao-vien' },
          { nhan: hs.className, href: `/giao-vien/lop/${hs.classId}` },
          { nhan: hs.displayName },
        ]}
      />

      <header className="mb-6">
        <h1 className="mt-0 mb-2 text-3xl font-bold">{hs.displayName}</h1>
        <p className="m-0 text-chu-phu">
          {hs.username} · {hs.className} · <span aria-hidden="true">{hs.course.iconEmoji}</span>{' '}
          {hs.course.title}
          {!hs.isActive ? (
            <span className="ms-2 rounded-full bg-the-mo px-2.5 py-0.5 text-sm font-semibold">
              Tài khoản đã ngưng hoạt động
            </span>
          ) : null}
        </p>
      </header>

      <div className="mb-6 rounded-the border border-vien bg-the p-5">
        <ThanhTienDo
          nhan="Phần bắt buộc của em này"
          phanTram={hs.progress.required.percent}
          daXong={hs.progress.required.completed}
          tong={hs.progress.required.total}
          chuaGiao={!hs.progress.hasRequiredWork}
          cao="lon"
        />
        {hs.progress.optional.total > 0 ? (
          <p className="mt-3 mb-0 text-sm text-chu-phu">
            🌟 Đã làm thêm {hs.progress.optional.completed}/{hs.progress.optional.total} bài ngoài
            phần bắt buộc
          </p>
        ) : null}
      </div>

      <div className="mb-8">
        <DieuKhienNhanh
          studentId={hs.studentId}
          courseId={hs.course.courseId}
          tierHienTai={hs.tier}
          ghiChu={hs.ghiChuNhanh}
          tenHocSinh={hs.displayName}
        />
      </div>

      {hs.canThiep.length > 0 ? (
        <section
          aria-labelledby="can-thiep-hien-co"
          className="mb-8 rounded-the border border-mo-rong bg-mo-rong-nen p-5"
        >
          <h2 id="can-thiep-hien-co" className="mt-0 mb-3 text-lg font-bold">
            Can thiệp đang áp dụng ({hs.canThiep.length})
          </h2>
          <ul className="m-0 list-none space-y-2 p-0 text-sm">
            {hs.canThiep.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                <strong className="text-chu">
                  Buổi {c.lessonOrder} · {c.lessonTitle}
                </strong>
                <span className="text-chu-phu">
                  {c.isUnlocked === true
                    ? 'đã mở khoá'
                    : c.isUnlocked === false
                      ? 'đang tạm khoá'
                      : c.forceStatus
                        ? `đổi trạng thái → ${c.forceStatus}`
                        : c.waivePrerequisites
                          ? 'bỏ yêu cầu bài trước'
                          : 'đã điều chỉnh'}
                  {c.phamViLop ? ' · áp dụng cả lớp' : ''}
                </span>
                {c.reason ? <span className="text-chu-nhat">— “{c.reason}”</span> : null}
                <span className="text-chu-nhat">
                  ({c.authorName}, {c.createdAt.toLocaleDateString('vi-VN')})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        Focus history.

        Rendered only when there is something to say — a permanent "0 lần rời
        tab" panel on every student invites a teacher to read the absence of a
        signal as a positive one, and to start comparing children by it.

        The framing repeats the limit deliberately: this counts departures from
        the tab and nothing else. A teacher reading it at the end of a long day
        will fill in the missing half themselves otherwise.
      */}
      {tapTrung && tapTrung.soLanRoi > 0 ? (
        <section
          aria-labelledby="tap-trung"
          className="mb-6 rounded-the border border-vien bg-the p-5"
        >
          <h2 id="tap-trung" className="mt-0 mb-1 text-xl font-bold">
            Mức độ tập trung
          </h2>
          <p className="mt-0 mb-4 text-sm text-chu-phu">
            Em này đã rời khỏi tab bài học{' '}
            <strong className="text-chu">{tapTrung.soLanRoi} lần</strong>
            {tapTrung.tongVangGiay > 0
              ? `, tổng cộng khoảng ${Math.max(1, Math.round(tapTrung.tongVangGiay / 60))} phút ở ngoài`
              : ''}
            . Hệ thống <strong className="text-chu">không biết em đã mở gì</strong> — con số này
            thường có nghĩa là em đang bí ở đâu đó, và đáng để thầy cô hỏi thăm một câu.
          </p>

          <ul className="m-0 list-none space-y-2 p-0">
            {tapTrung.theoBai.slice(0, 8).map((b) => (
              <li
                key={b.lessonId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-nut border border-vien p-3 text-sm"
              >
                <span>
                  Buổi {b.buoi} · {b.tenBai}
                </span>
                <span className="text-chu-phu tabular-nums">
                  {b.soLanRoi} lần
                  {b.tongVangGiay > 0
                    ? ` · ${Math.max(1, Math.round(b.tongVangGiay / 60))} phút`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="lo-trinh">
        <h2 id="lo-trinh" className="mt-0 mb-1 text-xl font-bold">
          Lộ trình của em này
        </h2>
        <p className="mt-0 mb-4 text-sm text-chu-phu">
          Đây là trạng thái thật mà em nhìn thấy, đã tính theo nhánh học và các can thiệp ở trên.
        </p>

        <ul className="m-0 list-none rounded-the border border-vien bg-the px-5 py-1">
          {hs.baiHoc.map((bai) => (
            <HangCanThiep
              key={bai.lessonId}
              studentId={hs.studentId}
              bai={bai}
              daCanThiep={coCanThiep.has(bai.lessonId)}
            />
          ))}
        </ul>
      </section>
    </VoGiaoVien>
  );
}
