import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/growth-door-state.mjs";
const WORKFLOW = ".github/workflows/star-growth-snapshot.yml";
const dir = mkdtempSync(join(tmpdir(), "doorstate-"));

const { parseDoorText, doorLine } = await import(pathToFileURL(join(ROOT, GEN)).href);

const PRESENCE_OK = [
  "{",
  '   "site": "https://mcpservers.org",',
  '   "verdict": "LISTED",',
  '   "site": "https://github.com/mcp",',
  '   "verdict": "NOT_FOUND",',
  "SUMMARY listed=3 not_found=1 undecidable=0",
].join("\n");

const TOPIC_OK = [
  "happy520ai/unified-ai-system - 8 stars, 20/20 topic slots used",
  "",
  "topic                      state                  total  rank  stars@30  stars@50",
  "mcp-gateway                ranked                   330    88       212        38",
  "agent-governance           ranked                   858    85        31        13",
  "mcp                        below_page               141292     -      47042     33420",
  "",
  "Page one within reach (rank-30 needs <=100 stars): agent-governance(31), mcp(47042)",
].join("\n");

// Carriers are a separate leg from directories on purpose: a directory listing appears in a sitemap, a
// carrier entry appears in a human-curated file, and one of our "merged" PRs turned out to have landed in a
// WATCHLIST file instead of the catalogue. Folding the two would overstate the doors.
const CARRIERS_OK = [
  "hashgraph-online/awesome-codex-plugins       LISTED       plugins/happy520ai/unified-ai-system/skills",
  "scadastrangelove/awesome-ai-security-tools   WATCHLISTED  WATCHLIST.md",
  "CARRIER_SUMMARY listed=6 watchlisted=1 absent=0 unreadable=0",
].join("\n");

// The inbound leg reports doors where somebody on the other side has spoken to us. It is kept as its own
// leg because it is the only number here that decays: a listing that lands stays landed, an unanswered
// question gets stale and the door closes on its own.
const INBOUND_OK = [
  "OWNER-GATE     e2b-dev/awesome-ai-agents#1401                blocked    gate: CLA  | Add Unified AI System",
  "(not printed individually: 29 doors waiting on the other side)",
  "INBOUND_STATE doors=31 reply_due=0 owner_gate=1 waiting=29 private_review=1 inline_newer=0 change_requested=0 conflicts=0 unreadable=0 bot_events_excluded=19 foreign_edits_seen=1 verdict=SWEEP-COMPLETE",
].join("\n");

const ALL_OK = { presence: PRESENCE_OK, topic: TOPIC_OK, carriers: CARRIERS_OK, inbound: INBOUND_OK, presenceStatus: 0, topicStatus: 0, carriersStatus: 0, inboundStatus: 0 };

function stub(name, body) {
  const p = join(dir, name + ".mjs");
  writeFileSync(p, body, "utf8");
  return p;
}

test("a healthy set of instruments parses into every door field", () => {
  const parsed = parseDoorText(ALL_OK);
  assert.deepEqual(parsed.directories, { listed: 3, not_found: 1, undecidable: 0 });
  assert.deepEqual(parsed.carriers, { listed: 6, watchlisted: 1, absent: 0, unreadable: 0 });
  assert.deepEqual(parsed.inbound, { doors: "31", replyDue: "0", ownerGate: "1", waiting: "29", privateReview: "1", inlineNewer: "0", changeRequested: "0", conflicts: "0", unreadable: "0" });
  assert.equal(parsed.github, "NOT_FOUND");
  assert.equal(parsed.stars, 8);
  assert.equal(parsed.slots, "20/20");
  assert.equal(parsed.topicRanked, 2, "only the two `ranked` rows count");
  for (const leg of ["presence", "topic", "carriers", "inbound"]) assert.equal(parsed.legs[leg].parsed, true, leg);
  const line = doorLine(parsed);
  assert.match(line, /^DOOR_STATE stars=8 topic_slots=20\/20 topic_pages_ranked=2 /);
  assert.match(line, /carriers_listed=6 carriers_watchlisted=1 carriers_absent=0 carriers_unreadable=0/);
  assert.match(line, /inbound_doors=31 inbound_reply_due=0 inbound_owner_gate=1 inbound_inline_newer=0 inbound_change_requested=0 inbound_conflicts=0 inbound_unreadable=0/);
  assert.match(line, /github_mcp=NOT_FOUND/);
  assert.match(line, /page_one_within_reach="agent-governance\(31\), mcp\(47042\)"/);
});

test("an unreadable leg prints the word unreadable instead of shrinking the claim", () => {
  const parsed = parseDoorText({ presence: "", topic: "", carriers: "", inbound: "", presenceStatus: 1, topicStatus: 124, carriersStatus: 1, inboundStatus: 4 });
  const line = doorLine(parsed);
  for (const field of ["stars=", "topic_slots=", "topic_pages_ranked=", "directories_listed=", "directories_not_found=", "directories_undecidable=", "carriers_listed=", "carriers_watchlisted=", "carriers_absent=", "carriers_unreadable=", "inbound_doors=", "inbound_reply_due=", "inbound_owner_gate=", "inbound_unreadable=", "github_mcp=", "page_one_within_reach="]) {
    assert.ok(line.includes(field + "unreadable"), field + " must read unreadable, got: " + line);
  }
  for (const leg of ["presence", "topic", "carriers", "inbound"]) assert.equal(parsed.legs[leg].parsed, false, leg);
});

test("a queue that could not be read is not reported as a queue of zero", () => {
  // The child's own refusal line arrives with `doors=unreadable`, and the aggregator must treat that as a
  // blind leg rather than as "no doors awaiting a reply", which is the difference between news and noise.
  const parsed = parseDoorText({ ...ALL_OK, inbound: "INBOUND_STATE doors=unreadable reply_due=unreadable owner_gate=unreadable waiting=unreadable private_review=unreadable inline_newer=unreadable unreadable=unreadable bot_events_excluded=0 foreign_edits_seen=0 verdict=SEARCH-UNREADABLE" });
  assert.equal(parsed.legs.inbound.parsed, false);
  assert.equal(parsed.inbound.doors, "unreadable", "the word is kept verbatim, not coerced to a number");
  assert.match(doorLine(parsed), /inbound_doors=unreadable/);
});

test("a field the aggregator has never heard of does not blind the leg", () => {
  // The watch grows categories (inline review comments were one). Parsing the line positionally would turn an
  // addition into "that leg is unreadable", which is a false alarm that trains the reader to ignore the word.
  const extended = INBOUND_OK.replace("verdict=SWEEP-COMPLETE", "mentions_seen=7 verdict=SWEEP-COMPLETE");
  const parsed = parseDoorText({ ...ALL_OK, inbound: extended });
  assert.equal(parsed.legs.inbound.parsed, true, "an unknown extra field must not make the leg unreadable");
  assert.equal(parsed.inbound.doors, "31");
  assert.equal(parsed.inbound.inlineNewer, "0");
  // A field that is genuinely absent from the line is reported as unreadable rather than as zero.
  const shortened = parseDoorText({ ...ALL_OK, inbound: "INBOUND_STATE doors=31 reply_due=0 verdict=X" });
  assert.equal(shortened.inbound.ownerGate, "unreadable");
  assert.equal(shortened.inbound.waiting, "unreadable");
});

test("one leg truncated is partial, and the other legs still report", () => {
  const parsed = parseDoorText({ ...ALL_OK, carriers: "hashgraph-online/awesome-codex-plugins LISTED x" });
  assert.equal(parsed.legs.carriers.parsed, false, "no CARRIER_SUMMARY line means the carrier leg is blind");
  assert.equal(parsed.legs.presence.parsed, true);
  assert.equal(parsed.directories.listed, 3, "the readable legs still report their doors");
  assert.match(doorLine(parsed), /carriers_listed=unreadable/);
});

test("the CLI runs four legs, prints the line, and writes the snapshot file", () => {
  const presence = stub("presence-ok", "console.log(" + JSON.stringify(PRESENCE_OK) + ");");
  const topic = stub("topic-ok", "console.log(" + JSON.stringify(TOPIC_OK) + ");");
  const carriers = stub("carriers-ok", "console.log(" + JSON.stringify(CARRIERS_OK) + ");");
  const inbound = stub("inbound-ok", "console.log(" + JSON.stringify(INBOUND_OK) + ");");
  const out = join(dir, "door-state.md");
  const r = spawnSync(process.execPath, [GEN, "--presence", presence, "--topic", topic, "--carriers", carriers, "--inbound", inbound, "--output", out], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^DOOR_STATE stars=8/m);
  const md = readFileSync(out, "utf8");
  assert.ok(md.includes("DOOR_STATE stars=8"), "the markdown must carry the same line the stdout printed");
  assert.ok(md.includes("6 in a catalogue"), "the carrier sentence must be rendered, not only counted: " + md.split("\n").filter((l) => l.includes("Carriers")).join("|"));
  assert.ok(md.includes("only in a staging file"), "and must keep the watchlisted entry distinct from the catalogue count");
  assert.ok(md.includes("awaiting a reply from us"), "the inbound sentence must be rendered too, not only counted: " + md.split("\n").filter((l) => l.includes("Open pull requests")).join("|"));
  // A door we are simply waiting on must not be printed as an alarm, so the call-out exists only when the
  // count is non-zero. Both halves of that are fixed here or the arm is decorative.
  assert.doesNotMatch(r.stdout, /^INBOUND: /m, "reply_due=0 must not produce an alarm line");
});

test("a door awaiting a reply is called out by name in the run log", () => {
  const presence = stub("presence-ok2", "console.log(" + JSON.stringify(PRESENCE_OK) + ");");
  const topic = stub("topic-ok2", "console.log(" + JSON.stringify(TOPIC_OK) + ");");
  const carriers = stub("carriers-ok2", "console.log(" + JSON.stringify(CARRIERS_OK) + ");");
  const due = INBOUND_OK.replace("reply_due=0 owner_gate=1 waiting=29", "reply_due=2 owner_gate=1 waiting=27");
  const inbound = stub("inbound-due", "console.log(" + JSON.stringify(due) + ");");
  const r = spawnSync(process.execPath, [GEN, "--presence", presence, "--topic", topic, "--carriers", carriers, "--inbound", inbound], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^INBOUND: 2 door\(s\)/m);
  assert.match(r.stdout, /inbound_reply_due=2/);
});

test("a blind leg exits non-zero unless the caller says the run may be partial", () => {
  const empty = stub("empty", "console.log('');");
  const blind = [GEN, "--presence", empty, "--topic", empty, "--carriers", empty, "--inbound", empty];
  const r = spawnSync(process.execPath, blind, { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stderr, /at least one leg was unreadable/);
  const ok = spawnSync(process.execPath, [...blind, "--allow-unreadable"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stderr, /Nothing is being claimed about those doors/);
});

test("the CLI defaults are the real instruments, not the stubs used above", () => {
  const src = readFileSync(join(ROOT, GEN), "utf8");
  for (const tool of ["tools/check-directory-presence.mjs", "tools/check-topic-rank.mjs", "tools/check-carrier-presence.mjs", "tools/growth-inbound-watch.mjs"]) {
    assert.ok(src.includes('"' + tool + '"'), "door state must call " + tool);
  }
});

test("the inbound leg is reachable from CI without editing CI", () => {
  // door-state is already a workflow step with a read token in its environment, so a fourth leg inherits
  // both. Asserting the wiring is what keeps "written" from becoming "run only when someone remembers".
  const yml = readFileSync(join(ROOT, WORKFLOW), "utf8");
  assert.match(yml, /GH_TOKEN: \$\{\{ github\.token \}\}/u);
  const step = /- name: Summarise the growth doors[\s\S]*?run: \|\n([\s\S]*?)\n\n/.exec(yml);
  assert.ok(step, "the door summary step must exist as written");
  assert.match(step[1], /node tools\/growth-door-state\.mjs --allow-unreadable/u);
});

test("a scheduled job that stopped running the doors is caught here, not in the log", () => {
  const yml = readFileSync(join(ROOT, WORKFLOW), "utf8");
  assert.ok(yml.includes("tools/growth-door-state.mjs"), "the snapshot workflow must run the door summary");
  assert.ok(yml.includes("--allow-unreadable"), "and must not fail the night because a third-party site was down");
  assert.ok(yml.includes("door-state.md"), "the snapshot file must be uploaded, not just printed");
});

test("an outstanding change request travels by name and is not coerced to zero", () => {
  // Found the hard way on 2026-09-29: a reviewer asked for changes at 05:10Z, we pushed the changes at 14:51Z,
  // and reply-due correctly went quiet - which left the standing request invisible to the nightly. The field
  // is a category of its own so the two readings can be true at once.
  const parsed = parseDoorText({ ...ALL_OK, inbound: INBOUND_OK.replace("change_requested=0", "change_requested=2") });
  assert.equal(parsed.inbound.changeRequested, "2");
  assert.match(doorLine(parsed), /inbound_change_requested=2/);
});

test("a watch build that never emitted the field reads as unreadable, not as an empty queue", () => {
  // The aggregator may run against an older child than this test fixture. A missing category must surface as
  // "we do not know", because "zero doors have a change request" is a claim about the world we cannot make.
  const older = parseDoorText({ ...ALL_OK, inbound: INBOUND_OK.replace(" change_requested=0", "") });
  assert.equal(older.inbound.changeRequested, "unreadable");
  assert.match(doorLine(older), /inbound_change_requested=unreadable/);
  assert.equal(older.legs.inbound.parsed, true, "the rest of the leg is still readable");
});

test("a door that has quietly fallen behind is counted, not narrated", () => {
  // Nobody comments when a branch goes stale: GitHub just stops calling it mergeable. The count comes from
  // mergeable_state, which is the only place that fact is recorded.
  const parsed = parseDoorText({ ...ALL_OK, inbound: INBOUND_OK.replace("conflicts=0", "conflicts=2") });
  assert.equal(parsed.inbound.conflicts, "2");
  assert.match(doorLine(parsed), /inbound_conflicts=2/);
});

test("an older watch build reports the conflict count as unreadable rather than zero", () => {
  const older = parseDoorText({ ...ALL_OK, inbound: INBOUND_OK.replace(" conflicts=0", "") });
  assert.equal(older.inbound.conflicts, "unreadable");
  assert.match(doorLine(older), /inbound_conflicts=unreadable/);
});
