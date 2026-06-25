/**
 * Forge Task Store — persistent storage for goals, tasks, checkpoints, and audit events.
 *
 * Usage:
 *   const store = new TaskStore('/path/to/forge.db');
 *   const goalId = store.createGoal({ text, projectRoot, budget });
 *   store.insertTaskDAG(goalId, tasks, deps);
 *   const ready = store.getReadyTasks(goalId);
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { CREATE_TABLES, INSERT_SCHEMA_VERSION, MIGRATE_V2 } from './schema.js';

export class TaskStore {
  #db;

  /** @param {string} dbPath — absolute path to the SQLite file */
  constructor(dbPath) {
    this.#db = new Database(dbPath);
    this.#db.pragma('journal_mode = WAL');
    this.#db.pragma('foreign_keys = ON');
    this.#db.exec(CREATE_TABLES);
    this.#db.exec(INSERT_SCHEMA_VERSION);
  }

  /** Expose the underlying Database instance for other modules (UserManager, etc.) */
  get db() { return this.#db; }

  // ── Goals ──────────────────────────────────────────────────────────────

  createGoal({ text, projectRoot, budget }) {
    const id = `g-${randomUUID().slice(0, 8)}`;
    this.#db.prepare(`
      INSERT INTO goals (id, text, project_root, budget_json)
      VALUES (?, ?, ?, ?)
    `).run(id, text, projectRoot, JSON.stringify(budget ?? {}));
    return id;
  }

  getGoal(goalId) {
    return this.#db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId);
  }

  updateGoalStatus(goalId, status, compiledDag = null) {
    const now = new Date().toISOString();
    const completedAt = status === 'completed' || status === 'failed' ? now : null;
    this.#db.prepare(`
      UPDATE goals SET status = ?, compiled_dag = COALESCE(?, compiled_dag),
      updated_at = ?, completed_at = COALESCE(?, completed_at)
      WHERE id = ?
    `).run(status, compiledDag, now, completedAt, goalId);
  }

  listGoals({ status, limit = 50 } = {}) {
    let sql = 'SELECT * FROM goals';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return this.#db.prepare(sql).all(...params);
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  insertTaskDAG(goalId, tasks, deps) {
    const insertTask = this.#db.prepare(`
      INSERT INTO tasks (id, goal_id, name, type, agent_role, prompt, allowed_files, estimated_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDep = this.#db.prepare(`
      INSERT OR IGNORE INTO task_deps (goal_id, task_id, depends_on)
      VALUES (?, ?, ?)
    `);

    const txn = this.#db.transaction(() => {
      for (const t of tasks) {
        insertTask.run(
          t.id, goalId, t.name, t.type, t.agentRole ?? null,
          t.prompt ?? null, JSON.stringify(t.allowedFiles ?? []), t.estimatedMin ?? null
        );
      }
      for (const d of deps) {
        insertDep.run(goalId, d.taskId, d.dependsOn);
      }
    });
    txn();
  }

  getTask(goalId, taskId) {
    return this.#db.prepare('SELECT * FROM tasks WHERE goal_id = ? AND id = ?').get(goalId, taskId);
  }

  getTasksForGoal(goalId) {
    return this.#db.prepare('SELECT * FROM tasks WHERE goal_id = ? ORDER BY id').all(goalId);
  }

  getTaskDeps(goalId) {
    return this.#db.prepare('SELECT * FROM task_deps WHERE goal_id = ?').all(goalId);
  }

  /**
   * Return tasks whose dependencies are all completed (or have no deps).
   * Excludes tasks that are already completed, running, or queued.
   */
  getReadyTasks(goalId) {
    const allTasks = this.getTasksForGoal(goalId);
    const deps = this.getTaskDeps(goalId);

    const completedIds = new Set(allTasks.filter(t => t.status === 'completed').map(t => t.id));
    const depMap = new Map();
    for (const d of deps) {
      if (!depMap.has(d.task_id)) depMap.set(d.task_id, []);
      depMap.get(d.task_id).push(d.depends_on);
    }

    return allTasks.filter(t => {
      if (t.status !== 'pending') return false;
      const taskDeps = depMap.get(t.id) ?? [];
      return taskDeps.every(depId => completedIds.has(depId));
    });
  }

  updateTaskStatus(goalId, taskId, status, { resultJson, errorMessage } = {}) {
    const now = new Date().toISOString();
    const startedAt = status === 'running' ? now : null;
    const completedAt = (status === 'completed' || status === 'failed') ? now : null;
    const retryInc = status === 'running' ? 0 : 0;

    this.#db.prepare(`
      UPDATE tasks SET
        status = ?,
        result_json = COALESCE(?, result_json),
        error_message = COALESCE(?, error_message),
        started_at = COALESCE(?, started_at),
        completed_at = COALESCE(?, completed_at)
      WHERE goal_id = ? AND id = ?
    `).run(status, resultJson ?? null, errorMessage ?? null,
           startedAt, completedAt, goalId, taskId);
  }

  incrementRetry(goalId, taskId) {
    this.#db.prepare(`
      UPDATE tasks SET retry_count = retry_count + 1 WHERE goal_id = ? AND id = ?
    `).run(goalId, taskId);
  }

  // ── Checkpoints ────────────────────────────────────────────────────────

  createCheckpoint({ goalId, afterTaskId, gitCommit, modifiedFiles, newFiles, contextSummary, keyDecisions, budgetSnapshot }) {
    const id = `cp-${randomUUID().slice(0, 8)}`;
    this.#db.prepare(`
      INSERT INTO checkpoints (id, goal_id, after_task_id, git_commit, modified_files, new_files,
        context_summary, key_decisions, budget_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, goalId, afterTaskId ?? null, gitCommit ?? null,
      JSON.stringify(modifiedFiles ?? []), JSON.stringify(newFiles ?? []),
      contextSummary ?? null, JSON.stringify(keyDecisions ?? []),
      JSON.stringify(budgetSnapshot ?? {})
    );
    return id;
  }

  getCheckpoints(goalId) {
    return this.#db.prepare('SELECT * FROM checkpoints WHERE goal_id = ? ORDER BY created_at').all(goalId);
  }

  getLatestCheckpoint(goalId) {
    return this.#db.prepare(
      'SELECT * FROM checkpoints WHERE goal_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(goalId);
  }

  // ── Artifacts ──────────────────────────────────────────────────────────

  recordArtifact({ goalId, taskId, filePath, action, diffText, hashBefore, hashAfter }) {
    this.#db.prepare(`
      INSERT INTO artifacts (goal_id, task_id, file_path, action, diff_text, hash_before, hash_after)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(goalId, taskId, filePath, action, diffText ?? null, hashBefore ?? null, hashAfter ?? null);
  }

  getArtifacts(goalId, taskId = null) {
    if (taskId) {
      return this.#db.prepare('SELECT * FROM artifacts WHERE goal_id = ? AND task_id = ?').all(goalId, taskId);
    }
    return this.#db.prepare('SELECT * FROM artifacts WHERE goal_id = ?').all(goalId);
  }

  // ── Events (audit log) ─────────────────────────────────────────────────

  logEvent(goalId, taskId, eventType, payload = {}) {
    this.#db.prepare(`
      INSERT INTO events (goal_id, task_id, event_type, payload)
      VALUES (?, ?, ?, ?)
    `).run(goalId, taskId ?? null, eventType, JSON.stringify(payload));
  }

  getEvents(goalId, { limit = 200 } = {}) {
    return this.#db.prepare(
      'SELECT * FROM events WHERE goal_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(goalId, limit);
  }

  // ── Sessions ─────────────────────────────────────────────────────────

  /**
   * List all sessions for a given user.
   * @param {string} userId
   * @returns {object[]}
   */
  getSessions(userId) {
    return this.#db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  }

  /**
   * Create a new session.
   * @param {{ userId: string, goalId?: string, metadata?: object }} opts
   * @returns {string} session id
   */
  createSession({ userId, goalId, metadata }) {
    const id = `s-${randomUUID().slice(0, 12)}`;
    this.#db.prepare(`
      INSERT INTO sessions (id, user_id, goal_id, metadata)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, goalId ?? null, metadata ? JSON.stringify(metadata) : null);
    return id;
  }

  /**
   * Update the status of an existing session.
   * @param {string} sessionId
   * @param {string} status — one of 'active'|'paused'|'completed'|'transferred'
   */
  updateSessionStatus(sessionId, status) {
    const now = new Date().toISOString();
    this.#db.prepare(`
      UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, now, sessionId);
  }

  /**
   * Get a single session by ID.
   * @param {string} sessionId
   * @returns {object|undefined}
   */
  getSession(sessionId) {
    return this.#db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  }

  // ── Knowledge ────────────────────────────────────────────────────────

  /**
   * Insert a new knowledge entry.
   * @param {{ userId: string, title: string, content: string, category?: string, tags?: string[], relatedGoals?: string[] }} opts
   * @returns {string} knowledge entry id
   */
  addKnowledge({ userId, title, content, category = 'general', tags, relatedGoals }) {
    const id = `k-${randomUUID().slice(0, 12)}`;
    this.#db.prepare(`
      INSERT INTO knowledge (id, user_id, title, content, category, tags, related_goals)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, userId, title, content, category,
      tags ? JSON.stringify(tags) : null,
      relatedGoals ? JSON.stringify(relatedGoals) : null
    );
    return id;
  }

  /**
   * Basic search for knowledge entries by category and/or tags.
   * @param {{ category?: string, tags?: string[], query?: string }} opts
   * @returns {object[]}
   */
  searchKnowledge({ category, tags, query } = {}) {
    const conditions = [];
    const params = [];

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (tags && tags.length > 0) {
      // Match any entry whose tags JSON contains at least one of the given tags
      const tagClauses = tags.map(() => 'tags LIKE ?');
      conditions.push(`(${tagClauses.join(' OR ')})`);
      for (const tag of tags) {
        params.push(`%"${tag}"%`);
      }
    }
    if (query) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    let sql = 'SELECT * FROM knowledge';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC';

    return this.#db.prepare(sql).all(...params);
  }

  /**
   * Get a single knowledge entry by ID.
   * @param {string} id
   * @returns {object|undefined}
   */
  getKnowledge(id) {
    return this.#db.prepare('SELECT * FROM knowledge WHERE id = ?').get(id);
  }

  /**
   * List knowledge entries with optional filters.
   * @param {{ userId?: string, category?: string, limit?: number }} opts
   * @returns {object[]}
   */
  listKnowledge({ userId, category, limit = 50 } = {}) {
    const conditions = [];
    const params = [];

    if (userId) {
      conditions.push('user_id = ?');
      params.push(userId);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    let sql = 'SELECT * FROM knowledge';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY updated_at DESC LIMIT ?';
    params.push(limit);

    return this.#db.prepare(sql).all(...params);
  }

  /**
   * Update fields on an existing knowledge entry.
   * @param {string} id
   * @param {{ title?: string, content?: string, category?: string, tags?: string[], relatedGoals?: string[], tfidfJson?: string }} updates
   */
  updateKnowledge(id, updates) {
    const fields = [];
    const params = [];

    if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
    if (updates.content !== undefined) { fields.push('content = ?'); params.push(updates.content); }
    if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category); }
    if (updates.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(updates.tags)); }
    if (updates.relatedGoals !== undefined) { fields.push('related_goals = ?'); params.push(JSON.stringify(updates.relatedGoals)); }
    if (updates.tfidfJson !== undefined) { fields.push('tfidf_json = ?'); params.push(updates.tfidfJson); }

    fields.push("updated_at = datetime('now')");
    params.push(id);

    this.#db.prepare(`UPDATE knowledge SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  /**
   * Delete a knowledge entry.
   * @param {string} id
   * @returns {{ changes: number }}
   */
  deleteKnowledge(id) {
    const info = this.#db.prepare('DELETE FROM knowledge WHERE id = ?').run(id);
    return { changes: info.changes };
  }

  // ── Agent Assignments ────────────────────────────────────────────────

  /**
   * Record a new agent assignment.
   * @param {{ userId: string, goalId: string, workerType: string }} opts
   * @returns {number} the auto-increment assignment id
   */
  recordAgentAssignment({ userId, goalId, workerType }) {
    const info = this.#db.prepare(`
      INSERT INTO agent_assignments (user_id, goal_id, worker_type)
      VALUES (?, ?, ?)
    `).run(userId, goalId, workerType);
    return info.lastInsertRowid;
  }

  /**
   * Mark an agent assignment as completed.
   * @param {number} assignmentId
   */
  finishAgentAssignment(assignmentId) {
    const now = new Date().toISOString();
    this.#db.prepare(`
      UPDATE agent_assignments SET status = 'completed', finished_at = ? WHERE id = ?
    `).run(now, assignmentId);
  }

  /**
   * Get all active assignments for a user.
   * @param {string} userId
   * @returns {object[]}
   */
  getActiveAssignments(userId) {
    return this.#db.prepare(
      "SELECT * FROM agent_assignments WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC"
    ).all(userId);
  }

  // ── Migration ────────────────────────────────────────────────────────

  /**
   * Run the V1 → V2 migration. Each ALTER TABLE statement is wrapped in
   * try-catch so that re-running on an already-migrated database is safe.
   */
  migrateSchema() {
    for (const sql of MIGRATE_V2) {
      try {
        this.#db.exec(sql);
      } catch {
        // Column already exists — safe to ignore
      }
    }
    this.#db.exec(INSERT_SCHEMA_VERSION);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  close() {
    this.#db.close();
  }
}
