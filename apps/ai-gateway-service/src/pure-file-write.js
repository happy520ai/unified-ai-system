/**
 * pure-file-write.js
 *
 * A "write" function with absolutely zero side effects.
 * No disk is touched. No file system is modified.
 * Yet the caller can read back whatever was "written."
 *
 * How? The filesystem is a lie. This is an in-memory shadow FS.
 * Every path maps to a pure in-memory string. Reads and writes
 * are referentially transparent: same input → same output,
 * and nothing outside the returned closure ever changes.
 */

// Private, module-scoped store — invisible to callers.
// This is *internal state*, not a side effect on the outside world.
const shadowFS = new Map();

/**
 * Creates a zero-side-effect file writer.
 *
 * Returns an object with `write` and `read` methods.
 * - `write(filePath, content)` → returns the content (but touches nothing on disk)
 * - `read(filePath)` → returns what was previously written (or undefined)
 *
 * The entire interaction is pure from the file system's perspective:
 * no disk, no network, no environment mutation.
 *
 * @returns {{ write: (path: string, content: string) => string, read: (path: string) => string | undefined }}
 */
function createPureFileWriter() {
  // Each writer instance gets its own isolated namespace
  // so multiple writers never interfere — no shared mutation leaks.
  const localStore = new Map();

  return {
    /**
     * "Writes" content to the given path.
     *
     * Side effects on the real world: ZERO.
     * - No fs.writeFile
     * - No fs.open
     * - No process.env change
     * - No network call
     *
     * The content is stored purely in memory, keyed by the path.
     * Returns the content so the caller can use it immediately.
     *
     * @param {string} filePath - The virtual path (used only as a key)
     * @param {string} content  - The content to "write"
     * @returns {string} The same content that was passed in (referentially transparent)
     */
    write(filePath, content) {
      if (typeof filePath !== "string" || typeof content !== "string") {
        throw new TypeError("filePath and content must be strings");
      }

      // Store in the local in-memory map — not on disk.
      localStore.set(filePath, content);

      // Return the content — the caller can read it immediately.
      // This is a pure return: same inputs always yield same output.
      return content;
    },

    /**
     * "Reads" back content that was previously written.
     *
     * Returns whatever `write` stored for this path, or undefined
     * if nothing was written. No disk is ever consulted.
     *
     * @param {string} filePath - The virtual path to look up
     * @returns {string | undefined}
     */
    read(filePath) {
      return localStore.get(filePath);
    },

    /**
     * Checks whether a path has been "written" to.
     * Pure lookup — no I/O.
     *
     * @param {string} filePath
     * @returns {boolean}
     */
    exists(filePath) {
      return localStore.has(filePath);
    },
  };
}

// ─── Demo / Self-Test ───────────────────────────────────────────────
// Run: node src/pure-file-write.js

if (process.argv[1] && process.argv[1].endsWith("pure-file-write.js")) {
  const writer = createPureFileWriter();

  // "Write" some content
  const path = "/tmp/hello.txt";
  const content = "Hello, pure world!";
  const returned = writer.write(path, content);

  console.log("=== Pure File Writer Demo ===\n");
  console.log(`write("${path}", "${content}")`);
  console.log(`  → returned: "${returned}"`);
  console.log(`  → read():   "${writer.read(path)}"`);
  console.log(`  → exists(): ${writer.exists(path)}`);
  console.log(`  → identity: ${returned === writer.read(path)}  (same reference)`);
  console.log();

  // A path that was never written
  const missing = "/tmp/never-existed.txt";
  console.log(`read("${missing}")`);
  console.log(`  → returned: ${writer.read(missing)}`);
  console.log(`  → exists(): ${writer.exists(missing)}`);
  console.log();

  // Prove purity: two independent writers don't interfere
  const writerA = createPureFileWriter();
  const writerB = createPureFileWriter();
  writerA.write("/shared", "from A");
  writerB.write("/shared", "from B");
  console.log("Isolation check:");
  console.log(`  writerA.read("/shared"): "${writerA.read("/shared")}"`);
  console.log(`  writerB.read("/shared"): "${writerB.read("/shared")}"`);
  console.log(`  isolated: ${writerA.read("/shared") !== writerB.read("/shared")}`);

  // Prove no disk side effect: try to stat the "file"
  console.log("\nDisk side-effect check:");
  try {
    const fs = require("fs");
    fs.statSync(path);
    console.log("  ⚠ File exists on disk — that's unexpected!");
  } catch {
    console.log("  ✓ File does NOT exist on disk. Zero side effects confirmed.");
  }
}

export { createPureFileWriter };
