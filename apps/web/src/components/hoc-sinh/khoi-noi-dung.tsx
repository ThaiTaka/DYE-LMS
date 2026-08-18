import { VanBan } from '@/lib/markdown';
import type { KhoiHienThi } from '@/lib/student-data';

import { BaiTracNghiem } from './bai-trac-nghiem';
import { KhuLamBai } from './khu-lam-bai';
import { KIEU_NHANH, KIEU_TRUY_CAP } from '../ui/nhanh';

/**
 * Renders one lesson block.
 *
 * The wrapper is where the tier decision from Phase 4 becomes something a
 * student can see. An EXPLORATION block — content above their assigned tier —
 * is framed as a bonus quest with a gold dashed border and copy that says
 * "không làm cũng không sao cả". It is never a lock, a warning, or an error.
 */
export function KhoiNoiDung({ khoi }: { khoi: KhoiHienThi }) {
  const khamPha = khoi.access === 'EXPLORATION';
  const truyCap = KIEU_TRUY_CAP[khoi.access];
  const kieuNhanh = KIEU_NHANH[khoi.tier];

  return (
    <section
      aria-labelledby={`khoi-${khoi.blockId}`}
      className={
        khamPha
          ? 'rounded-the border-2 border-dashed border-mo-rong bg-mo-rong-nen p-5 sm:p-6'
          : 'rounded-the border border-vien bg-the p-5 sm:p-6'
      }
    >
      <header className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {khamPha ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mo-rong px-3 py-1 text-xs font-bold text-white">
              <span aria-hidden="true">{truyCap.icon}</span>
              {truyCap.nhan}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${kieuNhanh.nen} ${kieuNhanh.chu} ${kieuNhanh.vien}`}
            >
              <span aria-hidden="true">{kieuNhanh.icon}</span>
              {kieuNhanh.nhan}
            </span>
          )}

          {khoi.access === 'OPTIONAL' ? (
            <span className="text-xs font-medium text-chu-nhat">Làm thêm nếu em muốn</span>
          ) : null}

          {khoi.completed ? (
            <span className="text-xs font-semibold text-dung">✓ Đã xong</span>
          ) : null}
        </div>

        <h2 id={`khoi-${khoi.blockId}`} className="mt-0 mb-1 text-xl leading-snug font-bold">
          {khoi.title}
        </h2>

        {khamPha ? <p className="m-0 text-sm text-mo-rong">{truyCap.moTa}</p> : null}
      </header>

      <NoiDungTheoLoai khoi={khoi} />
    </section>
  );
}

function NoiDungTheoLoai({ khoi }: { khoi: KhoiHienThi }) {
  const nd = khoi.noiDung;

  switch (nd.kind) {
    case 'theory':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {nd.keyPoints.length > 0 ? (
            <aside
              aria-label="Ý chính cần nhớ"
              className="mt-5 rounded-nut border border-chinh/20 bg-chinh-nhat p-4"
            >
              <p className="mt-0 mb-2 text-sm font-bold text-chinh">Ghi nhớ</p>
              <ul className="m-0 list-disc space-y-1 ps-5 text-sm">
                {nd.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </aside>
          ) : null}
        </>
      );

    case 'example':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>

          <pre className="mt-4 overflow-x-auto rounded-nut bg-[#0f172a] p-4 text-[0.95rem] leading-relaxed text-[#e2e8f0]">
            <code>{nd.code}</code>
          </pre>

          {nd.output ? (
            <div className="mt-3">
              <p className="mt-0 mb-1.5 text-sm font-semibold text-chu-phu">Kết quả</p>
              <pre className="overflow-x-auto rounded-nut border border-vien bg-the-mo p-4 text-sm">
                <code>{nd.output}</code>
              </pre>
            </div>
          ) : null}

          {nd.notes.length > 0 ? (
            <ul className="mt-4 mb-0 list-disc space-y-1.5 ps-5 text-sm text-chu-phu">
              {nd.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
        </>
      );

    case 'playground':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          <div className="mt-4">
            <KhuLamBai
              blockId={khoi.blockId}
              maBanDau={khoi.maBanDau}
              coBanNhap={khoi.coBanNhap}
              luuLucBanDau={khoi.luuLucBanDau}
              // A playground has nothing to hand in; it is for trying things.
              coBaiTap={false}
              nhan="Khung soạn thảo"
              mucTieu={nd.goal}
            />
          </div>
        </>
      );

    case 'challenge':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          <ThuThachLapTrinh khoi={khoi} />
        </>
      );

    case 'quiz':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {khoi.tracNghiem ? (
            <div className="mt-4">
              <BaiTracNghiem tracNghiem={khoi.tracNghiem} />
            </div>
          ) : null}
        </>
      );

    case 'reflection':
      return (
        <div className="rounded-nut border border-vien bg-the-mo p-4">
          <p className="m-0">{nd.prompt}</p>
          <p className="mt-3 mb-0 text-sm text-chu-nhat">
            Em có thể ghi câu trả lời vào vở — phần nộp bài suy ngẫm sẽ có ở bản cập nhật sau.
          </p>
        </div>
      );

    case 'resource':
      return (
        <ul className="m-0 list-none space-y-2 p-0">
          {nd.links.map((l, i) => (
            <li key={i}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-cham items-center gap-2 rounded text-chinh underline underline-offset-2"
              >
                {l.label}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(mở tab mới)</span>
              </a>
            </li>
          ))}
        </ul>
      );

    case 'project':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {nd.milestones.length > 0 ? (
            <div className="mt-4 rounded-nut border border-vien bg-the-mo p-4">
              <p className="mt-0 mb-2 text-sm font-bold">Các bước em sẽ đi qua</p>
              <ol className="m-0 space-y-1.5 ps-5 text-sm">
                {nd.milestones.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </div>
          ) : null}
          <p className="mt-4 mb-0 text-sm text-chu-nhat">
            Khu vực nộp dự án sẽ được mở ở bản cập nhật sau.
          </p>
        </>
      );

    case 'video':
      return (
        <>
          {nd.markdown ? <VanBan>{nd.markdown}</VanBan> : null}
          {nd.url ? (
            <a
              href={nd.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2 font-medium text-chinh"
            >
              ▶ Xem video
              {nd.durationSec > 0 ? (
                <span className="text-sm text-chu-nhat">
                  ({Math.round(nd.durationSec / 60)} phút)
                </span>
              ) : null}
            </a>
          ) : null}
        </>
      );

    case 'khong-doc-duoc':
      // One malformed row must not blank out the whole lesson.
      return (
        <p className="m-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
          Phần nội dung này đang được cập nhật. Em cứ học tiếp phần sau nhé.
        </p>
      );

    default: {
      const unreachable: never = nd;
      void unreachable;
      return null;
    }
  }
}

/**
 * Coding challenge — statement, samples, workspace and hints.
 *
 * The workspace renders even when no `Problem` row is attached, because the
 * draft and its history are keyed on the block: a student typing into a
 * challenge that has not been wired to a problem yet still must not lose their
 * work. The submit button is what depends on there being something to hand in.
 */
function ThuThachLapTrinh({ khoi }: { khoi: KhoiHienThi }) {
  const baiTap = khoi.baiTap;

  return (
    <div className="mt-4 space-y-4">
      {baiTap ? (
        <div className="rounded-nut border border-vien bg-the-mo p-4">
          <h3 className="mt-0 mb-2 text-base font-bold">{baiTap.title}</h3>
          <VanBan>{baiTap.statement}</VanBan>
        </div>
      ) : null}

      {baiTap && baiTap.viDu.length > 0 ? (
        <div>
          <p className="mt-0 mb-2 text-sm font-semibold">Ví dụ</p>
          <ul className="m-0 list-none space-y-3 p-0">
            {baiTap.viDu.map((v, i) => (
              <li key={i} className="rounded-nut border border-vien p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mt-0 mb-1 text-xs font-semibold text-chu-nhat">Đầu vào</p>
                    <pre className="m-0 overflow-x-auto rounded bg-the-mo p-2 text-sm">
                      <code>{v.input || '(không có)'}</code>
                    </pre>
                  </div>
                  <div>
                    <p className="mt-0 mb-1 text-xs font-semibold text-chu-nhat">Kết quả mong đợi</p>
                    <pre className="m-0 overflow-x-auto rounded bg-the-mo p-2 text-sm">
                      <code>{v.expectedOutput}</code>
                    </pre>
                  </div>
                </div>
                {v.explanation ? (
                  <p className="mt-2 mb-0 text-sm text-chu-phu">{v.explanation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <KhuLamBai
        blockId={khoi.blockId}
        maBanDau={khoi.maBanDau}
        coBanNhap={khoi.coBanNhap}
        luuLucBanDau={khoi.luuLucBanDau}
        coBaiTap={baiTap !== null}
        nhan="Bài làm của em"
      />

      {baiTap && baiTap.hints.length > 0 ? (
        <details className="rounded-nut border border-vien bg-the p-4">
          <summary className="min-h-cham cursor-pointer font-semibold">
            💡 Xem gợi ý ({baiTap.hints.length})
          </summary>
          <ol className="mt-3 mb-0 space-y-1.5 ps-5 text-sm">
            {baiTap.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
