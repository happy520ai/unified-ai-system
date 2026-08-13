import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSafetyBoundaryReport,
  isForbiddenPath,
  isSensitivePath,
  sanitizePath,
  sanitizeText,
  scanGeneratedOutputForSecrets,
} from "./safetyBoundaryChecker.js";

describe("safetyBoundaryChecker — forbidden path detection", () => {
  it("blocks legacy, env, git and node_modules paths", () => {
    assert.equal(isForbiddenPath("legacy/old.js"), true);
    assert.equal(isForbiddenPath("legacy"), true);
    assert.equal(isForbiddenPath(".env"), true);
    assert.equal(isForbiddenPath(".env.local"), true);
    assert.equal(isForbiddenPath(".git/config"), true);
    assert.equal(isForbiddenPath("node_modules/pkg/index.js"), true);
    assert.equal(isForbiddenPath("PROJECT_CONTEXT.md"), true);
  });

  it("allows normal source paths", () => {
    assert.equal(isForbiddenPath("src/index.js"), false);
    assert.equal(isForbiddenPath("packages/core/util.js"), false);
  });

  it("normalizes backslashes to forward slashes", () => {
    assert.equal(isForbiddenPath("legacy\\old.js"), true);
  });
});

describe("safetyBoundaryChecker — sensitive path detection", () => {
  it("flags env and secret-like paths", () => {
    assert.equal(isSensitivePath(".env.production"), true);
    assert.equal(isSensitivePath("config/secret.json"), true);
    assert.equal(isSensitivePath("credentials/token.txt"), true);
    assert.equal(isSensitivePath("src/index.js"), false);
  });
});

describe("safetyBoundaryChecker — text sanitization", () => {
  it("redacts api keys, bearer tokens and webhook URLs", () => {
    const dirty = 'api_key = "abc123DEF456ghi" and Bearer eyJhbGciOiJIUzI1NiJ9.payload.sign and https://example.com/webhook/123';
    const clean = sanitizeText(dirty);
    assert.ok(!clean.includes("abc123DEF456ghi"));
    assert.ok(!clean.includes("eyJhbGciOiJIUzI1NiJ9"));
    assert.ok(!clean.includes("webhook/123"));
    assert.ok(clean.includes("[REDACTED]"));
    assert.ok(clean.includes("[WEBHOOK_REDACTED]"));
  });
});

describe("safetyBoundaryChecker — path sanitization", () => {
  it("redacts sensitive paths but preserves normal ones", () => {
    assert.equal(sanitizePath(".env"), "[sensitive-path-redacted]");
    assert.equal(sanitizePath("src/index.js"), "src/index.js");
  });
});

describe("safetyBoundaryChecker — secret scan", () => {
  it("detects secret and webhook values in generated output", () => {
    const result = scanGeneratedOutputForSecrets([
      "ok line",
      "api_key=sk-abcdefghijklmnop",
      "call https://hooks.example.com/webhook/abc",
    ]);
    assert.equal(result.secretValueExposed, true);
    assert.equal(result.webhookValueExposed, true);
    assert.equal(result.providerCallsMade, false);
  });

  it("reports clean output as clean", () => {
    const result = scanGeneratedOutputForSecrets(["plain text", "no secrets here"]);
    assert.equal(result.secretValueExposed, false);
    assert.equal(result.webhookValueExposed, false);
  });
});

describe("safetyBoundaryChecker — boundary report", () => {
  it("defaults every boundary flag to false", () => {
    const report = buildSafetyBoundaryReport();
    assert.equal(report.providerCallsMade, false);
    assert.equal(report.secretValueExposed, false);
    assert.equal(report.deployExecuted, false);
    assert.equal(report.chatModified, false);
  });

  it("accepts overrides", () => {
    const report = buildSafetyBoundaryReport({ chatModified: true });
    assert.equal(report.chatModified, true);
  });
});
