/**
 * Parsing lesson block content out of JSONB.
 *
 * `LessonBlock.content` is `Json`, so at the type level it is `unknown`. These
 * guards turn it into a discriminated union before any component touches it.
 *
 * The parser is total: unrecognised or malformed content becomes a `khong-doc-duoc`
 * variant rather than throwing. A single bad row authored in the Phase 6 editor
 * must degrade one block, never blank out an entire lesson for a student.
 */

export interface NoiDungLyThuyet {
  kind: 'theory';
  markdown: string;
  keyPoints: string[];
}

export interface NoiDungViDu {
  kind: 'example';
  markdown: string;
  code: string;
  output: string | null;
  notes: string[];
}

export interface NoiDungSanChoi {
  kind: 'playground';
  markdown: string;
  starterCode: string;
  goal: string;
}

export interface NoiDungThuThach {
  kind: 'challenge';
  markdown: string;
}

/** Micro:bit block workspace, edited in the embedded MakeCode editor. */
export interface NoiDungMicrobit {
  kind: 'microbit';
  markdown: string;
  goal: string;
  /** Seeds the editor with a starting arrangement. Empty means a blank workspace. */
  blocksXml: string;
  /** MakeCode blocks this task is about, shown as a reference strip. */
  khoiLenh: string[];
}

export interface NoiDungTracNghiem {
  kind: 'quiz';
  markdown: string;
}

export interface NoiDungVideo {
  kind: 'video';
  url: string;
  durationSec: number;
  markdown: string | null;
}

export interface NoiDungSuyNgam {
  kind: 'reflection';
  prompt: string;
}

export interface NoiDungTaiNguyen {
  kind: 'resource';
  links: Array<{ label: string; url: string }>;
}

export interface NoiDungDuAn {
  kind: 'project';
  markdown: string;
  template: string;
  milestones: string[];
}

export interface NoiDungKhongDocDuoc {
  kind: 'khong-doc-duoc';
}

export type NoiDungKhoi =
  | NoiDungLyThuyet
  | NoiDungViDu
  | NoiDungSanChoi
  | NoiDungThuThach
  | NoiDungMicrobit
  | NoiDungTracNghiem
  | NoiDungVideo
  | NoiDungSuyNgam
  | NoiDungTaiNguyen
  | NoiDungDuAn
  | NoiDungKhongDocDuoc;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/** Only these schemes are allowed through to an href. */
const SAFE_SCHEME = /^(https?:\/\/|\/|#)/i;

export function parseNoiDung(raw: unknown): NoiDungKhoi {
  if (!isRecord(raw)) return { kind: 'khong-doc-duoc' };

  switch (raw['kind']) {
    case 'theory':
      return {
        kind: 'theory',
        markdown: str(raw['markdown']),
        keyPoints: strList(raw['keyPoints']),
      };

    case 'example':
      return {
        kind: 'example',
        markdown: str(raw['markdown']),
        code: str(raw['code']),
        output: typeof raw['output'] === 'string' ? raw['output'] : null,
        notes: strList(raw['notes']),
      };

    case 'playground':
      return {
        kind: 'playground',
        markdown: str(raw['markdown']),
        starterCode: str(raw['starterCode']),
        goal: str(raw['goal']),
      };

    case 'challenge':
      return { kind: 'challenge', markdown: str(raw['markdown']) };

    case 'microbit':
      return {
        kind: 'microbit',
        markdown: str(raw['markdown']),
        goal: str(raw['goal']),
        blocksXml: typeof raw['blocksXml'] === 'string' ? raw['blocksXml'] : '',
        khoiLenh: Array.isArray(raw['khoiLenh'])
          ? raw['khoiLenh'].filter((k): k is string => typeof k === 'string')
          : [],
      };

    case 'quiz':
      return { kind: 'quiz', markdown: str(raw['markdown']) };

    case 'video':
      return {
        kind: 'video',
        url: SAFE_SCHEME.test(str(raw['url'])) ? str(raw['url']) : '',
        durationSec: typeof raw['durationSec'] === 'number' ? raw['durationSec'] : 0,
        markdown: typeof raw['markdown'] === 'string' ? raw['markdown'] : null,
      };

    case 'reflection':
      return { kind: 'reflection', prompt: str(raw['prompt']) };

    case 'resource': {
      const rawLinks = Array.isArray(raw['links']) ? raw['links'] : [];
      return {
        kind: 'resource',
        links: rawLinks
          .filter(isRecord)
          .map((l) => ({ label: str(l['label']), url: str(l['url']) }))
          // Drop anything with an unsafe or empty target rather than rendering
          // a link a student could click into a javascript: URL.
          .filter((l) => l.label !== '' && SAFE_SCHEME.test(l.url)),
      };
    }

    case 'project':
      return {
        kind: 'project',
        markdown: str(raw['markdown']),
        template: str(raw['template'], 'CUSTOM'),
        milestones: strList(raw['milestones']),
      };

    default:
      return { kind: 'khong-doc-duoc' };
  }
}
