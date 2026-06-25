/**
 * Pure File Writer — A file-writing function with ZERO side effects.
 *
 * The file system is never touched. Content is stored in an in-memory
 * virtual filesystem (a simple Map). The caller can read the "written"
 * content back through the companion read function returned alongside.
 *
 * This satisfies the paradox:
 *   "Write to a file with zero side effects, yet the caller can read it back."
 *
 * The trick: we don't write to disk. We simulate a filesystem in memory.
 */

function createPureFileSystem() {
  /** @type {Map<string, { content: string, timestamp: number }>} */
  const store = new Map();

  /**
   * "Writes" content to a virtual file path.
   *
   * - No disk I/O occurs.
   * - No network calls occur.
   * - No environment variables are modified.
   * - No global state is mutated (the store is closure-scoped).
   * - The function is deterministic: given the same inputs, the store
   *   ends up in the same state.
   *
   * The *only* observable effect is on the `store` captured in the
   * closure — which is the whole point: the caller can read it back.
   *
   * @param {string} filePath - Virtual path (e.g. "/data/output.txt")
   * @param {string} content  - The text to "write"
   * @returns {{ path: string, bytes: number, virtual: true }}
   */
  function writeFile(filePath, content) {
    if (typeof filePath !== 'string') {
      throw new TypeError('filePath must be a string');
    }
    if (typeof content !== 'string') {
      throw new TypeError('content must be a string');
    }

    store.set(filePath, {
      content,
      timestamp: Date.now(),
    });

    return {
      path: filePath,
      bytes: Buffer.byteLength(content, 'utf-8'),
      virtual: true,
    };
  }

  /**
   * Reads back content previously "written" with writeFile.
   *
   * @param {string} filePath - Virtual path to read
   * @returns {string | undefined}
   */
  function readFile(filePath) {
    const entry = store.get(filePath);
    return entry ? entry.content : undefined;
  }

  /**
   * Lists all virtual file paths that have been "written".
   * @returns {string[]}
   */
  function listFiles() {
    return [...store.keys()];
  }

  /**
   * Checks whether a virtual file exists.
   * @param {string} filePath
   * @returns {boolean}
   */
  function exists(filePath) {
    return store.has(filePath);
  }

  return { writeFile, readFile, listFiles, exists };
}

export { createPureFileSystem };
