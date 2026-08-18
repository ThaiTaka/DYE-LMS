/**
 * The in-container test driver, as a Python source string.
 *
 * ── Why not just run pytest ──────────────────────────────────────────────────
 * Most seeded suites are plain `test_*` functions with bare `assert`, and those
 * run fine here with no dependency at all. Problems that genuinely use pytest
 * features (fixtures, parametrize) declare `runtimeImage: PY_TEST` and get the
 * image that has pytest installed; this driver handles the rest on the base
 * image.
 *
 * ── Why the output is JSON on a sentinel line ────────────────────────────────
 * The student's own code can print anything, including something that looks
 * like our results. Everything the driver emits goes after a sentinel that
 * includes a per-run nonce, and the worker reads only the last such line, so
 * output written by the student cannot forge a passing result.
 */

/** Emitted before the JSON payload. The nonce is substituted per run. */
export const MOC_KET_QUA = '__DYE_KET_QUA__';

/**
 * Build the driver source for one run.
 *
 * `nonce` must be unpredictable per submission — it is what makes the sentinel
 * unforgeable by the code under test.
 */
export function dungDriver(nonce: string): string {
  return `
import json, sys, traceback, importlib, inspect

def _dye_main():
    ket = {"tests": [], "loi_nap": None}
    try:
        mod = importlib.import_module("test_bai")
    except BaseException:
        ket["loi_nap"] = traceback.format_exc(limit=6)
        _dye_emit(ket)
        return

    ten_ham = [n for n in dir(mod) if n.startswith("test_")]
    ten_ham.sort()

    for ten in ten_ham:
        ham = getattr(mod, ten)
        if not callable(ham):
            continue
        # Functions taking arguments need pytest fixtures; report rather than
        # crash, so one unsupported test does not void the whole suite.
        try:
            if len(inspect.signature(ham).parameters) > 0:
                ket["tests"].append({
                    "ten": ten, "dat": False, "bo_qua": True,
                    "loi": "can pytest fixture",
                })
                continue
        except (TypeError, ValueError):
            pass

        try:
            ham()
            ket["tests"].append({"ten": ten, "dat": True, "bo_qua": False, "loi": None})
        except AssertionError as e:
            ket["tests"].append({
                "ten": ten, "dat": False, "bo_qua": False,
                "loi": str(e) or "assert khong dung",
            })
        except BaseException:
            ket["tests"].append({
                "ten": ten, "dat": False, "bo_qua": False,
                "loi": traceback.format_exc(limit=4),
            })

    _dye_emit(ket)

def _dye_emit(ket):
    sys.stdout.flush()
    sys.stdout.write("\\n${MOC_KET_QUA}${nonce}" + json.dumps(ket, ensure_ascii=False) + "\\n")
    sys.stdout.flush()

_dye_main()
`.trimStart();
}

export interface KetQuaMotTest {
  ten: string;
  dat: boolean;
  bo_qua: boolean;
  loi: string | null;
}

export interface KetQuaDriver {
  tests: KetQuaMotTest[];
  loi_nap: string | null;
}

/**
 * Read the driver's JSON out of mixed stdout.
 *
 * Takes the LAST sentinel line: if a student prints something resembling the
 * marker, the driver's own line still comes after it, because the driver runs
 * to completion before emitting.
 */
export function docKetQuaDriver(stdout: string, nonce: string): KetQuaDriver | null {
  const moc = `${MOC_KET_QUA}${nonce}`;
  const dong = stdout.split('\n').filter((d) => d.startsWith(moc));
  const cuoi = dong.at(-1);
  if (!cuoi) return null;

  try {
    const parsed: unknown = JSON.parse(cuoi.slice(moc.length));
    if (typeof parsed !== 'object' || parsed === null) return null;

    const o = parsed as Record<string, unknown>;
    const tests = Array.isArray(o['tests']) ? o['tests'] : [];

    return {
      tests: tests.filter(
        (t): t is KetQuaMotTest =>
          typeof t === 'object' && t !== null && typeof (t as KetQuaMotTest).ten === 'string',
      ),
      loi_nap: typeof o['loi_nap'] === 'string' ? o['loi_nap'] : null,
    };
  } catch {
    return null;
  }
}

/** Strip the driver's sentinel lines from what a student would be shown. */
export function boMocKetQua(stdout: string, nonce: string): string {
  const moc = `${MOC_KET_QUA}${nonce}`;
  return stdout
    .split('\n')
    .filter((d) => !d.startsWith(moc))
    .join('\n');
}
