/**
 * Forge Goal Refiner Helpers — extracted constants, typedefs, and pure functions
 * for codebase probing, goal clarity analysis, prompt building, JSON parsing,
 * review merging, and quality scoring.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, extname, sep } from 'node:path';

// ── Constants ─────────────────────────────────────────────────────────────

/** Maximum files walked during deep probing. */
export const MAX_PROBE_FILES = 400;

/** Maximum chars stored per key-file (truncated to keep prompts bounded). */
export const MAX_KEY_FILE_CHARS = 3000;

/** Directories skipped during walking. */
export const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo',
  'legacy', '.svelte-kit', '.nuxt', '.output', '.vercel', '.netlify',
  '.idea', '.vscode', '.vs', 'out', '__pycache__', '.pytest_cache',
]);

/** File names treated as key configuration / entry files. */
export const KEY_FILES = new Set([
  'package.json', 'tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json',
  '.env.example', 'README.md', 'vite.config.ts', 'vite.config.js',
  'next.config.js', 'next.config.mjs', 'jest.config.js', 'jest.config.ts',
  'vitest.config.ts', 'vitest.config.js', 'docker-compose.yml', 'Makefile',
  'pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json',
  'babel.config.js', 'webpack.config.js', 'rollup.config.js', 'eslint.config.js',
  'pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile',
  '.babelrc', '.eslintrc.json', '.eslintrc.js',
]);

/** Candidate entry-point paths (relative to project root) to read if present. */
export const ENTRY_POINT_CANDIDATES = [
  'src/index.js', 'src/index.ts', 'src/index.mjs',
  'src/main.js', 'src/main.ts', 'src/main.mjs',
  'src/app.js', 'src/app.ts',
  'index.js', 'index.ts', 'index.mjs',
  'main.js', 'main.ts',
  'app.js', 'app.ts',
  'server.js', 'server.ts',
];

// ── Known framework signatures inside package.json dependencies ───────────

/** @type {Record<string, string>} */
export const FRAMEWORK_MARKERS = {
  next: 'Next.js',
  nuxt: 'Nuxt',
  react: 'React',
  'react-dom': 'React',
  vue: 'Vue',
  svelte: 'Svelte',
  '@angular/core': 'Angular',
  express: 'Express',
  '@nestjs/core': 'NestJS',
  fastify: 'Fastify',
  koa: 'Koa',
  hapi: 'Hapi',
  '@hapi/hapi': 'Hapi',
  hono: 'Hono',
  astro: 'Astro',
  remix: 'Remix',
  '@remix-run/node': 'Remix',
  'solid-js': 'SolidJS',
  preact: 'Preact',
  'ember-source': 'Ember',
  '@ember/source': 'Ember',
};

/** @type {Record<string, string>} */
export const TEST_FRAMEWORK_MARKERS = {
  jest: 'jest',
  vitest: 'vitest',
  mocha: 'mocha',
  ava: 'ava',
  'node:test': 'node:test',
  tape: 'tape',
  cypress: 'cypress',
  playwright: 'playwright',
  '@playwright/test': 'playwright',
};

// ── LLM Prompts ───────────────────────────────────────────────────────────

export const DAG_SYSTEM_PROMPT = `You are the Forge Goal Refiner. Decompose the user's coding goal into an executable Task DAG.

You MUST respond with a valid JSON object in this exact format (no markdown fences, no extra text):

{
  "tasks": [
    {
      "id": "t1",
      "name": "short description",
      "type": "explore|plan|implement|test|verify|debug|review|refactor",
      "agentRole": "code-archaeologist|architect|coder|tester|verifier|debugger|reviewer",
      "prompt": "detailed instructions for the worker agent",
      "dependsOn": [],
      "allowedFiles": ["src/**/*.js"],
      "estimatedMin": 10
    }
  ],
  "checkpoints": ["after_t2", "after_t5"],
  "rollbackPoints": ["before_t3"],
  "summary": "one-line summary of the plan"
}

Rules:
1. ALWAYS start with an explore task (type: explore).
2. Follow with a plan task (type: plan).
3. Implementation tasks should be specific and scoped to a few files each.
4. Implementation tasks that don't depend on each other can run in parallel (list their real deps).
5. ALWAYS end with test and verify tasks.
6. Keep prompts detailed enough that a worker agent can execute without ambiguity.
7. allowedFiles should be restrictive globs.
8. The entire DAG should typically have 5-10 tasks for a medium goal.
9. MERGE tasks that modify the SAME file: combine them into ONE implement task.
10. PREFER fewer, broader tasks over many narrow ones.`;

export const REVIEW_SYSTEM_PROMPT = `You are the Forge DAG Reviewer. You receive a proposed Task DAG plus project context and return critique.

You MUST respond with a valid JSON object (no markdown fences, no extra text):

{
  "issues": [
    {
      "kind": "missing_dep|file_collision|missing_test|scope_too_broad|scope_too_narrow|missing_verify",
      "taskId": "t3",
      "detail": "why this is a problem",
      "fix": "concrete fix — e.g. add dependsOn t2, merge with t4, add a test task"
    }
  ],
  "verdict": "ok|needs_revision",
  "revisedSummary": "optional improved one-line summary"
}

Review checklist:
1. Missing dependencies — does task X read/write something that task Y earlier produced, without a dependsOn?
2. File collisions — do two implement tasks touch the same file? They should be merged or sequenced.
3. Missing test/verify — every implement task should have a following test task (or a combined verify at the end).
4. Scope realism — is any single task doing too much (split) or too little (merge)?
5. Does the DAG follow explore -> plan -> implement -> test -> verify?`;

// ── JSDoc Type Definitions ────────────────────────────────────────────────

/**
 * @typedef {Object} CodebaseProfile
 * @property {string[]} tree           — relative paths of probed entries (capped)
 * @property {{ path: string, content: string }[]} keyFiles
 * @property {string[]} frameworks     — detected framework names
 * @property {string[]} testFrameworks — detected test framework names
 * @property {string[]} languages      — detected languages: 'js'|'ts'|'python'|...
 * @property {string}  moduleSystem    — 'esm'|'cjs'|'mixed'|'unknown'
 * @property {boolean} monorepo        — workspace / lerna / nx detected
 * @property {Record<string, number>} fileCountsByExt
 * @property {number}  totalFileCount
 * @property {string[]} entryPoints    — entry point files that were actually read
 * @property {{ path: string, content: string }[]} entryPointContents
 */

/**
 * @typedef {Object} ClarityResult
 * @property {number} score       — 0..100
 * @property {string[]} clarifications — optional questions that could improve the goal
 * @property {string} scopeHint   — 'too_small'|'ok'|'too_big'
 * @property {string[]} mentionedPaths — file/dir paths referenced by the goal text
 */

/**
 * @typedef {Object} QualityScores
 * @property {number} structure    — 0..100, does DAG follow explore→plan→implement→test→verify
 * @property {number} coverage     — 0..100, are mentioned paths covered by allowedFiles
 * @property {number} parallelism  — 0..100, are independent tasks properly marked for parallelism
 * @property {number} testCoverage — 0..100, is there a test/verify tail
 * @property {number} overall      — 0..100, weighted average
 */

// ── Deep Codebase Probe ───────────────────────────────────────────────────

/**
 * Walk the project tree, read key files, and produce a CodebaseProfile.
 *
 * @param {string} projectRoot
 * @param {number} [maxDepth=5]
 * @returns {Promise<CodebaseProfile>}
 */
export async function probeCodebaseDeep(projectRoot, maxDepth = 5) {
  const tree = [];
  /** @type {{ path: string, content: string }[]} */
  const keyFiles = [];
  /** @type {Map<string, number>} */
  const fileCountsByExt = new Map();
  /** @type {Set<string>} */
  const languages = new Set();
  let totalFileCount = 0;
  let walked = 0;

  async function walk(dir, depth) {
    if (depth > maxDepth || walked >= MAX_PROBE_FILES) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (walked >= MAX_PROBE_FILES) break;
      const full = join(dir, entry.name);
      const rel = relative(projectRoot, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          tree.push(`${rel}/`);
          await walk(full, depth + 1);
        }
      } else if (entry.isFile()) {
        walked++;
        totalFileCount++;
        tree.push(rel);

        const ext = extname(entry.name).toLowerCase();
        fileCountsByExt.set(ext, (fileCountsByExt.get(ext) ?? 0) + 1);

        if (ext === '.ts' || ext === '.tsx') languages.add('ts');
        else if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.jsx') languages.add('js');
        else if (ext === '.py') languages.add('python');
        else if (ext === '.go') languages.add('go');
        else if (ext === '.rs') languages.add('rust');
        else if (ext === '.java') languages.add('java');

        if (KEY_FILES.has(entry.name)) {
          try {
            const content = await readFile(full, 'utf-8');
            keyFiles.push({ path: rel, content: content.slice(0, MAX_KEY_FILE_CHARS) });
          } catch { /* unreadable */ }
        }
      }
    }
  }

  await walk(projectRoot, 0);

  // ── Parse package.json for framework / test framework / module system ──

  const frameworks = [];
  const testFrameworks = [];
  let moduleSystem = 'unknown';

  const pkgFile = keyFiles.find(k =>
    k.path === 'package.json' || k.path.endsWith('/package.json'));
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content);
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
        ...(pkg.peerDependencies ?? {}),
      };
      for (const [name, label] of Object.entries(FRAMEWORK_MARKERS)) {
        if (allDeps[name] && !frameworks.includes(label)) frameworks.push(label);
      }
      for (const [name, label] of Object.entries(TEST_FRAMEWORK_MARKERS)) {
        if (allDeps[name] && !testFrameworks.includes(label)) testFrameworks.push(label);
      }
      if (pkg.type === 'module') moduleSystem = 'esm';
      else if (pkg.type === 'commonjs') moduleSystem = 'cjs';
    } catch { /* malformed */ }
  }

  // Fallback heuristic: count import/require usage in a few JS/TS files.
  if (moduleSystem === 'unknown') {
    let esmHits = 0, cjsHits = 0;
    const sample = tree
      .filter(p => /\.(js|mjs|cjs|ts)$/.test(p) && !p.endsWith('/'))
      .slice(0, 10);
    for (const rel of sample) {
      try {
        const c = await readFile(join(projectRoot, rel.replace(/\//g, sep)), 'utf-8');
        const head = c.slice(0, 2000);
        if (/\bimport\s+[\w{*]/.test(head) || /\bexport\s+(default|const|function|class)\b/.test(head)) esmHits++;
        if (/\brequire\s*\(/.test(head) || /\bmodule\.exports\b/.test(head)) cjsHits++;
      } catch { /* skip */ }
    }
    if (esmHits > 0 && cjsHits === 0) moduleSystem = 'esm';
    else if (cjsHits > 0 && esmHits === 0) moduleSystem = 'cjs';
    else if (esmHits > 0 && cjsHits > 0) moduleSystem = 'mixed';
  }

  // ── Monorepo detection ─────────────────────────────────────────────────
  const monorepo = keyFiles.some(k =>
    k.path === 'pnpm-workspace.yaml' ||
    k.path === 'lerna.json' ||
    k.path === 'nx.json' ||
    k.path === 'turbo.json'
  );

  // ── Read entry points (if present) ─────────────────────────────────────
  /** @type {{ path: string, content: string }[]} */
  const entryPointContents = [];
  const entryPoints = [];
  for (const candidate of ENTRY_POINT_CANDIDATES) {
    try {
      const c = await readFile(join(projectRoot, candidate.replace(/\//g, sep)), 'utf-8');
      entryPoints.push(candidate);
      entryPointContents.push({ path: candidate, content: c.slice(0, MAX_KEY_FILE_CHARS) });
    } catch { /* not present */ }
  }

  return {
    tree,
    keyFiles,
    frameworks,
    testFrameworks,
    languages: [...languages],
    moduleSystem,
    monorepo,
    fileCountsByExt: Object.fromEntries([...fileCountsByExt.entries()].sort((a, b) => b[1] - a[1])),
    totalFileCount,
    entryPoints,
    entryPointContents,
  };
}

// ── Goal Clarity Analysis ─────────────────────────────────────────────────

/**
 * Score the goal's clarity without blocking. Heuristic-only; does not call LLM.
 *
 * @param {string} goalText
 * @param {CodebaseProfile} profile
 * @returns {ClarityResult}
 */
export function analyzeGoalClarity(goalText, profile) {
  const text = goalText || '';
  const lower = text.toLowerCase();
  /** @type {string[]} */
  const clarifications = [];
  let score = 40; // baseline: most goals start mediocre

  // ── Specificity signals ──────────────────────────────────────────────
  const mentionedPaths = [];
  const pathPattern = /(?:[\w.-]+\/)+[\w.-]+(?:\.\w+)?/g;
  for (const m of text.matchAll(pathPattern)) {
    if (m[0].length >= 3 && !m[0].includes(' ')) mentionedPaths.push(m[0]);
  }
  if (mentionedPaths.length > 0) score += 12;
  else clarifications.push('Which files or directories should this goal touch? (e.g. src/auth/login.js)');

  const functionNamePattern = /\b([a-zA-Z_][\w]*)(?:\s*\(|\s+function|\s+method|\s+class)\b/;
  if (functionNamePattern.test(text)) score += 8;
  else clarifications.push('Can you name the specific function, class, or component involved?');

  const actionVerbs = ['add', 'create', 'fix', 'remove', 'refactor', 'rename', 'update',
    'implement', 'write', 'migrate', 'replace', 'delete', 'introduce', 'split', 'merge'];
  if (actionVerbs.some(v => lower.startsWith(v) || lower.includes(` ${v} `))) score += 10;
  else clarifications.push('What is the primary action? (add/fix/refactor/migrate/...)');

  const hasFeatureDescription = text.length > 60;
  if (hasFeatureDescription) score += 8;
  else clarifications.push('The goal is short — can you describe the expected behavior in one more sentence?');

  // ── Conflict with existing patterns ──────────────────────────────────
  if (profile.frameworks.length > 0 && lower.includes('jquery')) {
    clarifications.push(`The project uses ${profile.frameworks.join(', ')} — are you sure you want jQuery?`);
    score -= 5;
  }
  if (profile.moduleSystem === 'esm' && lower.includes('require(')) {
    clarifications.push('The project is ESM. Using require() will conflict — prefer import statements.');
    score -= 5;
  }
  if (profile.moduleSystem === 'cjs' && /\bimport\s+[\w{]/.test(text)) {
    clarifications.push('The project is CommonJS. import syntax will conflict — prefer require().');
    score -= 5;
  }

  // ── Scope estimation ─────────────────────────────────────────────────
  const scopeKeywords = {
    big: ['system', 'architecture', 'redesign', 'rewrite', 'whole', 'entire', 'all ', 'full ',
          'microservice', 'platform', 'monorepo-wide'],
    small: ['typo', 'rename a', 'change one', 'update a single', 'a single', 'one line'],
  };
  let scopeHint = 'ok';
  if (scopeKeywords.big.some(k => lower.includes(k))) {
    scopeHint = 'too_big';
    clarifications.push('This looks large — consider splitting it into multiple sequential goals.');
    score -= 4;
  } else if (scopeKeywords.small.some(k => lower.includes(k))) {
    scopeHint = 'too_small';
  }

  // ── Clamp ────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, clarifications, scopeHint, mentionedPaths };
}
