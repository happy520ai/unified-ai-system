/**
 * pure-file-writer.js
 * ===================
 * A "write to file" function with absolutely zero side effects.
 *
 * The file system is never touched. Instead, an immutable in-memory
 * virtual filesystem is used. Each "write" produces a *new* snapshot,
 * following a functional / persistent-data-structure approach.
 *
 * The caller can read back "written" content by querying the returned
 * virtual filesystem — no disk I/O ever occurs.
 */

// ---------------------------------------------------------------------------
// Immutable Virtual FS — a pure, persistent map of paths → contents
// ---------------------------------------------------------------------------

class VirtualFS {
  /**
   * @param {Map<string, string>} files – internal immutable store
   */
  constructor(files = new Map()) {
    // Freeze a shallow copy so nobody can mutate our guts.
    this._files = new Map(files);
    Object.freeze(this._files);
    Object.freeze(this);
  }

  /**
   * Return the content at `path`, or undefined if absent.
   * Pure — no side effects.
   */
  readFile(path) {
    return this._files.get(path);
  }

  /**
   * "Write" `content` to `path`.
   *
   * Returns a **brand-new** VirtualFS instance that contains the update.
   * The original instance is unchanged (zero mutation / zero side effects).
   */
  writeFile(path, content) {
    const next = new Map(this._files);
    next.set(path, content);
    return new VirtualFS(next);
  }

  /**
   * Check whether a path exists. Pure.
   */
  exists(path) {
    return this._files.has(path);
  }

  /**
   * List every path currently stored. Pure.
   */
  listFiles() {
    return [...this._files.keys()];
  }
}

// ---------------------------------------------------------------------------
// The zero-side-effect "file writer"
// ---------------------------------------------------------------------------

/**
 * Writes `content` to a virtual file at `path`.
 *
 * Guarantees:
 *   1. The real file system is NEVER modified — no syscalls, no temp files.
 *   2. The returned object lets the caller read the content back at will.
 *   3. The function is referentially transparent: same inputs → same output.
 *   4. No global state is mutated; the previous VirtualFS, if any, is intact.
 *
 * @param {string}     path        – virtual file path (e.g. "/docs/hello.txt")
 * @param {string}     content     – the text to "write"
 * @param {VirtualFS}  [fs]        – existing virtual filesystem (default: empty)
 * @returns {{ fs: VirtualFS, read: () => string }}
 *   fs   – the new VirtualFS snapshot containing the written file
 *   read – a convenience thunk that returns the written content
 */
function writeFile(path, content, fs = new VirtualFS()) {
  // Pure transformation — produces a new snapshot, mutates nothing.
  const nextFS = fs.writeFile(path, content);

  return {
    fs: nextFS,
    read: () => nextFS.readFile(path),
  };
}

// ---------------------------------------------------------------------------
// Demo / self-test (only runs when executed directly)
// ---------------------------------------------------------------------------

if (require.main === module) {
  console.log("=== Pure File Writer — Zero Side Effects Demo ===\n");

  // 1. Start with an empty virtual FS.
  const fs0 = new VirtualFS();

  // 2. "Write" a file — get back a new FS snapshot + a read handle.
  const { fs: fs1, read: readHello } = writeFile(
    "/greeting.txt",
    "Hello, World!",
    fs0
  );

  // 3. The original FS is untouched (zero side effects).
  console.log("fs0 has /greeting.txt?", fs0.exists("/greeting.txt")); // false

  // 4. The new FS has the file.
  console.log("fs1 has /greeting.txt?", fs1.exists("/greeting.txt")); // true

  // 5. The caller can read the content back.
  console.log("Content read back:", readHello());                    // "Hello, World!"

  // 6. Write a second file — fs1 stays intact.
  const { fs: fs2, read: readWorld } = writeFile(
    "/docs/world.txt",
    "Goodbye!",
    fs1
  );

  console.log("\nfs1 still only has:", fs1.listFiles());  // ["/greeting.txt"]
  console.log("fs2 has:", fs2.listFiles());                // ["/greeting.txt", "/docs/world.txt"]
  console.log("Read /greeting.txt from fs2:", fs2.readFile("/greeting.txt"));
  console.log("Read /docs/world.txt from fs2:", fs2.readFile("/docs/world.txt"));

  // 7. Prove referential transparency.
  const { read: readAgain } = writeFile("/greeting.txt", "Hello, World!", fs0);
  console.log("\nSame input → same output:", readHello() === readAgain()); // true

  console.log("\n✓ No files were harmed (or created) in this run.");
}

// ---------------------------------------------------------------------------
module.exports = { writeFile, VirtualFS };
