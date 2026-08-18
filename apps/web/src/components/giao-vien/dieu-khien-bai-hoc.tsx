'use client';

// Imported from the `/text` subpath, not the package root. The root barrel
// re-exports the session layer, which imports `node:crypto` — pulling that into
// a client bundle fails the build, and would ship server code to the browser if
// it did not. The type import below is erased at compile time and costs nothing.
import { bocMarkdown } from '@dye/core/text';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { CHUA_LAM, datCanThiepBaiHoc } from '@/app/giao-vien/actions';

import { PhanHoi } from './dieu-khien-nhanh';

import type { LessonAccess } from '@dye/core';

/** Human wording for each resolved lesson status, from the teacher's side. */
const NHAN_TRANG_THAI: Record<string, string> = {
  REQUIRED: 'Bắt buộc',
  RECOMMENDED: 'Nên làm',
  OPTIONAL: 'Tuỳ chọn',
  ADVANCED: 'Nâng cao',
};

function NutHanhDong({ nhan, chinh = false }: { nhan: string; chinh?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-cham rounded-nut px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        chinh
          ? 'bg-chinh text-white hover:bg-chinh-dam'
          : 'border border-vien text-chu-phu hover:border-vien-dam hover:text-chu'
      }`}
    >
      {pending ? 'Đang lưu…' : nhan}
    </button>
  );
}

/**
 * One row of the lesson list, with the intervention controls for that lesson.
 *
 * The controls only expand when the teacher asks for them. A 30-row course with
 * six always-visible buttons per row is a wall, and a wall is where mistakes get
 * made — this keeps the list scannable and puts the actions one click away.
 */
export function HangCanThiep({
  studentId,
  bai,
  daCanThiep,
}: {
  studentId: string;
  bai: LessonAccess;
  daCanThiep: boolean;
}) {
  const [mo, setMo] = useState(false);
  const [ketQua, formAction] = useActionState(datCanThiepBaiHoc, CHUA_LAM);

  const tieuDe = bocMarkdown(bai.title);
  const vungId = `can-thiep-${bai.lessonId}`;

  return (
    <li className="border-b border-vien last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
            bai.completed
              ? 'bg-dung-nen text-dung'
              : bai.unlocked
                ? 'bg-chinh-nhat text-chinh'
                : 'bg-the-mo text-chu-nhat'
          }`}
        >
          {bai.completed ? '✓' : bai.unlocked ? bai.order : '🔒'}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium">
            Buổi {bai.order} · {tieuDe}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-chu-phu">
            <span>{bai.isRequired ? 'Bắt buộc với em này' : 'Không tính vào tiến độ'}</span>
            <span aria-hidden="true">·</span>
            <span>{NHAN_TRANG_THAI[bai.status] ?? bai.status}</span>
            {bai.statusSource !== 'default' ? (
              <span className="rounded-full bg-thu-thach-nen px-2 py-0.5 text-xs font-semibold text-thu-thach">
                {bai.statusSource === 'student-override' ? 'Đã đổi riêng' : 'Đổi theo lớp'}
              </span>
            ) : null}
            {daCanThiep ? (
              <span className="rounded-full bg-mo-rong-nen px-2 py-0.5 text-xs font-semibold text-mo-rong">
                Có can thiệp
              </span>
            ) : null}
          </span>
          {!bai.unlocked && bai.lockReason ? (
            <span className="mt-1 block text-sm text-chu-nhat">{bai.lockReason}</span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={() => setMo((v) => !v)}
          aria-expanded={mo}
          aria-controls={vungId}
          className="min-h-cham rounded-nut border border-vien px-3.5 py-2 text-sm font-medium text-chu-phu hover:border-chinh hover:text-chinh"
        >
          {mo ? 'Đóng' : 'Điều chỉnh'}
        </button>
      </div>

      {mo ? (
        <div id={vungId} className="mb-4 rounded-nut bg-the-mo p-4">
          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="studentId" value={studentId} />
            <input type="hidden" name="lessonId" value={bai.lessonId} />

            <div>
              <label
                htmlFor={`ly-do-${bai.lessonId}`}
                className="mb-1.5 block text-sm font-semibold"
              >
                Lý do <span className="font-normal text-chu-nhat">(lưu vào nhật ký)</span>
              </label>
              <input
                id={`ly-do-${bai.lessonId}`}
                name="reason"
                type="text"
                placeholder="ví dụ: em đã học trước phần này ở nhà"
                className="min-h-cham w-full rounded-nut border border-vien bg-the px-3.5 py-2.5 text-base"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {/*
                Each button submits the same form with a different `hanhDong`.
                The server re-authorizes every one of them: the presence of a
                button here is a convenience, never the permission itself.
              */}
              {!bai.unlocked ? (
                <button
                  type="submit"
                  name="hanhDong"
                  value="mo-khoa"
                  className="min-h-cham rounded-nut bg-chinh px-4 py-2 text-sm font-semibold text-white hover:bg-chinh-dam"
                >
                  🔓 Mở bài này cho em
                </button>
              ) : (
                <button
                  type="submit"
                  name="hanhDong"
                  value="khoa-lai"
                  className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-semibold text-chu-phu hover:border-vien-dam hover:text-chu"
                >
                  Tạm khoá bài này
                </button>
              )}

              {bai.missingPrerequisites.length > 0 && !bai.prerequisitesWaived ? (
                <button
                  type="submit"
                  name="hanhDong"
                  value="bo-tien-quyet"
                  className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-semibold text-chu-phu hover:border-vien-dam hover:text-chu"
                >
                  Bỏ yêu cầu bài trước
                </button>
              ) : null}

              {bai.teacherOverridden || bai.statusSource === 'student-override' ? (
                <button
                  type="submit"
                  name="hanhDong"
                  value="go-bo"
                  className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-semibold text-chu-phu hover:border-vien-dam hover:text-chu"
                >
                  Gỡ can thiệp
                </button>
              ) : null}
            </div>

            <details className="text-sm">
              <summary className="min-h-cham cursor-pointer py-2 font-medium text-chu-phu">
                Đổi trạng thái bài học
              </summary>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor={`tt-${bai.lessonId}`}
                    className="mb-1.5 block text-sm font-semibold"
                  >
                    Trạng thái mới
                  </label>
                  <select
                    id={`tt-${bai.lessonId}`}
                    name="forceStatus"
                    defaultValue={bai.status}
                    className="min-h-cham rounded-nut border border-vien bg-the px-3 py-2 text-base"
                  >
                    {Object.entries(NHAN_TRANG_THAI).map(([value, nhan]) => (
                      <option key={value} value={value}>
                        {nhan}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  name="hanhDong"
                  value="doi-trang-thai"
                  className="min-h-cham rounded-nut border border-vien px-4 py-2 text-sm font-semibold text-chu-phu hover:border-vien-dam hover:text-chu"
                >
                  Áp dụng
                </button>
              </div>
            </details>

            <PhanHoi ketQua={ketQua} />
          </form>
        </div>
      ) : null}
    </li>
  );
}

export { NutHanhDong };
