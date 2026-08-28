import { describe, expect, it, vi } from "vitest";

import { createMcpToolAdapter } from "./mcpToolAdapter.js";

describe("MCP Agent tool adapter external-effect boundary", () => {
  it("accepts the bridge listing envelope and commits a fenced mutation before callTool", async () => {
    const callTool = vi.fn(async () => ({ status: "success", content: [{ type: "text", text: "created" }] }));
    const bridge = {
      listAllTools: vi.fn(async () => ({
        status: "success",
        tools: [{
          name: "create_ticket",
          prefixedName: "ops__create_ticket",
          serverName: "ops",
          inputSchema: { type: "object", properties: { title: { type: "string" } } },
        }],
      })),
      callTool,
      getHealth: vi.fn(() => ({ status: "ready" })),
    };
    const registered: any[] = [];
    const registry = {
      registerTool: vi.fn((tool) => {
        registered.push(tool);
        return { status: "success" };
      }),
      unregisterTool: vi.fn(),
    };
    const adapter: any = createMcpToolAdapter(bridge, { autoSync: false });

    await expect(adapter.syncTools(registry)).resolves.toMatchObject({
      added: ["ops__create_ticket"],
      total: 1,
    });
    expect(registered[0]).toMatchObject({
      isReadOnly: false,
      externalEffectType: "mcp:agent-tool-call",
      externalEffectRequiresFence: true,
    });

    const commitExternalEffect = vi.fn(async () => {});
    await registered[0].execute({ title: "bounded" }, { commitExternalEffect });
    expect(commitExternalEffect).toHaveBeenCalledOnce();
    expect(callTool).toHaveBeenCalledWith("ops__create_ticket", { title: "bounded" });
    expect(commitExternalEffect.mock.invocationCallOrder[0])
      .toBeLessThan(callTool.mock.invocationCallOrder[0]);
  });

  it("does not report a tool as added when the registry blocks a collision", async () => {
    const adapter: any = createMcpToolAdapter({
      listAllTools: vi.fn(async () => ({
        status: "success",
        tools: [{ name: "file_read", prefixedName: "file_read", inputSchema: { type: "object" } }],
      })),
      callTool: vi.fn(),
      getHealth: vi.fn(),
    }, { autoSync: false });
    const result = await adapter.syncTools({
      registerTool: vi.fn(() => ({
        status: "error",
        code: "TOOL_BUILTIN_OVERRIDE_BLOCKED",
      })),
      unregisterTool: vi.fn(),
    });
    expect(result).toMatchObject({ added: [], total: 0 });
    expect(result.errors.join("\n")).toContain("TOOL_BUILTIN_OVERRIDE_BLOCKED");
  });
});
