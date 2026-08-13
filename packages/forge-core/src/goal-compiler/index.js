/**
 * Forge Goal Compiler — compiles a natural-language goal into an executable Task DAG.
 *
 * Steps:
 *   1. Probe the codebase (file tree, key files, framework detection)
 *   2. Send goal + codebase context to LLM for task decomposition
 *   3. Parse the LLM response into a structured DAG
 *   4. Store the DAG in the TaskStore
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { buildDAG } from './dag-builder.js';
import { callLLM } from '../llm-client.js';

const LANGUAGE_PRIORITY = ['ts', 'js', 'python', 'go', 'rust', 'java'];
const EXT_TO_LANGUAGE = Object.freeze({
  '.ts': 'ts',
  '.tsx': 'ts',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'js',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
});
const GOAL_TEXT_LANGUAGE_PATTERNS = [
  { pattern: /\b(type\s*script|typescript|ts)\b/, language: 'ts' },
  { pattern: /\b(java\s*script|javascript|js|node\.js|nodejs)\b/, language: 'js' },
  { pattern: /\b(python|py)\b/, language: 'python' },
  { pattern: /\b(go|golang)\b/, language: 'go' },
  { pattern: /\brust\b/, language: 'rust' },
  { pattern: /\bjava\b/, language: 'java' },
];

function normalizeLanguageCandidate(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v === 'typescript') return 'ts';
  if (v === 'javascript' || v === 'nodejs' || v === 'node.js') return 'js';
  if (v === 'py' || v === 'python') return 'python';
  if (v === 'golang' || v === 'go') return 'go';
  if (v === 'rust' || v === 'java') return v;
  if (v === 'ts') return 'ts';
  if (v === 'js') return 'js';
  return null;
}

function inferLanguageFromText(text) {
  const normalized = String(text || '').toLowerCase();
  const extMatch = normalized.match(/\b[\w.-]+\.(ts|tsx|js|jsx|py|go|rs|java)\b/g);
  if (extMatch?.length > 0) {
    const extension = extMatch[0].slice(extMatch[0].lastIndexOf('.')).toLowerCase();
    const matchLang = EXT_TO_LANGUAGE[extension];
    if (matchLang) return matchLang;
  }

  for (const { pattern, language } of GOAL_TEXT_LANGUAGE_PATTERNS) {
    if (pattern.test(normalized)) return language;
  }
  return null;
}

function inferTaskLanguage(task, fallbackLanguage = 'js', goalText = '') {
  const fromFiles = inferLanguageFromAllowedFiles(task?.allowedFiles ?? []);
  if (fromFiles) return fromFiles;
  const fromText = inferLanguageFromText(`${task?.name ?? ''} ${task?.prompt ?? ''} ${goalText ?? ''}`);
  if (fromText) return fromText;
  return normalizeLanguageCandidate(fallbackLanguage) || 'js';
}

function inferLanguageFromAllowedFiles(patterns) {
  const languageVotes = new Map();
  const list = Array.isArray(patterns) ? patterns : [];
  for (const pattern of list) {
    const matches = String(pattern).toLowerCase().match(/\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java)\b/g);
    if (!matches || matches.length === 0) continue;
    for (const ext of matches) {
      const mapped = EXT_TO_LANGUAGE[ext];
      if (!mapped) continue;
      languageVotes.set(mapped, (languageVotes.get(mapped) || 0) + 1);
    }
  }

  for (const language of LANGUAGE_PRIORITY) {
    if ((languageVotes.get(language) || 0) > 0) return language;
  }
  return null;
}

function inferLanguageFromTree(tree) {
  const counts = new Map();
  for (const rel of tree) {
    const language = EXT_TO_LANGUAGE[extname(rel).toLowerCase()];
    if (!language) continue;
    counts.set(language, (counts.get(language) || 0) + 1);
  }
  for (const language of LANGUAGE_PRIORITY) {
    if ((counts.get(language) || 0) > 0) return language;
  }
  return 'js';
}

function buildLanguagePreferenceText(language, taskLanguage = null) {
  const normalizedLanguage = normalizeLanguageCandidate(language) || 'js';
  if (!taskLanguage || normalizeLanguageCandidate(taskLanguage) === normalizedLanguage) {
    return `Default implementation language: ${normalizedLanguage === 'ts' ? 'TypeScript' : normalizedLanguage === 'js' ? 'JavaScript' : normalizedLanguage}.`;
  }
  const normalizedTaskLanguage = normalizeLanguageCandidate(taskLanguage) || normalizedLanguage;
  const taskMap = { ts: 'TypeScript', js: 'JavaScript', python: 'Python', go: 'Go', rust: 'Rust', java: 'Java' };
  return `Primary task language: ${taskMap[normalizedTaskLanguage] ?? normalizedTaskLanguage}. Project default remains ${taskMap[normalizedLanguage] ?? normalizedLanguage}.`;
}

const MAX_PROBE_FILES = 80;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.turbo', 'legacy']);

// ── Codebase probing ────────────────────────────────────────────────────

async function probeCodebase(projectRoot, depth = 4) {
  const tree = [];
  const keyFiles = [];
  let count = 0;

  async function walk(dir, d) {
    if (d > depth || count >= MAX_PROBE_FILES) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (count >= MAX_PROBE_FILES) break;
      const full = join(dir, entry.name);
      const rel = relative(projectRoot, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          tree.push(`${rel}/`);
          await walk(full, d + 1);
        }
      } else {
        count++;
        tree.push(rel);
        // Read key config files for context
        if (isKeyFile(entry.name)) {
          try {
            const content = await readFile(full, 'utf-8');
            keyFiles.push({ path: rel, content: content.slice(0, 3000) });
          } catch { /* skip unreadable */ }
        }
      }
    }
  }

  await walk(projectRoot, 0);
  return { tree, keyFiles };
}

function isKeyFile(name) {
  const keys = ['package.json', 'tsconfig.json', '.env.example', 'README.md',
    'vite.config.ts', 'next.config.js', 'jest.config.js', 'vitest.config.ts',
    'docker-compose.yml', 'Makefile', 'pnpm-workspace.yaml'];
  return keys.includes(name);
}

// ── Goal Compiler ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Forge Goal Compiler. Your job is to decompose a user's coding goal into an executable Task DAG.

You MUST respond with a valid JSON object in this exact format (no markdown fences, no extra text):

{
  "tasks": [
    {
      "id": "t1",
      "name": "short description",
      "type": "explore|plan|implement|test|verify|debug|review|refactor|web|scrape|generate-image|generate-embedding|generate-audio|generate-video|transcribe",
      "agentRole": "code-archaeologist|architect|coder|tester|verifier|debugger|reviewer|web|image-generator|embedding-generator|audio-generator|video-generator",
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
1. ALWAYS start with an explore task (type: explore) to understand the codebase before any changes.
2. Follow with a plan task (type: plan) to design the approach.
3. Implementation tasks should be specific and scoped to a few files each.
4. Implementation tasks that don't depend on each other can run in parallel (just list their real deps).
5. ALWAYS end with test and verify tasks.
6. Keep prompts detailed enough that a worker agent can execute without ambiguity.
7. allowedFiles should be restrictive globs — only files the task should touch.
8. The entire DAG should typically have 5-10 tasks for a medium goal.
9. MERGE tasks that modify the SAME file: If multiple implementation changes target the same file, combine them into ONE implement task rather than splitting them. This prevents conflicts and redundant work.
10. PREFER fewer, broader tasks over many narrow ones. Each task should produce a complete, testable change.
11. For multimodal tasks (generate-image, generate-embedding, generate-audio, generate-video, transcribe), use the matching agentRole. These tasks produce binary artifacts, not code edits. Include the prompt/text/input in the task prompt field and any model/size/voice preferences.
12. For WEB AUTOMATION tasks (navigate websites, fill forms, click buttons, extract data from web pages, follow operation manuals), use type "web" or "scrape" with agentRole "web". Include the target URL in the task's prompt or a "url" field, and operation steps in the prompt. The web worker drives a real browser via Playwright + LLM.`;

export async function compileGoal(store, { goalText, projectRoot }) {
  const goalId = store.createGoal({ text: goalText, projectRoot, budget: { maxMinutes: 120 } });
  store.logEvent(goalId, null, 'goal_created', { text: goalText });

  // Step 1: Probe the codebase
  console.log('[forge:compiler] Probing codebase...');
  const { tree, keyFiles } = await probeCodebase(projectRoot);

  // Step 2: Build the LLM prompt
  const preferredLanguage = inferLanguageFromText(goalText) || inferLanguageFromTree(tree);
  const languageConstraintText = buildLanguagePreferenceText(preferredLanguage);
  const userPrompt = buildUserPrompt(goalText, tree, keyFiles, preferredLanguage);

  // Step 3: Call LLM to decompose goal (with timeout)
  console.log('[forge:compiler] Decomposing goal via LLM...');
  const llmResponse = await Promise.race([
    callLLM(SYSTEM_PROMPT, userPrompt, { maxTokens: 16384, temperature: 0.1 }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("LLM call timed out after 120s")), 120_000)),
  ]);

  // Step 4: Parse the DAG
  let parsed;
  try {
    console.log(`[forge:compiler] LLM response length: ${llmResponse.length} chars`);
    console.log(`[forge:compiler] Response preview: ${llmResponse.slice(0, 500)}`);

    // Debug: dump full response for diagnosis (only when FORGE_DEBUG_LLM=true)
    if (process.env.FORGE_DEBUG_LLM === "true") {
      try {
        const { writeFileSync } = await import('node:fs');
        writeFileSync('forge-llm-debug.json', llmResponse, 'utf-8');
        console.log('[forge:compiler] Full response written to forge-llm-debug.json');
      } catch { /* best-effort: debug dump must not block main flow */ }
    }

    // Try multiple JSON extraction strategies
    let jsonStr = llmResponse
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Sanitize: strip control characters (except \n, \r, \t) that break JSON.parse
    jsonStr = jsonStr.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

    // Strategy 1: Find the outermost { ... }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Strategy 2: Try to repair truncated JSON
      const repaired = repairTruncatedJSON(jsonStr);
      if (repaired) {
        console.log('[forge:compiler] Repaired truncated JSON');
        parsed = JSON.parse(repaired);
      } else {
        throw new Error('No JSON object found in response');
      }
    } else {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        console.log(`[forge:compiler] Initial parse failed: ${parseErr.message}`);
        // Strategy 3a: Fix unescaped newlines/tabs inside JSON strings
        const sanitized = jsonMatch[0].replace(/(?<=:\s*"[^"]*)\n/g, '\\n')
          .replace(/(?<=:\s*"[^"]*)\r/g, '\\r')
          .replace(/(?<=:\s*"[^"]*)\t/g, '\\t');
        try {
          parsed = JSON.parse(sanitized);
          console.log('[forge:compiler] Parsed after newline sanitization');
        } catch {
          // Strategy 3b: Try repairing the matched JSON
          const repaired = repairTruncatedJSON(jsonMatch[0]);
          if (repaired) {
            console.log('[forge:compiler] Repaired partially truncated JSON');
            parsed = JSON.parse(repaired);
          } else {
            throw new Error(`JSON found but unparseable and unrepairable: ${parseErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    store.updateGoalStatus(goalId, 'failed');
    store.logEvent(goalId, null, 'compile_failed', { error: err.message, rawResponse: llmResponse.slice(0, 2000) });
    throw new Error(`Failed to parse goal compilation: ${err.message}\n\nRaw response:\n${llmResponse.slice(0, 1000)}`);
  }

  // Step 5: Build and store the DAG
  if (Array.isArray(parsed.tasks)) {
    parsed.tasks = parsed.tasks.map((task) => {
      const taskLanguage = inferTaskLanguage(task, preferredLanguage, goalText);
      const shouldAttachConstraint = ['implement', 'test', 'refactor'].includes(task.type);
      let constraints = Array.isArray(task.constraints) ? [...task.constraints] : [];
      if (shouldAttachConstraint) {
        const langConstraint = buildLanguagePreferenceText(preferredLanguage, taskLanguage);
        if (!constraints.includes(langConstraint)) constraints.push(langConstraint);
        if (languageConstraintText !== langConstraint && !constraints.includes(languageConstraintText)) {
          constraints.push(languageConstraintText);
        }
      }
      return { ...task, language: taskLanguage, constraints };
    });
  }

  const { tasks, deps } = buildDAG(parsed.tasks);

  store.insertTaskDAG(goalId, tasks, deps);
  store.updateGoalStatus(goalId, 'compiled', JSON.stringify(parsed));
  store.logEvent(goalId, null, 'goal_compiled', {
    taskCount: tasks.length,
    summary: parsed.summary,
    checkpoints: parsed.checkpoints,
  });

  console.log(`[forge:compiler] Goal compiled: ${tasks.length} tasks, DAG stored.`);
  return { goalId, taskCount: tasks.length, summary: parsed.summary };
}

function buildUserPrompt(goalText, tree, keyFiles, preferredLanguage = 'js') {
  let prompt = `## Goal\n${goalText}\n\n`;
  if (preferredLanguage) {
    prompt += `## Preferred Language\n${preferredLanguage}\n\n`;
  }
  prompt += `## Project File Tree (first ${tree.length} entries)\n\`\`\`\n${tree.join('\n')}\n\`\`\`\n\n`;

  if (keyFiles.length > 0) {
    prompt += `## Key Files\n`;
    for (const kf of keyFiles) {
      prompt += `\n### ${kf.path}\n\`\`\`\n${kf.content}\n\`\`\`\n`;
    }
  }

  prompt += `\nNow decompose this goal into a Task DAG. Remember: explore first, then plan, then implement, then test, then verify.`;
  return prompt;
}

/**
 * Attempt to repair truncated JSON from LLM output.
 * Handles cases where the response was cut off mid-array or mid-object.
 */
function repairTruncatedJSON(str) {
  try {
    // Find the start of the JSON object
    const start = str.indexOf('{');
    if (start === -1) return null;

    let json = str.slice(start);

    // Count unmatched braces/brackets
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escape = false;

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

    // Remove trailing partial content (incomplete string or value)
    // Find the last complete JSON value
    json = json.replace(/,\s*[^,}\]]*$/, '');

    // Close any unclosed strings
    if (inString) json += '"';

    // Close brackets and braces
    while (brackets > 0) { json += ']'; brackets--; }
    while (braces > 0) { json += '}'; braces--; }

    // Try to parse
    const result = JSON.parse(json);

    // Validate it has the required structure
    if (result.tasks && Array.isArray(result.tasks) && result.tasks.length > 0) {
      // Add defaults for missing fields
      if (!result.summary) result.summary = 'Compiled from truncated response';
      if (!result.checkpoints) result.checkpoints = [];
      return JSON.stringify(result);
    }

    return null;
  } catch {
    return null;
  }
}
