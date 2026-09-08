import { apDungBoSung } from './bo-sung/ap-dung.ts';
import {
  boSungMicrobit,
  boSungPygame,
  boSungPythonCoBan,
  boSungPythonNangCao,
} from './bo-sung/index.ts';
import { microbitCoBan } from './microbit-co-ban.ts';
import { pygame } from './pygame.ts';
import { pythonCoBan } from './python-co-ban.ts';
import { pythonNangCao } from './python-nang-cao.ts';

import type { CourseSpec } from '../types.ts';

/**
 * The full DYE curriculum. Order matters — it is the order courses appear to
 * students, and matches CourseSpec.order.
 *
 * Each course is the authored lesson plan with the expansion pack merged on top;
 * see ./bo-sung/ap-dung.ts for why the extra practice lives beside the plan
 * rather than inside it. `assertCurriculumCompliance` runs on the merged result,
 * so nothing gains an exemption by arriving this way.
 */
export const allCourses: CourseSpec[] = [
  apDungBoSung(pythonCoBan, boSungPythonCoBan),
  apDungBoSung(pygame, boSungPygame),
  apDungBoSung(pythonNangCao, boSungPythonNangCao),
  apDungBoSung(microbitCoBan, boSungMicrobit),
];
