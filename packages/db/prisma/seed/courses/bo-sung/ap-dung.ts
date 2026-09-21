/**
 * Merging the expansion pack into the authored curriculum.
 *
 * ── Why a merge rather than editing the lesson files ─────────────────────────
 * The files under ../ are the lesson plan transcribed. They carry the teacher's
 * notes verbatim and the reasoning for each ordering decision, and they are read
 * by a human deciding what to teach on Tuesday. Threading two hundred generated
 * exercises through twenty of them would bury that.
 *
 * So the expansion lives beside it, keyed by lesson slug, and is applied here.
 * `assertCurriculumCompliance` runs on the RESULT, so nothing is exempted by
 * being added this way — the merged course is held to every rule the authored
 * one is.
 *
 * ── The flow rule is enforced structurally, not by hoping ────────────────────
 * `assertPedagogicalFlow` forbids a lesson going THEORY -> assessment with no
 * interactive example or playground in between. Appending to a lesson that
 * already has an assessment is always safe: the FIRST assessment does not move,
 * so whatever satisfied the rule before still does.
 *
 * The dangerous case is a lesson that is currently pure theory. Appending a
 * challenge there makes that challenge the first assessment, with nothing
 * hands-on before it. Rather than leave that to authoring discipline across two
 * hundred entries, `apDungBoSung` detects it and inserts the supplied warm-up
 * playground first. A missing warm-up is a loud error here rather than a
 * CurriculumViolation later.
 */
import type { BlockSpec, CourseSpec, LessonSpec } from '../../types.ts';

/** Blocks to append to one lesson, keyed by lesson slug. */
export interface BoSungBaiHoc {
  /**
   * Warm-up inserted only when the lesson has no hands-on block before its first
   * assessment. Required whenever `khoi` contains an assessment block and the
   * lesson is otherwise theory-only.
   *
   * Must not be a Python workspace in a Micro:bit session — `apDungChoBai`
   * throws on that. `example()` suits either kind and is the safe default.
   */
  khoiDong?: BlockSpec;
  /** The new blocks, appended in order. */
  khoi: BlockSpec[];
}

export type BoSungKhoaHoc = Record<string, BoSungBaiHoc>;

const DANH_GIA: ReadonlySet<string> = new Set([
  'QUIZ',
  'MINI_CHALLENGE',
  'CODING',
  'MICROBIT_WORKSPACE',
  'MULTIPLE_CHOICE',
  'FILL_IN_BLANK',
]);

const THUC_HANH: ReadonlySet<string> = new Set(['INTERACTIVE_EXAMPLE', 'PLAYGROUND', 'PROJECT']);

/**
 * Block kinds the lesson player renders as the CodeMirror PYTHON editor.
 *
 * Kept here as well as in assertions.ts because this file is the one place
 * that can put a block into a lesson the lesson's own author never wrote.
 */
const KHU_PYTHON: ReadonlySet<string> = new Set(['PLAYGROUND', 'MINI_CHALLENGE', 'CODING']);

/** Would this block list trip `assertPedagogicalFlow`? */
function viPhamLuongDay(khoi: BlockSpec[]): boolean {
  if (!khoi.some((b) => b.type === 'THEORY')) return false;
  const dau = khoi.findIndex((b) => DANH_GIA.has(b.type));
  if (dau === -1) return false;
  return !khoi.slice(0, dau).some((b) => THUC_HANH.has(b.type));
}

function apDungChoBai(bai: LessonSpec, them: BoSungBaiHoc): LessonSpec {
  let khoi = [...bai.blocks, ...them.khoi];

  if (viPhamLuongDay(khoi)) {
    if (!them.khoiDong) {
      throw new Error(
        `bo-sung/${bai.slug}: bai nay chua co khoi thuc hanh nao truoc phan danh gia, ` +
          'nen phai khai bao `khoiDong` (mot khoi khoi dong) trong ban bo sung.',
      );
    }

    /*
     * A Micro:bit session may not be warmed up with a Python editor.
     *
     * This is the one place a block can arrive in a lesson without its author
     * choosing it — `khoiDong` is declared by the expansion pack and inserted
     * here — so it is the one place that can put a Python editor beside a
     * MakeCode workspace without anyone writing that down. No expansion
     * declares a `khoiDong` today, which is exactly why this needs to be a
     * thrown error rather than a note: the first one that does would otherwise
     * reintroduce the two-workspace bug silently, in a lesson nobody edited.
     *
     * An `example()` (INTERACTIVE_EXAMPLE) is the warm-up that works for both
     * kinds of session — it renders a static snippet, not an editor — so there
     * is always a correct answer available to the author this refuses.
     */
    const laBuoiMicrobit = khoi.some((b) => b.type === 'MICROBIT_WORKSPACE');
    if (laBuoiMicrobit && KHU_PYTHON.has(them.khoiDong.type)) {
      throw new Error(
        `bo-sung/${bai.slug}: khoi khoi dong la ${them.khoiDong.type}, ma day la buoi ` +
          'Micro:bit. Khoi do se mo khung soan thao Python ngay canh khu MakeCode, ' +
          'nen hoc sinh khong biet lam bai o dau. Dung example() hoac theory() thay the.',
      );
    }

    // Inserted before the appended blocks, not at the very front: the lesson's
    // own theory should still be read first.
    khoi = [...bai.blocks, them.khoiDong, ...them.khoi];
  }

  return { ...bai, blocks: khoi };
}

/**
 * Return a copy of `khoaHoc` with the expansion applied.
 *
 * A slug in `boSung` that matches no lesson is thrown rather than ignored: a
 * typo would otherwise silently drop a lesson's entire expansion, and the only
 * symptom would be one lesson quietly staying short.
 */
export function apDungBoSung(khoaHoc: CourseSpec, boSung: BoSungKhoaHoc): CourseSpec {
  const coSlug = new Set(khoaHoc.modules.flatMap((m) => m.lessons.map((l) => l.slug)));
  for (const slug of Object.keys(boSung)) {
    if (!coSlug.has(slug)) {
      throw new Error(`bo-sung: khong co bai hoc nao ten "${slug}" trong ${khoaHoc.slug}`);
    }
  }

  return {
    ...khoaHoc,
    modules: khoaHoc.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => {
        const them = boSung[l.slug];
        return them ? apDungChoBai(l, them) : l;
      }),
    })),
  };
}
