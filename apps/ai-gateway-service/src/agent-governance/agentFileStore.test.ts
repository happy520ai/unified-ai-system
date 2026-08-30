import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
} from "@unified-ai-system/shared-contracts";
import {
  buildManifest,
  computeAgentHash,
  computePolicyDeltaHash,
  computePolicyHash,
} from "@unified-ai-system/policy-engine";
import { describe, expect, it } from "vitest";
import {
  createAgentFileStore,
  type AgentFileStore,
  type AgentPolicyDelta,
} from "./agentFileStore.ts";

const SECRET = "agent-file-store-test-secret-0123456789";
const CREATED_AT = "2026-08-30T00:00:00.000Z";
const EXPIRES_AT = "2026-08-30T01:00:00.000Z";
const BUNDLE_FILES = [
  "agent.json",
  "policy-delta.json",
  "effective-policy.json",
  "manifest.json",
] as const;

type AgentBundle = Parameters<AgentFileStore["writeAgentBundle"]>[0];

function bundle(agentId: string, marker: string): AgentBundle {
  const policyContent: Omit<EffectiveAgentPolicy, "policyHash"> = {
    agentId,
    classification: { family: "analysis", domain: "tests", subclass: marker },
    traits: ["read_only"],
    riskLevel: "low",
    toolDecisions: { file_read: "allow" },
    grantedTools: ["file_read"],
    mandatory: {
      auditRequired: true,
      credentialsExposedToAgent: false,
      crossTenantAccess: "deny",
      selfPolicyModification: "deny",
      gatewayBypass: "deny",
      permissionExpansion: "deny",
    },
    limits: { maxSteps: 3, maxToolCalls: 3, maxRuntimeSeconds: 30 },
    requirements: { auditRequired: true },
    permissions: {
      canCreateChildren: false,
      canWrite: false,
      canSendExternalMessage: false,
      canExecuteCode: false,
    },
    scope: { allowedTenants: ["tenant_a"] },
    expiresAt: EXPIRES_AT,
    lineage: [{ policyKey: "root-policy", version: 1, bindingType: "root" }],
    compiledAt: CREATED_AT,
  };
  const policy: EffectiveAgentPolicy = {
    ...policyContent,
    policyHash: computePolicyHash(policyContent),
  };
  const record: AgentRegistryRecord = {
    agentId,
    name: marker,
    purpose: `bundle ${marker}`,
    tenantId: "tenant_a",
    ownerUserId: "user_a",
    createdBy: "user_a",
    parentAgentId: null,
    generationDepth: 0,
    classification: policy.classification,
    traits: policy.traits,
    riskLevel: policy.riskLevel,
    requestedTools: ["file_read"],
    grantedTools: policy.grantedTools,
    policyHash: policy.policyHash,
    status: "ACTIVE",
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
  };
  const delta: AgentPolicyDelta = {
    agentId,
    inherits: [{ policyKey: "root-policy", version: 1 }],
    instanceRules: { dataRules: { allowedResourceSets: { marker: [marker] } } },
  };
  const manifest: AgentPolicyManifest = buildManifest({
    agentId,
    agentHash: computeAgentHash(record),
    policyHash: policy.policyHash,
    deltaHash: computePolicyDeltaHash(delta),
    compiledAt: policy.compiledAt,
    secret: SECRET,
  });
  return { record, delta, policy, manifest };
}

function audit(agentId: string): AgentGovernanceAuditEvent {
  return {
    id: `age_${agentId}`,
    eventType: "AGENT_DRAFT_CREATED",
    agentId,
    tenantId: "tenant_a",
    timestamp: CREATED_AT,
  };
}

async function stagingEntries(root: string): Promise<string[]> {
  try {
    return await readdir(join(root, "agents", ".bundle-staging"));
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") return [];
    throw error;
  }
}

async function snapshotBundle(root: string, agentId: string): Promise<Record<string, string>> {
  const entries = await Promise.all(BUNDLE_FILES.map(async (fileName) => [
    fileName,
    await readFile(join(root, "agents", agentId, fileName), "utf8"),
  ] as const));
  return Object.fromEntries(entries);
}

describe("AgentFileStore staged bundle publication", () => {
  it("durably stages the complete bundle, publishes it, and preserves the existing audit trail", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-file-store-stage-"));
    const agentId = "agt_staged_publish";
    try {
      const store = createAgentFileStore({ dataDir: root, secret: SECRET });
      await store.appendAudit(agentId, audit(agentId));
      const expected = bundle(agentId, "first");

      await store.writeAgentBundle(expected);

      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "agent.json"), "utf8")))
        .toEqual(expected.record);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "policy-delta.json"), "utf8")))
        .toEqual(expected.delta);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "effective-policy.json"), "utf8")))
        .toEqual(expected.policy);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "manifest.json"), "utf8")))
        .toEqual(expected.manifest);
      expect(await store.readAudit(agentId)).toEqual([audit(agentId)]);
      expect(await stagingEntries(root)).toEqual([]);
      expect((await readdir(store.agentDir(agentId))).some((name) => name.endsWith(".tmp"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  });

  it("cleans staged bytes and leaves an existing audit-only Agent directory untouched when staging fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-file-store-stage-fail-"));
    const agentId = "agt_stage_failure";
    try {
      const store = createAgentFileStore({
        dataDir: root,
        secret: SECRET,
        bundlePublishFaultInjector(stage) {
          if (stage === "after-staged-files") throw new Error("simulated staging failure");
        },
      });
      await store.appendAudit(agentId, audit(agentId));

      await expect(store.writeAgentBundle(bundle(agentId, "not-published")))
        .rejects.toThrow(/simulated staging failure/u);

      expect(await readdir(store.agentDir(agentId))).toEqual(["audit.ndjson"]);
      expect(await store.readAudit(agentId)).toEqual([audit(agentId)]);
      expect(await stagingEntries(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  });

  it("rolls back a partially published update without deleting the existing Agent directory or unrelated files", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-file-store-publish-rollback-"));
    const agentId = "agt_publish_rollback";
    try {
      const initialStore = createAgentFileStore({ dataDir: root, secret: SECRET });
      await initialStore.writeAgentBundle(bundle(agentId, "original"));
      await initialStore.appendAudit(agentId, audit(agentId));
      await writeFile(join(initialStore.agentDir(agentId), "operator-note.txt"), "preserve me", "utf8");
      const before = await snapshotBundle(root, agentId);
      let injected = false;
      const failingStore = createAgentFileStore({
        dataDir: root,
        secret: SECRET,
        bundlePublishFaultInjector(stage, detail) {
          if (!injected && stage === "after-publish-file" && detail.fileName === "agent.json") {
            injected = true;
            throw new Error("simulated mid-publish failure");
          }
        },
      });

      await expect(failingStore.writeAgentBundle(bundle(agentId, "replacement")))
        .rejects.toThrow(/simulated mid-publish failure/u);

      expect(await snapshotBundle(root, agentId)).toEqual(before);
      expect(await readFile(join(initialStore.agentDir(agentId), "operator-note.txt"), "utf8"))
        .toBe("preserve me");
      expect(await initialStore.readAudit(agentId)).toEqual([audit(agentId)]);
      expect(await stagingEntries(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  });

  it("serializes concurrent writes for one Agent so the final bundle is internally consistent", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-file-store-serialized-"));
    const agentId = "agt_serialized_updates";
    try {
      const store = createAgentFileStore({ dataDir: root, secret: SECRET });
      const second = bundle(agentId, "second");
      await Promise.all([
        store.writeAgentBundle(bundle(agentId, "first")),
        store.writeAgentBundle(second),
      ]);

      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "agent.json"), "utf8")))
        .toEqual(second.record);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "policy-delta.json"), "utf8")))
        .toEqual(second.delta);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "effective-policy.json"), "utf8")))
        .toEqual(second.policy);
      expect(JSON.parse(await readFile(join(store.agentDir(agentId), "manifest.json"), "utf8")))
        .toEqual(second.manifest);
      expect(await stagingEntries(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  });

  it("uses bounded authenticated tail reads for steady-state audit appends", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-tail-read-"));
    const probes: Array<{ mode: "full" | "tail"; bytesRead: number }> = [];
    try {
      const store = createAgentFileStore({
        dataDir: root,
        secret: SECRET,
        auditMirrorReadProbe: ({ mode, bytesRead }) => probes.push({ mode, bytesRead }),
      });
      const agentId = "agt_tail_read";
      for (let index = 0; index < 128; index += 1) {
        await store.appendAudit(agentId, {
          id: `age_tail_${index}`,
          eventType: "TOOL_REQUESTED",
          agentId,
          tenantId: "tenant_a",
          toolName: "file_read",
          reason: `tail-${index}`,
          timestamp: CREATED_AT,
        });
      }

      expect(probes.filter((probe) => probe.mode === "full")).toHaveLength(0);
      expect(probes.filter((probe) => probe.mode === "tail")).toHaveLength(127);
      expect(Math.max(...probes.map((probe) => probe.bytesRead))).toBeLessThanOrEqual(64 * 1024);
      await expect(store.readAudit(agentId, 200)).resolves.toHaveLength(128);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  }, 60_000);

  it("invalidates the tail cache and rejects an equal-size in-place prefix mutation", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-audit-prefix-generation-"));
    const agentId = "agt_prefix_generation";
    try {
      const store = createAgentFileStore({ dataDir: root, secret: SECRET });
      await store.appendAudit(agentId, {
        id: "age_prefix_first",
        eventType: "TOOL_REQUESTED",
        agentId,
        tenantId: "tenant_a",
        reason: "alpha",
        timestamp: CREATED_AT,
      });
      await store.appendAudit(agentId, {
        id: "age_prefix_tail",
        eventType: "TOOL_ALLOWED",
        agentId,
        tenantId: "tenant_a",
        reason: "tail-safe",
        timestamp: CREATED_AT,
      });

      const auditPath = join(store.agentDir(agentId), "audit.ndjson");
      const original = await readFile(auditPath, "utf8");
      const mutated = original.replace('"reason":"alpha"', '"reason":"omega"');
      expect(Buffer.byteLength(mutated)).toBe(Buffer.byteLength(original));
      expect(mutated).not.toBe(original);
      await writeFile(auditPath, mutated, "utf8");
      // Force a deterministic file-generation change even on coarse timestamp
      // filesystems; production writes also update ctime, which callers cannot
      // restore without privileged filesystem control.
      const changedTime = new Date("2026-08-30T00:01:00.000Z");
      await utimes(auditPath, changedTime, changedTime);

      await expect(store.appendAudit(agentId, {
        id: "age_prefix_after_tamper",
        eventType: "TOOL_DENIED",
        agentId,
        tenantId: "tenant_a",
        reason: "must-not-append",
        timestamp: CREATED_AT,
      })).rejects.toThrow(/authentication|malformed|unsafe/u);
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
    }
  });
});
