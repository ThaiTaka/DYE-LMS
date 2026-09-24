import { apDungBoSung } from './bo-sung/ap-dung.ts';
import {
  boSungMicrobit,
  boSungPygame,
  boSungPythonCoBan,
  boSungPythonNangCao,
} from './bo-sung/index.ts';
import { microbitCoBan } from './microbit-co-ban.ts';
import { apDungMocOnTap } from './moc-on-tap.ts';
import { pygame } from './pygame.ts';
import { pythonCoBan } from './python-co-ban.ts';
import { pythonNangCao } from './python-nang-cao.ts';

import type { CourseSpec } from '../types.ts';

/**
 * The full DYE curriculum. Order matters — it is the order courses appear to
 * students, and matches CourseSpec.order.
 *
 * Each course is the authored lesson plan with the expansion pack merged on top
 * (see ./bo-sung/ap-dung.ts for why the extra practice lives beside the plan
 * rather than inside it), then the review milestones appended by rule — a boss
 * fight every 5th session, a presentation every 15th (./moc-on-tap.ts).
 * Milestones go LAST so they close the session after any expansion blocks.
 * `assertCurriculumCompliance` runs on the merged result, so nothing gains an
 * exemption by arriving this way.
 */
export const allCourses: CourseSpec[] = [
  apDungMocOnTap(apDungBoSung(pythonCoBan, boSungPythonCoBan)),
  apDungMocOnTap(apDungBoSung(pygame, boSungPygame)),
  apDungMocOnTap(apDungBoSung(pythonNangCao, boSungPythonNangCao)),
  apDungMocOnTap(apDungBoSung(microbitCoBan, boSungMicrobit)),
];
