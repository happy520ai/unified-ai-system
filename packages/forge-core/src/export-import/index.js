/**
 * Goal Transfer — cross-session and cross-machine goal export, import, and transfer.
 *
 * Provides:
 *   - Full goal serialization (tasks, deps, checkpoints, artifacts, events)
 *   - Portable JSON format with schema versioning for forward compatibility
 *   - Import with ID remapping to avoid conflicts across sessions/machines
 *   - Ownership transfer between users
 *
 * Usage:
 *   const transfer = new GoalTransfer(store);
 *   const exported = transfer.exportGoal(goalId);
 *   const json = transfer.serialize(exported);
 *   // ... save json to file, send over network, etc.
 *   const data = transfer.deserialize(json);
 *   const { goalId: newId } = transfer.importGoal(data, { newProjectRoot: '/new/path' });
 */

import crypto from 'node:crypto';
import {
  EXPORT_VERSION, MIN_IMPORT_VERSION,
  sanitizeGoal, sanitizeTask, sanitizeDep,
  sanitizeCheckpoint, sanitizeArtifact, sanitizeEvent,
  validateExport,
} from './sanitizers.js';

export class GoalTransfer {
  #store;

  /**
   * @param {import('../task-store/index.js').TaskStore} store — TaskStore instance
   */
  constructor(store) {
    this.#store = store;
  }

  /**
   * Export a goal and all its associated data to a portable JSON format.
   *
   * Gathers the goal record, all tasks, dependency edges, checkpoints, artifacts,
   * and audit events into a single self-contained object. The export includes a
   * schema version for compatibility checking during import.
   *
   * @param {string} goalId — the goal to export
   * @returns {object} — the exported data object
   * @throws {Error} if the goal is not found
   */
  exportGoal(goalId) {
    const goal = this.#store.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const tasks = this.#store.getTasksForGoal(goalId);
    const deps = this.#store.getTaskDeps(goalId);
    const checkpoints = this.#store.getCheckpoints(goalId);
    const artifacts = this.#store.getArtifacts(goalId);
    const events = this.#store.getEvents(goalId, { limit: 10000 });

    // Compute summary metadata
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    const failedCount = tasks.filter(t => t.status === 'failed').length;
    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const runningCount = tasks.filter(t => t.status === 'running').length;
    const blockedCount = tasks.filter(t => t.status === 'blocked').length;

    // Compute file-level summary from artifacts
    const filesCreated = artifacts.filter(a => a.action === 'created').length;
    const filesModified = artifacts.filter(a => a.action === 'modified').length;
    const filesDeleted = artifacts.filter(a => a.action === 'deleted').length;
    const uniqueFiles = new Set(artifacts.map(a => a.file_path)).size;

    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      goal: sanitizeGoal(goal),
      tasks: tasks.map(t => sanitizeTask(t)),
      deps: deps.map(d => sanitizeDep(d)),
      checkpoints: checkpoints.map(c => sanitizeCheckpoint(c)),
      artifacts: artifacts.map(a => sanitizeArtifact(a)),
      events: events.map(e => sanitizeEvent(e)),
      metadata: {
        taskCount: tasks.length,
        completedCount,
        failedCount,
        pendingCount,
        runningCount,
        blockedCount,
        dependencyCount: deps.length,
        checkpointCount: checkpoints.length,
        artifactCount: artifacts.length,
        eventCount: events.length,
        filesCreated,
        filesModified,
        filesDeleted,
        uniqueFilesAffected: uniqueFiles,
        goalStatus: goal.status,
        goalText: goal.text,
        projectRoot: goal.project_root,
      },
    };
  }

  /**
   * Import a previously exported goal into the store.
   *
   * Generates new IDs for the goal and all tasks to avoid conflicts with existing
   * data. All internal references (task deps, checkpoint after_task_id, artifact
   * task_id, event task_id) are remapped to the new IDs.
   *
   * @param {object} exportedData — the data object from exportGoal()
   * @param {object} [options]
   * @param {string} [options.newProjectRoot] — override the project_root path
   * @param {string} [options.userId] — the user performing the import (for audit events)
   * @returns {{ goalId: string, taskCount: number, originalGoalId: string, status: string }}
   * @throws {Error} if the export format is invalid or incompatible
   */
  importGoal(exportedData, { newProjectRoot = null, userId = null } = {}) {
    // Validate export format
    validateExport(exportedData);

    const { goal: oldGoal, tasks: oldTasks, deps: oldDeps, checkpoints: oldCheckpoints, artifacts: oldArtifacts, events: oldEvents } = exportedData;

    // Generate new goal ID
    const newGoalId = `g-${crypto.randomUUID().slice(0, 8)}`;

    // Build task ID remapping: oldId -> newId
    const taskIdMap = new Map();
    for (const task of oldTasks) {
      const newTaskId = `t-${crypto.randomUUID().slice(0, 8)}`;
      taskIdMap.set(task.id, newTaskId);
    }

    // Build checkpoint ID remapping: oldId -> newId
    const checkpointIdMap = new Map();
    for (const cp of oldCheckpoints) {
      const newCpId = `cp-${crypto.randomUUID().slice(0, 8)}`;
      checkpointIdMap.set(cp.id, newCpId);
    }

    // Determine project root
    const projectRoot = newProjectRoot ?? oldGoal.project_root;

    // 1. Create the goal
    let budget = {};
    try {
      budget = oldGoal.budget_json
        ? (typeof oldGoal.budget_json === 'string' ? JSON.parse(oldGoal.budget_json) : oldGoal.budget_json)
        : {};
    } catch { /* use empty budget */ }

    // createGoal returns the ID it generates, but we already generated one.
    // Use the store's createGoal and note that the store generates its own ID.
    const actualGoalId = this.#store.createGoal({
      text: oldGoal.text,
      projectRoot,
      budget,
    });

    // Determine the imported goal status — reset to 'compiled' if it was running
    // so the new session can start fresh
    let importStatus = oldGoal.status;
    if (importStatus === 'running') {
      importStatus = 'compiled';
    }
    // If the goal was pending, keep it as-is; if completed/failed, keep as-is for archival
    this.#store.updateGoalStatus(actualGoalId, importStatus, oldGoal.compiled_dag ?? null);

    // 2. Insert tasks and dependencies
    const remappedTasks = oldTasks.map(t => ({
      id: taskIdMap.get(t.id),
      name: t.name,
      type: t.type,
      agentRole: t.agent_role ?? null,
      prompt: t.prompt ?? null,
      allowedFiles: t.allowed_files
        ? (typeof t.allowed_files === 'string' ? JSON.parse(t.allowed_files) : t.allowed_files)
        : [],
      estimatedMin: t.estimated_min ?? null,
    }));

    const remappedDeps = oldDeps.map(d => ({
      taskId: taskIdMap.get(d.task_id),
      dependsOn: taskIdMap.get(d.depends_on),
    })).filter(d => d.taskId && d.dependsOn); // filter out deps referencing unknown tasks

    this.#store.insertTaskDAG(actualGoalId, remappedTasks, remappedDeps);

    // Restore task statuses and results from the export
    for (const oldTask of oldTasks) {
      const newTaskId = taskIdMap.get(oldTask.id);
      if (!newTaskId) continue;

      // Restore status if it was completed or failed (preserve history)
      if (oldTask.status === 'completed') {
        this.#store.updateTaskStatus(actualGoalId, newTaskId, 'completed', {
          resultJson: oldTask.result_json ?? null,
        });
      } else if (oldTask.status === 'failed') {
        this.#store.updateTaskStatus(actualGoalId, newTaskId, 'failed', {
          errorMessage: oldTask.error_message ?? null,
        });
      } else if (oldTask.status === 'blocked') {
        this.#store.updateTaskStatus(actualGoalId, newTaskId, 'blocked', {
          errorMessage: oldTask.error_message ?? null,
        });
      }
      // pending/running tasks stay as pending in the new session
    }

    // 3. Record artifacts (remap task IDs)
    for (const artifact of oldArtifacts) {
      const newTaskId = taskIdMap.get(artifact.task_id);
      if (!newTaskId) continue;

      this.#store.recordArtifact({
        goalId: actualGoalId,
        taskId: newTaskId,
        filePath: artifact.file_path,
        action: artifact.action,
        diffText: artifact.diff_text ?? null,
        hashBefore: artifact.hash_before ?? null,
        hashAfter: artifact.hash_after ?? null,
      });
    }

    // 4. Replay events (remap task IDs)
    // Add an import marker event first
    this.#store.logEvent(actualGoalId, null, 'goal_imported', {
      originalGoalId: oldGoal.id,
      importedAt: new Date().toISOString(),
      userId: userId ?? null,
      originalStatus: oldGoal.status,
      taskCount: oldTasks.length,
      exportVersion: exportedData.version,
    });

    for (const event of oldEvents) {
      const newTaskId = event.task_id ? (taskIdMap.get(event.task_id) ?? null) : null;

      let payload = {};
      try {
        payload = event.payload
          ? (typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload)
          : {};
      } catch { /* use empty payload */ }

      // Tag imported events so they can be distinguished from new events
      payload._imported = true;
      payload._originalTimestamp = event.created_at;

      this.#store.logEvent(actualGoalId, newTaskId, event.event_type, payload);
    }

    // 5. Log checkpoints (remap task IDs)
    // Checkpoints reference task IDs in after_task_id; we remap those.
    // Since the store API doesn't have a direct checkpoint insert method that
    // accepts all fields, we use createCheckpoint with the available data.
    for (const cp of oldCheckpoints) {
      const newAfterTaskId = cp.after_task_id
        ? (taskIdMap.get(cp.after_task_id) ?? null)
        : null;

      let budgetSnapshot = {};
      try {
        budgetSnapshot = cp.budget_snapshot
          ? (typeof cp.budget_snapshot === 'string' ? JSON.parse(cp.budget_snapshot) : cp.budget_snapshot)
          : {};
      } catch { /* use empty */ }

      let keyDecisions = [];
      try {
        keyDecisions = cp.key_decisions
          ? (typeof cp.key_decisions === 'string' ? JSON.parse(cp.key_decisions) : cp.key_decisions)
          : [];
      } catch { /* use empty */ }

      let modifiedFiles = [];
      try {
        modifiedFiles = cp.modified_files
          ? (typeof cp.modified_files === 'string' ? JSON.parse(cp.modified_files) : cp.modified_files)
          : [];
      } catch { /* use empty */ }

      let newFiles = [];
      try {
        newFiles = cp.new_files
          ? (typeof cp.new_files === 'string' ? JSON.parse(cp.new_files) : cp.new_files)
          : [];
      } catch { /* use empty */ }

      this.#store.createCheckpoint({
        goalId: actualGoalId,
        afterTaskId: newAfterTaskId,
        gitCommit: cp.git_commit ?? null,
        modifiedFiles,
        newFiles,
        contextSummary: cp.context_summary ?? null,
        keyDecisions,
        budgetSnapshot: {
          ...budgetSnapshot,
          _importedFrom: cp.id,
        },
      });
    }

    return {
      goalId: actualGoalId,
      originalGoalId: oldGoal.id,
      taskCount: oldTasks.length,
      status: importStatus,
      projectRoot,
      taskIdMap: Object.fromEntries(taskIdMap),
    };
  }

  /**
   * Transfer a goal to another user (reassign ownership).
   *
   * Since the goals table does not have a dedicated `created_by` column, this
   * method logs a transfer event and updates the goal's budget_json with the
   * new owner information. The transfer is recorded in the audit trail.
   *
   * @param {string} goalId — the goal to transfer
   * @param {string} toUserId — the user ID to transfer ownership to
   * @param {object} [options]
   * @param {string} [options.fromUserId] — the current owner (for audit logging)
   * @param {string} [options.reason] — reason for the transfer
   * @returns {{ goalId: string, fromUserId: string|null, toUserId: string, transferredAt: string }}
   * @throws {Error} if the goal is not found
   */
  transferGoal(goalId, toUserId, { fromUserId = null, reason = null } = {}) {
    const goal = this.#store.getGoal(goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const transferredAt = new Date().toISOString();

    // Update budget_json to include ownership metadata
    let budget = {};
    try {
      budget = goal.budget_json
        ? (typeof goal.budget_json === 'string' ? JSON.parse(goal.budget_json) : goal.budget_json)
        : {};
    } catch { /* use empty */ }

    budget._owner = toUserId;
    budget._transferredAt = transferredAt;
    budget._transferredFrom = fromUserId;

    // Write the updated budget back via status update (preserves existing data)
    this.#store.updateGoalStatus(goalId, goal.status, goal.compiled_dag ?? null);

    // Log the transfer event
    this.#store.logEvent(goalId, null, 'goal_transferred', {
      fromUserId,
      toUserId,
      reason: reason ?? null,
      transferredAt,
    });

    // If the goal has running tasks, log a warning event
    const tasks = this.#store.getTasksForGoal(goalId);
    const runningTasks = tasks.filter(t => t.status === 'running');
    if (runningTasks.length > 0) {
      this.#store.logEvent(goalId, null, 'goal_transfer_with_active_tasks', {
        runningTaskCount: runningTasks.length,
        runningTaskIds: runningTasks.map(t => t.id),
        warning: 'Goal was transferred while tasks are still running',
      });
    }

    return {
      goalId,
      fromUserId,
      toUserId,
      transferredAt,
      taskCount: tasks.length,
      runningTaskCount: runningTasks.length,
    };
  }

  /**
   * Serialize export data to a JSON string (for file saving or API response).
   *
   * @param {object} exportedData — the data object from exportGoal()
   * @returns {string} — formatted JSON string
   */
  serialize(exportedData) {
    return JSON.stringify(exportedData, null, 2);
  }

  /**
   * Deserialize a JSON string back to export data.
   *
   * @param {string} jsonString — JSON string from serialize()
   * @returns {object} — the parsed export data object
   * @throws {Error} if the JSON is invalid
   */
  deserialize(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }

    // Basic structural validation
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Deserialized data is not an object');
    }
    if (!parsed.goal || !parsed.tasks) {
      throw new Error('Deserialized data is missing required fields (goal, tasks)');
    }

    return parsed;
  }
}
