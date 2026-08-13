/**
 * DAG Builder — converts parsed task list into TaskStore-compatible structures.
 *
 * Validates:
 *   - All dependency references are valid
 *   - No cycles exist (topological sort)
 *   - Each task has a unique ID
 */

export function buildDAG(parsedTasks) {
  const taskMap = new Map();
  const tasks = [];
  const deps = [];

  // Normalize and validate tasks
  for (const t of parsedTasks) {
    if (!t.id || !t.name || !t.type) {
      throw new Error(`Invalid task: missing required fields (id, name, type). Got: ${JSON.stringify(t)}`);
    }
    if (taskMap.has(t.id)) {
      throw new Error(`Duplicate task ID: ${t.id}`);
    }
    taskMap.set(t.id, t);
    tasks.push({
      id: t.id,
      name: t.name,
      type: t.type,
      agentRole: t.agentRole ?? defaultAgentRole(t.type),
      prompt: t.prompt ?? '',
      constraints: Array.isArray(t.constraints) ? [...t.constraints] : [],
      allowedFiles: t.allowedFiles ?? ['**/*'],
      estimatedMin: t.estimatedMin ?? 10,
      language: inferTaskLanguage(t, 'js'),
    });
  }

  // Merge consecutive same-role tasks with overlapping allowedFiles
  const merged = mergeOverlappingTasks(tasks);

  // Rebuild taskMap after merging
  taskMap.clear();
  for (const t of merged) {
    taskMap.set(t.id, t);
  }

  // Build dependency edges
  for (const t of merged) {
    const originalDeps = parsedTasks.find(p => p.id === t.id)?.dependsOn ?? t.dependsOn ?? [];
    const depList = Array.isArray(originalDeps) ? originalDeps : [];
    for (const dep of depList) {
      if (!taskMap.has(dep)) {
        // Dep might have been merged into another task — try to find the merged target
        const remapped = findMergedTarget(dep, taskMap, merged);
        if (remapped && remapped !== t.id) {
          deps.push({ taskId: t.id, dependsOn: remapped });
        }
        // If dep doesn't exist at all after merge, skip it
      } else {
        if (dep !== t.id) {
          deps.push({ taskId: t.id, dependsOn: dep });
        }
      }
    }
  }

  // Cycle detection via topological sort (Kahn's algorithm)
  detectCycles(merged, deps);

  return { tasks: merged, deps };
}

/**
 * Merge consecutive implement/refactor tasks that share the same agentRole
 * and have overlapping allowedFiles patterns.
 */
function mergeOverlappingTasks(tasks) {
  const result = [];
  const mergedIds = new Set();
  const idRemap = new Map(); // old id → merged id

  for (let i = 0; i < tasks.length; i++) {
    if (mergedIds.has(tasks[i].id)) continue;

    let current = { ...tasks[i] };
    const mergeable = ['implement', 'refactor'];

    if (mergeable.includes(current.type)) {
      for (let j = i + 1; j < tasks.length; j++) {
        if (mergedIds.has(tasks[j].id)) continue;
        const next = tasks[j];

        if (next.type !== current.type || next.agentRole !== current.agentRole) continue;
        if (!hasOverlappingFiles(current.allowedFiles, next.allowedFiles)) continue;

        // Merge: combine prompts, merge allowedFiles, sum estimates
        current = {
          id: current.id,
          name: `${current.name}; ${next.name}`,
          type: current.type,
          agentRole: current.agentRole,
          prompt: `${current.prompt}\n\n---\n\n${next.prompt}`,
          constraints: [...new Set([...(current.constraints || []), ...(next.constraints || [])])],
          allowedFiles: [...new Set([...current.allowedFiles, ...next.allowedFiles])],
          estimatedMin: Math.max(current.estimatedMin, next.estimatedMin),
          dependsOn: [...new Set([...(current.dependsOn || []), ...(next.dependsOn || [])])].filter(d => d !== current.id),
          language: inferTaskLanguage({
            name: `${current.name}; ${next.name}`,
            prompt: `${current.prompt}\n\n---\n\n${next.prompt}`,
            allowedFiles: [...new Set([...current.allowedFiles, ...next.allowedFiles])],
          }, current.language || next.language || 'js'),
        };
        mergedIds.add(next.id);
        idRemap.set(next.id, current.id);
        console.log(`[forge:dag-builder] Merged task ${next.id} into ${current.id} (overlapping files)`);
      }
    }

    result.push(current);
  }

  // Apply id remapping to remaining dependsOn references
  for (const t of result) {
    if (t.dependsOn) {
      t.dependsOn = t.dependsOn.map(d => idRemap.get(d) || d);
    }
  }

  return result;
}

/**
 * Check if two allowedFiles arrays have overlapping glob patterns.
 * Simple heuristic: check if any pattern shares a directory prefix.
 */
function hasOverlappingFiles(filesA, filesB) {
  if (!filesA || !filesB) return false;
  for (const a of filesA) {
    for (const b of filesB) {
      // Exact match or one is a prefix/glob of the other
      if (a === b) return true;
      const dirA = a.replace(/\/\*\*?.*$/, '').replace(/\*+$/, '');
      const dirB = b.replace(/\/\*\*?.*$/, '').replace(/\*+$/, '');
      if (dirA && dirB && (dirA.startsWith(dirB) || dirB.startsWith(dirA))) return true;
    }
  }
  return false;
}

/**
 * Find the merged task ID that contains the given original task ID.
 */
function findMergedTarget(oldId, taskMap, mergedTasks) {
  if (taskMap.has(oldId)) return oldId;
  // Check if oldId was merged into something
  for (const t of mergedTasks) {
    if (t.id === oldId) return oldId;
  }
  return null;
}

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

const LANG_PRIORITY = ['ts', 'js', 'python', 'go', 'rust', 'java'];

const TASK_LANGUAGE_PATTERNS = [
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

function inferLanguageFromAllowedFiles(patterns) {
  const languageVotes = new Map();
  const items = Array.isArray(patterns) ? patterns : [];
  for (const pattern of items) {
    const hits = String(pattern)
      .toLowerCase()
      .match(/\.(ts|tsx|js|mjs|cjs|jsx|py|go|rs|java)\b/g);
    if (!hits || hits.length === 0) continue;
    for (const ext of hits) {
      const mapped = EXT_TO_LANGUAGE[ext];
      if (!mapped) continue;
      languageVotes.set(mapped, (languageVotes.get(mapped) || 0) + 1);
    }
  }

  for (const language of LANG_PRIORITY) {
    if ((languageVotes.get(language) || 0) > 0) return language;
  }
  return null;
}

function inferLanguageFromTextHint(text) {
  const normalized = String(text || '').toLowerCase();
  for (const { pattern, language } of TASK_LANGUAGE_PATTERNS) {
    if (pattern.test(normalized)) return language;
  }
  return null;
}

function inferTaskLanguage(task, fallbackLanguage = 'js') {
  const fromFiles = inferLanguageFromAllowedFiles(task?.allowedFiles ?? []);
  if (fromFiles) return fromFiles;
  const fromText = inferLanguageFromTextHint(`${task?.name ?? ''} ${task?.prompt ?? ''}`);
  if (fromText) return fromText;
  return normalizeLanguageCandidate(fallbackLanguage) || 'js';
}

function detectCycles(tasks, deps) {
  const inDegree = new Map();
  const adjacency = new Map();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adjacency.set(t.id, []);
  }

  for (const d of deps) {
    adjacency.get(d.dependsOn).push(d.taskId);
    inDegree.set(d.taskId, (inDegree.get(d.taskId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()].filter(([, v]) => v === 0).map(([k]) => k);
  let processed = 0;

  while (queue.length > 0) {
    const node = queue.shift();
    processed++;
    for (const neighbor of (adjacency.get(node) ?? [])) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (processed < tasks.length) {
    throw new Error(`Cycle detected in task DAG. Processed ${processed}/${tasks.length} tasks.`);
  }
}

function defaultAgentRole(type) {
  const roleMap = {
    explore: 'code-archaeologist',
    plan: 'architect',
    implement: 'coder',
    test: 'tester',
    verify: 'verifier',
    debug: 'debugger',
    review: 'reviewer',
    refactor: 'coder',
    'generate-image': 'image-generator',
    'generate-embedding': 'embedding-generator',
    'generate-audio': 'audio-generator',
    'generate-video': 'video-generator',
    'transcribe': 'audio-generator',
  };
  return roleMap[type] ?? 'coder';
}
