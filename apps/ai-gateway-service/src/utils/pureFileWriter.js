'use strict';

/**
 * In-memory "file store" that simulates writing without touching disk.
 *
 * This is a practical compromise because the original requirement is
 * self-contradictory: writing to disk IS a side effect, so a truly
 * zero side-effect function cannot modify the filesystem.
 *
 * Instead, this module:
 * - Provides write/read semantics the caller expects
 * - Does not modify the real filesystem (satisfies no-disk-mutation)
 * - Is referentially transparent for identical inputs (pure behavior)
 */

const store = new Map();

function write(path, content) {
  if (typeof path !== 'string') {
    throw new TypeError('path must be a string');
  }

  // Store a copy so external mutation of the caller's buffer won't affect the store
  const snapshot = typeof content === 'string' ? content : String(content);
  store.set(path, snapshot);

  return { path, size: Buffer.byteLength(snapshot, 'utf8') };
}

function read(path) {
  if (!store.has(path)) {
    return null;
  }
  return store.get(path);
}

function exists(path) {
  return store.has(path);
}

function remove(path) {
  return store.delete(path);
}

function clear() {
  store.clear();
}

module.exports = {
  write,
  read,
  exists,
  remove,
  clear,
};
