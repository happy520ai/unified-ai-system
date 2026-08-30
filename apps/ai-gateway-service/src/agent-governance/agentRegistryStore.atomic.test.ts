import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { createAgentRegistryStore } from "./agentRegistryStore.ts";

const SECRET = "atomic-registry-test-secret-0123456789";
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function record(agentId: string, overrides: Partial<AgentRegistryRecord> = {}): AgentRegistryRecord {
  return {
    agentId,
    name: agentId,
    purpose: "test",
    tenantId: "tenant_a",
    ownerUserId: "user_1",
    createdBy: "user_1",
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "analysis", domain: "general", subclass: "test" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read"],
    grantedTools: ["file_read"],
    policyHash: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: "2026-08-30T10:00:00.000Z",
    expiresAt: "2026-08-30T11:00:00.000Z",
    ...overrides,
  };
}

describe("Agent registry atomic batches", () => {
  it("persists a multi-Agent lifecycle transition in one complete registry image", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-registry-batch-"));
    roots.push(root);
    const path = join(root, "agents.json");
    const store = createAgentRegistryStore({ storePath: path, secret: SECRET });
    await store.upsertMany([
      record("agt_parent", { status: "REVOKED" }),
      record("agt_child", { parentAgentId: "agt_parent", generationDepth: 1, status: "REVOKED" }),
    ]);

    const persisted = JSON.parse(await readFile(path, "utf8"));
    expect(Object.keys(persisted.agents).sort()).toEqual(["agt_child", "agt_parent"]);
    expect(Object.values(persisted.agents).every((item: any) => item.status === "REVOKED")).toBe(true);
  });

  it("validates the full batch before changing an existing registry image", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-registry-batch-invalid-"));
    roots.push(root);
    const path = join(root, "agents.json");
    const store = createAgentRegistryStore({ storePath: path, secret: SECRET });
    await store.upsert(record("agt_existing"));

    await expect(store.upsertMany([
      record("agt_existing", { status: "REVOKED" }),
      { ...record("agt_invalid"), policyHash: "invalid" },
    ])).rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });

    expect((await store.get("agt_existing", "tenant_a"))?.status).toBe("ACTIVE");
    expect(JSON.parse(await readFile(path, "utf8")).agents.agt_existing.status).toBe("ACTIVE");
  });
});
