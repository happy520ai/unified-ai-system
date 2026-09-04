import { describe, expect, it } from "vitest";
import { createBuiltInTools } from "../claude-code-patterns/developerTools.js";
import { createGitTools } from "../tools/gitTools.js";
import { createLspTools } from "../tools/lspTool.js";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";

describe("Agent Governance tool-risk catalog", () => {
  it("classifies canonical Workforce execution as an allowed write-capable subagent creator", () => {
    expect(createToolRiskCatalog().lookup("workforce_execute")).toMatchObject({
      name: "workforce_execute",
      actionType: "write",
      riskTraits: ["subagent_creator", "write_capable"],
      riskLevel: "high",
      defaultDecision: "allow",
      credentialMode: "server_side",
    });
  });

  it("covers every statically registered Agent runtime tool by its exact name", () => {
    const runtimeNames = new Set([
      ...Object.keys(createBuiltInTools(process.cwd())),
      ...(createGitTools({ workingDirectory: process.cwd() }) as any[]).map((tool) => tool.name),
      ...((createLspTools({ workingDirectory: process.cwd() }) as any).tools as any[]).map((tool) => tool.name),
    ]);
    const catalog = createToolRiskCatalog();
    const missing = [...runtimeNames].filter((name) => catalog.lookup(name) === null).sort();
    expect(missing).toEqual([]);
  });
});
