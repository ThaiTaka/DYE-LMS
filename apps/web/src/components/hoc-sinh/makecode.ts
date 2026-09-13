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
 * `controller=1` enables the embedding protocol. `nocookiebanner=1` removes a
 * consent dialog that would sit on top of the workspace.
 *
 * ── `ws=iframe`: the HOST is the editor's storage ────────────────────────────
 * MakeCode picks its project store from `ws`. This used to say `browser`, which
 * keeps projects in the editor's own IndexedDB — and an editor that owns its
 * storage has no reason to tell anyone when it writes. In that mode the
 * `workspacesave` event this page waits for is NEVER posted to the parent: the
 * submit path asked for a save, the editor saved to IndexedDB, and our side sat
 * out the timeout and reported "chưa đọc được khối lệnh từ trình soạn" while
 * the blocks were right there on screen. `workspaceloaded` never arrived either,
 * so a saved workspace was never put back after a reload.
 *
 * With `ws=iframe` the editor keeps projects in memory and treats the parent
 * window as the database. Every write becomes a `workspacesave` message
 * carrying the whole project, and the editor asks the host three things it
 * MUST answer (each is sent with `response: true` and awaited):
 *
 *   • `workspacesync`   on boot — "what projects do you have?" Answered with an
 *                       empty list; the editor then creates a blank project. An
 *                       unanswered sync leaves the editor on its spinner forever.
 *   • `workspaceloaded` once the editor is up — the moment to put a saved
 *                       workspace back.
 *   • `workspacereset`  if the student resets the editor.
 *
 * The student's blocks still never touch MakeCode's cloud: the only store is
 * this page, and this page saves to our own server.
 *
 * ── The parameters go in the QUERY STRING, before `#editor` ──────────────────
 * This used to build `/#editor?lang=vi`, with everything inside the fragment.
 * Two URLs that differ only in their fragment are the SAME document to a
 * browser: assigning one to an `<iframe src>` that holds the other performs a
 * fragment navigation — no reload, no `load` event. So switching the language
 * did not restart MakeCode. It fired `hashchange` inside a running editor,
 * whose router re-entered `#editor` with the old language bundle still loaded,
 * and the toolbox it had already rendered came apart. Our side then waited for
 * a `workspaceloaded` that a fragment navigation never sends.
 *
 * With `lang` in the real query string, `vi` and `en` are different documents,
 * and assigning the new `src` is a genuine navigation: MakeCode reloads with
 * the right bundle and renders its toolbox from scratch, `load` fires, and the
 * re-hydration path in khu-microbit.tsx runs exactly as designed. This is also
 * the shape MakeCode's own embedding docs use (`/?lang=xx#editor`).
 */
export function urlMakeCode(lang = 'vi'): string {
  const p = new URLSearchParams({
    controller: '1',
    ws: 'iframe',
    nocookiebanner: '1',
    lang,
  });
  return `${GOC_MAKECODE}/?${p.toString()}#editor`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Message shapes
// ═══════════════════════════════════════════════════════════════════════════

/** A message the editor sends to us. */
export interface TinNhanTuEditor {
  type: string;
  action?: string;
  id?: string;
  /**
   * The editor is waiting on an answer carrying this `id`. True on
   * `workspacesync`, `workspaceloaded` and `workspacereset`; the promise behind
   * each of them never settles until we reply.
   */
  response?: boolean;
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
  /**
   * Always asked for. The editor only posts `{ id, success }` back when this is
   * set, and that reply is what tells a waiting submit that a `saveproject`
   * has genuinely finished rather than merely been sent.
   */
  response: true;
  [key: string]: unknown;
}

/**
 * Our answer to a request the editor made with `response: true`.
 *
 * Shaped the way the editor's controller matches replies to requests: the
 * request's own `type` (`pxthost` — the editor was the requester) and its `id`.
 * A reply with any other `type` is dropped as an unknown request and the
 * editor keeps waiting.
 */
export interface TinNhanTraLoi {
  type: 'pxthost';
  id: string;
  success: boolean;
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
  return { type: 'pxteditor', id: idYeuCau(), action, response: true, ...them };
}

/** Answer an editor request. `them` carries any payload the request expects. */
export function traLoi(id: string, them: Record<string, unknown> = {}): TinNhanTraLoi {
  return { type: 'pxthost', id, success: true, ...them };
}

/**
 * The reply to `workspacesync`.
 *
 * An empty list, on purpose. The editor asks this before it has rendered
 * anything, and a project handed over here would have to be a complete
 * `pxt.workspace.Project` — header with ids and timestamps, `pxt.json`, every
 * file — built by us, from a schema that is MakeCode's to change. Instead the
 * editor makes itself a blank project from its own template, and once it says
 * `workspaceloaded` the saved blocks go in through `yeuCauNapWorkspace`.
 *
 * `controllerId` only names the host in MakeCode's telemetry.
 */
export function traLoiDongBo(id: string): TinNhanTraLoi {
  return traLoi(id, { projects: [], controllerId: 'dye-lms' });
}

/**
 * Put a saved workspace back into a freshly booted editor.
 *
 * `newproject` with `filesOverride` rather than `importproject`. An imported
 * project is installed exactly as given, so it has to carry a valid `pxt.json`
 * — dependencies, file list, preferred editor — or MakeCode loads it as an
 * invalid package and shows an empty toolbox. The earlier code sent only
 * `main.blocks`, which was never going to load; it went unnoticed because in
 * `ws=browser` mode the `workspaceloaded` that triggers it never fired.
 *
 * `newproject` builds the config from the target's OWN blocks template and lays
 * our files over it. It is the same call MakeCode makes for "import a .blocks
 * file", down to the blank `main.ts`: the editor regenerates the TypeScript
 * from the blocks the moment they load, so a stale program there could only
 * ever contradict them.
 */
export function yeuCauNapWorkspace(xml: string): TinNhanToiEditor {
  return yeuCau('newproject', {
    options: { filesOverride: { 'main.blocks': xml, 'main.ts': '  ' } },
  });
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

/**
 * Does this workspace actually contain blocks?
 *
 * ── Why `xml !== ''` was the wrong test ──────────────────────────────────────
 * An empty MakeCode workspace is NOT an empty string. It is the Blockly
 * wrapper with nothing inside it:
 *
 *     <xml xmlns="https://developers.google.com/blockly/xml"></xml>
 *
 * That is ~55 characters of perfectly truthy text, so the server's
 * `!blocksXml.trim()` check passes it and an empty workspace is accepted as a
 * real submission. The reverse mistake is worse and is the one students hit:
 * treating an unfamiliar shape as empty would refuse work that exists.
 *
 * So this is deliberately ASYMMETRIC. It answers "no" only for shapes it
 * positively recognises as empty — the wrapper alone, or a wrapper holding
 * nothing but a variable declaration, which is not yet a program. Anything it
 * does not recognise is treated as having blocks, because refusing a child's
 * work on a guess is the failure that must never happen.
 */
export function coKhoiLenh(xml: string): boolean {
  if (!xml.trim()) return false;

  const ruot = xml
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  if (!ruot) return false;

  // <xml ... /> — unambiguously nothing.
  if (/^<xml\b[^>]*\/>$/.test(ruot)) return false;

  const khop = /^<xml\b[^>]*>([\s\S]*)<\/xml>$/.exec(ruot);
  // Not wrapper-shaped. Unrecognised, so assume it is real work.
  if (!khop) return true;

  const trong = (khop[1] ?? '')
    // A `<variables>` element is bookkeeping MakeCode writes on its own; a
    // workspace holding only that has had nothing dragged into it yet.
    .replace(/<variables\b[^>]*\/>/g, '')
    .replace(/<variables\b[^>]*>[\s\S]*?<\/variables>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  return trong.length > 0;
}

/**
 * A compact, safe description of an inbound message, for the console.
 *
 * Never the raw payload: a workspace runs to hundreds of kilobytes and dumping
 * it makes the console useless exactly when someone is trying to read it. What
 * actually answers "why did the submission come out empty" is which fields
 * arrived and how big `main.blocks` was — so that is what this reports.
 */
export function tomTatTinNhan(data: TinNhanTuEditor): Record<string, unknown> {
  const nguon = (data.resp ?? data.project) as Record<string, unknown> | undefined;
  const text = nguon?.['text'] as Record<string, unknown> | undefined;
  const xml = typeof text?.['main.blocks'] === 'string' ? (text['main.blocks'] as string) : null;

  return {
    type: data.type,
    action: data.action ?? null,
    id: data.id ?? null,
    success: data.success ?? null,
    coResp: data.resp !== undefined,
    coProject: data.project !== undefined,
    cacTep: text ? Object.keys(text) : null,
    soKyTuXml: xml === null ? null : xml.length,
    dauXml: xml === null ? null : xml.slice(0, 120),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// One live editor per page
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Why a page may hold only ONE MakeCode editor.
 *
 * This registry was born when the editor ran with `ws=browser`. That mode keeps
 * projects in the editor's own IndexedDB behind a session the editor claims on
 * boot; a second editor on the same page claimed the same session, and every
 * earlier instance then failed its next storage read with:
 *
 *     pxtapp.js: Uncaught (in promise) Error: trying to access outdated session
 *
 * which the editor surfaced as its own crash screen — "Rất tiếc, chúng tôi phát
 * hiện có lỗi" — sitting inside our lesson page. Micro:bit Buổi 1 ships ten
 * hardware tasks, so ten editors booted at once and nine were guaranteed to
 * break.
 *
 * With `ws=iframe` there is no shared session — each frame keeps its projects
 * in its own memory and talks only to this page — so that crash is gone. The
 * registry stays for the other reason it was worth having: ten frames meant ten
 * copies of a ~10 MB third-party app on a school laptop that has to survive a
 * whole lesson, and ten `message` listeners all answering the same
 * `workspacesync`. At most one component holds the editor; the others render a
 * placeholder and can take it over.
 *
 * Module scope, not React state, on purpose: ownership is a property of the
 * PAGE, and the components competing for it are siblings with no shared parent
 * that could hold it.
 */
let chuSoHuu: string | null = null;

const nguoiTheoDoi = new Set<(chu: string | null) => void>();

function baoMoiNguoi(): void {
  for (const fn of nguoiTheoDoi) fn(chuSoHuu);
}

/** Subscribe to ownership changes. Returns its own unsubscribe. */
export function theoDoiChuEditor(fn: (chu: string | null) => void): () => void {
  nguoiTheoDoi.add(fn);
  return () => {
    nguoiTheoDoi.delete(fn);
  };
}

export function dangGiuEditor(): string | null {
  return chuSoHuu;
}

/**
 * Claim the editor for `id`, displacing whoever holds it.
 *
 * Idempotent: claiming twice with the same id is a no-op and notifies nobody,
 * which matters because React Strict Mode runs mount effects twice in
 * development and would otherwise produce a claim/release/claim flicker.
 */
export function giuEditor(id: string): void {
  if (chuSoHuu === id) return;
  chuSoHuu = id;
  baoMoiNguoi();
}

/**
 * Release the editor — but only if `id` still holds it.
 *
 * The guard is what makes Strict Mode's double-invoked cleanup safe: by the
 * time a displaced component runs its teardown, someone else may already own
 * the editor, and an unguarded release would tear down the NEW owner's frame.
 */
export function traEditor(id: string): void {
  if (chuSoHuu !== id) return;
  chuSoHuu = null;
  baoMoiNguoi();
}
