import 'server-only';

import { revalidatePath } from 'next/cache';

/**
 * Re-read every page that shows progress, once a block has been completed.
 *
 * Everything that says "done" — the ✓ on the block header, the "Phần bắt buộc"
 * bar, the next-lesson unlock on the course map, the course cards on the
 * dashboard — is a server component reading BlockProgress / LessonProgress.
 * Those rows are written by whichever path completed the block: the judge
 * worker in ANOTHER PROCESS, a server action, or the .hex route handler. None
 * of them can tell the App Router that a rendered tree has gone stale, and
 * the router keeps handing out what it has.
 *
 * `revalidatePath` is the one signal that reaches every cache at once. From a
 * server action the server re-renders the current page in THAT response; from
 * a route handler the client follows up with `router.refresh()` and gets a
 * fresh tree because the cached one was dropped here. Either way the course
 * map and the dashboard are fetched fresh on the next navigation, including
 * Back.
 *
 * Route patterns rather than concrete slugs, as everywhere else in this app:
 * the caller holds a block id, not the lesson's URL, and the pattern form
 * covers every lesson at once. The course map is revalidated as a layout so
 * anything rendered beneath it is included.
 *
 * Shared between `code-actions.ts` and `lib/nop-hex.ts` so the list of pages
 * that show progress lives in exactly one place and cannot drift.
 */
export function lamMoiTrangTienDo(): void {
  revalidatePath('/bai-hoc/[slug]', 'page');
  revalidatePath('/khoa-hoc/[slug]', 'layout');
  revalidatePath('/bang-dieu-khien');
}
