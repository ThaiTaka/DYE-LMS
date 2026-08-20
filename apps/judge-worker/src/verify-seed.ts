/**
 * Run every seeded reference solution through the real judge.
 *
 *     npm run judge:verify
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * A problem whose own reference solution does not pass is a problem that will
 * mark a correct student answer wrong. There is no way to find those by reading
 * the seed files — the failures come from float rounding, from an expected value
 * computed by hand, from a sandbox constraint the author did not have in mind.
 * The only way to know is to execute all of them.
 *
 * Phase 8 wrote this to validate the judge itself and it immediately found real
 * defects in Phase 2's content. It stays as a permanent gate.
 *
 * Exits non-zero when any solution fails, so CI can use it directly.
 */
// MUST be first — see apps/judge-worker/src/env.ts.
import './env';

import { PrismaClient } from '@prisma/client';

import { chamBai } from './judge';
import { coDocker } from './sandbox';

const db = new PrismaClient({ log: ['error'] });

interface Hong {
  slug: string;
  mode: string;
  verdict: string;
  dat: string;
}

async function main(): Promise<void> {
  if (!(await coDocker())) {
    console.error('Can Docker dang chay de kiem tra loi giai mau.');
    process.exit(1);
  }

  // Any student row works: judging reads the problem, not the person. Using a
  // real one keeps the foreign keys satisfied without inventing a fixture.
  const hocSinh = await db.user.findFirst({
    where: { role: 'STUDENT' },
    select: { id: true },
  });
  if (!hocSinh) {
    console.error('Chua co hoc sinh nao. Chay `npm run db:seed` truoc.');
    process.exit(1);
  }

  const baiTap = await db.problem.findMany({
    where: {
      judgeMode: { in: ['IO_MATCH', 'UNIT_TEST', 'PERFORMANCE'] },
      solutionCode: { not: '' },
    },
    select: { id: true, slug: true, judgeMode: true, solutionCode: true },
    orderBy: { slug: 'asc' },
  });

  console.log(`Kiem tra ${baiTap.length} loi giai mau qua bo cham that...\n`);

  const hong: Hong[] = [];
  const boQua: Hong[] = [];

  for (const bt of baiTap) {
    const sub = await db.submission.create({
      data: {
        studentId: hocSinh.id,
        problemId: bt.id,
        code: bt.solutionCode,
        verdict: 'PENDING',
      },
      select: { id: true },
    });

    try {
      const kq = await chamBai(db, sub.id);
      const dong: Hong = {
        slug: bt.slug,
        mode: bt.judgeMode,
        verdict: kq.verdict,
        dat: `${kq.passedTests}/${kq.totalTests}`,
      };

      if (kq.verdict === 'SKIPPED') boQua.push(dong);
      else if (kq.verdict !== 'ACCEPTED') hong.push(dong);

      process.stdout.write(kq.verdict === 'ACCEPTED' ? '.' : 'x');
    } catch (err) {
      hong.push({
        slug: bt.slug,
        mode: bt.judgeMode,
        verdict: `THROW: ${String(err).slice(0, 60)}`,
        dat: '-',
      });
      process.stdout.write('!');
    } finally {
      await db.submissionTestResult.deleteMany({ where: { submissionId: sub.id } });
      await db.submission.delete({ where: { id: sub.id } }).catch(() => undefined);
    }
  }

  const dat = baiTap.length - hong.length - boQua.length;
  console.log(`\n\n${dat}/${baiTap.length} loi giai mau DAT`);

  if (boQua.length > 0) {
    console.log(`\n${boQua.length} bo qua (chua ho tro o phase nay):`);
    for (const b of boQua) console.log(`  ${b.mode.padEnd(11)} ${b.slug}`);
  }

  if (hong.length > 0) {
    console.log(`\n${hong.length} KHONG DAT — loi giai mau khong qua duoc bai cua chinh no:`);
    for (const h of hong) {
      console.log(`  ${h.mode.padEnd(11)} ${h.slug.padEnd(42)} ${h.verdict} ${h.dat}`);
    }
    console.log(
      '\nMoi bai o tren se cham SAI mot bai lam DUNG cua hoc sinh.\n' +
        'Sua noi dung trong packages/db/prisma/seed/courses/, khong sua bo cham.',
    );
  }

  await db.$disconnect();
  process.exit(hong.length > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
