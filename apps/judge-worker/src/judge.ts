/**
 * Judging one submission.
 *
 * ── Order of operations, and why ─────────────────────────────────────────────
 * The problem and its tests are re-read from the database on every job. The
 * queue carries only a submission id, so a tampered or stale job body cannot
 * change what runs or how it is scored.
 *
 * A submission is moved to RUNNING before the first container starts, so a
 * worker that dies mid-job leaves visible evidence rather than a row that looks
 * untouched.
 *
 * ── What a student is allowed to learn from a failure ────────────────────────
 * Sample tests teach: on failure the student sees the input, what was expected,
 * and what their program printed. Hidden tests assess: the student learns only
 * that one failed. Storing hidden inputs in the result rows would hand over the
 * assessment through the network tab.
 */
import { randomBytes } from 'node:crypto';

import { ghiNhanDatBai } from '@dye/core';

import { catBot, giaiThichLoi, laLoiCuPhap, locVetLoi, phanLoaiKetThuc } from './classify';
import { docLuat, soSanhDauRa } from './compare';
import { GIOI_HAN } from './config';
import { boMocKetQua, docKetQuaDriver, dungDriver } from './driver';
import { coBoSinh, sinhDauVao } from './generators';
import { ANH_CHAY, chayTrongHop } from './sandbox';

import type { PrismaClient, Verdict } from '@prisma/client';

export interface KetQuaCham {
  verdict: Verdict;
  score: number;
  passedTests: number;
  totalTests: number;
  maxTimeMs: number;
  /** Teacher/admin only. Never rendered to a student. */
  runnerError: string | null;
  compileError: string | null;
}

/** Clamp whatever the problem row asks for to what the worker will actually allow. */
function gioiHanThoiGian(ms: number): number {
  return Math.max(500, Math.min(ms || 2000, GIOI_HAN.THOI_GIAN_TOI_DA_MS));
}

// ═══════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════

export async function chamBai(db: PrismaClient, submissionId: string): Promise<KetQuaCham> {
  const sub = await db.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      lessonId: true,
      code: true,
      verdict: true,
      problem: {
        select: {
          id: true,
          judgeMode: true,
          runtimeImage: true,
          networkPolicy: true,
          timeLimitMs: true,
          memoryLimitMb: true,
          totalPoints: true,
          unitTestCode: true,
          authorizedBy: true,
          testCases: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              input: true,
              expectedOutput: true,
              isHidden: true,
              isSample: true,
              points: true,
              timeLimitMs: true,
              comparison: true,
              explanation: true,
            },
          },
          perfScenarios: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              order: true,
              label: true,
              n: true,
              generator: true,
              seed: true,
              maxTimeMs: true,
              expectedComplexity: true,
            },
          },
        },
      },
    },
  });

  if (!sub) throw new Error(`khong tim thay bai nop ${submissionId}`);

  const { problem } = sub;

  await db.submission.update({
    where: { id: submissionId },
    data: { verdict: 'RUNNING' },
  });

  const ketQua = await chayTheoChe(db, sub.id, sub.code, problem);

  await db.submission.update({
    where: { id: submissionId },
    data: {
      verdict: ketQua.verdict,
      score: ketQua.score,
      passedTests: ketQua.passedTests,
      totalTests: ketQua.totalTests,
      maxTimeMs: ketQua.maxTimeMs,
      compileError: ketQua.compileError,
      runnerError: ketQua.runnerError,
      judgedAt: new Date(),
    },
  });

  // Phase 4 integration: an accepted answer is what turns a challenge block
  // into progress, and progress is what unlocks the next lesson.
  if (ketQua.verdict === 'ACCEPTED') {
    // Shared with manual grading, so an accepted answer means the same thing
    // however it was reached.
    await ghiNhanDatBai(db, sub.studentId, problem.id);
  }

  return ketQua;
}

// ═══════════════════════════════════════════════════════════════════════════
// Mode dispatch
// ═══════════════════════════════════════════════════════════════════════════

async function chayTheoChe(
  db: PrismaClient,
  submissionId: string,
  code: string,
  problem: {
    id: string;
    judgeMode: string;
    runtimeImage: string;
    networkPolicy: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    totalPoints: number;
    unitTestCode: string | null;
    authorizedBy: string | null;
    testCases: Array<{
      id: string;
      order: number;
      input: string;
      expectedOutput: string;
      isHidden: boolean;
      isSample: boolean;
      points: number;
      timeLimitMs: number | null;
      comparison: unknown;
      explanation: string | null;
    }>;
    perfScenarios: Array<{
      id: string;
      order: number;
      label: string;
      n: number;
      generator: string;
      seed: number;
      maxTimeMs: number;
      expectedComplexity: string;
    }>;
  },
): Promise<KetQuaCham> {
  const trong: KetQuaCham = {
    verdict: 'INTERNAL_ERROR',
    score: 0,
    passedTests: 0,
    totalTests: 0,
    maxTimeMs: 0,
    runnerError: null,
    compileError: null,
  };

  // A problem asking for network access must carry an explicit teacher
  // authorisation. Refuse rather than quietly widening the sandbox.
  if (problem.networkPolicy !== 'NONE' && !problem.authorizedBy) {
    return {
      ...trong,
      verdict: 'SKIPPED',
      runnerError: `chinh sach mang ${problem.networkPolicy} chua duoc giao vien uy quyen`,
    };
  }

  /*
   * Micro:bit blocks are never executed here, and the check comes BEFORE the
   * runtime-image lookup because a hardware task has no container image in any
   * meaningful sense — `runtimeImage` on such a row is just its column default.
   *
   * SKIPPED rather than INTERNAL_ERROR: nothing went wrong. The program's
   * output is light on a physical LED matrix, which no container can observe,
   * so a teacher grades it by reading the block logic. Marking it WRONG_ANSWER
   * for producing no stdout would fail a student whose blocks were perfect.
   */
  if (problem.judgeMode === 'MAKECODE') {
    return {
      ...trong,
      verdict: 'SKIPPED',
      runnerError: 'MAKECODE: bai Micro:bit do giao vien cham, khong chay trong sandbox',
    };
  }

  const image = ANH_CHAY[problem.runtimeImage];
  if (!image) {
    return { ...trong, runnerError: `khong biet runtime image ${problem.runtimeImage}` };
  }

  // PY_WEB needs a loopback mock server that Phase 8 does not build. Left
  // SKIPPED and visible, rather than judged against nothing and marked wrong.
  if (problem.runtimeImage === 'PY_WEB') {
    return {
      ...trong,
      verdict: 'SKIPPED',
      runnerError: 'runtime PY_WEB chua duoc ho tro o Phase 8',
    };
  }

  switch (problem.judgeMode) {
    case 'IO_MATCH':
      return chamDoiChieuIO(db, submissionId, code, problem, image);
    case 'UNIT_TEST':
      return chamKiemThu(code, problem, image);
    case 'PERFORMANCE':
      return chamHieuNang(code, problem, image);
    case 'PROJECT_UPLOAD':
      return { ...trong, verdict: 'SKIPPED', runnerError: 'du an Pygame thuoc Phase 9' };
    case 'MAKECODE':
      // Unreachable: handled above, before the image lookup. Kept so adding a
      // mode cannot silently fall through to INTERNAL_ERROR.
      return { ...trong, verdict: 'SKIPPED', runnerError: 'MAKECODE: giao vien cham' };
    default:
      return { ...trong, runnerError: `khong biet judgeMode ${problem.judgeMode}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IO_MATCH
// ═══════════════════════════════════════════════════════════════════════════

async function chamDoiChieuIO(
  db: PrismaClient,
  submissionId: string,
  code: string,
  problem: Parameters<typeof chayTheoChe>[3],
  image: string,
): Promise<KetQuaCham> {
  const tests = problem.testCases;
  if (tests.length === 0) {
    return {
      verdict: 'INTERNAL_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: 0,
      runnerError: 'bai tap khong co ca kiem thu nao',
      compileError: null,
    };
  }

  let dat = 0;
  let diem = 0;
  let maxTimeMs = 0;
  let verdict: Verdict = 'ACCEPTED';
  let compileError: string | null = null;
  let runnerError: string | null = null;

  const ghi: Array<{
    testCaseId: string;
    verdict: Verdict;
    timeMs: number;
    stdout: string | null;
    stderr: string | null;
    friendlyError: string | null;
  }> = [];

  for (const t of tests) {
    const gioiHan = gioiHanThoiGian(t.timeLimitMs ?? problem.timeLimitMs);

    const chay = await chayTrongHop({
      tep: { 'main.py': code },
      lenh: ['python', '/sandbox/main.py'],
      stdin: t.input,
      timeLimitMs: gioiHan,
      memoryLimitMb: problem.memoryLimitMb,
      image,
    });

    maxTimeMs = Math.max(maxTimeMs, chay.thoiGianMs);

    const tuKetThuc = phanLoaiKetThuc(chay.ketThuc, chay.exitCode);
    let vTest: Verdict;
    let friendly: string | null = null;

    if (tuKetThuc === 'INTERNAL_ERROR') {
      vTest = 'INTERNAL_ERROR';
      runnerError = catBot(chay.stderr || 'khong chay duoc container');
    } else if (tuKetThuc === 'RUNTIME_ERROR' && laLoiCuPhap(chay.stderr)) {
      // A syntax error means nothing ran at all. Every remaining test would
      // report the same thing, so stop and say so once.
      vTest = 'COMPILE_ERROR';
      const g = giaiThichLoi(chay.stderr);
      compileError = catBot(locVetLoi(chay.stderr));
      friendly = g.thongDiep;
      ghi.push({
        testCaseId: t.id,
        verdict: vTest,
        timeMs: chay.thoiGianMs,
        stdout: null,
        stderr: t.isHidden ? null : catBot(locVetLoi(chay.stderr), 1024),
        friendlyError: friendly,
      });
      verdict = 'COMPILE_ERROR';
      break;
    } else if (tuKetThuc !== null) {
      vTest = tuKetThuc;
      if (tuKetThuc === 'RUNTIME_ERROR') friendly = giaiThichLoi(chay.stderr).thongDiep;
      if (tuKetThuc === 'TIME_LIMIT_EXCEEDED') {
        friendly = `Chương trình chạy quá ${gioiHan} mili giây. Em kiểm tra xem có vòng lặp nào không dừng không nhé.`;
      }
      if (tuKetThuc === 'MEMORY_LIMIT_EXCEEDED') {
        friendly = 'Chương trình dùng quá nhiều bộ nhớ. Em thử cách làm tốn ít bộ nhớ hơn nhé.';
      }
      if (tuKetThuc === 'OUTPUT_LIMIT_EXCEEDED') {
        friendly = 'Chương trình in ra quá nhiều. Có thể có một vòng lặp in mãi không dừng.';
      }
    } else {
      const ss = soSanhDauRa(chay.stdout, t.expectedOutput, docLuat(t.comparison));
      if (ss.khop) {
        vTest = 'ACCEPTED';
        dat += 1;
        diem += t.points;
      } else {
        vTest = 'WRONG_ANSWER';
        friendly = ss.chiKhacKhoangTrang
          ? 'Kết quả gần đúng rồi — chỉ khác nhau ở dấu cách hoặc dòng trống. Em kiểm tra lại cách in nhé.'
          : (t.explanation ?? null);
      }
    }

    if (vTest !== 'ACCEPTED' && verdict === 'ACCEPTED') verdict = vTest;

    ghi.push({
      testCaseId: t.id,
      verdict: vTest,
      timeMs: chay.thoiGianMs,
      // Hidden tests assess. Storing their input or the student's output for
      // them would leak the assessment through the results panel.
      stdout: t.isHidden ? null : catBot(chay.stdout, 2048),
      stderr: t.isHidden ? null : catBot(locVetLoi(chay.stderr), 1024),
      friendlyError: friendly,
    });
  }

  await luuKetQuaTest(db, submissionId, ghi);

  return {
    verdict,
    score: verdict === 'ACCEPTED' ? problem.totalPoints : diem,
    passedTests: dat,
    totalTests: tests.length,
    maxTimeMs,
    runnerError,
    compileError,
  };
}

async function luuKetQuaTest(
  db: PrismaClient,
  submissionId: string,
  ghi: Array<{
    testCaseId: string;
    verdict: Verdict;
    timeMs: number;
    stdout: string | null;
    stderr: string | null;
    friendlyError: string | null;
  }>,
): Promise<void> {
  await db.submissionTestResult.deleteMany({ where: { submissionId } });
  if (ghi.length === 0) return;

  await db.submissionTestResult.createMany({
    data: ghi.map((g) => ({ submissionId, ...g })),
    skipDuplicates: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT_TEST
// ═══════════════════════════════════════════════════════════════════════════

async function chamKiemThu(
  code: string,
  problem: Parameters<typeof chayTheoChe>[3],
  image: string,
): Promise<KetQuaCham> {
  if (!problem.unitTestCode) {
    return {
      verdict: 'INTERNAL_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: 0,
      runnerError: 'bai tap UNIT_TEST khong co unitTestCode',
      compileError: null,
    };
  }

  // Unforgeable per run: the student's own program cannot print a passing
  // result, because it cannot predict this value.
  const nonce = randomBytes(12).toString('hex');
  const gioiHan = gioiHanThoiGian(problem.timeLimitMs);

  const chay = await chayTrongHop({
    tep: {
      // The seeded suites import `from solution import ...`.
      'solution.py': code,
      'test_bai.py': problem.unitTestCode,
      '_dye_driver.py': dungDriver(nonce),
    },
    lenh: ['python', '/sandbox/_dye_driver.py'],
    timeLimitMs: gioiHan,
    memoryLimitMb: problem.memoryLimitMb,
    image,
  });

  const tuKetThuc = phanLoaiKetThuc(chay.ketThuc, chay.exitCode);

  if (tuKetThuc === 'INTERNAL_ERROR') {
    return {
      verdict: 'INTERNAL_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: chay.thoiGianMs,
      runnerError: catBot(chay.stderr || 'khong chay duoc container'),
      compileError: null,
    };
  }

  if (laLoiCuPhap(chay.stderr)) {
    return {
      verdict: 'COMPILE_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: chay.thoiGianMs,
      runnerError: null,
      compileError: catBot(locVetLoi(chay.stderr)),
    };
  }

  if (tuKetThuc !== null && tuKetThuc !== 'RUNTIME_ERROR') {
    return {
      verdict: tuKetThuc,
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: chay.thoiGianMs,
      runnerError: null,
      compileError: null,
    };
  }

  const kq = docKetQuaDriver(chay.stdout, nonce);

  if (!kq) {
    // The driver never reported. Almost always the student's module failing on
    // import, which is a runtime error in their code, not a worker fault.
    return {
      verdict: 'RUNTIME_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: chay.thoiGianMs,
      runnerError: catBot(boMocKetQua(chay.stdout, nonce), 1024),
      compileError: null,
    };
  }

  if (kq.loi_nap) {
    return {
      verdict: 'RUNTIME_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: chay.thoiGianMs,
      runnerError: catBot(locVetLoi(kq.loi_nap)),
      compileError: null,
    };
  }

  const tinh = kq.tests.filter((t) => !t.bo_qua);
  const dat = tinh.filter((t) => t.dat).length;
  const tong = tinh.length;
  const tatCaDat = tong > 0 && dat === tong;

  return {
    verdict: tatCaDat ? 'ACCEPTED' : 'WRONG_ANSWER',
    score: tong === 0 ? 0 : Math.round((dat / tong) * problem.totalPoints),
    passedTests: dat,
    totalTests: tong,
    maxTimeMs: chay.thoiGianMs,
    runnerError: null,
    compileError: null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The Big-O challenge.
 *
 * Runs the same program at increasing N and checks each stage against its own
 * deadline. Correctness is not re-checked here — a PERFORMANCE problem also
 * carries sample test cases for that — so what this measures is exactly what it
 * claims to: whether the algorithm's shape holds up as the input grows.
 */
async function chamHieuNang(
  code: string,
  problem: Parameters<typeof chayTheoChe>[3],
  image: string,
): Promise<KetQuaCham> {
  const kichBan = problem.perfScenarios;
  if (kichBan.length === 0) {
    return {
      verdict: 'INTERNAL_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: 0,
      runnerError: 'bai tap PERFORMANCE khong co kich ban nao',
      compileError: null,
    };
  }

  const thieu = kichBan.filter((k) => !coBoSinh(k.generator));
  if (thieu.length > 0) {
    // Refuse rather than grade against empty input — a student would see a
    // confusing failure for a problem that was mis-authored.
    return {
      verdict: 'INTERNAL_ERROR',
      score: 0,
      passedTests: 0,
      totalTests: 0,
      maxTimeMs: 0,
      runnerError: `thieu bo sinh du lieu: ${thieu.map((k) => k.generator).join(', ')}`,
      compileError: null,
    };
  }

  let dat = 0;
  let maxTimeMs = 0;
  let verdict: Verdict = 'ACCEPTED';
  let compileError: string | null = null;

  for (const k of kichBan) {
    const stdin = sinhDauVao(k.generator, { n: k.n, seed: k.seed });
    const gioiHan = gioiHanThoiGian(k.maxTimeMs);

    const chay = await chayTrongHop({
      tep: { 'main.py': code },
      lenh: ['python', '/sandbox/main.py'],
      stdin,
      timeLimitMs: gioiHan,
      memoryLimitMb: problem.memoryLimitMb,
      image,
      // Sorting N = 100 000 prints ~800 KB, which is the exercise working.
      gioiHanDauRaByte: GIOI_HAN.DAU_RA_HIEU_NANG_BYTE,
    });

    maxTimeMs = Math.max(maxTimeMs, chay.thoiGianMs);
    const tuKetThuc = phanLoaiKetThuc(chay.ketThuc, chay.exitCode);

    if (tuKetThuc === null) {
      dat += 1;
      continue;
    }

    if (laLoiCuPhap(chay.stderr)) {
      compileError = catBot(locVetLoi(chay.stderr));
      verdict = 'COMPILE_ERROR';
      break;
    }

    // The first stage the algorithm cannot keep up with is the answer: a
    // quadratic solution passes N=100 and dies at N=100 000, and that gap is
    // the lesson.
    if (verdict === 'ACCEPTED') verdict = tuKetThuc;
    break;
  }

  return {
    verdict,
    score:
      verdict === 'ACCEPTED'
        ? problem.totalPoints
        : Math.round((dat / kichBan.length) * problem.totalPoints),
    passedTests: dat,
    totalTests: kichBan.length,
    maxTimeMs,
    runnerError: null,
    compileError,
  };
}
