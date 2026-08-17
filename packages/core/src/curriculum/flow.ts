/**
 * Lesson flow validation.
 *
 * The brief forbids the "PDF → Next → Quiz" shape outright. The mandated
 * sequence is:
 *
 *     Theory → Interactive Example → Code Playground → Mini Challenge
 *
 * The seed enforces this at build time. This module enforces it at RUNTIME, so
 * the Phase 6 curriculum editor cannot save a lesson that violates it either.
 * One rule, two enforcement points, no way around it.
 */
import type { BlockType } from '@prisma/client';

/** Blocks that assess a student. */
const ASSESSMENT: ReadonlySet<BlockType> = new Set<BlockType>([
  'QUIZ',
  'MINI_CHALLENGE',
  'CODING',
]);

/** Blocks where a student does something rather than reads something. */
const HANDS_ON: ReadonlySet<BlockType> = new Set<BlockType>([
  'INTERACTIVE_EXAMPLE',
  'PLAYGROUND',
  'PROJECT',
]);

export interface FlowBlock {
  order: number;
  type: BlockType;
  title?: string;
}

export interface FlowViolation {
  code: 'theory-then-assessment' | 'empty-lesson' | 'duplicate-order';
  message: string;
  blockOrder?: number;
}

export interface FlowResult {
  valid: boolean;
  violations: FlowViolation[];
}

/**
 * Check one lesson's block sequence.
 *
 * Returns violations rather than throwing, so an editor can show every problem
 * at once instead of making the teacher fix them one at a time.
 */
export function validateLessonFlow(blocks: readonly FlowBlock[]): FlowResult {
  const violations: FlowViolation[] = [];

  if (blocks.length === 0) {
    violations.push({
      code: 'empty-lesson',
      message: 'Bài học chưa có khối nội dung nào.',
    });
    return { valid: false, violations };
  }

  const seen = new Set<number>();
  for (const block of blocks) {
    if (seen.has(block.order)) {
      violations.push({
        code: 'duplicate-order',
        message: `Có hai khối cùng vị trí ${block.order}.`,
        blockOrder: block.order,
      });
    }
    seen.add(block.order);
  }

  const ordered = [...blocks].sort((a, b) => a.order - b.order);

  // The rule only applies to lessons that actually teach something. A pure
  // practice session with no THEORY block is a legitimate shape.
  const hasTheory = ordered.some((b) => b.type === 'THEORY');
  if (hasTheory) {
    const firstAssessment = ordered.findIndex((b) => ASSESSMENT.has(b.type));

    if (firstAssessment !== -1) {
      const handsOnBefore = ordered.slice(0, firstAssessment).some((b) => HANDS_ON.has(b.type));

      if (!handsOnBefore) {
        const offender = ordered[firstAssessment];
        violations.push({
          code: 'theory-then-assessment',
          message:
            `Bài học đi thẳng từ Lý thuyết sang ${offender?.type ?? 'phần kiểm tra'} ` +
            'mà không có Ví dụ tương tác hoặc Sân chơi Code ở giữa. ' +
            'Luồng bắt buộc: Lý thuyết → Ví dụ tương tác → Sân chơi Code → Thử thách.',
          ...(offender ? { blockOrder: offender.order } : {}),
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * The canonical step rail shown to a student.
 *
 * Groups the block sequence into the four named stages so the UI can render
 * "Where am I?" without re-deriving the pedagogy from block types.
 */
export type FlowStage = 'LY_THUYET' | 'VI_DU' | 'SAN_CHOI' | 'THU_THACH' | 'KHAC';

export const STAGE_LABEL: Record<FlowStage, string> = {
  LY_THUYET: 'Lý thuyết',
  VI_DU: 'Ví dụ tương tác',
  SAN_CHOI: 'Sân chơi Code',
  THU_THACH: 'Thử thách',
  KHAC: 'Khác',
};

export function stageOf(type: BlockType): FlowStage {
  switch (type) {
    case 'THEORY':
      return 'LY_THUYET';
    case 'INTERACTIVE_EXAMPLE':
    case 'VIDEO':
      return 'VI_DU';
    case 'PLAYGROUND':
      return 'SAN_CHOI';
    case 'MINI_CHALLENGE':
    case 'CODING':
    case 'QUIZ':
    case 'PROJECT':
      return 'THU_THACH';
    case 'REFLECTION':
    case 'RESOURCE':
      return 'KHAC';
    default: {
      // Exhaustiveness guard: a new BlockType must be classified deliberately.
      const unreachable: never = type;
      void unreachable;
      return 'KHAC';
    }
  }
}
