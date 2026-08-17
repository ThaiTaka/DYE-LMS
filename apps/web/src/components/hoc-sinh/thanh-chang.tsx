import { STAGE_LABEL, type FlowStage } from '@dye/core';

import type { KhoiHienThi } from '@/lib/student-data';

/**
 * The step rail inside a lesson.
 *
 * Answers "Where am I?" at block level. It shows only the REQUIRED blocks for
 * this student, so a Cơ bản student sees a rail of four steps and a Nâng cao
 * student sees six — neither is shown a path that is not theirs to walk.
 *
 * Exploration blocks are counted separately underneath, framed as a bonus.
 */
const THU_TU: FlowStage[] = ['LY_THUYET', 'VI_DU', 'SAN_CHOI', 'THU_THACH'];

export function ThanhChang({ blocks }: { blocks: KhoiHienThi[] }) {
  const batBuoc = blocks.filter((b) => b.access === 'REQUIRED');
  const khamPha = blocks.filter((b) => b.access === 'EXPLORATION');

  const chang = THU_TU.map((stage) => {
    const cua = batBuoc.filter((b) => b.stage === stage);
    return {
      stage,
      tong: cua.length,
      xong: cua.filter((b) => b.completed).length,
      // Anchor to the first block of the stage so the rail is navigable.
      neo: cua[0]?.blockId ?? null,
    };
  }).filter((c) => c.tong > 0);

  if (chang.length === 0) return null;

  return (
    <nav aria-label="Các chặng của bài học" className="rounded-the border border-vien bg-the p-4">
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
        {chang.map((c, i) => {
          const xongHet = c.xong === c.tong;
          return (
            <li key={c.stage} className="flex items-center gap-2">
              {i > 0 ? (
                <span aria-hidden="true" className="text-vien-dam">
                  →
                </span>
              ) : null}

              <a
                href={c.neo ? `#khoi-${c.neo}` : '#noi-dung-chinh'}
                className={`flex min-h-cham items-center gap-2 rounded-nut border px-3 py-2 text-sm font-medium ${
                  xongHet
                    ? 'border-dung/30 bg-dung-nen text-dung'
                    : 'border-vien bg-the text-chu-phu hover:border-chinh hover:text-chinh'
                }`}
              >
                <span aria-hidden="true">{xongHet ? '✓' : i + 1}</span>
                {STAGE_LABEL[c.stage]}
                <span className="text-xs tabular-nums opacity-75">
                  {c.xong}/{c.tong}
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      {khamPha.length > 0 ? (
        <p className="mt-3 mb-0 text-sm text-mo-rong">
          🌟 Bài này còn {khamPha.length} phần khám phá thêm dành cho bạn nào muốn thử sức.
        </p>
      ) : null}
    </nav>
  );
}
