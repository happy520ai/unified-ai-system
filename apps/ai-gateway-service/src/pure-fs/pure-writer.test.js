/**
 * Tests for the Pure File Writer
 *
 * Proves:
 *  1. The caller CAN read back written content.
 *  2. The disk is NEVER touched (zero side effects).
 *  3. Multiple isolated filesystems can coexist.
 *  4. The API mirrors the real fs module for familiarity.
 */

const fs = require('fs');
const path = require('path');
const { createPureFileSystem } = require('./pure-writer');

// ── Helper: snapshot the real filesystem so we can prove nothing changed ──

function snapshotDirectory(dirPath) {
  try {
    return JSON.stringify(fs.readdirSync(dirPath).sort());
  } catch {
    return '[]';
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Pure File Writer', () => {
  // ── 1. Content can be read back ──────────────────────────────────────

  test('written content is readable by the caller', () => {
    const vfs = createPureFileSystem();

    const result = vfs.writeFile('/hello.txt', 'Hello, World!');

    expect(result).toEqual({
      path: '/hello.txt',
      bytes: 13,
      virtual: true,
    });

    expect(vfs.readFile('/hello.txt')).toBe('Hello, World!');
  });

  test('overwriting a file replaces the content', () => {
    const vfs = createPureFileSystem();

    vfs.writeFile('/data.txt', 'first');
    vfs.writeFile('/data.txt', 'second');

    expect(vfs.readFile('/data.txt')).toBe('second');
  });

  test('reading a non-existent file returns undefined', () => {
    const vfs = createPureFileSystem();

    expect(vfs.readFile('/nope.txt')).toBeUndefined();
  });

  test('empty string content is valid', () => {
    const vfs = createPureFileSystem();

    vfs.writeFile('/empty.txt', '');

    expect(vfs.readFile('/empty.txt')).toBe('');
    expect(vfs.exists('/empty.txt')).toBe(true);
  });

  test('unicode and special characters survive round-trip', () => {
    const vfs = createPureFileSystem();
    const content = '你好世界 🌍\n\t"quotes" & <tags>';

    vfs.writeFile('/unicode.txt', content);

    expect(vfs.readFile('/unicode.txt')).toBe(content);
  });

  test('large content survives round-trip', () => {
    const vfs = createPureFileSystem();
    const content = 'A'.repeat(1_000_000);

    vfs.writeFile('/large.txt', content);

    expect(vfs.readFile('/large.txt')).toBe(content);
    expect(vfs.readFile('/large.txt').length).toBe(1_000_000);
  });

  // ── 2. ZERO side effects on the real filesystem ─────────────────────

  test('the working directory is untouched after writeFile', () => {
    const vfs = createPureFileSystem();
    const cwdSnapshot = snapshotDirectory(process.cwd());

    vfs.writeFile('/some/path/file.txt', 'data');
    vfs.writeFile('/another/file.log', 'log data');

    expect(snapshotDirectory(process.cwd())).toBe(cwdSnapshot);
  });

  test('no files appear in the OS temp directory', () => {
    const vfs = createPureFileSystem();
    const tmpDir = require('os').tmpdir();
    const tmpSnapshot = snapshotDirectory(tmpDir);

    vfs.writeFile('/tmp/test.txt', 'should not exist');

    expect(snapshotDirectory(tmpDir)).toBe(tmpSnapshot);
  });

  test('result object is marked as virtual (not on disk)', () => {
    const vfs = createPureFileSystem();
    const result = vfs.writeFile('/any/path.txt', 'content');

    expect(result.virtual).toBe(true);
  });

  test('written path does not exist on the real disk', () => {
    const vfs = createPureFileSystem();

    vfs.writeFile('/test-file-on-disk.txt', 'ghost data');

    // Verify no such file exists on the real filesystem
    expect(fs.existsSync('/test-file-on-disk.txt')).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'test-file-on-disk.txt'))).toBe(false);
  });

  // ── 3. Multiple isolated filesystems ────────────────────────────────

  test('two independent filesystems do not share state', () => {
    const vfs1 = createPureFileSystem();
    const vfs2 = createPureFileSystem();

    vfs1.writeFile('/shared-name.txt', 'from vfs1');

    expect(vfs1.readFile('/shared-name.txt')).toBe('from vfs1');
    expect(vfs2.readFile('/shared-name.txt')).toBeUndefined();
  });

  // ── 4. Utility methods ──────────────────────────────────────────────

  test('listFiles returns all written paths', () => {
    const vfs = createPureFileSystem();

    vfs.writeFile('/a.txt', 'a');
    vfs.writeFile('/b.txt', 'b');
    vfs.writeFile('/dir/c.txt', 'c');

    expect(vfs.listFiles().sort()).toEqual(['/a.txt', '/b.txt', '/dir/c.txt']);
  });

  test('exists returns true for written files, false otherwise', () => {
    const vfs = createPureFileSystem();

    vfs.writeFile('/real.txt', 'yes');

    expect(vfs.exists('/real.txt')).toBe(true);
    expect(vfs.exists('/fake.txt')).toBe(false);
  });

  // ── 5. Input validation ─────────────────────────────────────────────

  test('throws TypeError for non-string filePath', () => {
    const vfs = createPureFileSystem();

    expect(() => vfs.writeFile(123, 'data')).toThrow(TypeError);
    expect(() => vfs.writeFile(null, 'data')).toThrow(TypeError);
  });

  test('throws TypeError for non-string content', () => {
    const vfs = createPureFileSystem();

    expect(() => vfs.writeFile('/file.txt', 42)).toThrow(TypeError);
    expect(() => vfs.writeFile('/file.txt', undefined)).toThrow(TypeError);
  });
});
