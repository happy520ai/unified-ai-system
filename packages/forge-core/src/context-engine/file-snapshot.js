import crypto from 'crypto';

/**
 * @typedef {{ path: string, oldHash: string | null, newHash: string | null, type: 'added' | 'modified' | 'unchanged' }} ChangeRecord
 */

/**
 * FileSnapshot — Point-in-time snapshot of file contents for incremental
 * context management. Tracks file hashes to enable delta-style rebuilds
 * instead of full context reconstruction on every call.
 */
export class FileSnapshot {
  /** @type {Map<string, { content: string, hash: string, timestamp: number }>} */
  #files;

  /** @type {number} */
  #lastSnapshotTime;

  constructor() {
    this.#files = new Map();
    this.#lastSnapshotTime = Date.now();
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Batch-capture a path→content mapping (convenience over update()).
   *
   * @param {Record<string, string>} files
   */
  capture(files) {
    if (!files || typeof files !== 'object') return;
    for (const [filePath, content] of Object.entries(files)) {
      this.update(filePath, String(content ?? ''));
    }
  }

  /**
   * Whether a path is tracked in this snapshot.
   * @param {string} filePath
   * @returns {boolean}
   */
  has(filePath) {
    return this.#files.has(filePath);
  }

  /**
   * Update or add a file to the snapshot.
   *
   * @param {string} filePath
   * @param {string} content
   * @returns {ChangeRecord | null} null if unchanged, otherwise the change record
   */
  update(filePath, content) {
    const newHash = this.#hashContent(content);
    const existing = this.#files.get(filePath);

    if (existing) {
      if (existing.hash === newHash) {
        return null; // unchanged
      }
      const oldHash = existing.hash;
      this.#files.set(filePath, { content, hash: newHash, timestamp: Date.now() });
      return { path: filePath, oldHash, newHash, type: 'modified' };
    }

    this.#files.set(filePath, { content, hash: newHash, timestamp: Date.now() });
    return { path: filePath, oldHash: null, newHash, type: 'added' };
  }

  /**
   * Diff this snapshot against a previous one.
   *
   * Accepts either a FileSnapshot instance (returns the full
   * {added, modified, removed, unchanged} breakdown) or a plain
   * path→content object (returns the flat list of added/modified paths).
   *
   * @param {FileSnapshot | Record<string, string>} previousSnapshot
   * @returns {{ added: string[], modified: string[], removed: string[], unchanged: string[] } | string[]}
   */
  diff(previousSnapshot) {
    // 便利形式：diff(path→content 对象) → 变更路径数组。
    if (previousSnapshot !== null
      && typeof previousSnapshot === 'object'
      && !(previousSnapshot instanceof FileSnapshot)) {
      const changed = [];
      const keys = Object.keys(previousSnapshot);
      const knownKeys = new Set([...this.#files.keys(), ...keys]);
      for (const filePath of knownKeys) {
        const prevContent = Object.prototype.hasOwnProperty.call(previousSnapshot, filePath)
          ? previousSnapshot[filePath]
          : undefined;
        const current = this.#files.get(filePath);
        if (!current) {
          if (prevContent !== undefined) changed.push(filePath);
          continue;
        }
        if (prevContent === undefined || this.#hashContent(prevContent) !== current.hash) {
          changed.push(filePath);
        }
      }
      return changed;
    }

    const added = [];
    const modified = [];
    const removed = [];
    const unchanged = [];

    const prevFiles = previousSnapshot.#files;
    const prevKeys = new Set(prevFiles.keys());
    const currKeys = new Set(this.#files.keys());

    for (const filePath of currKeys) {
      if (!prevKeys.has(filePath)) {
        added.push(filePath);
      } else if (prevFiles.get(filePath).hash !== this.#files.get(filePath).hash) {
        modified.push(filePath);
      } else {
        unchanged.push(filePath);
      }
    }

    for (const filePath of prevKeys) {
      if (!currKeys.has(filePath)) {
        removed.push(filePath);
      }
    }

    return { added, modified, removed, unchanged };
  }

  /**
   * Get all files that changed after a given timestamp.
   *
   * @param {number} sinceTimestamp
   * @returns {string[]}
   */
  getChanges(sinceTimestamp) {
    const changed = [];
    for (const [filePath, entry] of this.#files) {
      if (entry.timestamp > sinceTimestamp) {
        changed.push(filePath);
      }
    }
    return changed;
  }

  /**
   * Check if the snapshot is stale (too many files changed since last snapshot).
   * When stale, a full context rebuild is preferred over delta.
   *
   * @param {number} [threshold=500]
   * @returns {boolean}
   */
  isStale(threshold = 500) {
    const changedCount = [...this.#files.values()].filter(
      (e) => e.timestamp > this.#lastSnapshotTime
    ).length;
    return changedCount > threshold;
  }

  /**
   * Get the content of a file from the snapshot.
   *
   * @param {string} filePath
   * @returns {string | undefined}
   */
  getContent(filePath) {
    const entry = this.#files.get(filePath);
    return entry ? entry.content : undefined;
  }

  /**
   * Get the hash of a file from the snapshot.
   *
   * @param {string} filePath
   * @returns {string | undefined}
   */
  getHash(filePath) {
    const entry = this.#files.get(filePath);
    return entry ? entry.hash : undefined;
  }

  /**
   * Check if a file exists in the snapshot.
   *
   * @param {string} filePath
   * @returns {boolean}
   */
  has(filePath) {
    return this.#files.has(filePath);
  }

  /**
   * Number of files tracked.
   *
   * @returns {number}
   */
  get size() {
    return this.#files.size;
  }

  // ── Serialization ─────────────────────────────────────────────────────

  /**
   * Serialize to plain JSON-serializable object.
   *
   * @returns {object}
   */
  toJSON() {
    const files = [];
    for (const [path, entry] of this.#files) {
      files.push([path, { content: entry.content, hash: entry.hash, timestamp: entry.timestamp }]);
    }
    return {
      files,
      lastSnapshotTime: this.#lastSnapshotTime,
    };
  }

  /**
   * Deserialize from a JSON object.
   *
   * @param {object} data
   * @returns {FileSnapshot}
   */
  static fromJSON(data) {
    const snapshot = new FileSnapshot();
    if (data && Array.isArray(data.files)) {
      for (const [filePath, entry] of data.files) {
        snapshot.#files.set(filePath, {
          content: entry.content,
          hash: entry.hash,
          timestamp: entry.timestamp,
        });
      }
    }
    if (data && typeof data.lastSnapshotTime === 'number') {
      snapshot.#lastSnapshotTime = data.lastSnapshotTime;
    }
    return snapshot;
  }

  // ── Statistics ────────────────────────────────────────────────────────

  /**
   * Get snapshot statistics.
   *
   * @returns {{ totalFiles: number, changedFiles: number, lastSnapshotTime: number }}
   */
  getStats() {
    const changedFiles = [...this.#files.values()].filter(
      (e) => e.timestamp > this.#lastSnapshotTime
    ).length;
    return {
      totalFiles: this.#files.size,
      changedFiles,
      lastSnapshotTime: this.#lastSnapshotTime,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 hash of content.
   *
   * @param {string} content
   * @returns {string}
   */
  #hashContent(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
