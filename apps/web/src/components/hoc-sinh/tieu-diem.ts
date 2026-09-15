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
 * The lesson tracker (theo-doi-tap-trung.tsx) has since stopped listening to
 * `blur` altogether — see its header for the list of innocent things that
 * fire it. This check now serves the exam room's lockdown hook, where the
 * page is fullscreen and a window taking focus is a more meaningful signal.
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

// ═══════════════════════════════════════════════════════════════════════════
// The OS file picker
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Is a native file dialog open on top of the page right now?
 *
 * ── The false positive this exists for ───────────────────────────────────────
 * "Nộp tệp .hex" opens the operating system's file picker. On a desktop that
 * takes focus from the window; on Android it is a separate activity that
 * covers the tab, and Chrome fires `visibilitychange → hidden` for it. Either
 * way the student has not gone anywhere — they are choosing the file the page
 * asked them for — and the lesson tracker must not count it.
 *
 * ── Why a module-level flag ──────────────────────────────────────────────────
 * The upload component and the tracker are siblings that do not know about
 * each other, and threading a prop between them would couple the lesson page
 * to the one block type that has a picker. A flag read at event time, like
 * `dangTrongIframe` above, keeps both sides ignorant of each other.
 *
 * ── How it clears itself ─────────────────────────────────────────────────────
 * The picker closing hands focus back to the window (desktop) or shows the tab
 * again (mobile) — those are the two signals `batDauChonTep` waits for, and
 * either one ends the pause. The upload component also ends it explicitly on
 * `change` and `cancel`, so a browser that fires neither of the window-level
 * events still cannot leave the tracker switched off for the rest of the page.
 */
let dangChonTep = false;
/** Removes the listeners the current pause installed. Null when not paused. */
let goListener: (() => void) | null = null;

export function dangMoHopChonTep(): boolean {
  return dangChonTep;
}

/** Call from the picker's `click`, BEFORE the dialog opens. */
export function batDauChonTep(): void {
  if (typeof window === 'undefined') return;
  ketThucChonTep();
  dangChonTep = true;

  const onFocus = (): void => ketThucChonTep();
  const onVisible = (): void => {
    if (document.visibilityState === 'visible') ketThucChonTep();
  };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);
  goListener = () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Idempotent; safe to call when no pause is in force. */
export function ketThucChonTep(): void {
  dangChonTep = false;
  goListener?.();
  goListener = null;
}
