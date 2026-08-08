// Tests for the WorkBuddy registration helper. Verifies that we can read an
// existing mcp.json, merge a `unified-ai-system` entry without disturbing
// other entries, and unregister cleanly.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  registerService,
  unregisterService,
  inspectRegistration,
  workbuddyRegisterInternals,
} from "./workbuddy-register.js";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");

function emptyMcp(dir, fixture = { mcpServers: { other: { command: "x" } } }) {
  const filePath = join(dir, "mcp.json");
  writeFileSync(filePath, JSON.stringify(fixture, null, 2));
  return filePath;
}

test("registerService adds entry without dropping sibling servers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-reg-"));
  try {
    const filePath = emptyMcp(dir);
    const result = await registerService({
      repoRoot,
      mcpJsonPath: filePath,
    });
    assert.equal(result.applied, true);
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    assert.ok(parsed.mcpServers.other);
    assert.ok(parsed.mcpServers["unified-ai-system"]);
    assert.equal(parsed.mcpServers["unified-ai-system"].metadata.id, "unified-ai-system");
    assert.equal(parsed.metadata.lastRegisteredServer, "unified-ai-system");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("registerService is idempotent on repeated calls", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-reg-"));
  try {
    const filePath = emptyMcp(dir);
    await registerService({ repoRoot, mcpJsonPath: filePath });
    await registerService({ repoRoot, mcpJsonPath: filePath });
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    assert.equal(Object.keys(parsed.mcpServers).length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unregisterService removes only the unified-ai-system entry", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-reg-"));
  try {
    const filePath = emptyMcp(dir);
    await registerService({ repoRoot, mcpJsonPath: filePath });
    const result = await unregisterService({ mcpJsonPath: filePath });
    assert.equal(result.applied, true);
    const text = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    assert.equal(parsed.mcpServers.other.command, "x");
    assert.equal(parsed.mcpServers["unified-ai-system"], undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("inspectRegistration reports current state without mutation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-reg-"));
  try {
    const filePath = emptyMcp(dir);
    await registerService({ repoRoot, mcpJsonPath: filePath });
    const inspection = await inspectRegistration({ mcpJsonPath: filePath });
    assert.equal(inspection.registered, true);
    assert.ok(inspection.entry.metadata.tools.length >= 9);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("derives stdio command with the mcp-service start script", () => {
  const derived = workbuddyRegisterInternals.deriveStdioCommand(repoRoot);
  assert.equal(derived.command, process.execPath);
  assert.match(derived.args[0], /packages[\\/]mcp-service[\\/]bin[\\/]start-service\.js$/);
  assert.ok(derived.args.includes("--stdio"));
});
