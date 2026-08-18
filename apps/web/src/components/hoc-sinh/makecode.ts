/**
 * The MakeCode iframe controller protocol.
 *
 * ── What this is ─────────────────────────────────────────────────────────────
 * MakeCode exposes an embedding API: load the editor in an iframe with
 * `controller=1`, and talk to it with `postMessage`. The editor announces itself,
 * the host sends requests, the editor answers with a matching `id`.
 *
 * ── Why the protocol lives in its own module ─────────────────────────────────
 * Everything here is a pure function over message objects, so the parts that are
 * easy to get wrong — accepting a message from the wrong origin, mismatching a
 * response to its request — are testable without a browser, an iframe, or a
 * network round trip to makecode.microbit.org.
 *
 * ── The origin check is the security boundary ────────────────────────────────
 * `window.addEventListener('message')` receives from ANY origin. A page that
 * acts on `event.data` without checking `event.origin` is taking instructions
 * from whoever managed to get a frame or a popup onto the page. Every inbound
 * message is filtered through `laTinNhanHopLe` first.
 */

/** The only origin whose messages are ever acted on. */
export const GOC_MAKECODE = 'https://makecode.microbit.org';

/**
 * Editor URL.
 *
 * `controller=1` enables the embedding protocol. `ws=browser` keeps MakeCode's
 * own project storage in the student's browser rather than its cloud, so a
 * child's work is not silently syncing to a third party. `nocookiebanner=1`
 * removes a consent dialog that would sit on top of the workspace.
 */
export function urlMakeCode(lang = 'vi'): string {
  const p = new URLSearchParams({
    controller: '1',
    ws: 'browser',
    nocookiebanner: '1',
    lang,
  });
  return `${GOC_MAKECODE}/#editor?${p.toString()}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Message shapes
// ═══════════════════════════════════════════════════════════════════════════

/** A message the editor sends to us. */
export interface TinNhanTuEditor {
  type: string;
  action?: string;
  id?: string;
  /** Present on a response to one of our requests. */
  success?: boolean;
  resp?: unknown;
  /** Present on `workspacesave` / `workspaceloaded` style events. */
  project?: unknown;
}

/** A message we send to the editor. */
export interface TinNhanToiEditor {
  type: 'pxteditor';
  id: string;
  action: string;
  [key: string]: unknown;
}

/**
 * Is this a message we should act on?
 *
 * Two independent conditions, both required:
 *   1. It came from the MakeCode origin. Anything else is somebody else's frame.
 *   2. It looks like the protocol. A message from the right origin that is not
 *      shaped like `pxthost`/`pxteditor` traffic is not ours to interpret.
 */
export function laTinNhanHopLe(origin: string, data: unknown): data is TinNhanTuEditor {
  if (origin !== GOC_MAKECODE) return false;
  if (typeof data !== 'object' || data === null) return false;

  const t = (data as { type?: unknown }).type;
  return t === 'pxthost' || t === 'pxteditor';
}

let demId = 0;

/** Request ids are unique per page so a response can be matched to its request. */
export function idYeuCau(): string {
  demId += 1;
  return `dye-${Date.now().toString(36)}-${demId}`;
}

export function yeuCau(action: string, them: Record<string, unknown> = {}): TinNhanToiEditor {
  return { type: 'pxteditor', id: idYeuCau(), action, ...them };
}

/**
 * Pull the workspace out of whatever the editor sent back.
 *
 * MakeCode has moved this field around across versions, so several shapes are
 * accepted. Returning `null` rather than guessing matters: a wrong guess would
 * store an empty workspace over a student's real work.
 */
export function docWorkspace(data: TinNhanTuEditor): { xml: string; json: string } | null {
  const nguon = (data.resp ?? data.project) as Record<string, unknown> | undefined;
  if (!nguon || typeof nguon !== 'object') return null;

  const text = nguon['text'] as Record<string, unknown> | undefined;

  const xml =
    (typeof text?.['main.blocks'] === 'string' ? (text['main.blocks'] as string) : '') ||
    (typeof nguon['blocks'] === 'string' ? (nguon['blocks'] as string) : '');

  const json =
    typeof text?.['main.ts'] === 'string'
      ? (text['main.ts'] as string)
      : typeof nguon['source'] === 'string'
        ? (nguon['source'] as string)
        : '';

  if (!xml && !json) return null;
  return { xml, json };
}

/** Largest workspace we will accept back from the editor. */
export const GIOI_HAN_WORKSPACE = 512 * 1024;
