'use client';

import { useId, useState } from 'react';

import { kiemTraCauTraLoi, type KetQuaTraLoi } from '@/app/bai-hoc/[slug]/actions';
import type { CauHoiHienThi, TracNghiemHienThi } from '@/lib/student-data';

/**
 * Quiz runner — used by all three question surfaces.
 *
 * Tone is the design constraint here. A wrong answer from a 12-year-old is a
 * step in learning, not a failure, so:
 *   • it is amber and says "Thử lại nhé", never red and never "SAI";
 *   • the explanation appears either way, because the point is understanding;
 *   • retrying is always one obvious click away.
 *
 * Answers are checked by a server action. Nothing in this component — or in the
 * props it receives — knows which choice is correct until the student answers.
 *
 * ── The two framings ─────────────────────────────────────────────────────────
 * `kieu` changes nothing about how answers are checked and everything about how
 * the surface reads. A QUIZ block is the end-of-section check and closes with a
 * score. A MULTIPLE_CHOICE or FILL_IN_BLANK block is a practice bank a lesson
 * may carry several of, so it closes by saying the work is done rather than by
 * reporting a mark — a child who got 6/10 on practice has practised, and a
 * scoreboard would tell them otherwise.
 */
export function BaiTracNghiem({
  tracNghiem,
  kieu = 'kiem-tra',
  anhMinhHoa = null,
}: {
  tracNghiem: TracNghiemHienThi;
  kieu?: 'kiem-tra' | 'luyen-tap';
  anhMinhHoa?: string | null;
}) {
  const [ketQua, setKetQua] = useState<Record<string, KetQuaTraLoi>>({});

  const daTraLoi = Object.keys(ketQua).length;
  const daDung = Object.values(ketQua).filter((k) => k.dung).length;
  const tong = tracNghiem.questions.length;
  const xongHet = daTraLoi === tong;

  return (
    <div className="rounded-nut border border-vien bg-the p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-base font-bold">{tracNghiem.title}</h3>
        <p aria-live="polite" className="m-0 text-sm text-chu-phu">
          Đã trả lời {daTraLoi}/{tong}
          {daTraLoi > 0 ? ` · đúng ${daDung}` : ''}
        </p>
      </div>

      {tracNghiem.description ? (
        <p className="mt-0 mb-4 text-sm text-chu-phu">{tracNghiem.description}</p>
      ) : null}

      {anhMinhHoa ? (
        <figure className="hinh-bai-hoc mb-4">
          <img src={anhMinhHoa} alt="" loading="lazy" decoding="async" />
        </figure>
      ) : null}

      <ol className="m-0 list-none space-y-5 p-0">
        {tracNghiem.questions.map((cau, i) => (
          <li key={cau.id}>
            <CauHoi
              cau={cau}
              soThuTu={i + 1}
              ketQua={ketQua[cau.id]}
              onTraLoi={(kq) => setKetQua((truoc) => ({ ...truoc, [cau.id]: kq }))}
              onLamLai={() =>
                setKetQua((truoc) => {
                  // Remove the key entirely. Leaving it as `undefined` would keep
                  // the question counted in "đã trả lời" while rendering as unanswered.
                  const { [cau.id]: _bo, ...conLai } = truoc;
                  return conLai;
                })
              }
            />
          </li>
        ))}
      </ol>

      {xongHet ? (
        <p
          role="status"
          className="mt-5 mb-0 rounded-nut bg-dung-nen p-4 text-center font-semibold text-dung"
        >
          {kieu === 'kiem-tra'
            ? `🎉 Em đã làm hết ${tong} câu — đúng ${daDung} câu. Giỏi lắm!`
            : `🎉 Em đã làm hết ${tong} câu rồi. Câu nào chưa chắc, em quay lại làm lại thoải mái nhé.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The blank in a fill-in-the-blank template.
 *
 * Rendered as a styled span rather than left as three underscores in the prose,
 * so it reads as a gap to fill rather than as a typo — and so a screen reader
 * announces "chỗ trống" instead of spelling out punctuation.
 */
function CauVoiChoTrong({ template }: { template: string }) {
  const phan = template.split(/_{2,}/g);

  return (
    <p className="mt-0 mb-3 rounded-nut bg-the-mo p-3.5 text-base leading-relaxed">
      {phan.map((doan, i) => (
        <span key={i}>
          {doan}
          {i < phan.length - 1 ? (
            <span className="mx-1 inline-block min-w-16 border-b-2 border-chinh align-baseline text-center font-semibold text-chinh">
              <span className="sr-only">chỗ trống</span>
              <span aria-hidden="true">&nbsp;?&nbsp;</span>
            </span>
          ) : null}
        </span>
      ))}
    </p>
  );
}

function CauHoi({
  cau,
  soThuTu,
  ketQua,
  onTraLoi,
  onLamLai,
}: {
  cau: CauHoiHienThi;
  soThuTu: number;
  ketQua: KetQuaTraLoi | undefined;
  onTraLoi: (kq: KetQuaTraLoi) => void;
  onLamLai: () => void;
}) {
  const [dangGui, setDangGui] = useState(false);
  const [nhapTay, setNhapTay] = useState('');
  const [xemGoiY, setXemGoiY] = useState(false);
  const id = useId();

  async function gui(traLoi: string) {
    if (dangGui || !traLoi) return;
    setDangGui(true);
    try {
      onTraLoi(await kiemTraCauTraLoi(cau.id, traLoi));
    } finally {
      setDangGui(false);
    }
  }

  const daXong = ketQua !== undefined;
  const tracNghiem = cau.type === 'MULTIPLE_CHOICE' || cau.type === 'TRUE_FALSE';

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-3 p-0 text-base font-semibold">
        <span className="text-chu-nhat">Câu {soThuTu}.</span> {cau.prompt}
      </legend>

      {cau.mediaUrl ? (
        <figure className="hinh-bai-hoc mb-3">
          <img src={cau.mediaUrl} alt="" loading="lazy" decoding="async" />
        </figure>
      ) : null}

      {cau.template ? <CauVoiChoTrong template={cau.template} /> : null}

      {tracNghiem ? (
        <div className="space-y-2">
          {cau.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={dangGui}
              onClick={() => void gui(c.id)}
              className="flex min-h-cham w-full items-center gap-3 rounded-nut border border-vien bg-the px-4 py-3 text-start text-base hover:border-chinh hover:bg-chinh-nhat disabled:opacity-60"
            >
              {c.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <label htmlFor={id} className="sr-only">
            Câu trả lời của em
          </label>
          <input
            id={id}
            type="text"
            value={nhapTay}
            disabled={dangGui}
            onChange={(e) => setNhapTay(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void gui(nhapTay);
              }
            }}
            placeholder="Nhập câu trả lời…"
            autoComplete="off"
            className="min-h-cham flex-1 rounded-nut border border-vien px-4 py-2.5 text-base"
          />
          <button
            type="button"
            disabled={dangGui || nhapTay.trim() === ''}
            onClick={() => void gui(nhapTay)}
            className="min-h-cham rounded-nut bg-chinh px-5 py-2.5 font-semibold text-white hover:bg-chinh-dam disabled:opacity-50"
          >
            Trả lời
          </button>
        </div>
      )}

      {/*
        The hint is offered BEFORE answering and costs nothing.

        Coding challenges charge XP for a hint, which is right there: the hint
        shortens work the student is being graded on. Here there is no grade to
        protect, and a child who is stuck on question 4 of a practice bank with
        no way forward simply stops — so the only thing a locked hint would
        achieve is ending the practice early.
      */}
      {cau.hint && !daXong ? (
        <p className="mt-2.5 mb-0">
          {xemGoiY ? (
            <span className="block rounded-nut border border-chinh/20 bg-chinh-nhat p-3 text-sm">
              💡 {cau.hint}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setXemGoiY(true)}
              className="min-h-cham rounded text-sm font-medium text-chinh underline underline-offset-2"
            >
              💡 Em cần gợi ý
            </button>
          )}
        </p>
      ) : null}

      {daXong ? (
        <PhanHoi
          ketQua={ketQua}
          onLamLai={() => {
            setNhapTay('');
            setXemGoiY(false);
            onLamLai();
          }}
        />
      ) : null}
    </fieldset>
  );
}

/**
 * Feedback after an answer.
 *
 * Correct is green and celebratory. Incorrect is AMBER and says "Thử lại nhé" —
 * red would read as punishment, and the brief rules it out for exactly that
 * reason. Either way the explanation is shown, because that is the part that
 * actually teaches.
 */
function PhanHoi({ ketQua, onLamLai }: { ketQua: KetQuaTraLoi; onLamLai: () => void }) {
  const dung = ketQua.dung;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-nut border p-4 ${
        dung ? 'border-dung/30 bg-dung-nen' : 'border-thu-lai/30 bg-thu-lai-nen'
      }`}
    >
      <p className={`mt-0 mb-1 font-bold ${dung ? 'text-dung' : 'text-thu-lai'}`}>
        {dung ? '✓ Chính xác!' : '↻ Thử lại nhé'}
      </p>

      {!dung && ketQua.dapAnDung ? (
        <p className="mt-0 mb-1.5 text-sm">
          Đáp án đúng là: <strong>{ketQua.dapAnDung}</strong>
        </p>
      ) : null}

      {ketQua.giaiThich ? (
        <p className="mt-0 mb-0 text-sm text-chu-phu">{ketQua.giaiThich}</p>
      ) : null}

      {!dung ? (
        <button
          type="button"
          onClick={onLamLai}
          className="mt-3 min-h-cham rounded-nut border border-thu-lai px-4 py-2 text-sm font-semibold text-thu-lai hover:bg-thu-lai hover:text-white"
        >
          Làm lại câu này
        </button>
      ) : null}
    </div>
  );
}
