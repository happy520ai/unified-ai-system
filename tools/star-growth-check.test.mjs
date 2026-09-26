import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countHandAccepted,
  countHumanContributors,
  countListingKinds,
  deferredDoorStatus,
  isListedInReadme,
  needsRecarry,
  publishedToolCount,
  staleToolCounts,
} from './star-growth-check.mjs';

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

// The roster is the only authority for these counts, so the parser has to be pinned
// on both directions: a real shape it must read, and a missing marker it must refuse
// rather than report as zero.
test('publishedToolCount counts the roster and refuses to guess', () => {
  const source = `export const MCP_TOOL_NAMES = Object.freeze([
  "gateway_health",
  "workflow_run",
]);`;
  assert.equal(publishedToolCount(source), 2);
  assert.equal(publishedToolCount('export const SOMETHING_ELSE = [];'), null);
});

// Two live listings still advertised "nine governed MCP tools" on 2026-09-25 while the
// roster had fifteen. This fixture is one of those rows verbatim, so the matcher is
// proven against the real shape rather than a convenient one.
test('staleToolCounts reads the row shape that actually shipped', () => {
  const row = '- [Unified AI System](https://github.com/happy520ai/unified-ai-system) - Apache-2.0 local-first Node.js gateway and MCP server for Codex/Cursor/Cline: explicit provider/model selection, streaming chat, nine governed MCP tools and prompt enhancement.';
  const found = staleToolCounts(row, 15);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], { reported: 9, expected: 15, phrase: 'nine governed MCP tools' });
  assert.equal(staleToolCounts('ships 12 tools today', 15)[0].reported, 12);
});

test('staleToolCounts stays silent on correct counts and on rows that make no claim', () => {
  assert.deepEqual(staleToolCounts('fifteen governed MCP tools and a credential-free path', 15), []);
  assert.deepEqual(staleToolCounts('15 tools, 4 release gates', 15), []);
  assert.deepEqual(staleToolCounts('Apache-2.0 local-first Node.js gateway and MCP server', 15), []);
  assert.deepEqual(staleToolCounts('anything at all', 0), []);
  assert.deepEqual(staleToolCounts(null, 15), []);
});

// A deferred door is a promise about the future; it is only useful if the arithmetic
// and the bot exclusion are right, and if "could not read" never becomes "eligible".
test('countHumanContributors refuses to count bots as contributors', () => {
  assert.equal(countHumanContributors([
    { login: 'happy520ai', type: 'User' },
    { login: 'dependabot[bot]', type: 'Bot' },
  ]), 1);
  assert.equal(countHumanContributors([{ login: 'a', type: 'User' }, { login: 'b', type: 'User' }]), 2);
  assert.equal(countHumanContributors([]), 0);
  assert.equal(countHumanContributors(undefined), 0);
});

test('deferredDoorStatus reports the remaining distance, not a boolean alone', () => {
  const doors = [{ repo: 'x/list', requiresStars: 200, requiresHumanContributors: 2, note: 'n' }];
  const waiting = deferredDoorStatus(doors, 7, 1)[0];
  assert.equal(waiting.ready, false);
  assert.equal(waiting.starsNeeded, 193);
  assert.equal(waiting.contributorsNeeded, 1);

  const ready = deferredDoorStatus(doors, 200, 2)[0];
  assert.equal(ready.ready, true);
  assert.equal(ready.starsNeeded, 0);

  // Over-shooting must not produce negative debt.
  const past = deferredDoorStatus(doors, 900, 5)[0];
  assert.equal(past.starsNeeded, 0);
  assert.equal(past.contributorsNeeded, 0);
  assert.deepEqual(deferredDoorStatus(undefined, 7, 1), []);
});
