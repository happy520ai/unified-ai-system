// The published measurement page must be regenerable, and its renderer must be capable of refusing.
// Every arm here feeds a fixture that is wrong in one specific way and expects a nonzero exit; the
// positive arm exists so a fixture typo cannot masquerade as "the guard works".
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const RENDERER = "tools/render-mcp-header-doc.mjs";

const OWN = {
  verdict: "measured",
  baseline_tools: 15,
  handshake: { asked: "2025-06-18", answered: "2025-06-18", session_id_issued: false },
  legs: {
    header_answered: { status: 200, tools: 15 },
    header_omitted: { status: 200, tools: 15 },
    header_declined_revision: { status: 200, tools: 15 },
  },
};

const survey = (over = {}) => ({
  attempted: 2,
  negotiated_upward: 0,
  tally: { accepts_anything_we_tried: 1, auth_required: 1 },
  rows: [
    {
      name: "alpha", url: "https://a/mcp", verdict: "accepts_anything_we_tried",
      answered: "2025-06-18", session_id: false, baseline_served: true, baseline_status: 200,
      omitted_served: true, omitted_status: 200,
    },
    { name: "beta", url: "https://b/mcp", verdict: "auth_required" },
  ],
  ...over,
});

function run(surveyDoc, ownDoc, dir) {
  const surveyPath = join(dir, "survey.json");
  const ownPath = join(dir, "own.json");
  const outPath = join(dir, "out.md");
  writeFileSync(surveyPath, JSON.stringify(surveyDoc));
  writeFileSync(ownPath, JSON.stringify(ownDoc));
  const r = spawnSync(process.execPath, [RENDERER, "--survey", surveyPath, "--own", ownPath, "--out", outPath], {
    encoding: "utf8",
  });
  return { r, outPath };
}

const dirs = [];
function freshDir() {
  const dir = mkdtempSync(join(tmpdir(), "uai-header-render-"));
  dirs.push(dir);
  return dir;
}

test("a consistent artifact renders, and the numbers it publishes are its own", () => {
  const dir = freshDir();
  const { r, outPath } = run(survey(), OWN, dir);
  assert.equal(r.status, 0, r.stderr.slice(0, 400));
  const doc = readFileSync(outPath, "utf8");
  assert.match(doc, /[Oo]f 2 `streamable-http`/);
  assert.match(doc, /header absent: http 200, 15 tools/);
  assert.match(doc, /answered revision: \*\*2025-06-18\*\*/);
});

test("a tally that does not match its rows is refused, not averaged", () => {
  const dir = freshDir();
  const broken = survey({ tally: { accepts_anything_we_tried: 2, auth_required: 1 } });
  const { r } = run(broken, OWN, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /tally sums/);
});

test("a tally key that appears in no row is refused", () => {
  const dir = freshDir();
  const broken = survey({ tally: { HEADER_REQUIRED: 1, auth_required: 1 } });
  const { r } = run(broken, OWN, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /appears in no row/);
});

test("an empty sample is refused instead of rendering a zero-row claim", () => {
  const dir = freshDir();
  const { r } = run(survey({ attempted: 0, tally: {}, rows: [] }), OWN, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /empty sample/);
});

test("a self-probe that did not measure cannot soften into prose", () => {
  const dir = freshDir();
  const { r } = run(survey(), { ...OWN, verdict: "INSTRUMENT_BLIND" }, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /did not measure/);
});

test("a missing nested handshake field is a crash, not an undefined in public text", () => {
  // The class this catches is real: an earlier draft read own.answered (top level) and would have
  // published "answered revision: undefined", while session_id_issued read as "no" purely because
  // an absent field is falsy.
  const dir = freshDir();
  const own = { ...OWN, handshake: { asked: "2025-06-18", session_id_issued: false } };
  const { r } = run(survey(), own, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /missing handshake.answered/);
});

test("a header leg missing from the self artifact is refused by name", () => {
  const dir = freshDir();
  const own = { ...OWN, legs: { header_answered: OWN.legs.header_answered, header_omitted: OWN.legs.header_omitted } };
  const { r } = run(survey(), own, dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /legs.header_declined_revision/);
});
