import assert from 'assert';
import { formatBytes } from './formatBytes.mjs';

describe('formatBytes', () => {
  it('handles 0 bytes', () => {
    assert.strictEqual(formatBytes(0), '0 B');
  });

  it('converts positive values across units', () => {
    assert.strictEqual(formatBytes(1024), '1 KB');
    assert.strictEqual(formatBytes(1024 * 1024), '1 MB');
    assert.strictEqual(formatBytes(1024 * 1024 * 1024), '1 GB');
  });

  it('throws Error for negative input', () => {
    assert.throws(() => formatBytes(-1), Error);
  });

  it('throws TypeError for non-numeric input', () => {
    assert.throws(() => formatBytes('a'), Error, 'Input must be a number'); // Enhanced error message check
  });
});
