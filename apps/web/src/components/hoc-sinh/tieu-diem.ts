/**
 * Where did focus go?
 *
 * ── The false positive this exists for ───────────────────────────────────────
 * The MakeCode editor is a cross-origin iframe. The moment a student clicks a
 * block inside it, focus moves into the frame and the PARENT window fires
 * `blur` — byte-for-byte the same event as switching to another app. Both the
 * lesson tracker and the exam lockdown hook listened to that event and counted
 * it as leaving, so a child dragging blocks was being reported to their
 * teacher, and, once the lockdown could zero a lesson, being zeroed for doing
 * the lesson.
 *
 * ── What is knowable across the origin boundary ──────────────────────────────
 * Nothing about the frame's inside. But the frame ELEMENT is ours, and when
 * focus is inside a frame the parent document's `activeElement` is that
 * element. That is the one signal that separates "clicked into the editor"
 * from "went somewhere else", and it is the whole check.
 *
 * ── Why it must be read after a tick ─────────────────────────────────────────
 * The focus update steps fire `blur` on the old chain BEFORE the new focused
 * area is set. Read synchronously inside the `blur` handler, `activeElement` is
 * still the old element (or `body`), and the check silently never matches. So
 * a caller must defer — a zero-delay timer is enough — and only then ask.
 */
export function dangTrongIframe(): boolean {
  return document.activeElement?.tagName === 'IFRAME';
}
