import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const { CARRIERS, decide, pickVerdict, entryFacts, toolCountMentions, OUR_MARKER } = await import(pathToFileURL(resolve(ROOT, "tools/check-carrier-presence.mjs")).href);

// The instrument's whole purpose is that "merged" and "listed in front of a visitor" are different facts,
// so the carrier table is itself pinned: dropping a carrier would shrink a count without any assertion
// noticing.
test("the carrier table covers every repository that merged our work", () => {
  assert.ok(CARRIERS.length >= 9, "nine listings had merged something from us by 2026-09-29, got " + CARRIERS.length);
  assert.equal(new Set(CARRIERS.map((c) => c.repo)).size, CARRIERS.length, "duplicate repo rows");
  // A floor on the count does not protect a specific row, and this one was not found by watching a pull
  // request - it was found by searching for our own name, six weeks after it merged. Pin it by name.
  assert.ok(CARRIERS.some((c) => c.repo === "yzfly/Awesome-MCP-ZH"), "the catalogue found by search, not by a live PR, must stay monitored");
  for (const c of CARRIERS) {
    assert.match(c.repo, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, c.repo);
    assert.ok(c.paths.length > 0, c.repo + " needs at least one candidate file");
    for (const p of c.paths) {
      assert.ok(["catalog", "staging"].includes(p.kind), c.repo + ": unknown kind " + p.kind);
      assert.ok(p.path.length > 3 && !p.path.startsWith("/"), c.repo + ": bad path " + p.path);
    }
  }
  // The one carrier that received us into a holding file rather than the catalogue must stay modelled that
  // way, or the next run would report a catalogue listing that a visitor cannot browse to.
  const staged = CARRIERS.filter((c) => c.paths.some((p) => p.kind === "staging")).map((c) => c.repo);
  assert.deepEqual(staged, ["scadastrangelove/awesome-ai-security-tools"], JSON.stringify(staged));
});

const file = (o) => ({ status: 200, kind: "catalog", hits: 0, links_in_file: 40, path: "README.md", ...o });

test("a catalogue hit and a staging hit are different answers", () => {
  const catalog = pickVerdict([file({ hits: 2, path: "README.md" })], { listLinks: 40, selfFile: false });
  assert.equal(catalog.verdict, "LISTED");
  const staging = pickVerdict([file({ hits: 0 }), file({ hits: 1, path: "WATCHLIST.md", kind: "staging" })], { listLinks: 60, selfFile: false });
  assert.equal(staging.verdict, "WATCHLISTED");
  assert.match(staging.why, /holding file/);
  // Order is the decision: a catalog row read first must win over a staging row, because the visitor-facing
  // placement is what we asked for.
  const both = pickVerdict([file({ hits: 1, path: "README.md" }), file({ hits: 1, path: "WATCHLIST.md", kind: "staging" })], { listLinks: 60, selfFile: false });
  assert.equal(both.verdict, "LISTED");
});

test("absence is only claimed when a populated list was actually read", () => {
  const gone = pickVerdict([file({ hits: 0, links_in_file: 61 })], { listLinks: 61, selfFile: false });
  assert.equal(gone.verdict, "ABSENT");
  assert.match(gone.why, /no entry carrying our repository/);

  const thin = pickVerdict([{ status: 200, kind: "catalog", hits: 0, links_in_file: 2, path: "README.md" }], { listLinks: 2, selfFile: false });
  assert.equal(thin.verdict, "UNREADABLE", "a two-link file cannot prove absence");
  assert.match(thin.why, /below the 5/);

  const blind = pickVerdict([{ status: 404, kind: "catalog", hits: 0, links_in_file: 0, path: "README.md" }], { listLinks: 0, selfFile: false });
  assert.equal(blind.verdict, "UNREADABLE");
  assert.match(blind.why, /no candidate file could be read/);
});

test("a repository's own vendored file proves presence without needing list links", () => {
  // hashgraph-online/awesome-codex-plugins stores us as plugins/happy520ai/.../SKILL.md: the file IS the
  // entry, so it contains no other links and must still count as a listing rather than an inconclusive read.
  const self = pickVerdict([file({ hits: 21, path: "plugins/happy520ai/unified-ai-system/skills/unified-ai-gateway/SKILL.md", links_in_file: 1, self_file: true })], { listLinks: 1, selfFile: true });
  assert.equal(self.verdict, "LISTED");
  const decideSelf = decide({ fetched: 1, ourHits: 0, listLinks: 1, selfFile: true });
  assert.notEqual(decideSelf.verdict, "UNREADABLE", "the self-file exception must apply to the absence path too");
});

test("entry facts report pinned versions and tool counts without judging them", () => {
  const body = [
    "# something else",
    "- [unified-ai-system](https://github.com/happy520ai/unified-ai-system) — single-host public preview with seven stars and limited independent adoption.",
    "- Unified AI System current release: v0.8.0 declares fifteen tool names.",
    "- Unified AI System reviewed and pinned below: `0.4.9`. It carries 9 of the fifteen names.",
    "unrelated line mentioning 1.2.3 and fifteen",
  ].join("\n");
  const f = entryFacts(body);
  assert.equal(f.lines_with_us, 3);
  assert.deepEqual(f.pinned_versions, ["0.4.9", "0.8.0"]);
  // "fifteen tool names" and "carries 9" are both claims about how many tools we ship, so both must be
  // collected; a word-only scan would report [15] and the 9-tool pinned image would go unnoticed.
  assert.deepEqual(f.tool_count_mentions, [9, 15]);
  assert.ok(f.star_snapshots.length >= 1, JSON.stringify(f));
  // The last line must not leak in: it has no marker, and reading it would invent a claim about us.
  assert.equal(f.pinned_versions.includes("1.2.3"), false);
  assert.equal(entryFacts("nothing here matches").lines_with_us, 0);
});

test("tool counts are collected from words and digits alike, but only where a roster is being counted", () => {
  // Each carrier writes the number differently; a scanner that only knew one shape would report "no tool
  // count advertised" for the carriers that do advertise one.
  assert.deepEqual(toolCountMentions("It exposes 15 tools."), [15]);
  assert.deepEqual(toolCountMentions("fifteen governed MCP tools"), [15]);
  assert.deepEqual(toolCountMentions("It carries 9 of the fifteen names."), [9]);
  assert.deepEqual(toolCountMentions("declares nine tool names"), [9]);
  // Boundary: these numbers are real numbers on these pages but they are not tool counts. Collecting them
  // would make every pinned-image drift look like it had been explained.
  assert.deepEqual(toolCountMentions("seven stars and 32 open issues"), []);
  assert.deepEqual(toolCountMentions("has 8 stars, released 0.4.9"), []);
  // The two shapes together, deduplicated and sorted.
  assert.deepEqual(toolCountMentions("15 tools, and it carries 15 of them"), [15]);
});

test("the marker matches our repository and not a stranger's", () => {
  assert.ok(OUR_MARKER.test("https://github.com/happy520ai/unified-ai-system"));
  assert.ok(OUR_MARKER.test("Unified AI System"));
  assert.equal(OUR_MARKER.test("happy520ai/other-repo"), false);
  assert.equal(OUR_MARKER.test("someone-else/unified-ai-system-x"), false, "a substring-only match would let a neighbour's entry read as ours");
});
