import test from "node:test";
import assert from "node:assert/strict";
import { findPlainSecretFindings } from "./secretSafety.js";

test("detects MiMo api keys embedded in OpenCode config backups", () => {
  const fakeMimoKey = ["tp-", "caxy6uf32wil7q3", "82qzi5lygpugc3tx1rfuzjrvu7jzmdz09"].join("");
  const findings = findPlainSecretFindings(
    `{"provider":{"xiaomi":{"options":{"apiKey":"${fakeMimoKey}"}}}}`,
    "opencode.jsonc.bak-20260527-021026",
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "mimo-api-key");
  assert.equal(findings[0].filePath, "opencode.jsonc.bak-20260527-021026");
  assert.match(findings[0].maskedValue, /\*{4}/);
});

test("ignores env placeholders in OpenCode provider config", () => {
  const findings = findPlainSecretFindings(
    '{"provider":{"xiaomi":{"options":{"apiKey":"{env:MIMO_API_KEY}"}}}}',
    "opencode.jsonc",
  );

  assert.equal(findings.length, 0);
});
