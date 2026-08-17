'use client';

import { useId, useState } from 'react';

import { kiemTraCauTraLoi, type KetQuaTraLoi } from '@/app/bai-hoc/[slug]/actions';
import type { CauHoiHienThi, TracNghiemHienThi } from '@/lib/student-data';

/**
 * Quiz runner.
 *
 * Tone is the design constraint here. A wrong answer from a 12-year-old is a
 * step in learning, not a failure, so:
 *   • it is amber and says "Thử lại nhé", never red and never "SAI";
 *   • the explanation appears either way, because the point is understanding;
 *   • retrying is always one obvious click away.
 *
 * Answers are checked by a server action. Nothing in this component — or in the
 * props it receives — knows which choice is correct until the student answers.
 */
export function BaiTracNghiem({ tracNghiem }: { tracNghiem: TracNghiemHienThi }) {
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
          🎉 Em đã làm hết {tong} câu — đúng {daDung} câu. Giỏi lắm!
        </p>
      ) : null}
    </div>
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

      {daXong ? (
        <PhanHoi
          ketQua={ketQua}
          onLamLai={() => {
            setNhapTay('');
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
