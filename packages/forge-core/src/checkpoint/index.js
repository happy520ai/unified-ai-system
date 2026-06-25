/**
 * Checkpoint Manager — workspace snapshots for resume capability.
 *
 * Creates checkpoints:
 *   - Git commit SHA at checkpoint time
 *   - List of modified/new files since goal start
 *   - Compressed agent context summary
 *   - Key decisions and learned patterns
 *   - Budget snapshot (tokens, time, cost)
 *
 * Restores from checkpoints:
 *   - Git reset to checkpoint commit
 *   - Re-apply file changes
 *   - Restore agent context
 */

import { execSync, execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class CheckpointManager {
  #store;
  #projectRoot;

  /**
   * @param {import('../task-store/index.js').TaskStore} store
   * @param {string} projectRoot
   */
  constructor(store, projectRoot) {
    this.#store = store;
    this.#projectRoot = projectRoot;
  }

  /**
   * Create a checkpoint after a task completes.
   */
  createCheckpoint(goalId, taskId, context = {}) {
    const gitCommit = this.#getGitCommit();
    const modifiedFiles = this.#getModifiedFiles();
    const newFiles = this.#getNewFiles();

    const cpId = this.#store.createCheckpoint({
      goalId,
      afterTaskId: taskId,
      gitCommit,
      modifiedFiles,
      newFiles,
      contextSummary: context.summary ?? null,
      keyDecisions: context.keyDecisions ?? [],
      budgetSnapshot: context.budget ?? {},
    });

    this.#store.logEvent(goalId, taskId, 'checkpoint_created', {
      checkpointId: cpId,
      gitCommit,
      modifiedFilesCount: modifiedFiles.length,
    });

    console.log(`[forge:checkpoint] Created ${cpId} after task ${taskId} (commit: ${gitCommit?.slice(0, 7) ?? 'N/A'})`);
    return cpId;
  }

  /**
   * Get the latest checkpoint for a goal.
   */
  getLatestCheckpoint(goalId) {
    return this.#store.getLatestCheckpoint(goalId);
  }

  /**
   * List all checkpoints for a goal.
   */
  listCheckpoints(goalId) {
    return this.#store.getCheckpoints(goalId);
  }

  /**
   * Restore workspace to a checkpoint state.
   * WARNING: This performs a git reset — uncommitted changes will be lost.
   */
  async restoreCheckpoint(goalId, checkpointId) {
    const checkpoints = this.#store.getCheckpoints(goalId);
    const cp = checkpoints.find(c => c.id === checkpointId);
    if (!cp) throw new Error(`Checkpoint ${checkpointId} not found for goal ${goalId}`);

    if (cp.git_commit) {
      // Validate commit hash format to prevent command injection
      if (!/^[0-9a-f]{7,40}$/i.test(cp.git_commit)) {
        throw new Error('Invalid git commit hash format');
      }
      try {
        execFileSync('git', ['checkout', cp.git_commit], { cwd: this.#projectRoot, stdio: 'pipe' });
        console.log(`[forge:checkpoint] Restored to commit ${cp.git_commit.slice(0, 7)}`);
      } catch (err) {
        throw new Error(`Failed to restore checkpoint: ${err.message}`);
      }
    }

    this.#store.logEvent(goalId, null, 'checkpoint_restored', {
      checkpointId,
      gitCommit: cp.git_commit,
    });

    return cp;
  }

  // ── Git helpers ───────────────────────────────────────────────────────

  #getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { cwd: this.#projectRoot, encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  #getModifiedFiles() {
    try {
      const output = execSync('git diff --name-only', { cwd: this.#projectRoot, encoding: 'utf-8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  #getNewFiles() {
    try {
      const output = execSync('git ls-files --others --exclude-standard', { cwd: this.#projectRoot, encoding: 'utf-8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}
