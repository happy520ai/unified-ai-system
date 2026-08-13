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

export const LANGUAGE_PRIORITY = [
  'ts', 'js', 'python', 'go', 'rust', 'java', 'csharp', 'kotlin',
  'swift', 'cpp', 'c', 'ruby', 'php', 'powershell', 'shell',
];
export const DEFAULT_LANGUAGE_FALLBACK = 'other';
export const LANGUAGE_LABELS = Object.freeze({
  ts: 'TypeScript',
  js: 'JavaScript',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  kotlin: 'Kotlin',
  swift: 'Swift',
  ruby: 'Ruby',
  php: 'PHP',
  shell: 'POSIX shell',
  powershell: 'PowerShell',
  other: 'language best determined from file/task context',
});
export const EXT_TO_LANGUAGE = Object.freeze({
  '.ts': 'ts',
  '.tsx': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'js',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.hxx': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.psd1': 'powershell',
});

const GOAL_TEXT_LANGUAGE_PATTERNS = [
  { pattern: /\.(?:ts|tsx|mts|cts)\b/, language: 'ts' },
  { pattern: /\.(?:js|mjs|cjs|jsx)\b/, language: 'js' },
  { pattern: /\.py\b/, language: 'python' },
  { pattern: /\.go\b/, language: 'go' },
  { pattern: /\.rs\b/, language: 'rust' },
  { pattern: /\.java\b/, language: 'java' },
  { pattern: /\.cs\b/, language: 'csharp' },
  { pattern: /\.(?:cpp|cc|cxx|hpp|hh|hxx)\b/, language: 'cpp' },
  { pattern: /\.(?:c|h)\b/, language: 'c' },
  { pattern: /\.(?:kt|kts)\b/, language: 'kotlin' },
  { pattern: /\.swift\b/, language: 'swift' },
  { pattern: /\.rb\b/, language: 'ruby' },
  { pattern: /\.php\b/, language: 'php' },
  { pattern: /\.(?:sh|bash|zsh)\b/, language: 'shell' },
  { pattern: /\.(?:ps1|psm1|psd1)\b/, language: 'powershell' },
  { pattern: /\b(type\s*script|typescript|ts)\b/, language: 'ts' },
  { pattern: /\b(java\s*script|javascript|js|node\.js|nodejs)\b/, language: 'js' },
  { pattern: /\b(python|py)\b/, language: 'python' },
  { pattern: /\b(?:golang|go language|in go|using go)\b/, language: 'go' },
  { pattern: /\brust\b/, language: 'rust' },
  { pattern: /\bjava\b/, language: 'java' },
  { pattern: /(?:\bc\s*sharp\b|\bcsharp\b|\bc#|\.net\b|\bdotnet\b)/, language: 'csharp' },
  { pattern: /(?:\bc\+\+|\bcpp\b)/, language: 'cpp' },
  { pattern: /\bc language\b/, language: 'c' },
  { pattern: /\bkotlin\b/, language: 'kotlin' },
  { pattern: /\bswift\b/, language: 'swift' },
  { pattern: /\bruby\b/, language: 'ruby' },
  { pattern: /\bphp\b/, language: 'php' },
  { pattern: /\b(?:powershell|pwsh)\b/, language: 'powershell' },
  { pattern: /\b(?:posix shell|shell script|bash|zsh)\b/, language: 'shell' },
];

export function normalizeLanguageCandidate(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  const aliases = {
    typescript: 'ts', ts: 'ts',
    javascript: 'js', js: 'js', nodejs: 'js', 'node.js': 'js',
    python: 'python', py: 'python',
    golang: 'go', go: 'go',
    rust: 'rust', rs: 'rust',
    java: 'java',
    'c#': 'csharp', csharp: 'csharp', dotnet: 'csharp', '.net': 'csharp',
    'c++': 'cpp', cpp: 'cpp',
    c: 'c',
    kotlin: 'kotlin', kt: 'kotlin',
    swift: 'swift',
    ruby: 'ruby', rb: 'ruby',
    php: 'php',
    shell: 'shell', sh: 'shell', bash: 'shell', zsh: 'shell',
    powershell: 'powershell', pwsh: 'powershell', ps1: 'powershell',
    other: 'other', unknown: 'other',
  };
  return aliases[normalized] || null;
}

export const LANGUAGE_PROFILES = Object.freeze({
  ts: {
    label: 'TypeScript',
    extension: 'ts',
    moduleRule: 'Use the project\'s TypeScript module convention; prefer ESM for new modules and preserve established CommonJS boundaries.',
    styleRules: ['Use strict, explicit types at public boundaries.', 'Prefer small typed functions and exhaustive narrowing.', 'Handle asynchronous failures explicitly.'],
    importGuideline: 'Do not import JavaScript runtime globals as dependencies; import only declared packages, Node modules, and project symbols.',
  },
  js: {
    label: 'JavaScript',
    extension: 'js',
    moduleRule: 'Preserve the project\'s ESM or CommonJS convention; use ESM for new modules when no convention exists.',
    styleRules: ['Use modern JavaScript without implicit globals.', 'Prefer small testable functions and explicit asynchronous error handling.', 'Document public contracts where types are not self-evident.'],
    importGuideline: 'Do not import JavaScript runtime globals as dependencies; import only declared packages, Node modules, and project symbols.',
  },
  python: {
    label: 'Python',
    extension: 'py',
    moduleRule: 'Use normal Python imports and preserve the project package layout.',
    styleRules: ['Use type hints on public boundaries where practical.', 'Use context managers and explicit exception handling.', 'Follow the project formatter and PEP 8 naming.'],
    importGuideline: 'Do not import Python built-ins as dependencies; import only standard-library, declared third-party, and project modules.',
  },
  go: {
    label: 'Go',
    extension: 'go',
    moduleRule: 'Use the existing Go package layout and keep imports minimal.',
    styleRules: ['Return and wrap errors explicitly.', 'Keep interfaces consumer-focused and small.', 'Use idiomatic Go naming and formatting.'],
    importGuideline: 'Import only required standard-library or go.mod packages.',
  },
  rust: {
    label: 'Rust',
    extension: 'rs',
    moduleRule: 'Use the existing crate/module layout and minimal use declarations.',
    styleRules: ['Model recoverable failures with Result and absence with Option.', 'Make ownership and lifetime choices explicit at boundaries.', 'Follow rustfmt and clippy conventions.'],
    importGuideline: 'Use only required modules and Cargo dependencies; do not import prelude names as external dependencies.',
  },
  java: {
    label: 'Java',
    extension: 'java',
    moduleRule: 'Preserve package declarations and the project build layout.',
    styleRules: ['Keep classes and methods focused.', 'Use explicit nullability and immutable state where practical.', 'Follow the project formatter and API documentation conventions.'],
    importGuideline: 'Do not import java.lang classes explicitly; import required JDK and declared dependency types such as java.util.List normally.',
  },
  csharp: {
    label: 'C#',
    extension: 'cs',
    moduleRule: 'Preserve namespaces, project references, and the repository\'s target framework.',
    styleRules: ['Use nullable reference types consistently.', 'Prefer async/await with CancellationToken on cancellable public operations.', 'Follow established .NET naming and analyzer rules.'],
    importGuideline: 'Use only required namespaces and project/package references; do not invent NuGet dependencies.',
  },
  cpp: {
    label: 'C++',
    extension: 'cpp',
    moduleRule: 'Preserve the build system, include boundaries, and configured C++ standard.',
    styleRules: ['Use RAII and value semantics by default.', 'Make ownership explicit and avoid unchecked raw-resource management.', 'Follow the project formatter and warning policy.'],
    importGuideline: 'Include only required standard or project headers and do not invent link-time dependencies.',
  },
  c: {
    label: 'C',
    extension: 'c',
    moduleRule: 'Preserve header/source boundaries, ABI constraints, and the configured C standard.',
    styleRules: ['Make ownership and lifetime rules explicit.', 'Check allocation, I/O, and bounds failures.', 'Follow the repository warning and formatting policy.'],
    importGuideline: 'Include only required standard or project headers and preserve platform guards.',
  },
  kotlin: {
    label: 'Kotlin',
    extension: 'kt',
    moduleRule: 'Preserve package declarations and Gradle/Maven source-set conventions.',
    styleRules: ['Use null safety and sealed models deliberately.', 'Prefer coroutines only where the project already supports them.', 'Follow Kotlin naming and formatting conventions.'],
    importGuideline: 'Import only required Kotlin/JDK or declared dependency symbols.',
  },
  swift: {
    label: 'Swift',
    extension: 'swift',
    moduleRule: 'Preserve Swift package or Xcode target boundaries.',
    styleRules: ['Use value types and protocol-oriented design where appropriate.', 'Use structured concurrency and explicit error propagation.', 'Follow Swift API design guidelines.'],
    importGuideline: 'Import only required Apple SDK or declared package modules.',
  },
  ruby: {
    label: 'Ruby',
    extension: 'rb',
    moduleRule: 'Preserve the project require/autoload convention and gem boundaries.',
    styleRules: ['Prefer small objects and explicit failure behavior.', 'Follow the project RuboCop style if configured.', 'Avoid monkey patches outside established extension points.'],
    importGuideline: 'Require only standard-library, Gemfile, or project modules.',
  },
  php: {
    label: 'PHP',
    extension: 'php',
    moduleRule: 'Preserve namespaces, Composer autoloading, and the configured PHP version.',
    styleRules: ['Use strict types when consistent with the project.', 'Use explicit exceptions and typed public APIs.', 'Follow the configured PSR and formatter rules.'],
    importGuideline: 'Use only declared Composer packages and project symbols.',
  },
  shell: {
    label: 'POSIX shell',
    extension: 'sh',
    moduleRule: 'Preserve the target shell and repository script conventions.',
    styleRules: ['Quote expansions and handle command failures deliberately.', 'Prefer simple pipelines and explicit cleanup traps.', 'Keep portability constraints visible.'],
    importGuideline: 'Source only trusted repository scripts and require external commands explicitly.',
  },
  powershell: {
    label: 'PowerShell',
    extension: 'ps1',
    moduleRule: 'Preserve module boundaries and the declared PowerShell edition/version.',
    styleRules: ['Use approved verbs and explicit parameter validation.', 'Use terminating errors and try/catch for recoverable operations.', 'Avoid string-built commands and quote literal paths safely.'],
    importGuideline: 'Import only required installed or repository modules; do not assume optional modules exist.',
  },
  other: {
    label: 'language determined from task context',
    extension: 'ext',
    moduleRule: 'Use the target project\'s native module, package, and build conventions.',
    styleRules: ['Preserve local conventions and dependency boundaries.', 'Use explicit error handling and readable names.', 'Document reusable public behavior.'],
    importGuideline: 'Do not invent dependencies or import language runtime built-ins as third-party modules.',
  },
});

export function resolveLanguageProfile(languageOrTask = DEFAULT_LANGUAGE_FALLBACK) {
  const candidate = typeof languageOrTask === 'object'
    ? languageOrTask?.language
    : languageOrTask;
  const language = normalizeLanguageCandidate(candidate) || DEFAULT_LANGUAGE_FALLBACK;
  return LANGUAGE_PROFILES[language] || LANGUAGE_PROFILES.other;
}

export function getLanguageFileExtension(languageOrTask) {
  return resolveLanguageProfile(languageOrTask).extension;
}

export function buildImportConstraintText(languageOrTask) {
  return resolveLanguageProfile(languageOrTask).importGuideline;
}

export function inferLanguageFromTextGoalHint(text) {
  const normalized = String(text || '').toLowerCase();
  for (const { pattern, language } of GOAL_TEXT_LANGUAGE_PATTERNS) {
    if (pattern.test(normalized)) return language;
  }
  return null;
}

export function inferLanguageFromAllowedFiles(patterns) {
  const languageVotes = new Map();
  const items = Array.isArray(patterns) ? patterns : [];
  for (const pattern of items) {
    const match = String(pattern).toLowerCase().match(/\.(ts|tsx|mts|cts|js|mjs|cjs|jsx|py|go|rs|java|cs|cpp|cc|cxx|hpp|hh|hxx|c|h|kt|kts|swift|rb|php|sh|bash|zsh|ps1|psm1|psd1)\b/g);
    if (!match || match.length === 0) continue;

    for (const ext of match) {
      const mapped = EXT_TO_LANGUAGE[ext];
      if (!mapped) continue;
      languageVotes.set(mapped, (languageVotes.get(mapped) || 0) + 1);
    }
  }

  if (languageVotes.size === 0) return null;
  return [...languageVotes.entries()]
    .sort((left, right) => {
      const voteDifference = right[1] - left[1];
      if (voteDifference !== 0) return voteDifference;
      return LANGUAGE_PRIORITY.indexOf(left[0]) - LANGUAGE_PRIORITY.indexOf(right[0]);
    })[0][0];
}

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
 * @property {string}  [preferredLanguage]
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
 * Infer the best code language for implementation tasks.
 *
 * @param {CodebaseProfile} profile
 * @param {string} [goalText]
 * @returns {string}
 */
export function inferPreferredLanguage(profile = {}, goalText = '') {
  const lower = String(goalText || '').toLowerCase();
  const explicitLanguage = inferLanguageFromTextGoalHint(lower);
  if (explicitLanguage) return explicitLanguage;

  // 1) Prefer explicit file extensions / language words in the goal.
  const extMatch = lower.match(/\b[\w.-]+\.(ts|tsx|js|jsx|py|go|rs|java)\b/g);
  if (extMatch && extMatch.length > 0) {
    for (const matched of extMatch) {
      const ext = `.${matched.split('.').pop()}`;
      const fromExt = EXT_TO_LANGUAGE[ext];
      if (fromExt) return fromExt;
    }
  }

  const tokenMatch = lower.match(/\b(?:typescript|javascript|python|golang|rust|java|node\.js|nodejs|py)\b/g);
  if (tokenMatch && tokenMatch.length > 0) {
    const normalized = normalizeLanguageCandidate(tokenMatch[0]);
    if (normalized) return normalized;
  }

  // 2) Prefer the dominant detected language; priority only breaks ties.
  const languageCounts = new Map();
  for (const [extension, count] of Object.entries(profile.fileCountsByExt || {})) {
    const language = EXT_TO_LANGUAGE[String(extension).toLowerCase()];
    const numericCount = Number(count);
    if (!language || !Number.isFinite(numericCount) || numericCount <= 0) continue;
    languageCounts.set(language, (languageCounts.get(language) || 0) + numericCount);
  }
  if (languageCounts.size > 0) {
    return [...languageCounts.entries()]
      .sort((left, right) => {
        const countDifference = right[1] - left[1];
        if (countDifference !== 0) return countDifference;
        return LANGUAGE_PRIORITY.indexOf(left[0]) - LANGUAGE_PRIORITY.indexOf(right[0]);
      })[0][0];
  }

  // 3) Fall back to the ordered language list when counts are unavailable.
  const profileLanguages = new Set((profile.languages || []).map((language) => normalizeLanguageCandidate(language)).filter(Boolean));
  if (profileLanguages.size > 0) {
    for (const language of LANGUAGE_PRIORITY) {
      if (profileLanguages.has(language)) return language;
    }
    return [...profileLanguages][0];
  }

  return DEFAULT_LANGUAGE_FALLBACK;
}

/**
 * Convert a normalized language code to display text.
 *
 * @param {string} language
 * @returns {string}
 */
export function preferredLanguageLabel(language) {
  return resolveLanguageProfile(language).label;
}

/**
 * Build language selection text used in constraints and prompts.
 *
 * @param {string} language
 * @param {string|null|undefined} taskLanguage
 * @returns {string}
 */
export function buildLanguagePreferenceText(language, taskLanguage = null) {
  const normalizedLanguage = normalizeLanguageCandidate(language) || DEFAULT_LANGUAGE_FALLBACK;
  const normalizedTaskLanguage = normalizeLanguageCandidate(taskLanguage);
  const defaultLabel = preferredLanguageLabel(normalizedLanguage);

  if (!normalizedTaskLanguage || normalizedTaskLanguage === normalizedLanguage) {
    return `Default implementation language: ${defaultLabel}. ` +
      'If a task explicitly targets another language file, follow that file\'s language.';
  }

  const taskLabel = preferredLanguageLabel(normalizedTaskLanguage);
  if (normalizedLanguage === DEFAULT_LANGUAGE_FALLBACK) {
    return `Primary task language: ${taskLabel}. ` +
      'Project default is unclear; infer the default from task files and context.';
  }
  return `Primary task language: ${taskLabel}. Project default remains ${defaultLabel}. If this conflicts with an explicitly targeted file language, follow that file language.`;
}

/**
 * Infer task-local language by combining allowedFiles and task text hints.
 *
 * @param {object} task
 * @param {string} fallbackLanguage
 * @param {string} goalText
 * @returns {string}
 */
export function inferTaskLanguage(task = {}, fallbackLanguage = DEFAULT_LANGUAGE_FALLBACK, goalText = '') {
  const taskLanguageFromFiles = inferLanguageFromAllowedFiles(task?.allowedFiles ?? []);
  if (taskLanguageFromFiles) return taskLanguageFromFiles;

  const taskText = `${task?.name ?? ''} ${task?.prompt ?? ''} ${goalText ?? ''}`;
  const hint = inferLanguageFromTextGoalHint(taskText);
  if (hint) return hint;

  return normalizeLanguageCandidate(fallbackLanguage) || DEFAULT_LANGUAGE_FALLBACK;
}

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
