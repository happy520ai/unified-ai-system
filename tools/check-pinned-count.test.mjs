// Both directions are anchored, because an arm that can only say "wrong" teaches nothing and an
// arm that only says "fine" is decoration. The defective text below is the real merged content
// recovered from git (see .pm/t134-pinned-count-fixture.txt), not invented prose.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { pinnedCountMismatches, pinnedCorrectReadings, CURRENT_RELEASE, PINNED_ROSTER, run } from "./check-pinned-count.mjs";

// A byte-for-byte shape of what shipped: a numbered step plus the digest pin a few lines away.
const DEFECTIVE = [
  "- **Reviewed and pinned below: `0.4.9`.** The inspection procedure in this file",
  "  pins that image's recorded digests because `0.4.9` is the newest version with a",
  "  completed content review.",
  "1. Confirm that Codex CLI and Docker are installed and Docker is running.",
  "2. If the 15 tools are already visible, skip setup and do not register a",
  "   duplicate server.",
  "3. Explain the first stage: it downloads one reviewed platform from the",
  "   immutable `0.4.9` multi-platform index into Docker's cache, inspects its",
  "   manifest, and only then starts the container.",
  "IMAGE='ghcr.io/acme/mcp-server@sha256:751a0d32acd2d6b1da6ad9ac67987fbd1ff36ce26b7160014d8605f18b7907b3'",
  "8. Restart Codex or open a new task, then use `/mcp verbose` to confirm that all",
  "   15 tools are available. Remove the registration when it is no longer",
  "   wanted:",
].join("\n");

const CORRECT = DEFECTIVE
  .replace("If the 15 tools are already visible", "If the nine tools are already visible")
  .replace("15 tools are available.", "nine tools are available - the pinned `0.4.9` image ships nine of the fifteen names.");

test("the fixture is genuinely the defective shape and differs from the corrected one", () => {
  assert.notEqual(DEFECTIVE, CORRECT, "a fixture that changes nothing proves nothing");
  assert.match(DEFECTIVE, /sha256:[0-9a-f]{16}/);
  assert.match(DEFECTIVE, /If the 15 tools are already visible/);
  assert.equal(CURRENT_RELEASE, "0.8.0");
  assert.equal(PINNED_ROSTER["0.4.9"], 9, "0.4.9's roster is a measurement, not a guess");
});

test("fires on the real merged defect: current count inside a digest-pinned older procedure", () => {
  const { findings } = pinnedCountMismatches(DEFECTIVE, 15);
  assert.equal(findings.length, 2, `expected both step readings flagged, got ${findings.length}`);
  assert.deepEqual(findings.map((f) => f.pinnedVersion).sort(), ["0.4.9", "0.4.9"]);
  assert.deepEqual([...new Set(findings.map((f) => f.pinnedShips))], [9]);
  assert.deepEqual(findings.map((f) => f.line), [5, 12]);
});

test("stays quiet on the corrected file, and records why nine is right there", () => {
  const { findings, inconclusive } = pinnedCountMismatches(CORRECT, 15);
  assert.equal(findings.length, 0, JSON.stringify(findings));
  assert.equal(inconclusive.length, 0);
  const kept = pinnedCorrectReadings(CORRECT, 15);
  assert.equal(kept.length, 2, "the nine-readings must be recognised as pinned-identity correct");
  assert.ok(kept.every((k) => k.stated === 9 && k.pinnedVersion === "0.4.9"));
});

test("an unmeasured pinned version is inconclusive, never a silent pass", () => {
  const text = [
    "IMAGE='ghcr.io/acme/mcp-server@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
    "2. If the 15 tools are already visible, skip setup.",
    "   The reviewed `0.6.1` identities above are what this pins.",
  ].join("\n");
  const { findings, inconclusive } = pinnedCountMismatches(text, 15);
  assert.equal(findings.length, 0, "we may not assert a number we never measured");
  assert.ok(inconclusive.length >= 1, JSON.stringify({ findings, inconclusive }));
  assert.match(inconclusive.join(" "), /0\.6\.1/);
});

test("our own tracked markdown is clean under this rule right now", () => {
  const out = run({ paths: ["skills/unified-ai-gateway/SKILL.md"] });
  assert.ok(out.scanned >= 1, `read ${out.scanned} of ${out.files} files - an empty set must not read as clean`);
  assert.equal(out.status, "clean", JSON.stringify(out.report));
  assert.equal(out.mismatches, 0);
});

test("a count that merely sits near a pin but matches the pinned roster is not a finding", () => {
  const text = [
    "IMAGE='ghcr.io/acme/mcp-server@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'",
    "The reviewed `0.4.9` image ships nine governed MCP tools.",
  ].join("\n");
  const { findings } = pinnedCountMismatches(text, 15);
  assert.equal(findings.length, 0);
});
