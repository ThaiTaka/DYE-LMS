/**
 * Review milestones, placed by rule rather than by hand.
 *
 *   • Every 5th session closes with a boss fight reviewing the five before it
 *     (sessions 1–5 at session 5, 6–10 at 10, …).
 *   • Every 15th session also closes with an eight-slide presentation of the
 *     fifteen before it. Session 15 and 30 carry both: the fight, then the talk.
 *
 * ── Why a merge rather than editing the lesson files ─────────────────────────
 * The same reason as `bo-sung/ap-dung.ts`: the lesson files are the teacher's
 * plan transcribed, and a rule that applies to every course belongs in one
 * place rather than in twenty-four. `assertReviewMilestones` in assertions.ts
 * then holds the merged result to the rule, so a course cannot drift from it.
 *
 * ── Appended, never inserted ─────────────────────────────────────────────────
 * Blocks are upserted by (lesson, order). Appending gives the milestones the
 * next free orders and leaves every existing block — and the progress rows that
 * point at it — exactly where it was. Inserting would renumber blocks under
 * students' existing progress. It also keeps the pedagogical flow rule
 * satisfied: whatever made the lesson's first assessment legal still does.
 */
import { bossBlock, presentationBlock } from '../builders.ts';

import type { CourseSpec, LessonSpec } from '../types.ts';

/** A boss closes every this-many sessions. Mirrors SO_BUOI_MOI_CHANG_ON_TAP in @dye/core. */
export const CHANG_ON_TAP = 5;

/** A presentation closes every this-many sessions. */
export const CHANG_THUYET_TRINH = 15;

/**
 * The bosses, in the order a course meets them.
 *
 * Programming troubles with faces — nothing that reads as a threat to a
 * ten-year-old, and nothing named after a person.
 */
const DANH_SACH_BOSS: ReadonlyArray<{ ten: string; bieuTuong: string }> = [
  { ten: 'Bọ Bug Khổng Lồ', bieuTuong: '🐛' },
  { ten: 'Rồng Vòng Lặp', bieuTuong: '🐉' },
  { ten: 'Robot Lỗi Cú Pháp', bieuTuong: '🤖' },
  { ten: 'Bạch Tuộc Biến Số', bieuTuong: '🐙' },
  { ten: 'Quái Vật Mê Cung', bieuTuong: '👾' },
  { ten: 'Khổng Lồ Hàm Số', bieuTuong: '🗿' },
];

export function laBuoiOnTap(order: number): boolean {
  return order > 0 && order % CHANG_ON_TAP === 0;
}

export function laBuoiThuyetTrinh(order: number): boolean {
  return order > 0 && order % CHANG_THUYET_TRINH === 0;
}

function themMoc(bai: LessonSpec): LessonSpec {
  if (!laBuoiOnTap(bai.order)) return bai;

  const lanThu = bai.order / CHANG_ON_TAP - 1;
  const boss = DANH_SACH_BOSS[lanThu % DANH_SACH_BOSS.length] ?? DANH_SACH_BOSS[0]!;

  const them = [
    bossBlock({
      tenBoss: boss.ten,
      bieuTuong: boss.bieuTuong,
      tuBuoi: bai.order - CHANG_ON_TAP + 1,
      denBuoi: bai.order,
    }),
  ];

  if (laBuoiThuyetTrinh(bai.order)) {
    them.push(
      presentationBlock({ tuBuoi: bai.order - CHANG_THUYET_TRINH + 1, denBuoi: bai.order }),
    );
  }

  return { ...bai, blocks: [...bai.blocks, ...them] };
}

/** Return a copy of `khoaHoc` with the review milestones appended. */
export function apDungMocOnTap(khoaHoc: CourseSpec): CourseSpec {
  return {
    ...khoaHoc,
    modules: khoaHoc.modules.map((m) => ({ ...m, lessons: m.lessons.map(themMoc) })),
  };
}
