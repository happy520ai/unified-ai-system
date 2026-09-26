import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUR_COPY_STALE_ALLOWED,
  carrierFindings,
  carrierRegion,
  countHandAccepted,
  countHumanContributors,
  countListingKinds,
  deferredDoorStatus,
  findUntrackedDoors,
  isListedInReadme,
  needsRecarry,
  publishedToolCount,
  staleOwnClaimLines,
  staleToolCounts,
  unreadableCarriers,
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
  const rows = [
    { listing: 'readme' },
    { listing: 'readme' },
    { listing: 'absent' },
    { listing: 'unreadable' },
    { listing: 'n/a' },
    { listing: 'n/a' },
    {},
  ];
  const tally = countListingKinds(rows);
  assert.deepEqual(tally, { readme: 2, absent: 1, unreadable: 2, notApplicable: 2 });
  assert.equal(tally.readme + tally.absent + tally.unreadable + tally.notApplicable, rows.length);
  assert.deepEqual(countListingKinds([]), { readme: 0, absent: 0, unreadable: 0, notApplicable: 0 });
});

// The defect this bucket exists for: six submission tickets used to make the report say
// "6 unreadable", so the blindness count was really a count of our own bookkeeping.
test('a ticket with no README to read is not counted as a failed probe', () => {
  const rows = [{ repo: 'chatmcp/mcpso', listing: 'n/a' }, { repo: 'cline/mcp-marketplace', listing: 'n/a' }];
  assert.equal(countListingKinds(rows).unreadable, 0);
  assert.deepEqual(unreadableCarriers(rows), []);
});

test('unreadableCarriers names the repos a probe could not read, once each', () => {
  const rows = [
    { repo: 'a/l', listing: 'unreadable' },
    { repo: 'a/l', listing: 'unreadable' },
    { repo: 'b/l', listing: 'n/a' },
    { repo: 'c/l', listing: 'readme' },
    { repo: 'd/l', listing: 'absent' },
    { repo: 'e/l' },
  ];
  assert.deepEqual(unreadableCarriers(rows), ['a/l', 'e/l']);
  assert.deepEqual(unreadableCarriers([]), []);
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

// The re-carry arm can only be trusted if the door list is every door; this is the
// guard that stops "nothing needs action" from meaning "nothing I wrote down".
test('findUntrackedDoors names doors the report cannot see', () => {
  const tracked = [{ repo: 'a/l', pr: 1 }, { repo: 'b/l', pr: 2 }];
  const open = [
    { repository_url: 'https://api.github.com/repos/a/l', number: 1, title: 'tracked', pull_request: {} },
    { repository_url: 'https://api.github.com/repos/c/l', number: 3, title: 'the one that slips' },
    { repository_url: 'https://api.github.com/repos/happy520ai/unified-ai-system', number: 9, title: 'our own repo is not a door' },
  ];
  const result = findUntrackedDoors(tracked, open, 'happy520ai/unified-ai-system');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { repo: 'c/l', pr: 3, kind: 'issue', title: 'the one that slips' });
});

// The defect this arm was widened for: a submission that arrives as an issue, not a pull
// request, was invisible to a `type:pr` denominator, so "every door is tracked" was a
// narrower claim than it sounded.
test('findUntrackedDoors counts a submission issue as a door of its own kind', () => {
  const openIssue = {
    repository_url: 'https://api.github.com/repos/chatmcp/mcpso',
    number: 3394,
    title: '[Submit] Unified AI System: AI gateway with 9 governed MCP tools',
  };
  const untracked = findUntrackedDoors([], [openIssue], 'happy520ai/unified-ai-system');
  assert.equal(untracked.length, 1);
  assert.equal(untracked[0].kind, 'issue');
  const trackedAsIssue = findUntrackedDoors(
    [{ repo: 'chatmcp/mcpso', pr: 3394, kind: 'issue' }],
    [openIssue],
    'happy520ai/unified-ai-system'
  );
  assert.deepEqual(trackedAsIssue, []);
});

test('findUntrackedDoors is sensitive to a changed number, not just the repo', () => {
  const result = findUntrackedDoors([{ repo: 'a/l', pr: 1 }], [
    { repository_url: 'https://api.github.com/repos/a/l', number: 42, title: 'same list, new PR' },
  ], 'happy520ai/unified-ai-system');
  assert.equal(result.length, 1);
  assert.equal(result[0].pr, 42);
});

test('findUntrackedDoors degrades to empty rather than throwing', () => {
  assert.deepEqual(findUntrackedDoors([], [], 'x/y'), []);
  assert.deepEqual(findUntrackedDoors(undefined, undefined, 'x/y'), []);
});

// A security-advisory fork must never surface as a promotion door.
test('findUntrackedDoors ignores private-vulnerability forks', () => {
  const result = findUntrackedDoors([], [
    { repository_url: 'https://api.github.com/repos/happy520ai/unified-ai-system-ghsa-rg4w-29r7-h4rh', number: 1, title: 'PRIVATE SECURITY REVIEW' },
  ], 'happy520ai/unified-ai-system');
  assert.deepEqual(result, []);
});

// The chatmcp/mcpso#3394 case, verbatim: an open submission whose TITLE stated a tool
// count the published surface no longer has. A row with no claim must stay silent, a row
// with the right count must stay silent, and an unreadable roster must not read as clean.
test('staleOwnClaimLines reads our own submission title and body', () => {
  const rows = [
    {
      repo: 'chatmcp/mcpso',
      pr: 3394,
      kind: 'issue',
      claimText: '[Submit] Unified AI System: AI gateway with 9 governed MCP tools\n',
    },
    { repo: 'a/l', pr: 1, kind: 'pr', claimText: 'Add Unified AI System to the gateway list' },
    { repo: 'b/l', pr: 2, kind: 'pr', claimText: 'Unified AI System: gateway with 15 governed MCP tools' },
  ];
  const found = staleOwnClaimLines(rows, 15);
  assert.equal(found.length, 1);
  assert.match(found[0], /^chatmcp\/mcpso#3394 \(issue\) says "9 governed MCP tools"/);
  assert.equal(staleOwnClaimLines(rows, null), null);
  assert.deepEqual(staleOwnClaimLines([], 15), []);
});

// Declared boundary of the matcher, not an accident: it only reads a count that sits
// directly against "tools", optionally through "governed"/"MCP". Loosening it to any
// intervening word would make prose like "one more tool" a stale-count alarm, and a gate
// that cries wolf gets ignored. A one-time loose sweep of every live door body was run on
// 2026-09-26 to catch the phrases this arm cannot see.
test('staleToolCounts leaves adjective-separated count prose alone', () => {
  assert.deepEqual(staleToolCounts('All nine documented tools are exposed.', 15), []);
  assert.deepEqual(staleToolCounts('one more tool', 15), []);
  assert.deepEqual(staleToolCounts('nine governed MCP tools', 15), [
    { reported: 9, expected: 15, phrase: 'nine governed MCP tools' },
  ]);
});

// The allowlist must mute one door's honest history, not the phrase itself. If these two
// arms ever agree, the exclusion list has become a global mute and the arm is worthless.
test('the our-copy allowlist is scoped to one door, not to the phrase', () => {
  const quoted = {
    repo: 'TensorBlock/awesome-mcp-servers',
    pr: 2707,
    kind: 'pr',
    claimText: 'fix(ai--llm-integration): our own entry said nine tools and pinned a 0.4.1 image',
  };
  assert.deepEqual(staleOwnClaimLines([quoted], 15), []);
  const samePhraseElsewhere = { ...quoted, repo: 'someone-else/list', pr: 1 };
  const found = staleOwnClaimLines([samePhraseElsewhere], 15);
  assert.equal(found.length, 1);
  assert.match(found[0], /says "nine tools"/);
  assert.ok(OUR_COPY_STALE_ALLOWED.length >= 2, 'both recorded-history doors must be named');
});

// A merged door in someone else's repository keeps our numbers in files this report cannot
// see from a README. These arms cover the reader AND the tamper direction: the live text
// (fetched 2026-09-26, kept verbatim) must read clean, and a one-word edit must be named.
test('carrierFindings reads a clean upstream plugin manifest as clean', () => {
  const live = '{"version":"0.8.0","description":"Connect Codex to a self-hosted AI gateway with provider-free prompt enhancement and fifteen governed MCP tools.","shortDescription":"Fifteen governed MCP tools, local-first."}';
  assert.deepEqual(carrierFindings(live, 15, '0.8.0'), []);
});

test('carrierFindings names a stale count and a stale version pin', () => {
  const stale = '{"version":"0.7.0","description":"... twelve governed MCP tools ..."}';
  const findings = carrierFindings(stale, 15, '0.8.0');
  assert.equal(findings.length, 2);
  assert.match(findings[0], /states "twelve governed MCP tools" while the roster has 15/);
  assert.match(findings[1], /pins version 0\.7\.0, published release is 0\.8\.0/);
});

test('carrierFindings ignores a version assertion when the carrier is not versioned', () => {
  const md = 'Setup steps:\n1. If the 15 tools are already visible, continue.\n';
  assert.deepEqual(carrierFindings(md, 15, null), []);
  // boundary arm: the same text read against a different roster must complain
  assert.equal(carrierFindings(md, 12, null).length, 1);
});

test('carrierFindings on prose with no numbers reports nothing', () => {
  assert.deepEqual(carrierFindings('a gateway for agents, with governance and audit', 15, '0.8.0'), []);
});

// The false positive the first live run produced: an aggregate catalogue describes hundreds
// of plugins, so another plugin's "23 MCP tools" is not a claim about us. Scope is the fix,
// and the arm must prove both halves of it.
test('carrierRegion reads only the object that holds our anchor', () => {
  const index = '{"plugins":[{"name":"other","description":"a gateway exposing 23 MCP tools"},'
    + '{"name":"ours","repo":"happy520ai/unified-ai-system","description":"fifteen governed MCP tools"}]}';
  const region = carrierRegion(index, 'happy520ai/unified-ai-system');
  assert.match(region, /"name":"ours"/);
  assert.ok(!region.includes('23 MCP tools'), 'a neighbouring plugin leaked into our region');
  assert.deepEqual(carrierFindings(region, 15, null), []);
  // and the neighbour really does complain when scope is ignored, so the arm is not vacuous
  assert.equal(carrierFindings(index, 15, null).length, 1);
});

test('carrierRegion reports no-match as null rather than as clean', () => {
  assert.equal(carrierRegion('{"plugins":[{"name":"other"}]}', 'happy520ai/unified-ai-system'), null);
  assert.equal(carrierRegion('{"nested":{"deep":true}}', 'missing-anchor'), null);
});
