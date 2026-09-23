/**
 * Visual language for the four tiers.
 *
 * Each tier is identified by an ICON as well as a colour. Colour alone would
 * exclude students with colour-vision deficiency — roughly one boy in twelve —
 * and this is the main way the interface signals difficulty.
 *
 * The wording is chosen to read as an invitation, never as a verdict. There is
 * no tier below "Cơ bản", and nothing in this file describes a student; it
 * describes the work they have been assigned.
 */
import type { BlockAccess } from '@dye/core';
import type { Tier } from '@prisma/client';

export interface KieuNhanh {
  nhan: string;
  icon: string;
  /**
   * Tailwind classes: text colour, background, border — the SOLID tier look.
   * Used where the tier is the thing being chosen (the teacher's track picker),
   * so a selected option can be unmistakable.
   */
  chu: string;
  nen: string;
  vien: string;
  /**
   * The glass pill for LABELLING a tier — dashboard cards, block headers, the
   * top bar. Same recipe as `SAC_THAI` (see sac-thai.ts): a label must never
   * outweigh the gradient button beside it. Includes the border width.
   */
  huyHieu: string;
}

export const KIEU_NHANH: Record<Tier, KieuNhanh> = {
  CO_BAN: {
    nhan: 'Cơ bản',
    icon: '🌱',
    chu: 'text-co-ban',
    nen: 'bg-co-ban-nen',
    vien: 'border-co-ban',
    huyHieu: 'border border-co-ban/25 bg-co-ban/10 text-co-ban',
  },
  THU_THACH: {
    nhan: 'Thử thách',
    icon: '⚡',
    chu: 'text-thu-thach',
    nen: 'bg-thu-thach-nen',
    vien: 'border-thu-thach',
    huyHieu: 'border border-thu-thach/25 bg-thu-thach/10 text-thu-thach',
  },
  NANG_CAO: {
    nhan: 'Nâng cao',
    icon: '🚀',
    chu: 'text-nang-cao',
    nen: 'bg-nang-cao-nen',
    vien: 'border-nang-cao',
    huyHieu: 'border border-nang-cao/25 bg-nang-cao/10 text-nang-cao',
  },
  MO_RONG: {
    nhan: 'Mở rộng',
    icon: '🌟',
    chu: 'text-mo-rong',
    nen: 'bg-mo-rong-nen',
    vien: 'border-mo-rong',
    huyHieu: 'border border-mo-rong/25 bg-mo-rong/10 text-mo-rong',
  },
};

/**
 * How a block is introduced to the student.
 *
 * EXPLORATION only appears on INTERLEAVED courses (see `Course.branching`);
 * there, the wording has to make it read as a bonus quest — something extra on
 * offer — and never as a locked door or a warning. STRICT courses, the default,
 * never show it: above-track blocks are HIDDEN and dropped before render.
 */
export const KIEU_TRUY_CAP: Record<BlockAccess, { nhan: string; icon: string; moTa: string }> = {
  REQUIRED: {
    nhan: 'Phần chính',
    icon: '📘',
    moTa: 'Nội dung của em trong bài này.',
  },
  OPTIONAL: {
    nhan: 'Làm thêm',
    icon: '➕',
    moTa: 'Bài này không bắt buộc — làm nếu em muốn luyện thêm.',
  },
  EXPLORATION: {
    nhan: 'Khám phá thêm',
    icon: '🌟',
    moTa: 'Phần thưởng dành cho bạn nào muốn thử sức. Không làm cũng không sao cả.',
  },
  // Never rendered: a HIDDEN block is dropped by `lessonView` before any page
  // sees it. Present so the map stays total over BlockAccess.
  HIDDEN: {
    nhan: 'Ẩn',
    icon: '',
    moTa: '',
  },
};
