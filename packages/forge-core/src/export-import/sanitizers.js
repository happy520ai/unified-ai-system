/**
 * Sanitizers and validation helpers for goal export/import.
 *
 * Extracted from export-import/index.js to keep the main module
 * under the 500-line layering limit.
 */

/**
 * Export format version. Increment when making breaking changes to the schema.
 */
export const EXPORT_VERSION = 2;

/**
 * Minimum importable version.
 */
export const MIN_IMPORT_VERSION = 1;

/**
 * Sanitize a goal record for export (remove internal fields if needed).
 * @param {object} goal
 * @returns {object}
 */
export function sanitizeGoal(goal) {
  return {
    id: goal.id,
    text: goal.text,
    status: goal.status,
    project_root: goal.project_root,
    compiled_dag: goal.compiled_dag ?? null,
    budget_json: goal.budget_json ?? null,
    created_at: goal.created_at,
    updated_at: goal.updated_at,
    completed_at: goal.completed_at ?? null,
  };
}

/**
 * Sanitize a task record for export.
 * @param {object} task
 * @returns {object}
 */
export function sanitizeTask(task) {
  return {
    id: task.id,
    goal_id: task.goal_id,
    name: task.name,
    type: task.type,
    status: task.status,
    agent_role: task.agent_role ?? null,
    prompt: task.prompt ?? null,
    result_json: task.result_json ?? null,
    error_message: task.error_message ?? null,
    started_at: task.started_at ?? null,
    completed_at: task.completed_at ?? null,
    retry_count: task.retry_count ?? 0,
    max_retries: task.max_retries ?? 2,
    allowed_files: task.allowed_files ?? null,
    estimated_min: task.estimated_min ?? null,
  };
}

/**
 * Sanitize a dependency record for export.
 * @param {object} dep
 * @returns {object}
 */
export function sanitizeDep(dep) {
  return {
    goal_id: dep.goal_id,
    task_id: dep.task_id,
    depends_on: dep.depends_on,
  };
}

/**
 * Sanitize a checkpoint record for export.
 * @param {object} checkpoint
 * @returns {object}
 */
export function sanitizeCheckpoint(checkpoint) {
  return {
    id: checkpoint.id,
    goal_id: checkpoint.goal_id,
    after_task_id: checkpoint.after_task_id ?? null,
    git_commit: checkpoint.git_commit ?? null,
    modified_files: checkpoint.modified_files ?? null,
    new_files: checkpoint.new_files ?? null,
    context_summary: checkpoint.context_summary ?? null,
    key_decisions: checkpoint.key_decisions ?? null,
    budget_snapshot: checkpoint.budget_snapshot ?? null,
    created_at: checkpoint.created_at,
  };
}

/**
 * Sanitize an artifact record for export.
 * @param {object} artifact
 * @returns {object}
 */
export function sanitizeArtifact(artifact) {
  return {
    id: artifact.id,
    goal_id: artifact.goal_id,
    task_id: artifact.task_id,
    file_path: artifact.file_path,
    action: artifact.action,
    diff_text: artifact.diff_text ?? null,
    hash_before: artifact.hash_before ?? null,
    hash_after: artifact.hash_after ?? null,
    created_at: artifact.created_at,
  };
}

/**
 * Sanitize an event record for export.
 * @param {object} event
 * @returns {object}
 */
export function sanitizeEvent(event) {
  return {
    id: event.id,
    goal_id: event.goal_id,
    task_id: event.task_id ?? null,
    event_type: event.event_type,
    payload: event.payload ?? null,
    created_at: event.created_at,
  };
}

/**
 * Validate the export data structure before importing.
 * @param {object} data
 * @throws {Error} if validation fails
 */
export function validateExport(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Export data must be a non-null object');
  }

  if (typeof data.version !== 'number') {
    throw new Error('Export data missing version field');
  }
  if (data.version < MIN_IMPORT_VERSION) {
    throw new Error(
      `Export version ${data.version} is too old (minimum supported: ${MIN_IMPORT_VERSION}). ` +
      'Please re-export from a newer version of Forge.'
    );
  }
  if (data.version > EXPORT_VERSION) {
    console.warn(
      `[forge:transfer] Export version ${data.version} is newer than supported version ${EXPORT_VERSION}. ` +
      'Some data may not import correctly.'
    );
  }

  if (!data.goal || typeof data.goal !== 'object') {
    throw new Error('Export data missing required "goal" object');
  }
  if (!Array.isArray(data.tasks)) {
    throw new Error('Export data missing required "tasks" array');
  }
  if (!data.goal.id) {
    throw new Error('Export goal missing "id" field');
  }
  if (!data.goal.text) {
    throw new Error('Export goal missing "text" field');
  }

  for (const task of data.tasks) {
    if (!task.id) throw new Error(`Task missing "id" field`);
    if (!task.name) throw new Error(`Task ${task.id} missing "name" field`);
    if (!task.type) throw new Error(`Task ${task.id} missing "type" field`);
  }

  if (Array.isArray(data.deps)) {
    const taskIds = new Set(data.tasks.map(t => t.id));
    for (const dep of data.deps) {
      if (!taskIds.has(dep.task_id)) {
        console.warn(`[forge:transfer] Dep references unknown task: ${dep.task_id} (will be skipped)`);
      }
      if (!taskIds.has(dep.depends_on)) {
        console.warn(`[forge:transfer] Dep references unknown dependency: ${dep.depends_on} (will be skipped)`);
      }
    }
  }
}
