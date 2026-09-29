// The registry answers one row per version, and the first draft of this tool trusted a single name
// match - so it read our 0.3.1 row as the listing and reported the 0.8.0 entry as not_latest. Every
// fixture below therefore carries several versions, and the arms that must not redden are asserted
// as loudly as the ones that must.
import test from "node:test";
import assert from "node:assert/strict";
import { compareManifest, parseVersion, pickLatest, run } from "./check-registry-listing-sync.mjs";

const NAME = "io.github.happy520ai/unified-ai-system";
const MANIFEST = { name: NAME, version: "0.8.0", title: "Unified AI System MCP Gateway", description: "Self-hosted AI gateway + MCP server: virtual keys, budgets, audit." };

const row = (version, { latest = false, status = "active", description = MANIFEST.description, title = MANIFEST.title } = {}) => ({
  server: { name: NAME, version, title, description },
  _meta: { "io.modelcontextprotocol.registry/official": { isLatest: latest, status } },
});
const HISTORY = [row("0.7.0"), row("0.4.9"), row("0.8.0", { latest: true })];

test("pickLatest takes the isLatest row out of a multi-version listing, not the first name hit", () => {
  const picked = pickLatest(HISTORY, NAME);
  assert.equal(picked.error, null);
  assert.equal(picked.row.server.version, "0.8.0", "the draft matched 0.7.0 first and called our listing not_latest");
  assert.deepEqual(picked.versions, ["0.7.0", "0.4.9", "0.8.0"]);
  assert.equal(picked.rows_for_name, 3);
  assert.equal(pickLatest([{ server: { name: "someone-else/x" } }], NAME).rows_for_name, 0);
  assert.equal(pickLatest(null, NAME).error, "unreadable", "no array is not the same as an empty listing");
});

test("a listing that matches the manifest is synced, and that must be reachable", () => {
  const verdict = compareManifest(pickLatest(HISTORY, NAME), MANIFEST);
  assert.deepEqual({ state: verdict.state, red: verdict.red }, { state: "synced", red: false });
});

test("older syndicated text at the same version is noted, never reddened", () => {
  const drifted = [row("0.8.0", { latest: true, description: "Self-hosted MCP gateway for Codex, Cursor, and Cline." })];
  const verdict = compareManifest(pickLatest(drifted, NAME), MANIFEST);
  assert.equal(verdict.state, "text_drift");
  assert.equal(verdict.red, false, "publishing is version-gated, so this clears at the next release - reddening it nightly is noise that trains people to ignore red");
  assert.deepEqual(verdict.fields, ["description differs from server.json"]);
});

test("a registry behind the manifest is publish_pending, and is not treated as drift in the text", () => {
  const behind = [row("0.7.0", { latest: true, description: "totally different" })];
  const verdict = compareManifest(pickLatest(behind, NAME), { ...MANIFEST, version: "0.8.1" });
  assert.equal(verdict.state, "publish_pending");
  assert.equal(verdict.red, false);
  assert.match(verdict.fields[0], /registry newest=0.7.0, manifest=0.8.1 \(registry behind the manifest\)/);
});

test("a registry ahead of the manifest is still publish_pending but says so without the behind note", () => {
  const ahead = [row("0.9.0", { latest: true })];
  const verdict = compareManifest(pickLatest(ahead, NAME), MANIFEST);
  assert.equal(verdict.state, "publish_pending");
  assert.doesNotMatch(verdict.fields[0], /behind/);
});

test("absent, no latest, and inactive are problems about us", () => {
  assert.deepEqual({ ...compareManifest(pickLatest([], NAME), MANIFEST) }.state, "absent");
  assert.equal(compareManifest(pickLatest([], NAME), MANIFEST).red, true);
  const none = [row("0.8.0")];
  assert.equal(compareManifest(pickLatest(none, NAME), MANIFEST).state, "no_latest");
  assert.equal(compareManifest(pickLatest(none, NAME), MANIFEST).red, true, "exactly one row should carry isLatest; zero means the listing is not what clients see");
  const inactive = [row("0.8.0", { latest: true, status: "deprecated" })];
  assert.equal(compareManifest(pickLatest(inactive, NAME), MANIFEST).state, "not_active");
  assert.equal(compareManifest(pickLatest(inactive, NAME), MANIFEST).red, true);
});

test("a version string that is not three numbers is not compared as numbers", () => {
  assert.deepEqual(parseVersion("0.8.0"), [0, 8, 0]);
  assert.equal(parseVersion("v0.8"), null);
  assert.equal(parseVersion("0.8.0-beta"), null);
  assert.equal(parseVersion(undefined), null);
});

test("run() over an offline listing reproduces the live reading, and an unusable payload is unreadable", async () => {
  const ok = await run({ manifest: MANIFEST, offlineRows: HISTORY });
  assert.equal(ok.error, null);
  assert.equal(ok.verdict.state, "synced");
  const broken = await run({ manifest: MANIFEST, offlineRows: "not an array" });
  assert.equal(broken.error, "unreadable");
  assert.equal(broken.verdict.red, false, "an unreadable listing must never be reported as a problem with our listing");
});
