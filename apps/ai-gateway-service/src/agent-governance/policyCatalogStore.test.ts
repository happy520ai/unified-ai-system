import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computePolicyContentHash } from "@unified-ai-system/policy-engine";
import {
  AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES,
  BUILT_IN_EXECUTION_FAMILY_V2,
  BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH,
  createPolicyCatalogStore,
} from "./policyCatalogStore.ts";

describe("Agent Governance policy catalog durability", () => {
  it("seeds only a missing catalog and rejects corrupt existing state", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-"));
    const storePath = join(root, "policies.json");
    try {
      const fresh = createPolicyCatalogStore({ storePath });
      await fresh.load();
      expect((await fresh.getActive("root-policy"))?.status).toBe("active");
      expect((await fresh.getActive("execution-family"))?.version).toBe(2);
      expect((await fresh.get("execution-family", 1))?.status).toBe("draft");
      expect((await fresh.getActive("root-policy"))?.content.limits?.maxWorkforceRoles).toBe(8);
      expect(await fresh.getActive("execution-family")).toMatchObject({
        content: {
          capabilityCeiling: expect.arrayContaining(["workforce_execute"]),
          toolRules: { workforce_execute: "allow" },
          limits: { maxWorkforceRoles: 8 },
        },
      });

      await writeFile(storePath, "{broken", "utf8");
      const corrupt = createPolicyCatalogStore({ storePath });
      await expect(corrupt.load()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
      expect(await readFile(storePath, "utf8")).toBe("{broken");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pins immutable execution-family v1 allowlist hashes and seeds canonical v2 active", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-v2-"));
    try {
      const store = createPolicyCatalogStore({ storePath: join(root, "policies.json") });
      const v1 = await store.get("execution-family", 1);
      const v2 = await store.get("execution-family", 2);
      expect(v1?.contentHash).toBe(AUTO_MIGRATABLE_EXECUTION_FAMILY_V1_HASHES[1]);
      expect(v2).toMatchObject({ status: "active", contentHash: BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH });
      expect(computePolicyContentHash(BUILT_IN_EXECUTION_FAMILY_V2.content))
        .toBe(BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH);
      expect(v2?.content.capabilityCeiling).toEqual(expect.arrayContaining([
        "glob", "grep", "mcp", "workforce_execute", "forge_orchestrate",
      ]));
      expect(v2?.content.toolRules).toMatchObject({
        mcp: "require_approval",
        workforce_execute: "allow",
        forge_orchestrate: "allow",
      });
      expect(v2?.content.limits?.maxWorkforceRoles).toBe(8);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects content modified without its immutable hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-hash-"));
    const storePath = join(root, "policies.json");
    try {
      const fresh = createPolicyCatalogStore({ storePath });
      await fresh.load();
      const data = JSON.parse(await readFile(storePath, "utf8"));
      data.policies["analysis-family@1"].content.toolRules.file_read = "deny";
      await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");

      const restarted = createPolicyCatalogStore({ storePath });
      await expect(restarted.load()).rejects.toMatchObject({ name: "GovernanceStateIntegrityError" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe policy content before an immutable version is created", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-input-"));
    try {
      const store = createPolicyCatalogStore({ storePath: join(root, "policies.json") });
      await expect(store.create({
        policyKey: "unsafe-domain",
        version: 1,
        policyType: "domain",
        scopeKey: "unsafe",
        content: { toolRules: { constructor: "allow" } } as any,
      }, "platform-admin")).rejects.toMatchObject({ name: "PolicyContentInvalid" });
      await expect(store.create({
        policyKey: "credential-domain",
        version: 1,
        policyType: "domain",
        scopeKey: "credential",
        content: { mandatory: { credentialsExposedToAgent: true } },
      }, "platform-admin")).rejects.toMatchObject({ name: "PolicyContentInvalid" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restores the exact active pointer and policy statuses from an activation snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-restore-"));
    const storePath = join(root, "policies.json");
    try {
      const store = createPolicyCatalogStore({ storePath });
      await store.create({
        policyKey: "restore-domain",
        version: 1,
        policyType: "domain",
        scopeKey: "restore",
        content: { toolRules: { file_read: "allow" } },
      }, "platform-admin");
      await store.create({
        policyKey: "restore-domain",
        version: 2,
        policyType: "domain",
        scopeKey: "restore",
        content: { toolRules: { file_read: "deny" } },
      }, "platform-admin");
      await store.activate("restore-domain", 1, "platform-admin");
      const snapshot = await store.snapshotActivation("restore-domain");
      await store.activate("restore-domain", 2, "platform-admin");
      await store.restoreActivation(snapshot, "platform-admin");

      expect((await store.getActive("restore-domain"))?.version).toBe(1);
      expect((await store.get("restore-domain", 1))?.status).toBe("active");
      expect((await store.get("restore-domain", 2))?.status).toBe("draft");
      const restarted = createPolicyCatalogStore({ storePath });
      expect((await restarted.getActive("restore-domain"))?.version).toBe(1);
      expect((await restarted.get("restore-domain", 2))?.status).toBe("draft");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls the in-memory activation back when catalog persistence fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-flush-"));
    const storePath = join(root, "policies.json");
    try {
      const store = createPolicyCatalogStore({ storePath });
      await store.create({
        policyKey: "flush-domain",
        version: 1,
        policyType: "domain",
        scopeKey: "flush",
        content: { toolRules: { file_read: "deny" } },
      }, "platform-admin");
      await rm(storePath);
      await mkdir(storePath);

      await expect(store.activate("flush-domain", 1, "platform-admin")).rejects.toBeInstanceOf(Error);
      await expect(store.getActive("flush-domain")).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
      await expect(store.get("flush-domain", 1)).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("persists a monotonic activation completion fence and rejects stale operation bases", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-operation-"));
    try {
      const store = createPolicyCatalogStore({ storePath: join(root, "policies.json") });
      const base = await store.getActivationState();
      const operationId = randomUUID();
      const completed = await store.completeActivationOperation(operationId, "committed", base);
      expect(completed).toEqual({
        sequence: base.sequence + 1,
        lastOperationId: operationId,
        lastOutcome: "committed",
      });
      await expect(store.completeActivationOperation(operationId, "committed", base)).resolves.toEqual(completed);
      await expect(store.completeActivationOperation(randomUUID(), "rolled_back", base))
        .rejects.toMatchObject({ name: "PolicyActivationOperationDiverged" });

      const restarted = createPolicyCatalogStore({ storePath: join(root, "policies.json") });
      await expect(restarted.getActivationState()).resolves.toEqual(completed);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses activation rollback that would delete a later immutable version", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-policy-diverged-"));
    try {
      const store = createPolicyCatalogStore({ storePath: join(root, "policies.json") });
      await store.create({
        policyKey: "diverged-domain", version: 1, policyType: "domain", scopeKey: "diverged",
        content: { toolRules: { file_read: "allow" } },
      }, "platform-admin");
      const snapshot = await store.snapshotActivation("diverged-domain");
      await store.create({
        policyKey: "diverged-domain", version: 2, policyType: "domain", scopeKey: "diverged",
        content: { toolRules: { file_read: "deny" } },
      }, "platform-admin");
      await expect(store.restoreActivation(snapshot, "platform-admin"))
        .rejects.toMatchObject({ name: "PolicyActivationSnapshotDiverged" });
      await expect(store.get("diverged-domain", 2)).resolves.not.toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
