import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildOpenCodeToolingReadinessReport,
  loadOpenCodeConfigPair,
} from "./opencodeToolingReadinessCore.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

describe("Phase3993A OpenCode MCP/LSP/plugin readiness", () => {
  it("parses project OpenCode configs without BOM and keeps JSON mirrored with JSONC", () => {
    const pair = loadOpenCodeConfigPair({ repoRoot });

    assert.equal(pair.json.hasBom, false);
    assert.equal(pair.jsonc.hasBom, false);
    assert.deepEqual(pair.json.config.formatter, pair.jsonc.config.formatter);
    assert.deepEqual(pair.json.config.agent, pair.jsonc.config.agent);
    assert.deepEqual(pair.json.config.command, pair.jsonc.config.command);
    assert.deepEqual(pair.json.config.mcp, pair.jsonc.config.mcp);
    assert.deepEqual(pair.json.config.plugin, pair.jsonc.config.plugin);
  });

  it("reports MCP, LSP, plugin, formatter, launcher, and safety readiness", async () => {
    const report = await buildOpenCodeToolingReadinessReport({ repoRoot });

    assert.equal(report.status, "passed");
    assert.equal(report.summary.providerCalled, false);
    assert.equal(report.summary.paidApiCalled, false);
    assert.equal(report.summary.defaultChatChanged, false);
    assert.equal(report.summary.legacyModified, false);
    assert.equal(report.lsp.enabled, true);
    assert.equal(report.lsp.permission, "allow");
    assert.equal(report.lsp.launcherPresent, true);
    assert.equal(report.formatter.prettierHasFilePlaceholder, true);
    assert.equal(report.mcp.localServersReady, true);
    assert.equal(report.mcp.remoteServersConfigured, true);
    assert.equal(report.plugins.configuredPluginsReady, true);
    assert.equal(report.plugins.localPluginsReady, true);
  });
});
