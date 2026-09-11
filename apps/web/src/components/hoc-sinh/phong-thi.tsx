'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  batDauThi,
  luuCauTraLoiThi,
  nopBai,
  type KetQuaViPhamUI,
} from '@/app/kiem-tra/[slug]/actions';

import { useGiamSatPhongThi } from './dung-giam-sat-phong-thi';

import type { CauHoiThi } from '@dye/core';

/**
 * The exam room.
 *
 * ── Four screens, one component ──────────────────────────────────────────────
 *   gioi-thieu   the rules, the clock, the strike rule — and the one button
 *                that starts everything. Nothing about the questions is on
 *                screen yet.
 *   dang-thi     fullscreen, questions, countdown, autosave.
 *   da-nop       the score.
 *   bi-khoa      the lock. No score, because there is none.
 *
 * ── Fullscreen is the gate, not decoration ───────────────────────────────────
 * `requestFullscreen()` only works from a user gesture, so it is called inside
 * the click handler of "Bắt đầu" — and the server is asked to open the sitting
 * only AFTER it resolves. A sitting whose first seconds ran outside fullscreen
 * would be measured against a rule that was not yet in force.
 *
 * ── The client keeps no strike count ─────────────────────────────────────────
 * The hook reports; the server answers with the count and whether the attempt
 * is locked; this component renders THAT. The warning at strike one and the
 * lock at the limit are both decided by the server's reply. A tampered client
 * can suppress its own warning; it cannot change what the server did.
 *
 * ── Copy, paste, right-click ─────────────────────────────────────────────────
 * Blocked on the room element while the exam is running. This is a deterrent
 * with a known ceiling — devtools can lift it — not a control, and nothing
 * here pretends otherwise. The real controls are that the questions never
 * carry their answers and that the server marks.
 */

type ManHinh = 'gioi-thieu' | 'dang-thi' | 'da-nop' | 'bi-khoa';

export interface PhongThiProps {
  examId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingScore: number;
  maxStrikes: number;
  soCauHoi: number;
  courseSlug: string;
  courseTitle: string;
  /** Questions without their keys. Empty when the exam is not open to this student. */
  cauHoi: CauHoiThi[];
  /** An open sitting to resume, when the page was reloaded mid-exam. */
  luotDangLam: { attemptId: string; deadlineAt: string; answers: Record<string, unknown> } | null;
  /** A finished sitting to show, when there is one. */
  luotDaXong: {
    state: 'SUBMITTED' | 'LOCKED_CHEATING';
    score: number;
    maxScore: number;
    isPassed: boolean;
    cheatStrikes: number;
  } | null;
}

function phutGiay(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function PhongThi(props: PhongThiProps) {
  const router = useRouter();
  const goc = useRef<HTMLDivElement | null>(null);
  const id = useId();

  const [manHinh, setManHinh] = useState<ManHinh>(() =>
    props.luotDaXong?.state === 'LOCKED_CHEATING'
      ? 'bi-khoa'
      : props.luotDaXong?.state === 'SUBMITTED'
        ? 'da-nop'
        : 'gioi-thieu',
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [maxStrikes, setMaxStrikes] = useState(props.maxStrikes);
  const [traLoi, setTraLoi] = useState<Record<string, unknown>>(props.luotDangLam?.answers ?? {});
  const [conLai, setConLai] = useState<number | null>(null);
  const [thongBao, setThongBao] = useState('');
  const [dangBatDau, setDangBatDau] = useState(false);
  const [dangNop, setDangNop] = useState(false);
  const [ketQua, setKetQua] = useState(props.luotDaXong);

  /** The warning at strike one (or any strike short of the limit). */
  const [canhBao, setCanhBao] = useState<{ soLan: number; conLai: number } | null>(null);

  const daNopRef = useRef(false);

  // ── Strike handling: render what the server said ─────────────────────────
  const xuLyViPham = useCallback(
    (kq: KetQuaViPhamUI) => {
      if (!kq.ok) return;
      setMaxStrikes(kq.maxStrikes);
      if (kq.biKhoa) {
        daNopRef.current = true;
        setCanhBao(null);
        setManHinh('bi-khoa');
        setKetQua({ state: 'LOCKED_CHEATING', score: 0, maxScore: 0, isPassed: false, cheatStrikes: kq.cheatStrikes });
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        router.refresh();
        return;
      }
      if (!kq.trungLap) {
        setCanhBao({ soLan: kq.cheatStrikes, conLai: kq.maxStrikes - kq.cheatStrikes });
      }
    },
    [router],
  );

  useGiamSatPhongThi({
    attemptId: manHinh === 'dang-thi' ? attemptId : null,
    onKetQua: xuLyViPham,
    goc,
  });

  // ── Hand in ──────────────────────────────────────────────────────────────
  const nopBaiThi = useCallback(
    async (lyDo: 'nut' | 'het-gio') => {
      if (!attemptId || daNopRef.current) return;
      daNopRef.current = true;
      setDangNop(true);
      const kq = await nopBai(attemptId);
      setDangNop(false);
      if (kq.trangThai === 'ok' && kq.luot) {
        setKetQua({
          state: kq.luot.state === 'LOCKED_CHEATING' ? 'LOCKED_CHEATING' : 'SUBMITTED',
          score: kq.luot.score,
          maxScore: kq.luot.maxScore,
          isPassed: kq.luot.isPassed,
          cheatStrikes: kq.luot.cheatStrikes,
        });
        setManHinh(kq.luot.state === 'LOCKED_CHEATING' ? 'bi-khoa' : 'da-nop');
        setCanhBao(null);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        if (lyDo === 'het-gio') setThongBao('Hết giờ — bài đã được nộp tự động.');
      } else {
        daNopRef.current = false;
        setThongBao(kq.thongDiep);
      }
    },
    [attemptId],
  );

  // ── Countdown ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (manHinh !== 'dang-thi' || deadlineAt === null) return;
    const tick = (): void => {
      const ms = deadlineAt - Date.now();
      setConLai(ms);
      if (ms <= 0) void nopBaiThi('het-gio');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [manHinh, deadlineAt, nopBaiThi]);

  // ── Start / resume ───────────────────────────────────────────────────────
  const batDau = useCallback(async () => {
    const el = goc.current;
    if (!el) return;
    setDangBatDau(true);
    setThongBao('');

    if (!document.fullscreenEnabled) {
      setThongBao('Trình duyệt này không cho phép chế độ toàn màn hình, nên không vào thi được. Em dùng máy tính và Chrome/Edge/Firefox nhé.');
      setDangBatDau(false);
      return;
    }
    try {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      setThongBao('Chưa bật được toàn màn hình. Em bấm lại, và cho phép nếu trình duyệt hỏi nhé.');
      setDangBatDau(false);
      return;
    }

    const kq = await batDauThi(props.examId);
    if (kq.trangThai !== 'ok' || !kq.attemptId || !kq.deadlineAt) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      setThongBao(kq.thongDiep);
      setDangBatDau(false);
      return;
    }

    daNopRef.current = false;
    setAttemptId(kq.attemptId);
    setDeadlineAt(new Date(kq.deadlineAt).getTime());
    setMaxStrikes(kq.maxStrikes);
    setManHinh('dang-thi');
    setDangBatDau(false);
  }, [props.examId]);

  // ── Answers ──────────────────────────────────────────────────────────────
  const doiTraLoi = useCallback(
    (questionId: string, gia: unknown) => {
      setTraLoi((cu) => ({ ...cu, [questionId]: gia }));
      if (attemptId) void luuCauTraLoiThi(attemptId, questionId, gia).catch(() => undefined);
    },
    [attemptId],
  );

  /** Re-enter fullscreen from the warning — the click IS the user gesture. */
  const quayLaiBaiThi = useCallback(async () => {
    setCanhBao(null);
    const el = goc.current;
    if (el && !document.fullscreenElement) {
      await el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    }
    el?.focus();
  }, []);

  const chan = (e: React.SyntheticEvent): void => {
    if (manHinh === 'dang-thi') e.preventDefault();
  };

  const daTraLoi = props.cauHoi.filter((q) => {
    const v = traLoi[q.id];
    return v !== undefined && v !== '' && v !== null;
  }).length;

  return (
    <div
      ref={goc}
      tabIndex={-1}
      data-testid="phong-thi"
      onContextMenu={chan}
      onCopy={chan}
      onCut={chan}
      onPaste={chan}
      className="min-h-screen bg-nen text-chu outline-none"
    >
      {manHinh === 'gioi-thieu' ? (
        <GioiThieu
          {...props}
          coLuotDo={props.luotDangLam !== null}
          dangBatDau={dangBatDau}
          thongBao={thongBao}
          onBatDau={batDau}
        />
      ) : null}

      {manHinh === 'dang-thi' ? (
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <header className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-vien bg-the/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">Đang thi</p>
              <h1 className="m-0 truncate text-lg font-bold">{props.title}</h1>
            </div>
            <div className="flex items-center gap-4">
              <p className="m-0 text-sm text-chu-phu">
                {daTraLoi}/{props.cauHoi.length} câu
              </p>
              <p
                className={`m-0 rounded-nut border px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${
                  conLai !== null && conLai < 60_000
                    ? 'border-thu-lai bg-thu-lai-nen text-thu-lai'
                    : 'border-vien bg-the-mo'
                }`}
                aria-label="Thời gian còn lại"
              >
                ⏱ {conLai === null ? '--:--' : phutGiay(conLai)}
              </p>
            </div>
          </header>

          {/* Announced once, not every second: a screen reader user needs the
              warning, not a metronome. */}
          <p aria-live="polite" className="sr-only">
            {conLai !== null && conLai < 60_000 && conLai > 58_000 ? 'Còn một phút.' : ''}
          </p>

          <ol className="m-0 list-none space-y-6 p-0">
            {props.cauHoi.map((q, i) => (
              <li key={q.id} className="rounded-the border border-vien bg-the p-5">
                <CauHoi
                  cauHoi={q}
                  soThuTu={i + 1}
                  giaTri={traLoi[q.id]}
                  onDoi={(v) => doiTraLoi(q.id, v)}
                  idGoc={`${id}-${q.id}`}
                />
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-vien pt-6">
            <p className="m-0 text-sm text-chu-phu">
              Câu trả lời được lưu ngay khi em chọn. Nộp rồi thì không sửa được nữa.
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Nộp bài? Em đã trả lời ${daTraLoi}/${props.cauHoi.length} câu.`)) {
                  void nopBaiThi('nut');
                }
              }}
              disabled={dangNop}
              className="min-h-cham rounded-nut bg-chinh px-6 py-3 text-base font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
            >
              {dangNop ? 'Đang nộp…' : 'Nộp bài'}
            </button>
          </div>
          {thongBao ? (
            <p role="status" className="mt-4 mb-0 text-sm text-thu-lai">
              {thongBao}
            </p>
          ) : null}
        </div>
      ) : null}

      {manHinh === 'da-nop' && ketQua ? (
        <KetQuaThi {...props} ketQua={ketQua} thongBao={thongBao} />
      ) : null}

      {manHinh === 'bi-khoa' ? <BiKhoa {...props} soLan={ketQua?.cheatStrikes ?? maxStrikes} /> : null}

      {canhBao ? (
        <CanhBaoViPham
          soLan={canhBao.soLan}
          conLai={canhBao.conLai}
          maxStrikes={maxStrikes}
          onQuayLai={quayLaiBaiThi}
        />
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Screens
// ═══════════════════════════════════════════════════════════════════════════

function GioiThieu({
  title,
  description,
  durationMinutes,
  passingScore,
  maxStrikes,
  soCauHoi,
  courseSlug,
  courseTitle,
  coLuotDo,
  dangBatDau,
  thongBao,
  onBatDau,
}: PhongThiProps & {
  coLuotDo: boolean;
  dangBatDau: boolean;
  thongBao: string;
  onBatDau: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="m-0 text-sm font-semibold tracking-wide text-chinh uppercase">
        Bài kiểm tra lớn · {courseTitle}
      </p>
      <h1 className="mt-1 mb-3 text-3xl font-bold">{title}</h1>
      {description ? <p className="mt-0 mb-6 text-lg text-chu-phu">{description}</p> : null}

      <dl className="m-0 mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ['Số câu', `${soCauHoi}`],
          ['Thời gian', `${durationMinutes} phút`],
          ['Điểm đạt', `${passingScore}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-nut border border-vien bg-the p-4">
            <dt className="m-0 text-sm text-chu-phu">{k}</dt>
            <dd className="m-0 text-2xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      {/*
        The rules, in full, BEFORE the button. A student is held to what they
        were told; a rule applied without being stated first is a trap.
      */}
      <section
        aria-labelledby="luat-thi"
        className="mb-6 rounded-the border-2 border-thu-lai bg-thu-lai-nen p-5"
      >
        <h2 id="luat-thi" className="mt-0 mb-3 text-lg font-bold text-thu-lai">
          Luật phòng thi
        </h2>
        <ul className="m-0 list-disc space-y-2 ps-5">
          <li>
            Bài thi chạy ở chế độ <strong>toàn màn hình</strong>. Bấm &ldquo;Bắt đầu&rdquo; là vào
            toàn màn hình và đồng hồ bắt đầu chạy.
          </li>
          <li>
            <strong>Rời khỏi màn hình thi</strong> — chuyển tab, chuyển cửa sổ, thoát toàn màn
            hình — được tính là <strong>một lần vi phạm</strong>.
          </li>
          <li>
            Lần vi phạm thứ nhất: hệ thống cảnh báo và yêu cầu quay lại ngay. Tới{' '}
            <strong>lần thứ {maxStrikes}</strong>, bài thi{' '}
            <strong>tự động nộp với 0 điểm</strong>.
          </li>
          <li>Không sao chép, dán hay chuột phải trong lúc thi.</li>
          <li>Hết giờ, bài tự nộp với những câu em đã trả lời.</li>
        </ul>
        <p className="mt-3 mb-0 text-sm text-chu-phu">
          Máy chỉ đếm số lần rời đi, không biết em đã mở gì. Nếu bị khoá nhầm (bật gõ tiếng Việt,
          thông báo hệ thống…), thầy cô có thể huỷ lượt thi để em thi lại.
        </p>
      </section>

      {thongBao ? (
        <p role="alert" className="mb-4 rounded-nut border border-loi/30 bg-loi-nen p-3.5 text-sm font-medium text-loi">
          {thongBao}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBatDau}
          disabled={dangBatDau}
          className="min-h-cham rounded-nut bg-chinh px-6 py-3 text-base font-semibold text-white hover:bg-chinh-dam disabled:opacity-60"
        >
          {dangBatDau ? 'Đang mở…' : coLuotDo ? '⛶ Tiếp tục bài thi' : '⛶ Bắt đầu — vào toàn màn hình'}
        </button>
        <Link href={`/khoa-hoc/${courseSlug}`} className="min-h-cham inline-flex items-center px-3 text-chu-phu hover:text-chinh">
          Để sau
        </Link>
      </div>
      {coLuotDo ? (
        <p className="mt-3 mb-0 text-sm text-chu-phu">
          Em có một lượt đang làm dở. Đồng hồ vẫn chạy từ lúc bắt đầu; câu đã chọn vẫn còn.
        </p>
      ) : null}
    </main>
  );
}

function CauHoi({
  cauHoi,
  soThuTu,
  giaTri,
  onDoi,
  idGoc,
}: {
  cauHoi: CauHoiThi;
  soThuTu: number;
  giaTri: unknown;
  onDoi: (v: unknown) => void;
  idGoc: string;
}) {
  const nhan = `${idGoc}-nhan`;
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend id={nhan} className="mb-3 text-base font-semibold">
        <span className="me-2 text-chinh">Câu {soThuTu}.</span>
        {cauHoi.prompt}
        <span className="ms-2 text-sm font-normal text-chu-phu">({cauHoi.points} điểm)</span>
      </legend>

      {cauHoi.type === 'MULTIPLE_CHOICE' || cauHoi.type === 'TRUE_FALSE' ? (
        <ul className="m-0 list-none space-y-2 p-0">
          {cauHoi.choices.map((c) => {
            const cid = `${idGoc}-${c.id}`;
            const chon = giaTri === c.id;
            return (
              <li key={c.id}>
                <label
                  htmlFor={cid}
                  className={`flex min-h-cham cursor-pointer items-center gap-3 rounded-nut border px-4 py-2.5 ${
                    chon ? 'border-chinh bg-chinh-nhat' : 'border-vien hover:border-chinh'
                  }`}
                >
                  <input
                    id={cid}
                    type="radio"
                    name={idGoc}
                    value={c.id}
                    checked={chon}
                    onChange={() => onDoi(c.id)}
                    className="h-5 w-5 accent-chinh"
                  />
                  <span>{c.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          {cauHoi.template ? (
            <p className="mt-0 mb-2 font-mono text-sm text-chu-phu">{cauHoi.template}</p>
          ) : null}
          <input
            type="text"
            aria-labelledby={nhan}
            value={typeof giaTri === 'string' ? giaTri : ''}
            onChange={(e) => onDoi(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="min-h-cham w-full rounded-nut border border-vien bg-the px-4 py-2.5 text-base"
          />
        </>
      )}
    </fieldset>
  );
}

function KetQuaThi({
  title,
  courseSlug,
  passingScore,
  ketQua,
  thongBao,
}: PhongThiProps & {
  ketQua: NonNullable<PhongThiProps['luotDaXong']>;
  thongBao: string;
}) {
  const phanTram = ketQua.maxScore > 0 ? Math.round((ketQua.score / ketQua.maxScore) * 100) : 0;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
      <p aria-hidden="true" className="m-0 text-5xl">
        {ketQua.isPassed ? '🎉' : '📝'}
      </p>
      <h1 className="mt-3 mb-2 text-3xl font-bold">{ketQua.isPassed ? 'Em đã đạt!' : 'Đã nộp bài'}</h1>
      <p className="mt-0 mb-6 text-lg text-chu-phu">{title}</p>

      <p className="m-0 text-5xl font-bold tabular-nums">
        {ketQua.score}
        <span className="text-2xl text-chu-phu">/{ketQua.maxScore}</span>
      </p>
      <p className="mt-1 mb-8 text-chu-phu">
        {phanTram}% · cần {passingScore}% để đạt
        {ketQua.cheatStrikes > 0 ? ` · ${ketQua.cheatStrikes} lần cảnh báo` : ''}
      </p>

      {thongBao ? (
        <p role="status" className="mb-6 text-sm text-thu-lai">
          {thongBao}
        </p>
      ) : null}

      <Link
        href={`/khoa-hoc/${courseSlug}`}
        className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
      >
        ← Về bản đồ khoá học
      </Link>
    </main>
  );
}

function BiKhoa({ title, courseSlug, soLan }: PhongThiProps & { soLan: number }) {
  return (
    <main role="alert" className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-6">
      <p aria-hidden="true" className="m-0 text-5xl">
        🔒
      </p>
      <h1 className="mt-3 mb-2 text-3xl font-bold text-thu-lai">Bài thi đã bị khoá</h1>
      <p className="mt-0 mb-6 text-lg text-chu-phu">{title}</p>

      <div className="mx-auto mb-8 max-w-lg rounded-the border-2 border-thu-lai bg-thu-lai-nen p-5 text-start">
        <p className="mt-0 mb-3">
          Hệ thống ghi nhận em rời khỏi màn hình thi <strong>{soLan} lần</strong>, nên bài đã
          tự động nộp với <strong>0 điểm</strong> — đúng như luật đã nêu trước khi bắt đầu.
        </p>
        <p className="m-0">
          Máy chỉ đếm số lần rời đi, <strong>không biết em đã mở gì</strong>. Thầy cô đã nhận
          được thông báo. Nếu em rời màn hình vì lý do ngoài ý muốn, hãy nói với thầy cô — thầy
          cô có thể huỷ lượt này để em thi lại.
        </p>
      </div>

      <Link
        href={`/khoa-hoc/${courseSlug}`}
        className="inline-flex min-h-cham items-center gap-2 rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam"
      >
        ← Về bản đồ khoá học
      </Link>
    </main>
  );
}

/**
 * The warning at any strike short of the limit.
 *
 * Blocking, focus-trapped, no Escape: the only way out is the button, and the
 * button is also the user gesture that re-enters fullscreen. Escape is
 * swallowed for a second reason too — in fullscreen, Escape is what EXITS
 * fullscreen, and letting it through from here would count a new departure.
 */
function CanhBaoViPham({
  soLan,
  conLai,
  maxStrikes,
  onQuayLai,
}: {
  soLan: number;
  conLai: number;
  maxStrikes: number;
  onQuayLai: () => void;
}) {
  const nut = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    nut.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        nut.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="canh-bao-thi-tieu-de"
        aria-describedby="canh-bao-thi-noi-dung"
        className="w-full max-w-lg rounded-the border-4 border-loi bg-the p-6 shadow-2xl sm:p-8"
      >
        <h2 id="canh-bao-thi-tieu-de" className="mt-0 mb-4 text-2xl font-bold text-loi">
          <span aria-hidden="true">🚨 </span>TRỞ LẠI BÀI THI NGAY LẬP TỨC
        </h2>

        <div id="canh-bao-thi-noi-dung" className="space-y-3 text-base">
          <p className="m-0">
            Hệ thống ghi nhận em <strong>rời khỏi màn hình thi</strong> — đây là lần vi phạm thứ{' '}
            <strong>{soLan}</strong>.
          </p>
          <p className="m-0 font-semibold text-loi">
            {conLai === 1
              ? `Chỉ còn MỘT lần nữa. Rời màn hình lần thứ ${maxStrikes}, bài thi sẽ tự nộp với 0 điểm.`
              : `Còn ${conLai} lần nữa là bài thi bị khoá với 0 điểm.`}
          </p>
          <p className="m-0 text-chu-phu">
            Thầy cô sẽ thấy lần vi phạm này. Nếu là ngoài ý muốn, em quay lại và tiếp tục làm bài.
          </p>
        </div>

        <button
          ref={nut}
          type="button"
          onClick={onQuayLai}
          className="mt-6 min-h-cham w-full rounded-nut bg-loi px-5 py-3 text-base font-bold text-white hover:opacity-90"
        >
          Quay lại bài thi (toàn màn hình)
        </button>
      </div>
    </div>
  );
}
