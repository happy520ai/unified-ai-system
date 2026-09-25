import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsRecarry } from './star-growth-check.mjs';

// An open door on a fast-moving list can silently become unmergeable, which is why
// needsRecarry exists. These cases pin both directions: it must name the doors a
// re-carry actually fixes, and stay quiet about every state where re-carrying is
// the wrong action - a false alarm here trains people to ignore the report.
test('flags only open doors that a re-carry can fix', () => {
  const rows = [
    { repo: 'a/l', pr: 1, state: 'open', mergeState: 'DIRTY' },
    { repo: 'b/l', pr: 2, state: 'open', mergeState: 'BEHIND' },
    { repo: 'c/l', pr: 3, state: 'open', mergeState: 'FETCH_FAILED' },
  ];
  assert.deepEqual(needsRecarry(rows), [
    { kind: 'RE-CARRY', repo: 'a/l', pr: 1, mergeState: 'DIRTY' },
    { kind: 'RE-CARRY', repo: 'b/l', pr: 2, mergeState: 'BEHIND' },
    { kind: 'UNREADABLE', repo: 'c/l', pr: 3, mergeState: 'FETCH_FAILED' },
  ]);
});

test('stays silent on states where re-carrying would not help', () => {
  for (const mergeState of ['CLEAN', 'BLOCKED', 'UNSTABLE', 'UNKNOWN', 'MERGED']) {
    assert.deepEqual(needsRecarry([{ repo: 'x/l', pr: 1, state: 'open', mergeState }]), [], mergeState);
  }
});

test('closed and merged doors are never reported as needing action', () => {
  const rows = [
    { repo: 'dead/l', pr: 9, state: 'closed', mergeState: 'DIRTY' },
    { repo: 'gone/l', pr: 8, state: 'merged', mergeState: 'FETCH_FAILED' },
  ];
  assert.deepEqual(needsRecarry(rows), []);
});

test('degenerate inputs yield no action items rather than throwing', () => {
  for (const input of [[], undefined, null]) {
    assert.deepEqual(needsRecarry(input), []);
  }
});
