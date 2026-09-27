// The routing-headers page must be regenerable and its renderer must be capable of refusing.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { writeFileSync } from "node:fs";

const RENDERER = "tools/render-mcp-route-headers-doc.mjs";

const survey = () => ({
  attempted: 3,
  usable_comparison: 2,
  tally: { body_wins: 2, auth_required: 1 },
  rows: [
    { name: "a", url: "https://a/mcp", verdict: "body_wins", baseline_status: 200, baseline_keys: ["tools"], spoof_status: 200, spoof_keys: ["tools"] },
    { name: "b", url: "https://b/mcp", verdict: "body_wins", baseline_status: 200, baseline_keys: ["tools"], spoof_status: 200, spoof_keys: ["tools"] },
    { name: "c", url: "https://c/mcp", verdict: "auth_required" },
  ],
});

const own = () => ({
  verdict: "measured",
  baseline_tools: 15,
  route_headers: {
    body_method: "tools/list",
    baseline_result_keys: ["tools"],
    spoof_prompts_list: { status: 200, result_keys: ["tools"], error_code: null },
    spoof_nonsense_method: { status: 200, result_keys: ["tools"], error_code: null },
    verdict: "body_is_authoritative_header_inert",
  },
});

function run(sDoc, oDoc) {
  const dir = mkdtempSync(join(tmpdir(), "uai-route-render-"));
  const sPath = join(dir, "survey.json");
  const oPath = join(dir, "own.json");
  const outPath = join(dir, "out.md");
  writeFileSync(sPath, JSON.stringify(sDoc));
  writeFileSync(oPath, JSON.stringify(oDoc));
  const r = spawnSync(process.execPath, [RENDERER, "--survey", sPath, "--own", oPath, "--out", outPath], { encoding: "utf8" });
  return { r, outPath };
}

test("a consistent pair renders and publishes the counting it did", () => {
  const { r, outPath } = run(survey(), own());
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /All 2 servers that gave a comparable pair/);
  assert.match(doc, /body_is_authoritative_header_inert/);
  assert.match(doc, /Of 3 endpoints/);
});

test("a tally that does not sum to the rows is refused and nothing is written", () => {
  const broken = survey();
  broken.tally.body_wins = 5;
  const { r, outPath } = run(broken, own());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /"refused":"arithmetic"/);
  assert.throws(() => readFileSync(outPath, "utf8"));
});

test("an empty sample cannot be published as a zero", () => {
  const empty = { attempted: 0, tally: {}, rows: [] };
  const { r } = run(empty, own());
  assert.equal(r.status, 2);
  assert.match(r.stderr, /empty_sample/);
});

test("an own-server probe that did not measure is refused", () => {
  const { r } = run(survey(), { ...own(), verdict: "INSTRUMENT_BLIND" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /did not measure/);
});

test("routing legs missing result_keys are refused, not rendered as undefined", () => {
  const thin = own();
  delete thin.route_headers.spoof_nonsense_method.result_keys;
  const { r } = run(survey(), thin);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /result_keys/);
});

test("a server that IS routed by the header changes the sentence, and the tally still has to reconcile", () => {
  const found = survey();
  found.rows[1].verdict = "HEADER_ROUTES_IT";
  found.tally = { body_wins: 1, HEADER_ROUTES_IT: 1, auth_required: 1 };
  found.rows[1].spoof_keys = ["prompts"];
  const { r, outPath } = run(found, own());
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /1 served the body's method, 1 honoured the header/);
  assert.doesNotMatch(doc, /None could be routed/);
});
