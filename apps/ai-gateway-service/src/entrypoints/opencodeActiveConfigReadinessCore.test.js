import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { buildOpenCodeActiveConfigReadinessReport } from "./opencodeActiveConfigReadinessCore.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

describe("Phase3994A OpenCode active config readiness", () => {
  it("keeps global and project active OpenCode configs aligned with usable MCP/LSP/plugin gates", async () => {
    const report = await buildOpenCodeActiveConfigReadinessReport({ repoRoot });

    assert.equal(report.status, "passed", report.checks.filter((check) => !check.pass).map((check) => check.id).join(", "));
    assert.equal(report.summary.providerCalled, false);
    assert.equal(report.summary.paidApiCalled, false);
    assert.equal(report.summary.defaultChatChanged, false);
    assert.equal(report.permission.project.filesystem, "ask");
    assert.equal(report.permission.global.filesystem, "ask");
    assert.equal(report.plugin.project.toolSearchLoadsTask, true);
    assert.equal(report.plugin.project.toolSearchLoadsSkill, true);
    assert.equal(report.plugin.global.toolSearchLoadsTask, true);
    assert.equal(report.plugin.global.toolSearchLoadsSkill, true);
    assert.equal(report.mcp.project.requiredPresent, true);
    assert.equal(report.mcp.global.requiredPresent, true);
    assert.equal(report.launcher.setsConfigDir, true);
    assert.equal(report.launcher.setsExplicitConfig, true);
    assert.equal(report.launcher.passesProjectRoot, true);
  });
});
