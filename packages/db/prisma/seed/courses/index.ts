import type { CourseSpec } from '../types.ts';
import { pygame } from './pygame.ts';
import { pythonCoBan } from './python-co-ban.ts';
import { pythonNangCao } from './python-nang-cao.ts';

/**
 * The full DYE curriculum. Order matters — it is the order courses appear to
 * students, and matches CourseSpec.order.
 */
export const allCourses: CourseSpec[] = [pythonCoBan, pygame, pythonNangCao];
