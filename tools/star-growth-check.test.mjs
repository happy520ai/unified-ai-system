import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countHandAccepted, countListingKinds, isListedInReadme, needsRecarry } from './star-growth-check.mjs';

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

// PR state is not the same quantity as "we are listed". A maintainer can apply an
// entry by hand and close the branch, and two doors were scored as lost that way on
// 2026-09-25, so the README is read as a second instrument.
test('recognises a listing by link or by display name', () => {
  assert.equal(
    isListedInReadme('| [Unified AI System](https://github.com/happy520ai/unified-ai-system) | self-hosted gateway |'),
    'listed'
  );
  assert.equal(isListedInReadme('# Awesome X\n- Unified AI System - a governed gateway\n'), 'listed');
});

test('does not call a near-miss a listing', () => {
  assert.equal(
    isListedInReadme('# Gateways\n- Unified Payments API\n- ai-system-monitor\n- awesome-gateway\n'),
    'absent'
  );
});

// Blindness must not be reported as absence: an unreadable README has to land in its
// own bucket, because "not listed" is the reading that would justify re-filing.
test('separates unreadable from absent', () => {
  for (const value of ['', '   ', undefined, null, 42]) {
    assert.equal(isListedInReadme(value), 'unreadable');
  }
});

// A code-search carrier was tried on 2026-09-25 and dropped: its index is partial and
// it disagreed with itself between runs. These cases pin the stable reading and make
// sure a closed-but-listed door is counted as a win rather than a loss.
test('countListingKinds totals every row exactly once', () => {
  const tally = countListingKinds([
    { listing: 'readme' },
    { listing: 'readme' },
    { listing: 'absent' },
    { listing: 'unreadable' },
    {},
  ]);
  assert.deepEqual(tally, { readme: 2, absent: 1, unreadable: 2 });
  assert.equal(tally.readme + tally.absent + tally.unreadable, 5);
  assert.deepEqual(countListingKinds([]), { readme: 0, absent: 0, unreadable: 0 });
});

test('a closed door whose list still shows us counts as accepted by hand', () => {
  assert.equal(
    countHandAccepted([
      { state: 'closed', listing: 'readme' },
      { state: 'closed', listing: 'absent' },
      { state: 'open', listing: 'readme' },
      { state: 'merged', listing: 'readme' },
      { state: 'closed', listing: 'unreadable' },
    ]),
    1
  );
  assert.equal(countHandAccepted([]), 0);
  assert.equal(countHandAccepted(undefined), 0);
});
