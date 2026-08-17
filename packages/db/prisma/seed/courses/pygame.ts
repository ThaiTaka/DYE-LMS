/**
 * Course 2 — Lập Trình Game Python / Pygame (30 buổi).
 *
 * Source: lesson plan "LẬP TRÌNH GAME PYTHON", which enumerates all five modules
 * and their lesson ranges (4 + 4 + 8 + 10 + 4 = 30). Nothing in this course is
 * derived — the breakdown comes straight from the brief.
 */
import type { CourseSpec } from '../types.ts';
import { pygameModule1, pygameModule2 } from './pygame-m1.ts';
import { pygameModule3 } from './pygame-m2.ts';
import { pygameModule4, pygameModule5 } from './pygame-m5.ts';

export const pygame: CourseSpec = {
  slug: 'lap-trinh-game-pygame',
  title: 'Lập Trình Game Python',
  subtitle: '30 buổi · Từ cửa sổ trống đến trò chơi người khác chơi được',
  description:
    'Khoá học biến kiến thức Python thành trò chơi thật. Ngay buổi đầu tiên em đã có một cửa sổ game ' +
    'của riêng mình, và mỗi buổi sau đều kết thúc bằng một thứ chạy được trên màn hình.\n\n' +
    'Em sẽ đi qua chuyển động, vật lý, va chạm, AI kẻ địch, camera và giao diện — rồi ghép tất cả ' +
    'thành ba trò chơi hoàn chỉnh ở ba buổi tổng hợp. Cuối khoá, em chọn một dự án cá nhân ' +
    '(Space Invaders, Platformer, Pong, Maze hoặc Quiz GUI), hoàn thiện nó và trình bày trước lớp.',
  totalSessions: 30,
  order: 2,
  colorToken: 'violet',
  iconEmoji: '🎮',
  modules: [pygameModule1, pygameModule2, pygameModule3, pygameModule4, pygameModule5],
};
