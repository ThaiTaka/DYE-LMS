'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { giaoBaiTapVeNha } from '@/app/giao-vien/actions';
import { CHUA_LAM } from '@/app/giao-vien/ket-qua';
import { HuongDanBanPhim, SoanThao } from '@/components/hoc-sinh/soan-thao';

import { PhanHoi } from './dieu-khien-nhanh';

import type { LopChoBaiTap } from '@/lib/teacher-data';

const O_NHAP =
  'min-h-cham w-full rounded-nut border border-white/10 bg-be-mat px-3 py-2 text-sm text-chu placeholder:text-chu-nhat focus:border-chinh-sang';

function NutGiao() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="nut-neon">
      <span aria-hidden="true">📮</span>
      {pending ? 'Đang giao…' : 'Giao bài'}
    </button>
  );
}

export interface TaoBaiTapProps {
  lop: LopChoBaiTap[];
  /** "YYYY-MM-DDTHH:mm", Vietnamese wall clock, computed on the server. */
  hanMacDinh: string;
  hanToiThieu: string;
  /** Open the form on arrival — when the teacher has set nothing yet. */
  moSan?: boolean;
}

/**
 * "Giao bài tập mới" — the homework builder.
 *
 * ── A disclosure, not a dialog ───────────────────────────────────────────────
 * Same reasoning as `TaoLop`: a hand-rolled focus trap that half works is worse
 * for a keyboard user than no dialog. The form opens in place above the list.
 *
 * ── Controlled fields, on purpose ────────────────────────────────────────────
 * React 19 resets UNCONTROLLED fields after every form action — including one
 * that came back with "Hạn nộp phải ở sau thời điểm hiện tại". On a form with a
 * page of description and a code template that would throw a teacher's work
 * away over a typo in the date. Every field here is controlled, so a refusal
 * keeps everything; a success remounts the inner form, which clears it for the
 * next homework.
 *
 * ── Class first, then lesson ─────────────────────────────────────────────────
 * The lesson list is filtered to the courses the chosen class studies, and
 * resets when the class changes: the server refuses a lesson from another
 * course, so the form never offers one.
 */
export function TaoBaiTap({ lop, hanMacDinh, hanToiThieu, moSan = false }: TaoBaiTapProps) {
  const [mo, setMo] = useState(moSan);
  const [soLanXong, setSoLanXong] = useState(0);
  const [ketQua, action] = useActionState(giaoBaiTapVeNha, CHUA_LAM);
  const id = useId();
  const vungId = `${id}-vung`;

  useEffect(() => {
    if (ketQua.trangThai === 'thanh-cong') setSoLanXong((n) => n + 1);
  }, [ketQua]);

  return (
    <section
      aria-labelledby={`${id}-tieu-de`}
      className="mb-8 rounded-the border border-white/10 bg-be-mat p-5 shadow-mem sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${id}-tieu-de`} className="m-0 text-xl font-bold">
            Giao bài tập mới
          </h2>
          <p className="mt-1 mb-0 text-sm text-chu-phu">
            Bài tập code cho cả lớp, có hạn nộp. Các em thấy bài ngay trên trang chính.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={mo}
          aria-controls={vungId}
          onClick={() => setMo((v) => !v)}
          className={mo ? 'nut-vien text-sm' : 'nut-neon text-sm'}
        >
          {mo ? 'Đóng biểu mẫu' : '+ Giao bài tập'}
        </button>
      </div>

      {/* Outside the form, so the outcome survives the remount that clears it. */}
      <div className="mt-3 empty:mt-0">
        <PhanHoi ketQua={ketQua} />
      </div>

      {mo ? (
        lop.length === 0 ? (
          <p
            id={vungId}
            className="mt-4 mb-0 rounded-nut border border-white/10 bg-the p-4 text-sm text-chu-phu"
          >
            Thầy cô chưa phụ trách lớp nào đang hoạt động, nên chưa có lớp để giao bài.
          </p>
        ) : (
          <BieuMau
            key={soLanXong}
            vungId={vungId}
            action={action}
            lop={lop}
            hanMacDinh={hanMacDinh}
            hanToiThieu={hanToiThieu}
          />
        )
      ) : null}
    </section>
  );
}

function BieuMau({
  vungId,
  action,
  lop,
  hanMacDinh,
  hanToiThieu,
}: {
  vungId: string;
  action: (form: FormData) => void;
  lop: LopChoBaiTap[];
  hanMacDinh: string;
  hanToiThieu: string;
}) {
  const id = useId();
  const [tieuDe, setTieuDe] = useState('');
  const [classId, setClassId] = useState(lop.length === 1 ? (lop[0]?.id ?? '') : '');
  const [lessonId, setLessonId] = useState('');
  const [hanNop, setHanNop] = useState(hanMacDinh);
  const [moTa, setMoTa] = useState('');
  const [maMau, setMaMau] = useState('');

  const lopChon = lop.find((l) => l.id === classId) ?? null;
  const banPhimId = `${id}-ban-phim`;

  return (
    <form id={vungId} action={action} className="mt-5 grid gap-5">
      <p className="m-0">
        <label htmlFor={`${id}-ten`} className="mb-1 block text-sm font-semibold">
          Tên bài tập
        </label>
        <input
          id={`${id}-ten`}
          name="tieuDe"
          type="text"
          required
          maxLength={160}
          autoComplete="off"
          value={tieuDe}
          onChange={(e) => setTieuDe(e.target.value)}
          placeholder="Vẽ tam giác bằng dấu sao"
          className={O_NHAP}
        />
      </p>

      <div className="grid gap-5 md:grid-cols-3">
        <p className="m-0">
          <label htmlFor={`${id}-lop`} className="mb-1 block text-sm font-semibold">
            Lớp nhận bài
          </label>
          <select
            id={`${id}-lop`}
            name="classId"
            required
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              // A lesson of the previous class may not be one this class studies.
              setLessonId('');
            }}
            className={O_NHAP}
          >
            <option value="" disabled>
              — Chọn lớp —
            </option>
            {lop.map((l) => (
              <option key={l.id} value={l.id}>
                {l.ten} ({l.soHocSinh} em)
              </option>
            ))}
          </select>
        </p>

        <p className="m-0">
          <label htmlFor={`${id}-bai`} className="mb-1 block text-sm font-semibold">
            Sau buổi học <span className="font-normal text-chu-nhat">(không bắt buộc)</span>
          </label>
          <select
            id={`${id}-bai`}
            name="lessonId"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            disabled={!lopChon}
            aria-describedby={`${id}-bai-mo-ta`}
            className={`${O_NHAP} disabled:opacity-60`}
          >
            <option value="">— Không gắn buổi nào —</option>
            {lopChon?.khoaHoc.map((k) => (
              <optgroup key={k.id} label={k.ten}>
                {k.baiHoc.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nhan}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span id={`${id}-bai-mo-ta`} className="mt-1 block text-xs text-chu-nhat">
            {lopChon
              ? 'Thẻ bài tập sẽ có nút “Ôn lại buổi” dẫn về bài học này.'
              : 'Chọn lớp trước để thấy các buổi học của lớp.'}
          </span>
        </p>

        <p className="m-0">
          <label htmlFor={`${id}-han`} className="mb-1 block text-sm font-semibold">
            Hạn nộp
          </label>
          <input
            id={`${id}-han`}
            name="hanNop"
            type="datetime-local"
            required
            min={hanToiThieu}
            value={hanNop}
            onChange={(e) => setHanNop(e.target.value)}
            aria-describedby={`${id}-han-mo-ta`}
            className={`${O_NHAP} [color-scheme:dark]`}
          />
          <span id={`${id}-han-mo-ta`} className="mt-1 block text-xs text-chu-nhat">
            Giờ Việt Nam. Nộp muộn vẫn được nhận và được đánh dấu.
          </span>
        </p>
      </div>

      <p className="m-0">
        <label htmlFor={`${id}-de`} className="mb-1 block text-sm font-semibold">
          Đề bài
        </label>
        <textarea
          id={`${id}-de`}
          name="moTa"
          required
          rows={6}
          maxLength={10000}
          value={moTa}
          onChange={(e) => setMoTa(e.target.value)}
          aria-describedby={`${id}-de-mo-ta`}
          placeholder={'Dùng vòng lặp `for` in ra tam giác 5 dòng:\n\n*\n**\n***'}
          className={`${O_NHAP} min-h-40 resize-y leading-relaxed`}
        />
        <span id={`${id}-de-mo-ta`} className="mt-1 block text-xs text-chu-nhat">
          Viết như nội dung bài học: `code`, **chữ đậm**, danh sách gạch đầu dòng đều hiển thị đúng.
        </span>
      </p>

      <div>
        <p id={`${id}-ma-nhan`} className="mt-0 mb-1 text-sm font-semibold">
          Mã mẫu <span className="font-normal text-chu-nhat">(không bắt buộc)</span>
        </p>
        <p id={`${id}-ma-mo-ta`} className="mt-0 mb-2 text-xs text-chu-nhat">
          Các em mở bài là thấy sẵn đoạn code này, và bấm “Đặt lại về mẫu” được. Để trống nếu muốn
          các em bắt đầu từ ô trống.
        </p>
        <SoanThao
          giaTri={maMau}
          onDoi={setMaMau}
          nhan="Mã mẫu của bài tập"
          moTaBoi={`${id}-ma-mo-ta ${banPhimId}`}
          soDongToiThieu={8}
        />
        <HuongDanBanPhim id={banPhimId} className="mt-2" />
        {/* CodeMirror is not a form control; this carries its value. */}
        <input type="hidden" name="maMau" value={maMau} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
        <NutGiao />
        {lopChon ? (
          <p className="m-0 text-sm text-chu-phu">
            {lopChon.soHocSinh} em trong lớp{' '}
            <span className="font-semibold text-chu">{lopChon.ten}</span> sẽ nhận bài.
          </p>
        ) : null}
      </div>
    </form>
  );
}
