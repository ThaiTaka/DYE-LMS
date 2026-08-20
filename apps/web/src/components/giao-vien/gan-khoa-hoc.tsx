'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { ganKhoaHoc, goKhoaHoc } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';

import { PhanHoi } from './dieu-khien-nhanh';

export interface KhoaHocChon {
  courseId: string;
  slug: string;
  title: string;
  iconEmoji: string;
  totalSessions: number;
  daGan: boolean;
}

function NutGui({ nhan, kieu = 'chinh' }: { nhan: string; kieu?: 'chinh' | 'phu' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-cham rounded-nut px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        kieu === 'chinh'
          ? 'bg-chinh text-white hover:bg-chinh-dam'
          : 'border border-vien text-chu-phu hover:border-vien-dam hover:text-chu'
      }`}
    >
      {pending ? 'Đang xử lý…' : nhan}
    </button>
  );
}

/**
 * "Gắn khoá học" — put curriculum into a class.
 *
 * ── Why this is the most consequential button on the page ────────────────────
 * Until a `ClassCourse` row exists, every student in the class opens their
 * dashboard to nothing at all. Attaching a course is what makes the class a
 * class: it is the moment thirty children get thirty course maps, Buổi 1
 * unlocks, and the gating engine starts applying to them.
 *
 * The panel says so. The option list carries the session count, and the
 * confirmation message afterwards names what the students will now see, because
 * a teacher who is not sure whether the button did anything will press it again.
 *
 * ── Detaching is offered right next to attaching ─────────────────────────────
 * Two reasons. It is the fix for the obvious mistake — the wrong course, chosen
 * from a dropdown of four similar names — and it is genuinely low-stakes, which
 * the copy states: progress, drafts and submissions are keyed on lessons and
 * blocks, never on the class, so re-attaching restores every student to exactly
 * where they stopped.
 */
export function GanKhoaHoc({
  classId,
  khoaHoc,
}: {
  classId: string;
  khoaHoc: KhoaHocChon[];
}) {
  const [mo, setMo] = useState(false);
  const [kqGan, actionGan] = useActionState(ganKhoaHoc, CHUA_LAM);
  const [kqGo, actionGo] = useActionState(goKhoaHoc, CHUA_LAM);

  const id = useId();
  const vungId = `${id}-vung`;

  const chuaGan = khoaHoc.filter((k) => !k.daGan);
  const daGan = khoaHoc.filter((k) => k.daGan);

  return (
    <section className="mb-6 rounded-the border border-vien bg-the p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="mt-0 mb-1 text-lg font-bold">Khoá học của lớp</h2>
          <p className="m-0 text-sm text-chu-phu">
            {daGan.length === 0
              ? 'Lớp này chưa học khoá nào — các em đang mở trang chính ra và không thấy gì cả.'
              : `Lớp đang học ${daGan.length} khoá: ${daGan.map((k) => k.title).join(', ')}.`}
          </p>
        </div>

        <button
          type="button"
          aria-expanded={mo}
          aria-controls={vungId}
          onClick={() => setMo((v) => !v)}
          className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold whitespace-nowrap text-white hover:bg-chinh-dam"
        >
          {mo ? 'Đóng' : 'Gắn khoá học'}
        </button>
      </div>

      {/* Outside the panel, so the outcome survives closing it. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqGan} />
      </div>
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={kqGo} />
      </div>

      {mo ? (
        <div id={vungId} className="mt-4 border-t border-vien pt-4">
          {chuaGan.length === 0 ? (
            <p className="mt-0 mb-4 text-sm text-chu-phu">
              Lớp này đã có tất cả các khoá học đang mở.
            </p>
          ) : (
            <form action={actionGan} className="mb-5">
              <input type="hidden" name="classId" value={classId} />

              <h3 className="mt-0 mb-2 text-sm font-bold">Thêm một khoá học</h3>
              <p className="mt-0 mb-3 text-sm text-chu-phu">
                Gắn khoá học là lúc các em trong lớp{' '}
                <strong className="text-chu">bắt đầu nhìn thấy chương trình</strong>: bản đồ khoá
                học hiện ra ở trang chính và Buổi 1 mở sẵn cho mọi em. Các buổi sau mở dần theo
                tiến độ, và thầy cô mở sớm được cho từng em ở trang chi tiết học sinh.
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={`${id}-khoa`} className="mb-1.5 block text-sm font-semibold">
                    Chọn khoá học
                  </label>
                  <select
                    id={`${id}-khoa`}
                    name="courseId"
                    required
                    defaultValue=""
                    className="min-h-cham rounded-nut border border-vien bg-the px-3 py-2 text-base"
                  >
                    <option value="" disabled>
                      — Chọn khoá học —
                    </option>
                    {chuaGan.map((k) => (
                      <option key={k.courseId} value={k.courseId}>
                        {k.iconEmoji} {k.title} ({k.totalSessions} buổi)
                      </option>
                    ))}
                  </select>
                </div>
                <NutGui nhan="Gắn vào lớp" />
              </div>
            </form>
          )}

          {daGan.length > 0 ? (
            <div>
              <h3 className="mt-0 mb-2 text-sm font-bold">Khoá đang gắn</h3>
              <p className="mt-0 mb-3 text-sm text-chu-phu">
                Gỡ khoá học ra chỉ ẩn chương trình khỏi lớp.{' '}
                <strong className="text-chu">
                  Bài làm, bản nháp và tiến độ của các em vẫn được giữ nguyên
                </strong>{' '}
                — gắn lại lúc nào thì các em thấy lại đúng chỗ đã dừng.
              </p>

              <ul className="m-0 list-none space-y-2 p-0">
                {daGan.map((k) => (
                  <li
                    key={k.courseId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-nut border border-vien p-3"
                  >
                    <span className="text-sm">
                      <span aria-hidden="true">{k.iconEmoji}</span> {k.title}{' '}
                      <span className="text-chu-nhat">({k.totalSessions} buổi)</span>
                    </span>
                    <form action={actionGo}>
                      <input type="hidden" name="classId" value={classId} />
                      <input type="hidden" name="courseId" value={k.courseId} />
                      <NutGui nhan="Gỡ khỏi lớp" kieu="phu" />
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
