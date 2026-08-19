// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Local rule: no deficit language about students.
 *
 * The brief is explicit — the UI must never label a student "Weak" or "Average".
 * A code review can miss that; a build failure cannot. The scale is
 * Cơ bản → Thử thách → Nâng cao → Mở rộng, and it describes the WORK, never the child.
 *
 * The patterns target student-DESCRIPTIVE phrasing rather than bare words:
 * "trung bình" (average) is legitimate and common in this curriculum —
 * "tính điểm trung bình" is a standard beginner exercise — so a blunt word list
 * would produce false positives and get switched off, which is worse than no rule.
 */
const DEFICIT_PATTERNS = [
  { re: /học\s+sinh\s+(yếu|kém|dở|tệ)/iu, label: 'học sinh yếu/kém' },
  { re: /\bhs\s+(yếu|kém)/iu, label: 'hs yếu/kém' },
  { re: /nhóm\s+(yếu|kém)/iu, label: 'nhóm yếu/kém' },
  { re: /trình\s+độ\s+(yếu|kém)/iu, label: 'trình độ yếu/kém' },
  {
    re: /\b(weak|poor|failing|underperforming|struggling)\s+(student|learner|pupil)s?\b/iu,
    label: 'weak/poor student',
  },
  { re: /\bslow\s+learners?\b/iu, label: 'slow learner' },
  { re: /\bremedial\b/iu, label: 'remedial' },
  { re: /\bbelow[-\s]average\s+(student|learner)s?\b/iu, label: 'below-average student' },
  { re: /\blow[-\s]ability\b/iu, label: 'low-ability' },
];

/** @type {import('eslint').ESLint.Plugin} */
const dyePlugin = {
  rules: {
    'no-deficit-language': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Ban deficit vocabulary about students in user-facing strings.',
        },
        schema: [],
        messages: {
          deficit:
            'Ngôn ngữ tiêu cực về học sinh ("{{label}}"). Dùng thang Cơ bản / Thử thách / ' +
            'Nâng cao / Mở rộng — mô tả BÀI TẬP được giao, không mô tả học sinh.',
        },
      },
      create(context) {
        /** @param {import('estree').Node} node @param {string} text */
        const check = (node, text) => {
          for (const { re, label } of DEFICIT_PATTERNS) {
            if (re.test(text)) {
              context.report({ node, messageId: 'deficit', data: { label } });
              return;
            }
          }
        };

        return {
          Literal(node) {
            if (typeof node.value === 'string') check(node, node.value);
          },
          TemplateElement(node) {
            check(/** @type {never} */ (node), node.value.raw);
          },
        };
      },
    },
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'packages/db/prisma/migrations/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { dye: dyePlugin },
    rules: {
      'dye/no-deficit-language': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },

  {
    /*
     * Node globals for plain JavaScript.
     *
     * TypeScript files never needed this: typescript-eslint turns `no-undef`
     * off, because the compiler already knows what `process` is. A `.mjs`
     * script gets the base recommended config instead, where `no-undef` is on
     * and no environment is assumed — so `process` and `console` read as
     * undefined variables.
     */
    files: ['**/*.mjs', '**/*.js', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },

  {
    // These two files DEFINE the banned patterns, so the rule flags its own
    // source. Exempt the definition sites only — nothing else.
    files: ['packages/db/prisma/seed/assertions.ts', 'eslint.config.mjs'],
    rules: { 'dye/no-deficit-language': 'off' },
  },

  {
    /*
     * Hook rules, for the React code only.
     *
     * Added in Phase 7 because the code editor introduced the first non-trivial
     * hooks in the project — a debounced autosave with timers, refs and event
     * listeners is exactly the shape where a stale closure silently drops a
     * student's work rather than throwing.
     */
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
