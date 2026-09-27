// The cache-hints page must be regenerable, and its renderer must be able to refuse.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const RENDERER = "tools/render-mcp-cache-hints-doc.mjs";

const survey = (over = {}) => ({
  attempted: 3,
  servers_with_a_tool_list: 2,
  declaring_any_cache_hint: 1,
  our_gateway_cache_ttl_ms: 60_000,
  tally: { auth_required: 1, no_cache_hint_declared: 1, RESULT_LEVEL_HINT: 1 },
  rows: [
    { name: "quiet", url: "https://q/mcp", verdict: "no_cache_hint_declared", tools: 3, shape: { toolCount: 3, result_ttlMs_type: "absent", result_ttlMs_value: null, result_cacheScope: "absent", result_has_meta: false, result_keys: ["tools"], tools_with_ttlMs: 0, tools_with_cacheScope: 0, tools_with_meta: 0, min_tool_ttlMs: null, max_tool_ttlMs: null } },
    { name: "ad.getle/leads", url: "https://g/mcp", verdict: "RESULT_LEVEL_HINT", tools: 5, shape: { toolCount: 5, result_ttlMs_type: "number", result_ttlMs_value: 300000, result_cacheScope: "private", result_has_meta: false, result_keys: ["tools", "ttlMs", "cacheScope"], tools_with_ttlMs: 0, tools_with_cacheScope: 0, tools_with_meta: 0, min_tool_ttlMs: null, max_tool_ttlMs: null } },
    { name: "locked", url: "https://l/mcp", verdict: "auth_required" },
  ],
  ...over,
});

const own = (over = {}) => ({
  verdict: "measured",
  baseline_tools: 15,
  route_headers: {
    baseline_result_keys: ["tools"],
    our_tool_field_names: ["name", "description", "inputSchema"],
    our_result_ttlMs_present: false,
    our_result_cacheScope_present: false,
    ...over,
  },
});

function run(sDoc, oDoc) {
  const dir = mkdtempSync(join(tmpdir(), "uai-cache-render-"));
  const sPath = join(dir, "survey.json");
  const oPath = join(dir, "own.json");
  const outPath = join(dir, "out.md");
  writeFileSync(sPath, JSON.stringify(sDoc));
  writeFileSync(oPath, JSON.stringify(oDoc));
  const r = spawnSync(process.execPath, [RENDERER, "--survey", sPath, "--own", oPath, "--out", outPath], { encoding: "utf8" });
  return { r, outPath };
}

test("a reconciling pair renders, and the page counts what the artifact counted", () => {
  const { r, outPath } = run(survey(), own());
  assert.equal(r.status, 0, r.stderr.slice(0, 400));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /2 returned a tool list\. 1 of them declared no cache hint at all, and 1 declared one/);
  assert.match(doc, /ad\.getle\/leads` answered at the result level with ttlMs=300000 and cacheScope=private/);
  // Our own silence is reported from the probe, not asserted from code reading.
  assert.match(doc, /`ttlMs` present:\s*\*\*false\*\*/);
});

test("a tally that does not sum to the rows is refused", () => {
  const broken = survey();
  broken.tally.auth_required = 4;
  const { r, outPath } = run(broken, own());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /"refused":"arithmetic"/);
  assert.throws(() => readFileSync(outPath, "utf8"));
});

test("declared + silent not equalling the denominator is refused, so no server goes unaccounted", () => {
  // One server returned a list under a verdict that falls into neither bucket. The tally still sums
  // to the row count, so arithmetic alone would wave it through - and the page would quietly be
  // about 1 of the 2 servers that answered.
  const skewed = survey();
  skewed.rows[1].verdict = "list_shape_unexpected";
  skewed.tally = { auth_required: 1, no_cache_hint_declared: 1, list_shape_unexpected: 1 };
  const { r } = run(skewed, own());
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /declared\(\d+\) \+ silent\(\d+\) != listed/);
});

test("nobody returning a tool list is a refusal, not a page about zero", () => {
  const { r } = run(survey({ rows: [{ name: "locked", url: "https://l/mcp", verdict: "auth_required" }], tally: { auth_required: 1 }, servers_with_a_tool_list: 0, declaring_any_cache_hint: 0 }), own());
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /no denominator to publish/);
});

test("an own-server probe that did not measure cannot lend its numbers to the page", () => {
  const { r } = run(survey(), { ...own(), verdict: "INSTRUMENT_BLIND" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /did not measure/);
});

test("a missing own-server field is a crash, never an undefined printed as a finding", () => {
  const thin = own();
  delete thin.route_headers.our_result_ttlMs_present;
  const { r } = run(survey(), thin);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /missing route_headers\.our_result_ttlMs_present/);
});

test("when nobody declares anything, the page says the signal is absent rather than inventing a case", () => {
  const silent = survey({
    declaring_any_cache_hint: 0,
    tally: { auth_required: 1, no_cache_hint_declared: 2 },
    rows: [
      survey().rows[0],
      { ...survey().rows[1], verdict: "no_cache_hint_declared", shape: { ...survey().rows[1].shape, result_ttlMs_type: "absent", result_ttlMs_value: null, result_cacheScope: "absent", result_keys: ["tools"] } },
      survey().rows[2],
    ],
  });
  const { r, outPath } = run(silent, own());
  assert.equal(r.status, 0, r.stderr.slice(0, 400));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /Nobody spoke, so a gateway's only real input is its own default/);
  assert.doesNotMatch(doc, /ad\.getle\/leads` answered/);
});
