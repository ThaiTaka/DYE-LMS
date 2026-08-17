/**
 * Gamification: badges.
 *
 * Deliberately bounded (brief §E): achievements celebrate effort and progress.
 * There is no badge for being faster than a classmate, no public ranking, and
 * nothing that frames a student negatively.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

interface BadgeSpec {
  slug: string;
  name: string;
  description: string;
  iconEmoji: string;
  /** Machine-readable award rule, evaluated by @dye/core in Phase 4. */
  criteria: { type: string; count: number };
}

export const BADGES: BadgeSpec[] = [
  {
    slug: 'buoc-dau-tien',
    name: 'Bước đầu tiên',
    description: 'Hoàn thành bài học đầu tiên của em.',
    iconEmoji: '🌱',
    criteria: { type: 'lessons_completed', count: 1 },
  },
  {
    slug: 'kien-tri',
    name: 'Kiên trì',
    description: 'Hoàn thành 5 bài học.',
    iconEmoji: '🌿',
    criteria: { type: 'lessons_completed', count: 5 },
  },
  {
    slug: 'vung-nen-tang',
    name: 'Vững nền tảng',
    description: 'Hoàn thành 15 bài học.',
    iconEmoji: '🌳',
    criteria: { type: 'lessons_completed', count: 15 },
  },
  {
    slug: 'hoan-thanh-khoa-hoc',
    name: 'Hoàn thành khoá học',
    description: 'Hoàn thành mọi bài học bắt buộc được giao cho em.',
    iconEmoji: '🏅',
    criteria: { type: 'course_completed', count: 1 },
  },
  {
    slug: 'lap-trinh-vien-nhi',
    name: 'Lập trình viên nhí',
    description: 'Nộp thành công bài lập trình đầu tiên.',
    iconEmoji: '💻',
    criteria: { type: 'submissions_accepted', count: 1 },
  },
  {
    slug: 'go-loi-cao-thu',
    name: 'Cao thủ gỡ lỗi',
    description: 'Sửa một bài từ sai thành đúng — kiên nhẫn là kỹ năng.',
    iconEmoji: '🔧',
    criteria: { type: 'fixed_after_wrong', count: 1 },
  },
  {
    slug: 'giai-10-bai',
    name: 'Mười bài đã qua',
    description: 'Giải đúng 10 bài lập trình.',
    iconEmoji: '⭐',
    criteria: { type: 'submissions_accepted', count: 10 },
  },
  {
    slug: 'nha-tham-hiem',
    name: 'Nhà thám hiểm',
    description: 'Thử một bài ở mức Nâng cao hoặc Mở rộng.',
    iconEmoji: '🧭',
    criteria: { type: 'advanced_attempted', count: 1 },
  },
  {
    slug: 'chuoi-3-ngay',
    name: 'Ba ngày liên tiếp',
    description: 'Học ba ngày liên tiếp.',
    iconEmoji: '🔥',
    criteria: { type: 'streak_days', count: 3 },
  },
  {
    slug: 'nha-lam-game',
    name: 'Nhà làm game',
    description: 'Nộp dự án game đầu tiên của em.',
    iconEmoji: '🎮',
    criteria: { type: 'project_submitted', count: 1 },
  },
  {
    slug: 'kien-truc-su',
    name: 'Kiến trúc sư',
    description: 'Hoàn thành một dự án mô hình hoá bằng OOP.',
    iconEmoji: '🏛️',
    criteria: { type: 'oop_project_completed', count: 1 },
  },
  {
    slug: 'toi-uu-hoa',
    name: 'Người tối ưu',
    description: 'Vượt qua một Thử thách hiệu năng Big-O.',
    iconEmoji: '📈',
    criteria: { type: 'performance_challenge_passed', count: 1 },
  },
];

export async function seedBadges(db: PrismaClient): Promise<number> {
  for (const badge of BADGES) {
    const data = {
      name: badge.name,
      description: badge.description,
      iconEmoji: badge.iconEmoji,
      criteria: { ...badge.criteria } satisfies Prisma.InputJsonValue,
    };
    await db.badge.upsert({
      where: { slug: badge.slug },
      create: { slug: badge.slug, ...data },
      update: data,
    });
  }
  return BADGES.length;
}
