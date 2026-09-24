import { VanBan } from '@/lib/markdown';
import type { DuLieuBaiHoc, KhoiHienThi } from '@/lib/student-data';

import { BaiTracNghiem } from './bai-trac-nghiem';
import { BiKhoaViPham } from './bi-khoa-vi-pham';
import { NutDaDocXong } from './nut-da-doc-xong';
import { KhuLamBai } from './khu-lam-bai';
import { KhuMicrobit } from './khu-microbit';
import { KIEU_NHANH, KIEU_TRUY_CAP } from '../ui/nhanh';
import { SAC_THAI } from '../ui/sac-thai';

/**
 * Which workspace a lesson belongs to.
 *
 * A lesson has exactly one. A Micro:bit session is worked in MakeCode, a
 * Python session in the editor — and a page that puts both on screen asks a
 * ten-year-old to work out which box their homework goes in.
 */
export type MoiTruongBai = 'PYTHON' | 'MICROBIT';

/**
 * Is this block hardware work?
 *
 * Two sources, because they can disagree. `type` is a column the curriculum
 * asserts on (`MICROBIT_WORKSPACE`); `noiDung.kind` comes out of the block's
 * JSON payload. A block authored with one and not the other used to render the
 * Python editor for a MakeCode task, so this accepts either as proof.
 */
function laKhoiMicrobit(khoi: Pick<KhoiHienThi, 'type' | 'noiDung'>): boolean {
  return khoi.type === 'MICROBIT_WORKSPACE' || khoi.noiDung.kind === 'microbit';
}

/**
 * The lesson's workspace, decided once from all of its blocks.
 *
 * ── The bug this closes ──────────────────────────────────────────────────────
 * `microbit-buoi-01` carried a Python `playground` block as a warm-up, so
 * rendering each block on its own terms put a CodeMirror Python editor on the
 * same page as the MakeCode iframe, with nothing to say which one the work
 * goes in. That block is now theory + reflection, and Rule M7 in the seed
 * assertions refuses a Python workspace anywhere in a Micro:bit course.
 *
 * This stays regardless, and is not redundant: the seed rule governs what the
 * DYE curriculum ships, while this governs what the player DRAWS — including
 * for a lesson a teacher authors later through the admin tools, which no seed
 * assertion ever sees.
 *
 * So the decision is made per LESSON, not per block: one Micro:bit block makes
 * the whole session a Micro:bit session, and the Python editors in it stand
 * down. Their prose is kept — it is the instructions, and a warm-up that says
 * "think about what you want the board to show" still reads correctly without
 * a box to type Python into.
 */
export function moiTruongCuaBai(
  blocks: readonly Pick<KhoiHienThi, 'type' | 'noiDung'>[],
): MoiTruongBai {
  return blocks.some(laKhoiMicrobit) ? 'MICROBIT' : 'PYTHON';
}

/**
 * Renders one lesson block.
 *
 * The wrapper is where the tier decision from Phase 4 becomes something a
 * student can see. An EXPLORATION block — content above their assigned tier —
 * is framed as a bonus quest with a gold dashed border and copy that says
 * "không làm cũng không sao cả". It is never a lock, a warning, or an error.
 */
export function KhoiNoiDung({
  khoi,
  moiTruong,
  khoaViPham = null,
}: {
  khoi: KhoiHienThi;
  /**
   * The lesson's workspace, from `moiTruongCuaBai`.
   *
   * Optional so a block can still be rendered on its own — in a test, or in a
   * teacher preview of a single block — where there is no lesson to ask. The
   * block then answers for itself, which is the old behaviour.
   */
  moiTruong?: MoiTruongBai | undefined;
  /** Set when an integrity lock is in force on this lesson. */
  khoaViPham?: DuLieuBaiHoc['khoaViPham'];
}) {
  const khamPha = khoi.access === 'EXPLORATION';
  const truyCap = KIEU_TRUY_CAP[khoi.access];
  const kieuNhanh = KIEU_NHANH[khoi.tier];

  return (
    <section
      aria-labelledby={`khoi-${khoi.blockId}`}
      className={
        khamPha
          ? 'rounded-the border-2 border-dashed border-mo-rong bg-mo-rong-nen p-5 shadow-sm sm:p-6'
          : 'rounded-the border border-vien bg-the p-5 shadow-sm sm:p-6'
      }
    >
      <header className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {khamPha ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${SAC_THAI.moRong}`}
            >
              <span aria-hidden="true">{truyCap.icon}</span>
              {truyCap.nhan}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${kieuNhanh.huyHieu}`}
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

        <h2 id={`khoi-${khoi.blockId}`} className="mt-0 mb-1 text-2xl leading-snug font-bold">
          {khoi.title}
        </h2>

        {khamPha ? <p className="m-0 text-sm text-mo-rong">{truyCap.moTa}</p> : null}
      </header>

      <NoiDungTheoLoai
        khoi={khoi}
        moiTruong={moiTruong ?? (laKhoiMicrobit(khoi) ? 'MICROBIT' : 'PYTHON')}
        khoaViPham={khoaViPham}
      />
    </section>
  );
}

/**
 * Which block kinds a lock actually takes away.
 *
 * Reading material stays readable. The lock exists to stop work being HANDED IN,
 * not to stop a student learning — a locked child who wants to go back and read
 * the explanation is doing the thing everyone wants, and taking the theory away
 * from them would be punishment for its own sake.
 */
type LoaiLamBai = 'playground' | 'challenge' | 'microbit' | 'quiz';

const KHOI_LAM_BAI: readonly LoaiLamBai[] = ['playground', 'challenge', 'microbit', 'quiz'];

function laKhoiLamBai(nd: KhoiHienThi['noiDung']): nd is Extract<
  KhoiHienThi['noiDung'],
  { kind: LoaiLamBai }
> {
  return (KHOI_LAM_BAI as readonly string[]).includes(nd.kind);
}

function NoiDungTheoLoai({
  khoi,
  moiTruong,
  khoaViPham,
}: {
  khoi: KhoiHienThi;
  moiTruong: MoiTruongBai;
  khoaViPham: DuLieuBaiHoc['khoaViPham'];
}) {
  const nd = khoi.noiDung;

  /*
   * Does the Python editor belong on this page at all?
   *
   * False in a Micro:bit lesson, and false for a block the curriculum marked
   * `MICROBIT_WORKSPACE` whatever its payload says. Both checks, because both
   * failure modes have happened: a Python warm-up seeded into a hardware
   * session, and a hardware block whose JSON still said `challenge`.
   */
  const dungPython = moiTruong === 'PYTHON' && khoi.type !== 'MICROBIT_WORKSPACE';

  /*
   * The editor is REPLACED, not disabled.
   *
   * A greyed-out editor still holds the student's text and still invites them to
   * keep typing into work that no longer counts. Swapping the whole interactive
   * area for the panel makes the state unambiguous — and means there is no
   * disabled control for a devtools user to re-enable, since the server refuses
   * every one of these paths anyway (`moKhoiCode` in @dye/core).
   *
   * The markdown above it is kept: it is the instructions, and losing them would
   * leave the panel explaining a task the student can no longer read.
   */
  if (khoaViPham && laKhoiLamBai(nd)) {
    return (
      <>
        <VanBan>{nd.markdown}</VanBan>
        <div className="mt-4">
          <BiKhoaViPham khoa={khoaViPham} />
        </div>
      </>
    );
  }

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
              <p className="mt-0 mb-2 text-sm font-bold text-chinh-sang">Ghi nhớ</p>
              <ul className="m-0 list-disc space-y-1 ps-5 text-sm">
                {nd.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </aside>
          ) : null}
          <NutDaDocXong blockId={khoi.blockId} daXong={khoi.completed} />
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
      if (!dungPython) {
        return (
          <>
            <VanBan>{nd.markdown}</VanBan>
            <LamOMakeCode muc={nd.goal} />
          </>
        );
      }
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          <div className="mt-4">
            <KhuLamBai
              blockId={khoi.blockId}
              maBanDau={khoi.maBanDau}
              coBanNhap={khoi.coBanNhap}
              luuLucBanDau={khoi.luuLucBanDau}
              hocSinhId={khoi.hocSinhId}
              // A playground has nothing to hand in; it is for trying things.
              coBaiTap={false}
              nhan="Khung soạn thảo"
              mucTieu={nd.goal}
            />
          </div>
        </>
      );

    case 'challenge':
      if (!dungPython) {
        return (
          <>
            <VanBan>{nd.markdown}</VanBan>
            <LamOMakeCode muc={khoi.baiTap?.title ?? ''} />
          </>
        );
      }
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          <ThuThachLapTrinh khoi={khoi} />
        </>
      );

    /*
     * The hardware workspace. Reached only in a Micro:bit lesson, because a
     * block of this kind is itself what makes the lesson one — see
     * `moiTruongCuaBai`. Nothing else on the page opens a second editor.
     */
    case 'microbit':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          <div className="mt-4">
            <KhuMicrobit
              blockId={khoi.blockId}
              goal={nd.goal}
              khoiLenh={nd.khoiLenh}
              blocksXmlBanDau={nd.blocksXml}
              // A saved draft for this block IS the student's workspace.
              blocksXmlDaLuu={khoi.coBanNhap ? khoi.maBanDau : ''}
              coBaiTap={khoi.baiTap !== null}
              soLanDaNop={khoi.soLanDaNop}
              baiNopCuoi={khoi.baiNopCuoi}
              baiNopHex={
                khoi.baiNopCuoi?.hex
                  ? {
                      submissionId: khoi.baiNopCuoi.id,
                      tenTep: khoi.baiNopCuoi.hex.tenTep,
                      kichThuocKb: khoi.baiNopCuoi.hex.kichThuocKb,
                      nopLuc: khoi.baiNopCuoi.nopLuc,
                      daCham: khoi.baiNopCuoi.chamTay,
                      verdict: khoi.baiNopCuoi.verdict,
                    }
                  : null
              }
            />
          </div>
          {khoi.baiTap && khoi.baiTap.hints.length > 0 ? (
            <details className="mt-4 rounded-nut border border-vien bg-the p-4">
              <summary className="min-h-cham cursor-pointer font-semibold">
                💡 Xem gợi ý ({khoi.baiTap.hints.length})
              </summary>
              <ol className="mt-3 mb-0 space-y-1.5 ps-5 text-sm">
                {khoi.baiTap.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      );

    case 'quiz':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {khoi.tracNghiem ? (
            <div className="mt-4">
              <BaiTracNghiem
                tracNghiem={khoi.tracNghiem}
                kieu="kiem-tra"
                blockId={khoi.blockId}
                daXong={khoi.completed}
              />
            </div>
          ) : null}
        </>
      );

    /*
     * Trắc nghiệm and Điền khuyết — the two practice banks.
     *
     * They render through the SAME runner as a quiz, because the data is the
     * same: a Quiz whose Question rows hold the answers server-side. What
     * changes is `kieu`, which switches the closing message from a score to an
     * invitation to keep practising. A practice bank that ends with "đúng 6/10"
     * tells a child they failed at something that was never a test.
     *
     * The two cases are written out separately rather than merged, so a future
     * change to one — say a per-blank input for fill-in-the-blank — has an
     * obvious place to go.
     */
    case 'mcq':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {khoi.tracNghiem ? (
            <div className="mt-4">
              <BaiTracNghiem
                tracNghiem={khoi.tracNghiem}
                kieu="luyen-tap"
                anhMinhHoa={nd.imageUrl}
                blockId={khoi.blockId}
                daXong={khoi.completed}
              />
            </div>
          ) : (
            <p className="mt-4 mb-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
              Bộ câu hỏi của phần này đang được cập nhật. Em cứ học tiếp phần sau nhé.
            </p>
          )}
        </>
      );

    case 'fill-blank':
      return (
        <>
          <VanBan>{nd.markdown}</VanBan>
          {khoi.tracNghiem ? (
            <div className="mt-4">
              <BaiTracNghiem
                tracNghiem={khoi.tracNghiem}
                kieu="luyen-tap"
                anhMinhHoa={nd.imageUrl}
                blockId={khoi.blockId}
                daXong={khoi.completed}
              />
            </div>
          ) : (
            <p className="mt-4 mb-0 rounded-nut border border-vien bg-the-mo p-4 text-sm text-chu-phu">
              Bộ câu hỏi của phần này đang được cập nhật. Em cứ học tiếp phần sau nhé.
            </p>
          )}
        </>
      );

    case 'reflection':
      return (
        <>
          <div className="rounded-nut border border-vien bg-the-mo p-4">
            <p className="m-0">{nd.prompt}</p>
            <p className="mt-3 mb-0 text-sm font-medium text-chu-nhat">
              Em ghi câu trả lời vào vở, rồi bấm nút bên dưới nhé.
            </p>
          </div>
          <NutDaDocXong blockId={khoi.blockId} daXong={khoi.completed} nhan="Em đã suy nghĩ xong" />
        </>
      );

    case 'resource':
      return (
        <>
        <ul className="m-0 list-none space-y-2 p-0">
          {nd.links.map((l, i) => (
            <li key={i}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-cham items-center gap-2 rounded text-chinh-sang underline underline-offset-2"
              >
                {l.label}
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(mở tab mới)</span>
              </a>
            </li>
          ))}
        </ul>
        <NutDaDocXong blockId={khoi.blockId} daXong={khoi.completed} nhan="Em đã xem xong" />
        </>
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
          <p className="mt-4 mb-0 text-sm font-medium text-chu-nhat">
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
              className="mt-3 inline-flex min-h-cham items-center gap-2 rounded-nut border border-vien px-4 py-2 font-medium text-chinh-sang"
            >
              ▶ Xem video
              {nd.durationSec > 0 ? (
                <span className="text-sm font-medium text-chu-nhat">
                  ({Math.round(nd.durationSec / 60)} phút)
                </span>
              ) : null}
            </a>
          ) : null}
          <NutDaDocXong blockId={khoi.blockId} daXong={khoi.completed} nhan="Em đã xem xong" />
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
 * Stands in for the Python editor in a Micro:bit lesson.
 *
 * Not an error and not a lock — the block's instructions are still printed
 * above it, and this only answers the question they raise: "type it where?".
 * A warm-up in a hardware session is thinking-out-loud before opening
 * MakeCode, so it points at the workspace further down the page instead of
 * offering a box whose contents nothing would ever read.
 *
 * Plain `bg-the-mo`, not glass: this sits inside a lesson block that already
 * has a surface, and a second blurred layer on a school laptop buys nothing.
 */
function LamOMakeCode({ muc }: { muc: string }) {
  return (
    <div className="mt-4 rounded-nut border border-vien bg-the-mo p-4">
      <p className="m-0 flex items-start gap-2 text-sm font-semibold text-chu">
        <span aria-hidden="true">🧩</span>
        Bài này em làm bằng khối lệnh MakeCode, không gõ Python.
      </p>
      {muc ? <p className="mt-2 mb-0 text-sm text-chu-phu">Mục tiêu: {muc}</p> : null}
      <p className="mt-2 mb-0 text-sm font-medium text-chu-nhat">
        Khu kéo thả nằm ở phần Micro:bit bên dưới — em cuộn xuống một chút nhé.
      </p>
    </div>
  );
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
        hocSinhId={khoi.hocSinhId}
        coBaiTap={baiTap !== null}
        coDauVaoMau={(baiTap?.viDu.length ?? 0) > 0}
        soLanDaNop={khoi.soLanDaNop}
        baiNopCuoi={khoi.baiNopCuoi}
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
