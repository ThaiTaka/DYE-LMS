import type { DuLieuBaiHoc } from '@/lib/student-data';

/**
 * What a student sees where their editor used to be.
 *
 * ── A server component, on purpose ───────────────────────────────────────────
 * The lock arrives in the HTML. Rendering it from a client effect would leave
 * the real editor live and typeable for the first frame — and permanently for
 * anyone with scripting off, which is the exact configuration a student trying
 * to get around the tracker would arrive in.
 *
 * ── Why the tone is not the tone the feature name suggests ───────────────────
 * The system knows one fact: a tab was hidden twenty times. It does not know
 * that a child cheated, and it cannot. So this panel states what was counted,
 * what was done about it, and who can undo it — and stops. It does not say
 * "gian lận" at the student, because a 12-year-old who was looking up `range()`
 * and reads an accusation learns that the system lies about them, which is worse
 * for the classroom than anything the lock was meant to prevent.
 *
 * The teacher's copy of this event, in their notification and on their
 * dashboard, is where the word "vi phạm" appears — addressed to the adult who
 * can actually ask the question.
 *
 * ── The route out is a person ────────────────────────────────────────────────
 * There is no "appeal" form and no self-service unlock, because either would be
 * a way to make the lock meaningless. The only instruction is to speak to the
 * teacher, who has a one-click unlock that restores every score this took.
 */
export function BiKhoaViPham({
  khoa,
}: {
  khoa: NonNullable<DuLieuBaiHoc['khoaViPham']>;
}) {
  const luc = new Date(khoa.luc).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  const daVo = [
    khoa.soBaiKhongDiem > 0 ? `${khoa.soBaiKhongDiem} bài code` : null,
    khoa.soCauKhongDiem > 0 ? `${khoa.soCauKhongDiem} câu trắc nghiệm` : null,
  ].filter((x): x is string => x !== null);

  return (
    <div
      // `role="status"` rather than `alert`: by the time this renders the event
      // is minutes old and the student has already been shown a dialog. Barging
      // into a screen reader again on every navigation would be noise.
      role="status"
      className="rounded-the border-2 border-thu-lai bg-thu-lai-nen p-5 sm:p-6"
    >
      <p aria-hidden="true" className="m-0 text-3xl">
        🔒
      </p>
      <h3 className="mt-2 mb-3 text-lg font-bold text-thu-lai">Bài này đang bị khoá</h3>

      <div className="space-y-3 text-base">
        <p className="m-0">
          Lúc {luc}, hệ thống ghi nhận trang bài học bị chuyển đi{' '}
          <strong>{khoa.soLan} lần</strong> — quá mức cho phép là {khoa.nguong} lần. Bài đã tự động
          bị khoá{daVo.length > 0 ? ` và ${daVo.join(', ')} bị tính 0 điểm` : ''}.
        </p>

        <p className="m-0">
          Máy chỉ đếm số lần rời tab, <strong>nó không biết em đã mở gì</strong>. Nếu em rời bài vì
          đang tra cứu, vì máy tự ngủ, hay vì lý do nào khác — em nói với thầy cô, thầy cô mở khoá
          lại được ngay và điểm sẽ được trả lại đúng như cũ.
        </p>

        <p className="m-0 font-semibold">Trong lúc chờ, em chưa nộp thêm bài trong buổi này được.</p>
      </div>
    </div>
  );
}
