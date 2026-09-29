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

function stub(name, body) {
  const p = join(dir, name + ".mjs");
  writeFileSync(p, body, "utf8");
  return p;
}

test("a healthy pair of instruments parses into every door field", () => {
  const parsed = parseDoorText({ presence: PRESENCE_OK, topic: TOPIC_OK, presenceStatus: 0, topicStatus: 0 });
  assert.deepEqual(parsed.directories, { listed: 3, not_found: 1, undecidable: 0 });
  assert.equal(parsed.github, "NOT_FOUND");
  assert.equal(parsed.stars, 8);
  assert.equal(parsed.slots, "20/20");
  assert.equal(parsed.topicRanked, 2, "only the two `ranked` rows count");
  assert.equal(parsed.legs.presence.parsed, true);
  assert.equal(parsed.legs.topic.parsed, true);
  const line = doorLine(parsed);
  assert.match(line, /^DOOR_STATE stars=8 topic_slots=20\/20 topic_pages_ranked=2 /);
  assert.match(line, /github_mcp=NOT_FOUND/);
  assert.match(line, /page_one_within_reach="agent-governance\(31\), mcp\(47042\)"/);
});

test("an unreadable leg prints the word unreadable instead of shrinking the claim", () => {
  const parsed = parseDoorText({ presence: "", topic: "", presenceStatus: 1, topicStatus: 124 });
  const line = doorLine(parsed);
  for (const field of ["stars=", "topic_slots=", "topic_pages_ranked=", "directories_listed=", "directories_not_found=", "directories_undecidable=", "github_mcp=", "page_one_within_reach="]) {
    assert.ok(line.includes(field + "unreadable"), field + " must read unreadable, got: " + line);
  }
  assert.equal(parsed.legs.presence.parsed, false);
  assert.equal(parsed.legs.topic.parsed, false);
});

test("one leg good and one leg truncated is reported as partial, not as a clean line", () => {
  const parsed = parseDoorText({ presence: PRESENCE_OK, topic: "nothing we can read", presenceStatus: 0, topicStatus: 0 });
  assert.equal(parsed.legs.presence.parsed, true);
  assert.equal(parsed.legs.topic.parsed, false);
  assert.equal(parsed.directories.listed, 3, "the readable leg still reports its doors");
});

test("the CLI runs both legs, prints the line, and writes the snapshot file", () => {
  const presence = stub("presence-ok", "console.log(" + JSON.stringify(PRESENCE_OK) + ");");
  const topic = stub("topic-ok", "console.log(" + JSON.stringify(TOPIC_OK) + ");");
  const out = join(dir, "door-state.md");
  const r = spawnSync(process.execPath, [GEN, "--presence", presence, "--topic", topic, "--output", out], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^DOOR_STATE stars=8/m);
  const md = readFileSync(out, "utf8");
  assert.ok(md.includes("DOOR_STATE stars=8"), "the markdown must carry the same line the stdout printed");
  assert.ok(md.includes("github_mcp") || md.includes("GitHub's own MCP directory entry: **NOT_FOUND**"));
});

test("a blind leg exits non-zero unless the caller says the run may be partial", () => {
  const empty = stub("empty", "console.log('');");
  const r = spawnSync(process.execPath, [GEN, "--presence", empty, "--topic", empty], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stderr, /at least one leg was unreadable/);
  const ok = spawnSync(process.execPath, [GEN, "--presence", empty, "--topic", empty, "--allow-unreadable"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stderr, /Nothing is being claimed about those doors/);
});

test("a scheduled job that stopped running the doors is caught here, not in the log", () => {
  const yml = readFileSync(join(ROOT, WORKFLOW), "utf8");
  assert.ok(yml.includes("tools/growth-door-state.mjs"), "the snapshot workflow must run the door summary");
  assert.ok(yml.includes("--allow-unreadable"), "and must not fail the night because a third-party site was down");
  assert.ok(yml.includes("door-state.md"), "the snapshot file must be uploaded, not just printed");
});
