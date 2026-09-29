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

const ALL_OK = { presence: PRESENCE_OK, topic: TOPIC_OK, carriers: CARRIERS_OK, presenceStatus: 0, topicStatus: 0, carriersStatus: 0 };

function stub(name, body) {
  const p = join(dir, name + ".mjs");
  writeFileSync(p, body, "utf8");
  return p;
}

test("a healthy set of instruments parses into every door field", () => {
  const parsed = parseDoorText(ALL_OK);
  assert.deepEqual(parsed.directories, { listed: 3, not_found: 1, undecidable: 0 });
  assert.deepEqual(parsed.carriers, { listed: 6, watchlisted: 1, absent: 0, unreadable: 0 });
  assert.equal(parsed.github, "NOT_FOUND");
  assert.equal(parsed.stars, 8);
  assert.equal(parsed.slots, "20/20");
  assert.equal(parsed.topicRanked, 2, "only the two `ranked` rows count");
  for (const leg of ["presence", "topic", "carriers"]) assert.equal(parsed.legs[leg].parsed, true, leg);
  const line = doorLine(parsed);
  assert.match(line, /^DOOR_STATE stars=8 topic_slots=20\/20 topic_pages_ranked=2 /);
  assert.match(line, /carriers_listed=6 carriers_watchlisted=1 carriers_absent=0 carriers_unreadable=0/);
  assert.match(line, /github_mcp=NOT_FOUND/);
  assert.match(line, /page_one_within_reach="agent-governance\(31\), mcp\(47042\)"/);
});

test("an unreadable leg prints the word unreadable instead of shrinking the claim", () => {
  const parsed = parseDoorText({ presence: "", topic: "", carriers: "", presenceStatus: 1, topicStatus: 124, carriersStatus: 1 });
  const line = doorLine(parsed);
  for (const field of ["stars=", "topic_slots=", "topic_pages_ranked=", "directories_listed=", "directories_not_found=", "directories_undecidable=", "carriers_listed=", "carriers_watchlisted=", "carriers_absent=", "carriers_unreadable=", "github_mcp=", "page_one_within_reach="]) {
    assert.ok(line.includes(field + "unreadable"), field + " must read unreadable, got: " + line);
  }
  for (const leg of ["presence", "topic", "carriers"]) assert.equal(parsed.legs[leg].parsed, false, leg);
});

test("one leg truncated is partial, and the other legs still report", () => {
  const parsed = parseDoorText({ ...ALL_OK, carriers: "hashgraph-online/awesome-codex-plugins LISTED x" });
  assert.equal(parsed.legs.carriers.parsed, false, "no CARRIER_SUMMARY line means the carrier leg is blind");
  assert.equal(parsed.legs.presence.parsed, true);
  assert.equal(parsed.directories.listed, 3, "the readable legs still report their doors");
  assert.match(doorLine(parsed), /carriers_listed=unreadable/);
});

test("the CLI runs three legs, prints the line, and writes the snapshot file", () => {
  const presence = stub("presence-ok", "console.log(" + JSON.stringify(PRESENCE_OK) + ");");
  const topic = stub("topic-ok", "console.log(" + JSON.stringify(TOPIC_OK) + ");");
  const carriers = stub("carriers-ok", "console.log(" + JSON.stringify(CARRIERS_OK) + ");");
  const out = join(dir, "door-state.md");
  const r = spawnSync(process.execPath, [GEN, "--presence", presence, "--topic", topic, "--carriers", carriers, "--output", out], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^DOOR_STATE stars=8/m);
  const md = readFileSync(out, "utf8");
  assert.ok(md.includes("DOOR_STATE stars=8"), "the markdown must carry the same line the stdout printed");
  assert.ok(md.includes("6 in a catalogue"), "the carrier sentence must be rendered, not only counted: " + md.split("\n").filter((l) => l.includes("Carriers")).join("|"));
  assert.ok(md.includes("only in a staging file"), "and must keep the watchlisted entry distinct from the catalogue count");
});

test("a blind leg exits non-zero unless the caller says the run may be partial", () => {
  const empty = stub("empty", "console.log('');");
  const blind = [GEN, "--presence", empty, "--topic", empty, "--carriers", empty];
  const r = spawnSync(process.execPath, blind, { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stderr, /at least one leg was unreadable/);
  const ok = spawnSync(process.execPath, [...blind, "--allow-unreadable"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stderr, /Nothing is being claimed about those doors/);
});

test("the CLI defaults are the real instruments, not the stubs used above", () => {
  const src = readFileSync(join(ROOT, GEN), "utf8");
  for (const tool of ["tools/check-directory-presence.mjs", "tools/check-topic-rank.mjs", "tools/check-carrier-presence.mjs"]) {
    assert.ok(src.includes('"' + tool + '"'), "door state must call " + tool);
  }
});

test("a scheduled job that stopped running the doors is caught here, not in the log", () => {
  const yml = readFileSync(join(ROOT, WORKFLOW), "utf8");
  assert.ok(yml.includes("tools/growth-door-state.mjs"), "the snapshot workflow must run the door summary");
  assert.ok(yml.includes("--allow-unreadable"), "and must not fail the night because a third-party site was down");
  assert.ok(yml.includes("door-state.md"), "the snapshot file must be uploaded, not just printed");
});
