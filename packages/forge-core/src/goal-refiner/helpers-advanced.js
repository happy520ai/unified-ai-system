/**
 * Forge Goal Refiner Advanced Helpers — LLM prompts, prompt builders,
 * JSON parsing/repair, review merging, and DAG quality scoring.
 *
 * Split from helpers.js to keep both files under 500 lines.
 */

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

// ── Prompt builders ───────────────────────────────────────────────────────

/**
 * Build the user prompt for the initial DAG generation.
 *
 * @param {string} goalText
 * @param {import('./helpers.js').CodebaseProfile} profile
 * @param {import('./helpers.js').ClarityResult} clarity
 * @returns {string}
 */
export function buildInitialPrompt(goalText, profile, clarity) {
  const lines = [];
  lines.push(`## Goal\n${goalText}\n`);

  lines.push(`## Codebase Profile`);
  lines.push(`- Frameworks: ${profile.frameworks.length ? profile.frameworks.join(', ') : 'none detected'}`);
  lines.push(`- Test frameworks: ${profile.testFrameworks.length ? profile.testFrameworks.join(', ') : 'none detected'}`);
  lines.push(`- Languages: ${profile.languages.length ? profile.languages.join(', ') : 'unknown'}`);
  lines.push(`- Module system: ${profile.moduleSystem}`);
  lines.push(`- Monorepo: ${profile.monorepo ? 'yes' : 'no'}`);
  lines.push(`- Total files (probed): ${profile.totalFileCount}`);
  const topExts = Object.entries(profile.fileCountsByExt).slice(0, 6)
    .map(([e, n]) => `${e || '(no ext)'}:${n}`).join(', ');
  if (topExts) lines.push(`- Top extensions: ${topExts}`);
  lines.push('');

  if (profile.tree.length > 0) {
    lines.push(`## File Tree (first ${Math.min(profile.tree.length, 120)} entries)`);
    lines.push('```');
    lines.push(profile.tree.slice(0, 120).join('\n'));
    lines.push('```');
    lines.push('');
  }

  if (profile.keyFiles.length > 0) {
    lines.push('## Key Config Files');
    for (const kf of profile.keyFiles.slice(0, 8)) {
      lines.push(`\n### ${kf.path}\n\`\`\`\n${kf.content}\n\`\`\``);
    }
    lines.push('');
  }

  if (profile.entryPointContents.length > 0) {
    lines.push('## Entry Points');
    for (const ep of profile.entryPointContents.slice(0, 4)) {
      lines.push(`\n### ${ep.path}\n\`\`\`\n${ep.content}\n\`\`\``);
    }
    lines.push('');
  }

  if (clarity.clarifications.length > 0) {
    lines.push('## Clarity Notes (non-blocking, for awareness)');
    for (const q of clarity.clarifications) lines.push(`- ${q}`);
    lines.push(`- Clarity score: ${clarity.score}/100 (${clarity.scopeHint})`);
    lines.push('');
  }

  lines.push('Now decompose this goal into a Task DAG. Follow explore -> plan -> implement -> test -> verify.');
  return lines.join('\n');
}

/**
 * Build the user prompt for the DAG review pass.
 *
 * @param {string} goalText
 * @param {Object} initialDag
 * @param {import('./helpers.js').CodebaseProfile} profile
 * @returns {string}
 */
export function buildReviewPrompt(goalText, initialDag, profile) {
  const lines = [];
  lines.push(`## Goal\n${goalText}\n`);
  lines.push(`## Frameworks: ${profile.frameworks.join(', ') || 'none'}`);
  lines.push(`## Test frameworks: ${profile.testFrameworks.join(', ') || 'none'}\n`);
  lines.push(`## Proposed DAG\n\`\`\`json\n${JSON.stringify(initialDag, null, 2)}\n\`\`\`\n`);
  lines.push('Review this DAG. Return issues[] and verdict. If verdict is "ok", return empty issues[].');
  return lines.join('\n');
}

// ── JSON Parsing ──────────────────────────────────────────────────────────

/**
 * Extract a JSON object from possibly noisy LLM output.
 *
 * @param {string} raw
 * @returns {Object|null}
 */
export function parseJsonFromLLM(raw) {
  if (!raw) return null;
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return tryRepair(cleaned);

  try {
    return JSON.parse(match[0]);
  } catch {
    const repaired = tryRepair(match[0]);
    if (repaired) return repaired;
  }
  return null;
}

/**
 * Best-effort repair of truncated JSON (closing strings / arrays / objects).
 *
 * @param {string} str
 * @returns {Object|null}
 */
export function tryRepair(str) {
  try {
    const start = str.indexOf('{');
    if (start === -1) return null;
    let json = str.slice(start);

    let braces = 0, brackets = 0, inString = false, escape = false;
    for (let i = 0; i < json.length; i++) {
      const c = json[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{') braces++;
      else if (c === '}') braces--;
      else if (c === '[') brackets++;
      else if (c === ']') brackets--;
    }

    json = json.replace(/,\s*[^,}\]]*$/, '');
    if (inString) json += '"';
    while (brackets > 0) { json += ']'; brackets--; }
    while (braces > 0) { json += '}'; braces--; }

    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

// ── Review Merge ──────────────────────────────────────────────────────────

/**
 * Apply review feedback onto the initial DAG. Conservative: only apply fixes
 * that we can safely merge without re-invoking the LLM (add missing deps,
 * add a verify task if missing). File-collision merges are noted but deferred.
 *
 * @param {Object} initial
 * @param {Object} review
 * @returns {{ dag: Object, applied: number }}
 */
export function mergeReviewIntoDAG(initial, review) {
  const dag = JSON.parse(JSON.stringify(initial));
  const tasks = Array.isArray(dag.tasks) ? dag.tasks : [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  let applied = 0;

  const issues = Array.isArray(review?.issues) ? review.issues : [];
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const target = issue.taskId && taskMap.get(issue.taskId);

    if (issue.kind === 'missing_dep' && target) {
      // Parse "add dependsOn tX" from the fix string.
      const m = /dependsOn\s+(t\d+)/i.exec(issue.fix || '') ||
                /add\s+dep(?:endency)?\s*[:\-]?\s*(t\d+)/i.exec(issue.fix || '');
      if (m && taskMap.has(m[1]) && m[1] !== target.id) {
        target.dependsOn = Array.isArray(target.dependsOn) ? target.dependsOn : [];
        if (!target.dependsOn.includes(m[1])) {
          target.dependsOn.push(m[1]);
          applied++;
        }
      }
    }
  }

  // Ensure there is at least one verify task at the end.
  const hasVerify = tasks.some(t => t.type === 'verify');
  if (!hasVerify) {
    const lastImpl = [...tasks].reverse().find(t =>
      t.type === 'implement' || t.type === 'refactor' || t.type === 'test');
    const verifyId = `t${tasks.length + 1}`;
    const verifyTask = {
      id: verifyId,
      name: 'Final verification',
      type: 'verify',
      agentRole: 'verifier',
      prompt: 'Run all relevant verifiers and confirm the goal is satisfied end-to-end.',
      dependsOn: lastImpl ? [lastImpl.id] : [],
      allowedFiles: ['**/*'],
      estimatedMin: 10,
    };
    tasks.push(verifyTask);
    taskMap.set(verifyId, verifyTask);
    applied++;
  }

  // Ensure there is at least one test task when implements exist.
  const hasTest = tasks.some(t => t.type === 'test');
  const hasImpl = tasks.some(t => t.type === 'implement' || t.type === 'refactor');
  if (hasImpl && !hasTest) {
    const implTasks = tasks.filter(t => t.type === 'implement' || t.type === 'refactor');
    const testId = `t${tasks.length + 1}`;
    tasks.push({
      id: testId,
      name: 'Write / run tests for implemented changes',
      type: 'test',
      agentRole: 'tester',
      prompt: 'Write and run tests covering the tasks above. Use the project\'s existing test framework.',
      dependsOn: implTasks.map(t => t.id),
      allowedFiles: ['**/*.test.*', '**/*.spec.*', 'tests/**/*', 'test/**/*'],
      estimatedMin: 15,
    });
    applied++;
  }

  // Adopt revised summary if provided.
  if (review?.revisedSummary && typeof review.revisedSummary === 'string') {
    dag.summary = review.revisedSummary;
  }

  dag.tasks = tasks;
  return { dag, applied };
}

// ── Quality Scoring ───────────────────────────────────────────────────────

/**
 * Score the final DAG.
 *
 * @param {Object} dag
 * @param {import('./helpers.js').ClarityResult} clarity
 * @returns {import('./helpers.js').QualityScores}
 */
export function scoreDAG(dag, clarity) {
  const tasks = Array.isArray(dag?.tasks) ? dag.tasks : [];
  const types = tasks.map(t => t.type);

  // ── Structure: does the order start with explore, plan, end with test/verify?
  let structure = 30;
  if (types[0] === 'explore') structure += 25;
  if (types.slice(0, 3).includes('plan')) structure += 20;
  const lastTwo = types.slice(-2);
  if (lastTwo.includes('test') || lastTwo.includes('verify')) structure += 25;
  structure = Math.min(100, structure);

  // ── Coverage: do allowedFiles globs touch mentioned paths?
  let coverage = 50;
  const allGlobs = tasks.flatMap(t => Array.isArray(t.allowedFiles) ? t.allowedFiles : []);
  if (clarity.mentionedPaths.length > 0) {
    let hits = 0;
    for (const p of clarity.mentionedPaths) {
      const base = p.replace(/^(\.\/|\/)/, '').split('/')[0];
      if (allGlobs.some(g => g.includes(base) || g === '**/*')) hits++;
    }
    coverage = Math.round(30 + 70 * (hits / clarity.mentionedPaths.length));
  } else {
    coverage = 65; // no mentioned paths → assume decent
  }

  // ── Parallelism: tasks with empty dependsOn (other than root) are parallelizable.
  let parallelism = 50;
  const implTasks = tasks.filter(t =>
    t.type === 'implement' || t.type === 'refactor' || t.type === 'test');
  if (implTasks.length >= 2) {
    const independentCount = implTasks.filter(t =>
      !Array.isArray(t.dependsOn) || t.dependsOn.length === 0).length;
    // Reward a healthy mix; penalize if every impl task is sequential.
    if (independentCount === 0) parallelism = 40;
    else if (independentCount < implTasks.length) parallelism = 80;
    else parallelism = 95;
  } else {
    parallelism = 70;
  }

  // ── Test coverage: has both test and verify near the end.
  let testCoverage = 30;
  if (types.includes('test')) testCoverage += 35;
  if (types.includes('verify')) testCoverage += 35;
  testCoverage = Math.min(100, testCoverage);

  // ── Overall weighted average
  const overall = Math.round(
    structure * 0.25 +
    coverage * 0.25 +
    parallelism * 0.20 +
    testCoverage * 0.30
  );

  return {
    structure: Math.round(structure),
    coverage: Math.round(coverage),
    parallelism: Math.round(parallelism),
    testCoverage: Math.round(testCoverage),
    overall: Math.round(overall),
  };
}
