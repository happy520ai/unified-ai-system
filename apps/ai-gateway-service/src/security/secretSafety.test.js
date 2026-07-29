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

test("ignores JavaScript expressions that resemble environment assignments", () => {
  const findings = findPlainSecretFindings(
    [
      "const API_KEY = process.env.NVIDIA_API_KEY;",
      "const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000;",
      "const SECRET_PATTERNS = /KEY|SECRET|TOKEN/i;",
    ].join("\n"),
    "src/runtimeConfig.js",
  );

  assert.equal(findings.length, 0);
});

test("ignores explicit positive security fixtures in test files", () => {
  const token = ["nvapi", "A7b9C2d4E6f8G1h3J5k7"].join("-");
  const findings = findPlainSecretFindings(
    `assert.ok(RAW_KEY_PATTERN.test("${token}"));`,
    "security-patterns.test.js",
  );

  assert.equal(findings.length, 0);
});

test("still detects provider-shaped secrets in ordinary source files", () => {
  const token = ["nvapi", "A7b9C2d4E6f8G1h3J5k7"].join("-");
  const findings = findPlainSecretFindings(`const key = "${token}";`, "src/providerConfig.js");

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "nvidia-api-key");
});

test("detects unquoted secret values in environment files", () => {
  const findings = findPlainSecretFindings(
    ["OPENAI_API_KEY", "livevalue1234567890"].join("="),
    ".env",
  );

  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "api-key-env-value");
});
