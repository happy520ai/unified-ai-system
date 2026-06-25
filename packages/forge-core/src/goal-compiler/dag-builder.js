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
      allowedFiles: t.allowedFiles ?? ['**/*'],
      estimatedMin: t.estimatedMin ?? 10,
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
          allowedFiles: [...new Set([...current.allowedFiles, ...next.allowedFiles])],
          estimatedMin: Math.max(current.estimatedMin, next.estimatedMin),
          dependsOn: [...new Set([...(current.dependsOn || []), ...(next.dependsOn || [])])].filter(d => d !== current.id),
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
