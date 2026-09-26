import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OUR_COPY_STALE_ALLOWED,
  classifyProbeResponse,
  carrierFindings,
  carrierLines,
  carrierRegion,
  commentClaimFindings,
  countHandAccepted,
  countHumanContributors,
  countListingKinds,
  deferredDoorStatus,
  findUntrackedDoors,
  indexedSiteUrls,
  isListedInReadme,
  needsRecarry,
  publishedToolCount,
  replyRequestFrom,
  queueHealth,
  searchCoverageLines,
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

// This arm used to declare a narrower boundary: only a count sitting directly against
// "tools", optionally through "governed"/"MCP", on the grounds that loosening it would make
// "one more tool" an alarm and a gate that cries wolf gets ignored. That boundary cost a real
// miss - "nine stdio MCP tools" inside machine-readable install config read as clean - so it
// moved: any technical qualifier is now in scope, and the cry-wolf case is handled by an
// explicit prose stop-list instead of by blindness. Prose cases stay asserted on purpose.
test('staleToolCounts reads technical qualifiers and still ignores prose quantifiers', () => {
  assert.deepEqual(staleToolCounts('All nine documented tools are exposed.', 15), [
    { reported: 9, expected: 15, phrase: 'nine documented tools' },
  ]);
  assert.deepEqual(staleToolCounts('one more tool', 15), []);
  assert.deepEqual(staleToolCounts('two other tools', 15), []);
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

// cuihuan/awesome-ai-gateway#48 is a door that already closed: the maintainer applied our
// row by hand and the stale README sentence is being fixed through #102. Excluding it stops
// a future session from re-carrying a burned door - but the exclusion is a door AND phrase
// pair, so these three directions have to hold at once.
test('the closed-door exclusion mutes one sentence, not one door', () => {
  const recorded = {
    repo: 'cuihuan/awesome-ai-gateway',
    pr: 48,
    kind: 'pr',
    claimText: 'Add Unified AI System to self-hosted open source - nine governed MCP tools',
  };
  assert.deepEqual(staleOwnClaimLines([recorded], 15), []);

  const sameDoorDifferentClaim = {
    ...recorded,
    claimText: 'Add Unified AI System - eleven governed MCP tools',
  };
  const doorStillReads = staleOwnClaimLines([sameDoorDifferentClaim], 15);
  assert.equal(doorStillReads.length, 1, 'a different wrong count at the same door must still fire');
  assert.match(doorStillReads[0], /eleven governed MCP tools/);

  const samePhraseAnotherDoor = { ...recorded, repo: 'someone-else/list', pr: 2 };
  assert.equal(staleOwnClaimLines([samePhraseAnotherDoor], 15).length, 1);
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

// Two errors this arm exists to prevent. (1) Recency of submissions is not evidence anyone
// reads them: travisvn/awesome-claude-skills had PRs opened yesterday, a default branch
// eight months cold, 794 open pull requests and no merge in its recent closed set.
// (2) A mixed open/closed sample calls a healthy list dead, because a busy repo's 20
// most-recently-updated pull requests can be almost all open.
test('queueHealth reads merges out of the closed sample only', () => {
  const today = '2026-09-26T00:00:00Z';
  const closed = (n, mergedAt) =>
    Array.from({ length: n }, (_, i) => ({ state: 'closed', merged_at: i === 0 ? mergedAt : null }));
  const recent = '2026-09-20T00:00:00Z';
  const old = '2025-12-01T00:00:00Z';

  assert.equal(queueHealth(closed(20, recent), { today }).verdict, 'ALIVE');
  const dead = queueHealth(closed(20, null), { today });
  assert.equal(dead.verdict, 'DEAD_QUEUE');
  assert.match(dead.reason, /^0 of 20 /);
  assert.equal(dead.merged, 0);
  assert.equal(dead.closed, 20);
  assert.equal(queueHealth(closed(6, old), { today }).verdict, 'STALE');

  const stale = queueHealth(closed(6, old), { today });
  assert.equal(stale.verdict, 'STALE');
  assert.equal(stale.lastMergedAt, '2025-12-01');

  // open pull requests must not shrink or pollute the closed denominator
  const busy = [
    ...Array.from({ length: 18 }, () => ({ state: 'open' })),
    ...closed(6, recent),
  ];
  assert.equal(queueHealth(busy, { today }).verdict, 'ALIVE');

  assert.equal(queueHealth([{ state: 'closed' }, { state: 'closed' }], { today }).verdict, 'UNKNOWN');
  assert.equal(queueHealth(null, { today }).verdict, 'UNKNOWN');
  assert.equal(queueHealth([], { today }).verdict, 'UNKNOWN');
});

// Issue #20 carried `docker run ...:0.7.0` inside an owner comment for weeks: the remote
// sweep read bodies, never comments, and the pattern list only knew the word "twelve".
test('commentClaimFindings reads comments, which the body sweep never looked at', () => {
  const comment = {
    id: 1,
    html_url: 'https://github.com/o/r/issues/20#issuecomment-1',
    body: 'I verified the command is still: docker run image:tag and it exposes twelve governed MCP tools.',
  };
  const found = commentClaimFindings([comment], 15);
  assert.equal(found.offenders.length, 1);
  assert.match(found.offenders[0], /^comment 1 on #20 says "twelve governed MCP tools" while the roster has 15/);
  assert.equal(found.scanned, 1);

  const current = { ...comment, id: 2, body: 'exposes fifteen governed MCP tools' };
  assert.deepEqual(commentClaimFindings([current], 15).offenders, []);

  // allowlist moves a record out of offenders and says so, rather than muting the phrase
  const kept = commentClaimFindings([comment], 15, [{ id: 1, reason: 'dated audit record' }]);
  assert.deepEqual(kept.offenders, []);
  assert.equal(kept.kept.length, 1);
  assert.match(kept.kept[0], /^comment 1 on #20 - dated audit record$/);

  // comment URLs exist for issues and for pull requests; both must label cleanly
  assert.match(commentClaimFindings([{ id: 9, html_url: 'https://github.com/o/r/pull/115#issuecomment-9', body: 'twelve tools' }], 15).offenders[0], /^comment 9 on #115/);
  assert.equal(commentClaimFindings([comment], null), null);
  assert.deepEqual(commentClaimFindings([], 15).offenders, []);
  // boundary: version pins are out of scope for this arm by standing decision
  assert.deepEqual(commentClaimFindings([{ id: 3, html_url: 'x/issues/3', body: 'pin ai-gateway-service:0.5.0' }], 15).offenders, []);
});

// The coverage probe reads a search engine's HTML, and a search engine echoes your own
// query straight back at you - that echo once read as "6 pages indexed" on a page that had
// indexed none of them. These arms keep a result link, an echo, a fragment and a host
// spoof apart, and they refuse to let a dead probe be reported as a zero.
test('indexedSiteUrls counts result links, not the query it was asked', () => {
  const html = [
    '<a href="https://happy520ai.github.io/unified-ai-system/">home</a>',
    '<a href="https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html">page</a>',
    '<a href="https://happy520ai.github.io/unified-ai-system/index.zh-CN.html#frag">fragment</a>',
    '<a href="https://happy520ai.github.io/unified-ai-system/sitemap.xml?u=1">query string</a>',
    '<a href="https://duckduckgo.com/?q=site%3Ahappy520ai.github.io">our own echo</a>',
    '<a href="https://evil.example/happy520ai.github.io/page.html">host spoof</a>',
  ].join('\n');
  assert.deepEqual(indexedSiteUrls(html), [
    'https://happy520ai.github.io/unified-ai-system/',
    'https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html',
  ]);
  // The shape the real probe returns: destination inside an encoded redirect parameter.
  const wrapped = '<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fhappy520ai.github.io%2Funified-ai-system%2Fverify-mcp-docker-image.html&amp;rut=fbdb8493">wrapped result</a>';
  assert.deepEqual(indexedSiteUrls(wrapped), [
    'https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html',
  ]);
  assert.deepEqual(indexedSiteUrls(null), []);
  assert.deepEqual(indexedSiteUrls('no links here'), []);
});

test('searchCoverage names a dead probe instead of scoring it zero', () => {
  const published = [
    'https://happy520ai.github.io/unified-ai-system/',
    'https://happy520ai.github.io/unified-ai-system/a.html',
  ];
  const blind = searchCoverageLines(published, []).join('\n');
  assert.match(blind, /BLIND_PROBE/);
  assert.match(blind, /not evidence of absence|No coverage claim/);

  const broken = searchCoverageLines(published, [], { error: 'probe answered HTTP 403' }).join('\n');
  assert.match(broken, /Inconclusive/);
  assert.match(broken, /HTTP 403/);

  const counted = searchCoverageLines(published, [published[0]]).join('\n');
  assert.match(counted, /found in the index: 1; not visible: 1/);
  assert.match(counted, /a\.html/);
  assert.ok(!/BLIND_PROBE/.test(counted), 'one page found means the probe is alive');
});

// Both directions have to be proven with real bytes: the challenge page arrives under a
// success-looking status, and an empty results page must not be excused as a block.
test('classifyProbeResponse separates a stopped probe from an empty one', () => {
  const challenge = '<p>Please complete the following challenge to confirm this search was made by a human.</p><p>Select all squares containing a duck</p>';
  assert.equal(classifyProbeResponse(202, challenge).kind, 'CHALLENGE');
  assert.match(classifyProbeResponse(202, challenge).error, /bot challenge page/);
  assert.equal(classifyProbeResponse(200, '<a href="https://example.invalid/x">one result</a>').kind, 'RESULTS');
  assert.equal(classifyProbeResponse(200, '').kind, 'RESULTS', 'an empty results page is emptiness, not a block');
  assert.equal(classifyProbeResponse(500, 'gateway').kind, 'UNEXPECTED_STATUS');
  assert.equal(classifyProbeResponse(403, '<html>').error, 'probe answered HTTP 403');
});

// Line-scoped carriers guard a markdown list. Two directions must both hold: a neighbour's
// count must not become ours, and a file that does not list us must not read as clean.
test('carrierLines reads only our row out of a shared markdown list', () => {
  const md = [
    '- [Other Thing](https://github.com/other/thing) - An MCP server with sixteen governed MCP tools.',
    '- [Unified AI System](https://github.com/happy520ai/unified-ai-system) - Self-hosted AI gateway with nine governed MCP tools.',
    '- [Third](https://github.com/third/party) - Ships twelve MCP tools for file access.',
  ].join('\n');
  const scoped = carrierLines(md, 'happy520ai/unified-ai-system');
  assert.equal(scoped.includes('sixteen'), false);
  assert.equal(scoped.includes('twelve'), false);
  assert.deepEqual(staleToolCounts(scoped, 15).map((c) => c.phrase), ['nine governed MCP tools']);
  // A list that does not carry us is "unscoped", never "clean".
  assert.equal(carrierLines('- [Someone](https://example.invalid/x) - ten tools.', 'happy520ai/unified-ai-system'), null);
  assert.equal(carrierLines(null, 'a'), null);
  assert.equal(carrierLines('whole file, no anchor needed', undefined), 'whole file, no anchor needed');
});

// The matcher has failed in both directions here: too narrow missed "nine stdio MCP tools"
// inside machine-readable install config (printed ok on the most harmful carrier), and the
// first widening let a preceding word swallow the match so it detected less than before.
// This table is the contract between those two mistakes.
test('staleToolCounts matches any technical qualifier and no prose quantifier', () => {
  const cases = [
    ['nine governed MCP tools', 1],
    ['nine stdio MCP tools', 1],
    ['with nine governed MCP tools', 1],
    ['exposes fifteen governed MCP tools', 0],
    ['one more tool', 0],
    ['two other tools', 0],
    ['a number of tools', 0],
    ['nine more available tools', 0],
    ['12 tools', 1],
    ['all tools', 0],
  ];
  for (const [text, expected] of cases) {
    assert.equal(staleToolCounts(text, 15).length, expected, text);
  }
});

// A version pin is most often an image tag, not a "version" key - and an old tag is what a
// reader of a directory actually runs.
test('carrierFindings reads an image tag as the version pin it is', () => {
  const stale = '{"description":"exposes nine stdio MCP tools","binArgs":["run","ghcr.io/o/r/mcp-server:0.4.8"]}';
  const findings = carrierFindings(stale, 15, '0.8.0');
  assert.equal(findings.length, 2);
  assert.ok(findings.some((f) => /nine stdio MCP tools/.test(f)));
  assert.ok(findings.some((f) => /pins version 0\.4\.8, published release is 0\.8\.0/.test(f)));
  assert.deepEqual(carrierFindings(stale, 15, null), findings.filter((f) => /MCP tools/.test(f)), 'no version given means no version claim');
  assert.deepEqual(carrierFindings('{"version":"0.8.0","description":"fifteen tools"}', 15, '0.8.0'), []);
});

// The whole point of this arm is to answer one question across 40+ doors: did a human ask us
// something we have not answered. Every direction has to be proven, including the ones that
// must NOT fire - a bot comment or an owner's own reply is not a request, and an author-less
// record must never be mistaken for one.
test('replyRequestFrom flags a human who spoke after us and nothing else', () => {
  const c = (login, at, body = 'note') => ({ user: { login }, created_at: at, body });
  assert.equal(replyRequestFrom([c('happy520ai', '2026-09-25T10:00:00Z', 'ping'), c('maintainer', '2026-09-24T09:00:00Z', 'question?')], 'happy520ai'), null);
  const ask = replyRequestFrom([c('maintainer', '2026-09-26T09:00:00Z', 'can you rebase?'), c('happy520ai', '2026-09-25T10:00:00Z', 'thanks')], 'happy520ai');
  assert.equal(ask.author, 'maintainer');
  assert.equal(ask.at, '2026-09-26');
  assert.match(ask.excerpt, /rebase/);
  assert.equal(replyRequestFrom([c('dependabot[bot]', '2026-09-26T10:00:00Z', 'bump'), c('happy520ai', '2026-09-20T10:00:00Z', 'x')], 'happy520ai'), null);
  assert.equal(replyRequestFrom([c('InftyAI-Agent', '2026-09-26T10:00:00Z', 'PR updated')], 'happy520ai'), null);
  assert.equal(replyRequestFrom([c('other', '2026-09-26T10:00:00Z', 'asked')], 'happy520ai').at, '2026-09-26');
  assert.equal(replyRequestFrom([], 'happy520ai'), null);
  assert.equal(replyRequestFrom([{ user: {}, created_at: '2026-09-26T10:00:00Z', body: 'no author' }], 'happy520ai'), null);
  assert.equal(replyRequestFrom([{ user: { login: 'x', type: 'Bot' }, created_at: '2026-09-26T10:00:00Z' }], 'happy520ai'), null);
});
test('a human-typed bot account is not a request', () => {
  const c = (login, at, body) => ({ user: { login, type: 'User' }, created_at: at, body });
  assert.equal(replyRequestFrom([c('shiftbot', '2026-09-25T16:40:00Z', "I'm a robot checking the state of this pull request")], 'happy520ai'), null);
  assert.equal(replyRequestFrom([c('review-bot', '2026-09-25T16:40:00Z', 'linted')], 'happy520ai'), null);
  assert.equal(replyRequestFrom([c('a-person', '2026-09-25T16:40:00Z', 'could you rebase?')], 'happy520ai').author, 'a-person');
});
test('named automation accounts are not requests either', () => {
  const c = (login, at, body) => ({ user: { login, type: 'User' }, created_at: at, body });
  for (const login of ['github-actions[bot]', 'coderabbitai', 'socket-security', 'snyk-bot', 'cla-bot', 'shiftbot', 'InftyAI-Agent']) {
    assert.equal(replyRequestFrom([c(login, '2026-09-26T10:00:00Z', 'automated notice')], 'happy520ai'), null, login);
  }
  // The direction that must still fire: a person whose login merely contains a bot-ish word.
  assert.equal(replyRequestFrom([c('robbitten', '2026-09-26T10:00:00Z', 'rebase please')], 'happy520ai').author, 'robbitten');
});

// T-129: the carrier sweep must tell a record from an instruction, and the excuse has
// to stay narrower than the claim it protects.
const { classifyStaleLines } = await import("./star-growth-check.mjs");
const { isRecordLine } = await import("./launch-preflight.mjs");

test('a body whose only old number sits in a recorded sentence is not an offender', () => {
  const body = [
    '### Why this exists',
    'Every one of those rows was produced when the published surface had twelve tools;',
    'Each row currently reads "discovered twelve tools" (or 12 个工具).',
  ].join('\n');
  const { labels, recordLines } = classifyStaleLines(body);
  assert.deepEqual(labels, []);
  assert.equal(recordLines, 2);
});

test('an instruction to a reader still goes red, with the same matcher', () => {
  const { labels, recordLines } = classifyStaleLines('Install it and you should expect twelve tools.');
  assert.deepEqual(labels, ['twelve tools']);
  assert.equal(recordLines, 0);
});

test('one body carrying both kinds reports the instruction, not the pair', () => {
  const mixed = 'The v0.7.0 image exposed 12 tools.\nThe current release exposes twelve tools.';
  const { labels, recordLines } = classifyStaleLines(mixed);
  assert.deepEqual(labels, ['twelve tools']);
  assert.equal(recordLines, 1);
});

test('the record marker does not excuse a present-tense claim', () => {
  assert.equal(isRecordLine('The published container and the current source both expose 12 MCP tools.'), false);
  assert.equal(isRecordLine('the v0.7.0 image exposed 12 tools'), true);
  // The two markers that exist only for reproduced wording: an arrow introducing a
  // quotation, and a quoted phrase. Both were in the predicate the launch copy depends
  // on, and a narrower shared version made a quoted "eight dedicated tools" read as ours.
  assert.equal(isRecordLine('> the listing points at eight dedicated tools → "eight dedicated tools"'), true);
});

test('comment findings keep a self-marked record and reject an instruction', () => {
  const roster = 15;
  const sweep = commentClaimFindings(
    [
      { id: 1, html_url: 'https://x/issues/9#issuecomment-1', body: 'As of 2026-08-24 the audit record states: twelve tools were live then.' },
      { id: 2, html_url: 'https://x/issues/9#issuecomment-2', body: 'Verify the integration exposes twelve tools.' },
    ],
    roster,
    [],
  );
  assert.equal(sweep.scanned, 2);
  assert.equal(sweep.kept.length, 1);
  assert.match(sweep.kept[0], /marks itself as a record/);
  assert.equal(sweep.offenders.length, 1);
  assert.match(sweep.offenders[0], /comment 2 .*twelve tools/);
});
