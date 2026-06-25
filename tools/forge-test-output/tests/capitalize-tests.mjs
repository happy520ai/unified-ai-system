import { assert } from 'assert';
import capitalize from '../capitalize.mjs';

suite('capitalize.mjs Tests', () => {
  test('Empty String', () => {
    assert.strictEqual(capitalize(''), '');
  });

  test('Null Input', () => {
    assert.strictEqual(capitalize(null), '');
  });

  test('Non-String Input', () => {
    assert.strictEqual(capitalize(123), '');
  });

  test('Lowercase String', () => {
    assert.strictEqual(capitalize('hello'), 'Hello');
  });

  test('Uppercase String', () => {
    assert.strictEqual(capitalize('HELLO'), 'Hello');
  });

  test('Mixed Case String', () => {
    assert.strictEqual(capitalize('hElLo'), 'Hello');
  });
}));
