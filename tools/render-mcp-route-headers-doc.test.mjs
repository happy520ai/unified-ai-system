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
  get_stream: {
    plain: { status: 405, contentType: "application/json", chars: 83, dataEvents: 0 },
    with_route_header: { status: 405, contentType: "application/json", chars: 83, dataEvents: 0 },
    verdict: "get_shape_identical_with_and_without_header",
  },
});

const getSurvey = () => ({
  attempted: 4,
  get_legs_answered: 3,
  tally: { auth_required: 1, get_rejected_alike: 2, GET_LEG_UNREADABLE: 1 },
  rows: [
    { name: "g1", url: "https://g1/mcp", verdict: "get_rejected_alike", header_changed_anything: false, plain_leg_repeat_matched: true, plain: { status: 405, contentType: "application/json", chars: 70 }, routed: { status: 405, contentType: "application/json", chars: 70 }, plain_again: { status: 405, contentType: "application/json", chars: 70 } },
    { name: "g2", url: "https://g2/mcp", verdict: "get_rejected_alike", header_changed_anything: false, plain_leg_repeat_matched: true, plain: { status: 405, contentType: "application/json", chars: 60 }, routed: { status: 405, contentType: "application/json", chars: 60 }, plain_again: { status: 405, contentType: "application/json", chars: 60 } },
    { name: "g3", url: "https://g3/mcp", verdict: "GET_LEG_UNREADABLE", header_changed_anything: true, plain_leg_repeat_matched: false, plain: { status: 0, contentType: "", chars: 0 }, routed: { status: 409, contentType: "application/json", chars: 120 }, plain_again: { status: 409, contentType: "application/json", chars: 120 } },
    { name: "g4", url: "https://g4/mcp", verdict: "auth_required" },
  ],
});

function run(sDoc, oDoc, gDoc = getSurvey()) {
  const dir = mkdtempSync(join(tmpdir(), "uai-route-render-"));
  const sPath = join(dir, "survey.json");
  const oPath = join(dir, "own.json");
  const gPath = join(dir, "get.json");
  const outPath = join(dir, "out.md");
  writeFileSync(sPath, JSON.stringify(sDoc));
  writeFileSync(oPath, JSON.stringify(oDoc));
  writeFileSync(gPath, JSON.stringify(gDoc));
  const r = spawnSync(process.execPath, [RENDERER, "--survey", sPath, "--getstream", gPath, "--own", oPath, "--out", outPath], { encoding: "utf8" });
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

test("a GET artifact whose tally does not sum is refused and nothing is written", () => {
  const broken = getSurvey();
  broken.tally.get_rejected_alike = 9;
  const { r, outPath } = run(survey(), own(), broken);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /get_arithmetic/);
  assert.throws(() => readFileSync(outPath, "utf8"));
});

test("an aborted GET leg is reported as unreadable, never as a header effect", () => {
  const { r, outPath } = run(survey(), own(), getSurvey());
  assert.equal(r.status, 0, r.stderr.slice(0, 400));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /counted separately, never as a negative/);
  assert.match(doc, /not a header effect/);
  assert.doesNotMatch(doc, /1 server did look header-sensitive.*routed the request/s);
});

test("a GET sample with no readable leg is refused rather than published as zero routing", () => {
  const nothing = { attempted: 1, tally: { auth_required: 1 }, rows: [{ name: "z", url: "https://z", verdict: "auth_required" }] };
  const { r } = run(survey(), own(), nothing);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /no readable GET leg/);
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
