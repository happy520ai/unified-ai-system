/**
 * Forge Task Store — SQLite schema definitions.
 *
 * Tables:
 *   goals       — high-level objectives submitted by the user
 *   tasks       — individual tasks in a goal's DAG
 *   task_deps   — directed edges in the task DAG
 *   checkpoints — workspace + agent snapshots at natural boundaries
 *   artifacts   — files produced/modified by tasks
 *   events      — append-only execution log (audit trail)
 */

export const SCHEMA_VERSION = 2;

export const CREATE_TABLES = /* sql */ `
  -- Goals: one row per user-submitted objective
  CREATE TABLE IF NOT EXISTS goals (
    id            TEXT PRIMARY KEY,
    text          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','compiled','running','completed','failed','cancelled')),
    project_root  TEXT NOT NULL,
    compiled_dag  TEXT,              -- JSON snapshot of the full DAG at compile time
    budget_json   TEXT,              -- { maxTokens, maxMinutes, maxCost }
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT
  );

  -- Tasks: nodes in the goal's DAG
  CREATE TABLE IF NOT EXISTS tasks (
    id            TEXT NOT NULL,
    goal_id       TEXT NOT NULL REFERENCES goals(id),
    name          TEXT NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('explore','plan','implement','test','verify','debug','review','refactor')),
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','queued','running','completed','failed','blocked','skipped')),
    agent_role    TEXT,              -- which worker role handles this
    prompt        TEXT,              -- the task prompt sent to the worker
    result_json   TEXT,              -- worker's structured output
    error_message TEXT,
    started_at    TEXT,
    completed_at  TEXT,
    retry_count   INTEGER NOT NULL DEFAULT 0,
    max_retries   INTEGER NOT NULL DEFAULT 2,
    allowed_files TEXT,              -- JSON array of glob patterns
    estimated_min INTEGER,
    PRIMARY KEY (id, goal_id)
  );

  -- DAG edges: task dependency graph
  CREATE TABLE IF NOT EXISTS task_deps (
    goal_id     TEXT NOT NULL,
    task_id     TEXT NOT NULL,
    depends_on  TEXT NOT NULL,
    PRIMARY KEY (goal_id, task_id, depends_on),
    FOREIGN KEY (task_id, goal_id) REFERENCES tasks(id, goal_id),
    FOREIGN KEY (depends_on, goal_id) REFERENCES tasks(id, goal_id)
  );

  -- Checkpoints: workspace snapshots for resume capability
  CREATE TABLE IF NOT EXISTS checkpoints (
    id            TEXT PRIMARY KEY,
    goal_id       TEXT NOT NULL REFERENCES goals(id),
    after_task_id TEXT,              -- task after which this checkpoint was taken
    git_commit    TEXT,              -- git SHA at checkpoint time
    modified_files TEXT,             -- JSON array of files changed since goal start
    new_files     TEXT,              -- JSON array of files created since goal start
    context_summary TEXT,            -- compressed agent context
    key_decisions TEXT,              -- JSON array of decision records
    budget_snapshot TEXT,            -- { tokensUsed, timeElapsed, costSoFar }
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Artifacts: files produced or modified by a task
  CREATE TABLE IF NOT EXISTS artifacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id     TEXT NOT NULL,
    task_id     TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('created','modified','deleted')),
    diff_text   TEXT,              -- unified diff if modified
    hash_before TEXT,              -- SHA-256 before change
    hash_after  TEXT,              -- SHA-256 after change
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Events: append-only execution log (audit trail)
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id     TEXT NOT NULL,
    task_id     TEXT,
    event_type  TEXT NOT NULL,
    payload     TEXT,              -- JSON
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_tasks_goal   ON tasks(goal_id);
  CREATE INDEX IF NOT EXISTS idx_events_goal  ON events(goal_id);
  CREATE INDEX IF NOT EXISTS idx_checkpoints_goal ON checkpoints(goal_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_goal   ON artifacts(goal_id);

  -- Schema version tracking
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  -- Users: multi-user support
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    display_name TEXT,
    api_key     TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'developer'
                CHECK (role IN ('admin','developer','viewer')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    last_active TEXT
  );

  -- Sessions: user session tracking
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    goal_id     TEXT REFERENCES goals(id),
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','completed','transferred')),
    metadata    TEXT,              -- JSON: { projectRoot, checkpointId, ... }
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Knowledge: team knowledge base with vector indexing
  CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('pattern','solution','decision','architecture','gotcha','general')),
    tags        TEXT,              -- JSON array of tags
    tfidf_json  TEXT,              -- serialized TF-IDF vector for similarity search
    related_goals TEXT,            -- JSON array of goal IDs this knowledge relates to
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Agent pool: shared worker assignments
  CREATE TABLE IF NOT EXISTS agent_assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id),
    goal_id     TEXT NOT NULL REFERENCES goals(id),
    worker_type TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','idle','completed','error')),
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT
  );

  -- Indexes for new tables
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_goal ON sessions(goal_id);
  CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge(user_id);
  CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
  CREATE INDEX IF NOT EXISTS idx_agent_assignments_user ON agent_assignments(user_id);
  CREATE INDEX IF NOT EXISTS idx_agent_assignments_goal ON agent_assignments(goal_id);
`;

export const INSERT_SCHEMA_VERSION = `
  INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '${SCHEMA_VERSION}');
`;

/**
 * Migration V1 → V2: add multi-user columns to goals table.
 * Caller must wrap each statement in try-catch since SQLite does not support
 * ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 */
export const MIGRATE_V2 = [
  `ALTER TABLE goals ADD COLUMN created_by TEXT REFERENCES users(id);`,
  `ALTER TABLE goals ADD COLUMN assigned_to TEXT REFERENCES users(id);`,
];
