import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildManifest,
  compileEffectivePolicy,
  computeAgentHash,
  computePolicyContentHash,
} from "@unified-ai-system/policy-engine";
import type {
  AgentClassification,
  AgentRegistryRecord,
  PolicyLayerContent,
  PolicyRecord,
} from "@unified-ai-system/shared-contracts";
import { createAgentGovernanceService } from "./agentGovernanceService.ts";
import { createAgentFileStore } from "./agentFileStore.ts";
import { createAgentRegistryStore } from "./agentRegistryStore.ts";
import {
  AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES,
  BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH,
  createPolicyCatalogStore,
} from "./policyCatalogStore.ts";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";

const SECRET = "unit-test-built-in-migration-secret-0123456789";
const NOW = "2026-08-30T10:00:00.000Z";
const CTX = { tenantId: "tenant_a", userId: "operator_1", permissions: ["*"] };

const LEGACY_ZCODE_V1: PolicyLayerContent = {
  capabilityCeiling: [
    "file_read", "file_glob", "grep_search", "file_write", "file_edit", "file_insert",
    "git_status", "git_diff", "git_log", "git_branch", "git_commit", "git_push", "git_create_pr",
  ],
  toolRules: {
    shell_exec: "deny",
    code_run: "deny",
    git_push: "require_approval",
    git_create_pr: "require_approval",
  },
  limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240 },
};

const CURRENT_BUILT_IN_V1: PolicyLayerContent = {
  capabilityCeiling: [
    "file_read", "glob", "grep", "file_write", "file_edit", "file_insert", "ast_edit", "code_format",
    "generate_test", "git_status", "git_diff", "git_log", "git_branch", "git_commit", "git_push",
    "git_create_pr", "workforce_execute", "mcp",
  ],
  toolRules: {
    shell_exec: "deny",
    code_run: "deny",
    git_push: "require_approval",
    git_create_pr: "require_approval",
    workforce_execute: "allow",
    mcp: "require_approval",
  },
  limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 240, maxWorkforceRoles: 8 },
  permissions: {
    canCreateChildren: true,
    canWrite: true,
    canSendExternalMessage: true,
    canExecuteCode: false,
  },
};

function serviceAt(root: string, extra: Record<string, unknown> = {}) {
  return createAgentGovernanceService({
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: SECRET,
      PME_ENTERPRISE_PLATFORM_TENANT_ID: CTX.tenantId,
    },
    dataDir: root,
    now: () => NOW,
    allowLegacyStateMigration: true,
    ...extra,
  });
}

async function writeV1Catalog(root: string, content: PolicyLayerContent): Promise<PolicyRecord> {
  await mkdir(root, { recursive: true });
  const record: PolicyRecord = {
    policyKey: "execution-family",
    version: 1,
    policyType: "family",
    scopeKey: "execution",
    content,
    contentHash: computePolicyContentHash(content),
    status: "active",
    createdAt: NOW,
    activatedAt: NOW,
  };
  const rootContent: PolicyLayerContent = {
    mandatory: {
      auditRequired: true,
      credentialsExposedToAgent: false,
      crossTenantAccess: "deny",
      selfPolicyModification: "deny",
      gatewayBypass: "deny",
      permissionExpansion: "deny",
    },
    limits: {
      maxGenerationDepth: 2,
      maxChildrenPerAgent: 5,
      maxRuntimeSeconds: 300,
      maxSteps: 30,
      maxToolCalls: 50,
    },
  };
  const rootRecord: PolicyRecord = {
    policyKey: "root-policy",
    version: 1,
    policyType: "root",
    scopeKey: "global",
    content: rootContent,
    contentHash: computePolicyContentHash(rootContent),
    status: "active",
    createdAt: NOW,
    activatedAt: NOW,
  };
  await writeFile(join(root, "policies.json"), JSON.stringify({
    version: 1,
    updatedAt: NOW,
    policies: { "root-policy@1": rootRecord, "execution-family@1": record },
    activeByPolicyKey: { "root-policy": 1, "execution-family": 1 },
  }, null, 2), "utf8");
  return record;
}

async function installExistingAgent(root: string, family: PolicyRecord): Promise<AgentRegistryRecord> {
  const catalog = createPolicyCatalogStore({
    storePath: join(root, "policies.json"),
    secret: SECRET,
    now: () => NOW,
    allowLegacyStateMigration: true,
  });
  await catalog.load();
  const registry = createAgentRegistryStore({ storePath: join(root, "agents.json"), secret: SECRET, now: () => NOW });
  await registry.load();
  const files = createAgentFileStore({ dataDir: root });
  const rootPolicy = await catalog.getActive("root-policy");
  if (!rootPolicy) throw new Error("test root policy missing");
  const agentId = "agt_00000000-0000-4000-8000-000000000001";
  const classification: AgentClassification = {
    family: "execution",
    domain: "general",
    subclass: "legacy-existing",
  };
  const policy = compileEffectivePolicy({
    agentId,
    classification,
    traits: ["write_capable"],
    riskLevel: "high",
    requestedTools: ["file_read", "workforce_execute"],
    ttlSeconds: 3600,
    layerStack: [rootPolicy, family],
    toolDescriptors: createToolRiskCatalog().asMap(),
    parentEffective: null,
    creatorEntitlements: {
      allowedTools: ["file_read", "workforce_execute"],
      permissions: {
        canCreateChildren: true,
        canWrite: true,
        canSendExternalMessage: true,
        canExecuteCode: false,
      },
    },
    now: NOW,
  });
  const record: AgentRegistryRecord = {
    agentId,
    name: "legacy-existing",
    purpose: "existing Agent compiled before built-in v2",
    tenantId: CTX.tenantId,
    ownerUserId: CTX.userId,
    createdBy: CTX.userId,
    parentAgentId: null,
    generationDepth: 0,
    classification,
    traits: ["write_capable"],
    riskLevel: "high",
    requestedTools: ["file_read", "workforce_execute"],
    grantedTools: policy.grantedTools,
    policyHash: policy.policyHash,
    status: "ACTIVE",
    createdAt: NOW,
    expiresAt: policy.expiresAt,
  };
  const manifest = buildManifest({
    agentId,
    agentHash: computeAgentHash(record),
    policyHash: policy.policyHash,
    compiledAt: policy.compiledAt,
    secret: SECRET,
  });
  await files.writeAgentBundle({
    record,
    delta: {
      agentId,
      inherits: [
        { policyKey: rootPolicy.policyKey, version: rootPolicy.version },
        { policyKey: family.policyKey, version: family.version },
      ],
      instanceRules: {},
    },
    policy,
    manifest,
  });
  await registry.upsert(record);
  return record;
}

describe("built-in execution-family v2 migration", () => {
  for (const [label, content, expectedHash] of [
    ["legacy ZCode", LEGACY_ZCODE_V1, AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES[0]],
    ["current built-in", CURRENT_BUILT_IN_V1, AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES[1]],
  ] as const) {
    it(`auto-installs and activates v2 only for the allowlisted ${label} v1 hash`, async () => {
      const root = await mkdtemp(join(tmpdir(), `built-in-policy-${label.replaceAll(" ", "-")}-`));
      try {
        const v1 = await writeV1Catalog(root, content);
        expect(v1.contentHash).toBe(expectedHash);
        const service = serviceAt(root);
        const policies = await service.listPolicies();
        expect(policies.find((item) => item.policyKey === "execution-family" && item.version === 1)?.status)
          .toBe("superseded");
        expect(policies.find((item) => item.policyKey === "execution-family" && item.version === 2))
          .toMatchObject({ status: "active", contentHash: BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH });

        // A second process start is idempotent: no third record and no rewrite.
        const restarted = serviceAt(root);
        const repeated = await restarted.listPolicies();
        expect(repeated.filter((item) => item.policyKey === "execution-family")).toHaveLength(2);
        expect(repeated.filter((item) => item.policyKey === "execution-family" && item.status === "active"))
          .toHaveLength(1);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }

  it("keeps existing Agents no-expansion while newly generated Agents may receive v2 tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "built-in-policy-existing-agent-"));
    try {
      const family = await writeV1Catalog(root, LEGACY_ZCODE_V1);
      const existing = await installExistingAgent(root, family);
      const service = serviceAt(root);
      const migrated = await service.getEffectivePolicy(existing.agentId, CTX.tenantId);
      expect(migrated?.lineage).toContainEqual(expect.objectContaining({ policyKey: "execution-family", version: 2 }));
      expect(migrated?.grantedTools).not.toContain("workforce_execute");

      const generated = await service.generateAgent({
        name: "post-migration-control-plane",
        task: "execute bounded workforce, MCP, and Forge operations",
        requestedTools: ["workforce_execute", "mcp", "forge_orchestrate"],
        ttlSeconds: 1800,
        parentAgentId: null,
      }, CTX);
      expect(generated.grantedTools).toContain("workforce_execute");
      expect(generated.grantedTools).toContain("mcp");
      expect(generated.grantedTools).toContain("forge_orchestrate");
      const generatedPolicy = await service.getEffectivePolicy(generated.agentId, CTX.tenantId);
      expect(generatedPolicy?.lineage).toContainEqual(expect.objectContaining({ policyKey: "execution-family", version: 2 }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("installs v2 as draft but never auto-switches an unknown custom v1 hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "built-in-policy-custom-v1-"));
    try {
      const custom = structuredClone(LEGACY_ZCODE_V1);
      custom.limits = { ...custom.limits, maxSteps: 19 };
      const v1 = await writeV1Catalog(root, custom);
      expect(AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES).not.toContain(v1.contentHash);
      const service = serviceAt(root);
      const policies = await service.listPolicies();
      expect(policies.find((item) => item.policyKey === "execution-family" && item.version === 1))
        .toMatchObject({ status: "active", contentHash: v1.contentHash });
      expect(policies.find((item) => item.policyKey === "execution-family" && item.version === 2)).toMatchObject({
        status: "draft",
        contentHash: BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH,
      });
      expect((await service.listPolicies()).filter((item) => item.policyKey === "execution-family")).toHaveLength(2);
      const auditBeforeRestart = (await readFile(join(root, "audit-events.jsonl"), "utf8"))
        .split("\n").filter(Boolean).length;
      expect((await serviceAt(root).listPolicies()).filter((item) => item.policyKey === "execution-family")).toHaveLength(2);
      const auditAfterRestart = (await readFile(join(root, "audit-events.jsonl"), "utf8"))
        .split("\n").filter(Boolean).length;
      expect(auditAfterRestart).toBe(auditBeforeRestart);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resumes idempotently after a crash immediately after the state-anchored v2 install", async () => {
    const root = await mkdtemp(join(tmpdir(), "built-in-policy-install-crash-"));
    try {
      await writeV1Catalog(root, LEGACY_ZCODE_V1);
      let crashed = false;
      const service = serviceAt(root, {
        activationFaultInjector(stage: string) {
          if (!crashed && stage === "after-migration-install") {
            crashed = true;
            throw Object.assign(new Error("simulated migration install crash"), {
              code: "POLICY_ACTIVATION_CRASH_SIMULATION",
            });
          }
        },
      });
      await expect(service.listPolicies()).rejects.toMatchObject({ code: "POLICY_ACTIVATION_CRASH_SIMULATION" });
      const afterCrash = JSON.parse(await readFile(join(root, "policies.json"), "utf8"));
      expect(afterCrash.activeByPolicyKey["execution-family"]).toBe(1);
      expect(afterCrash.policies["execution-family@2"].status).toBe("draft");

      const recovered = await serviceAt(root).listPolicies();
      expect(recovered.find((item) => item.version === 2)?.status).toBe("active");
      expect(recovered.filter((item) => item.policyKey === "execution-family")).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses the activation journal to recover a migration crash after an existing Agent registry commit", async () => {
    const root = await mkdtemp(join(tmpdir(), "built-in-policy-activation-crash-"));
    try {
      const family = await writeV1Catalog(root, LEGACY_ZCODE_V1);
      const existing = await installExistingAgent(root, family);
      let crashed = false;
      const service = serviceAt(root, {
        activationFaultInjector(stage: string) {
          if (!crashed && stage === "after-agent-registry") {
            crashed = true;
            throw Object.assign(new Error("simulated migration activation crash"), {
              code: "POLICY_ACTIVATION_CRASH_SIMULATION",
            });
          }
        },
      });
      await expect(service.getAgent(existing.agentId, CTX.tenantId)).rejects.toMatchObject({
        code: "POLICY_ACTIVATION_CRASH_SIMULATION",
      });
      const afterCrash = JSON.parse(await readFile(join(root, "policies.json"), "utf8"));
      expect(afterCrash.activeByPolicyKey["execution-family"]).toBe(1);
      await expect(readFile(join(root, "policy-activation.journal.json"), "utf8")).resolves.toContain(
        "built-in-execution-family-v2-migration",
      );

      const restarted = serviceAt(root);
      const recovered = await restarted.getEffectivePolicy(existing.agentId, CTX.tenantId);
      expect(recovered?.lineage).toContainEqual(expect.objectContaining({
        policyKey: "execution-family",
        version: 2,
      }));
      expect(recovered?.grantedTools).not.toContain("workforce_execute");
      expect((await restarted.listPolicies()).find((item) => item.policyKey === "execution-family" && item.version === 2))
        .toMatchObject({ status: "active", contentHash: BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH });
      await expect(readFile(join(root, "policy-activation.journal.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
