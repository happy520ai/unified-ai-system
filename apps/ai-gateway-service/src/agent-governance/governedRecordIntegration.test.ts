import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAgentToolRegistry } from "../claude-code-patterns/toolRegistryEngine.js";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "./toolProxy.ts";

const IDENTITY = {
  tenantId: "tenant_a",
  userId: "owner_a",
  role: "admin",
  permissions: ["*"],
};

describe("governed record-result integration", () => {
  it("meters trusted grep records cumulatively and returns no records beyond maxRecords", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "governed-record-integration-"));
    try {
      const service = createAgentGovernanceService({
        dataDir,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "governed-record-integration-secret-0123456789",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
      });
      const agent = await service.generateAgent({
        name: "record-limited-grep",
        task: "Find Agent governance references",
        requestedTools: ["grep"],
        ttlSeconds: 3600,
        parentAgentId: null,
        instanceRules: { limits: { maxRecords: 1 } },
      }, IDENTITY);
      const registry = createAgentToolRegistry({
        workingDirectory: process.cwd(),
        governanceRequired: true,
        governanceToolProxy: createAgentGovernanceToolProxy({ service }),
      });
      const context = {
        agentGovernance: { agentId: agent.agentId, tenantId: "tenant_a", userId: "owner_a" },
        runAllowedTools: Object.freeze(["grep"]),
      };
      const params = {
        pattern: "Agent",
        path: "docs",
        file_filter: "agent-governance.md",
        max_results: 20,
      };
      const first = await registry.executeTool("grep", params, context) as any;
      expect(first).toMatchObject({ status: "success", matches: expect.any(Array) });
      expect(first.matches).toHaveLength(1);
      expect(await service.getUsage(agent.agentId)).toMatchObject({ records: 1, toolCalls: 1 });

      const second = await registry.executeTool("grep", params, context) as any;
      expect(second).toMatchObject({ status: "success", matches: [] });
      expect(await service.getUsage(agent.agentId)).toMatchObject({ records: 1, toolCalls: 2 });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("replaces successful output when maxRecords is configured but the tool has no trusted result contract", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "governed-record-no-contract-"));
    try {
      const service = createAgentGovernanceService({
        dataDir,
        env: {
          AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "governed-record-no-contract-secret-0123456789",
          PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
        },
      });
      const agent = await service.generateAgent({
        name: "record-limited-reader",
        task: "Read a file under a record ceiling",
        requestedTools: ["file_read"],
        ttlSeconds: 3600,
        parentAgentId: null,
        instanceRules: { limits: { maxRecords: 1 } },
      }, IDENTITY);
      const registry = createAgentToolRegistry({
        workingDirectory: process.cwd(),
        governanceRequired: true,
        governanceToolProxy: createAgentGovernanceToolProxy({ service }),
      });
      const result = await registry.executeTool("file_read", { file_path: "README.md", limit: 1 }, {
        agentGovernance: { agentId: agent.agentId, tenantId: "tenant_a", userId: "owner_a" },
        runAllowedTools: Object.freeze(["file_read"]),
      });
      expect(result).toMatchObject({
        status: "denied",
        code: "RECORD_METER_DESCRIPTOR_REQUIRED",
      });
      expect(await service.getUsage(agent.agentId)).toMatchObject({ records: 0, toolCalls: 1 });
    } finally {
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
