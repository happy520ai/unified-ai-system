import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeArgumentsHash, stableStringify } from "@unified-ai-system/policy-engine";
import { createHash } from "node:crypto";
import { createAgentApprovalStore } from "./agentApprovalStore.ts";

const REVIEW = {
  schemaVersion: 1 as const,
  reviewable: true,
  effectType: "git:push",
  policyHash: `sha256:${"a".repeat(64)}`,
  repository: { displayName: "review-repo", fingerprint: `sha256:${"b".repeat(64)}` },
  remote: { name: "origin", target: "example/review-repo", urlFingerprint: `sha256:${"c".repeat(64)}` },
  source: { branch: "main", commit: "d".repeat(40) },
  destination: { branch: "main" },
  options: { setUpstream: false, forceMode: "none" as const },
};

describe("agent governance approval store", () => {
  it("coalesces identical pending approvals and enforces a per-Agent pending cap", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-coalesce-"));
    try {
      let audits = 0;
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
        maxPendingPerAgent: 1,
      });
      const input = {
        agentId: "agt_coalesce",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { remote: "origin", branch: "main" },
        review: REVIEW,
      };
      const results = await Promise.all(Array.from({ length: 8 }, () => (
        store.create(input, async () => { audits += 1; })
      )));
      expect(new Set(results.map((item) => item.id)).size).toBe(1);
      expect(audits).toBe(1);
      expect(await store.listPending("agt_coalesce")).toHaveLength(1);

      await expect(store.create({
        ...input,
        arguments: { remote: "origin", branch: "release" },
        review: {
          ...REVIEW,
          source: { ...REVIEW.source, branch: "release" },
          destination: { branch: "release" },
        },
      })).rejects.toMatchObject({ name: "ApprovalPendingLimitReached" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("bounds durable terminal approval retention by compacting oldest tombstones", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-retention-"));
    const path = join(root, "approvals.json");
    try {
      const store = createAgentApprovalStore({
        storePath: path,
        secret: "test-only-governance-secret-material",
        maxRecords: 10,
      });
      for (let index = 0; index < 18; index += 1) {
        const branch = `branch-${index}`;
        const pending = await store.create({
          agentId: "agt_retention",
          tenantId: "tenant_a",
          toolName: "git_push",
          arguments: { branch },
          review: {
            ...REVIEW,
            source: { ...REVIEW.source, branch },
            destination: { branch },
          },
        });
        await store.decide(pending.id, "reject", "operator");
      }
      const persisted = JSON.parse(await readFile(path, "utf8"));
      expect(Object.keys(persisted.approvals).length).toBeLessThanOrEqual(10);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("expires stale live approvals before capacity accounting", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-expired-capacity-"));
    const path = join(root, "approvals.json");
    let nowIso = "2026-08-30T00:00:00.000Z";
    try {
      const store = createAgentApprovalStore({
        storePath: path,
        secret: "test-only-governance-secret-material",
        maxRecords: 10,
        now: () => nowIso,
      });
      for (let index = 0; index < 10; index += 1) {
        const branch = `stale-${index}`;
        await store.create({
          agentId: `agt_stale_${index}`,
          tenantId: "tenant_a",
          toolName: "git_push",
          arguments: { branch },
          ttlSeconds: 1,
          review: {
            ...REVIEW,
            source: { ...REVIEW.source, branch },
            destination: { branch },
          },
        });
      }
      nowIso = "2026-08-30T00:00:02.000Z";
      await expect(store.create({
        agentId: "agt_fresh",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "fresh" },
        review: {
          ...REVIEW,
          source: { ...REVIEW.source, branch: "fresh" },
          destination: { branch: "fresh" },
        },
      })).resolves.toMatchObject({ status: "PENDING" });
      const persisted = JSON.parse(await readFile(path, "utf8"));
      expect(Object.keys(persisted.approvals).length).toBeLessThanOrEqual(10);
      expect(Object.values(persisted.approvals).filter((item: any) => item.status === "PENDING")).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects Git execution envelopes that diverge from the operator-visible review", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-git-envelope-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      const { policyHash: _policyHash, ...reviewDraft } = REVIEW;
      const matchingEnvelope = {
        schemaVersion: 1,
        toolName: "git_push",
        review: reviewDraft,
        privateExecution: {
          remoteTarget: "https://example.invalid/review-repo.git",
          credentialHelpers: [],
          credentialUseHttpPath: false,
        },
      };
      const matchingArguments = {
        remote: "origin",
        branch: "main",
        force: false,
        setUpstream: false,
        __governanceApprovalEnvelope: matchingEnvelope,
      };
      await expect(store.create({
        agentId: "agt_git_envelope",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: matchingArguments,
        review: REVIEW,
      })).resolves.toMatchObject({ status: "PENDING" });

      await expect(store.create({
        agentId: "agt_git_mismatch",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: {
          ...matchingArguments,
          __governanceApprovalEnvelope: {
            ...matchingEnvelope,
            review: {
              ...reviewDraft,
              destination: { branch: "release" },
            },
          },
        },
        review: REVIEW,
      })).rejects.toMatchObject({ name: "GovernanceApprovalStoreCorrupt" });

      await expect(store.create({
        agentId: "agt_git_extra_key",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: {
          ...matchingArguments,
          __governanceApprovalEnvelope: { ...matchingEnvelope, unexpected: true },
        },
        review: REVIEW,
      })).rejects.toMatchObject({ name: "GovernanceApprovalStoreCorrupt" });

      await expect(store.create({
        agentId: "agt_git_public_extra_key",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: matchingArguments,
        review: { ...REVIEW, unexpected: true } as any,
      })).rejects.toMatchObject({ name: "GovernanceApprovalStoreCorrupt" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("binds a complete bounded Forge goal/options review to one sealed retry", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-forge-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      const goal = "implement the bounded reviewed change";
      const options = { enableCodeIntel: false as const, maxConcurrent: 2 };
      const args = {
        goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
        goalBytes: Buffer.byteLength(goal, "utf8"),
        options,
      };
      const review = {
        schemaVersion: 1 as const,
        reviewable: true,
        effectType: "forge:orchestrate",
        policyHash: `sha256:${"e".repeat(64)}`,
        forge: {
          goal,
          goalDigest: `sha256:${args.goalDigest}`,
          goalBytes: args.goalBytes,
          optionsHash: `sha256:${createHash("sha256").update(stableStringify(options), "utf8").digest("hex")}`,
          options,
        },
      };
      const pending = await store.create({
        agentId: "agt_forge",
        tenantId: "tenant_a",
        toolName: "forge_orchestrate",
        arguments: args,
        review,
      });
      await store.decide(pending.id, "approve", "operator");
      await expect(store.consumeApproved({
        approvalId: pending.id,
        agentId: "agt_forge",
        tenantId: "tenant_a",
        toolName: "forge_orchestrate",
        argumentsHash: computeArgumentsHash(args),
        policyHash: review.policyHash,
        executionId: "forge_retry_1",
      })).resolves.toMatchObject({ args, review: { forge: { goal } } });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("binds a complete Workforce goal/plan review to one sealed retry", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-workforce-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      const goal = "Execute the reviewed bounded workforce plan";
      const reviewOptions = { selectedRoleCount: 2, templateSelected: true };
      const args = {
        goal,
        goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
        goalBytes: Buffer.byteLength(goal, "utf8"),
        planId: "plan-reviewed-1",
        planDigest: "b".repeat(64),
        options: {
          autonomyMode: "controlled-execution",
          requiredScopes: ["workforce:execute"],
          ...reviewOptions,
        },
      };
      const review = {
        schemaVersion: 1 as const,
        reviewable: true,
        effectType: "workforce:execute",
        policyHash: `sha256:${"7".repeat(64)}`,
        workforce: {
          goal,
          goalDigest: `sha256:${args.goalDigest}`,
          goalBytes: args.goalBytes,
          planId: args.planId,
          planDigest: `sha256:${args.planDigest}`,
          autonomyMode: args.options.autonomyMode,
          requiredScopes: args.options.requiredScopes,
          optionsHash: `sha256:${createHash("sha256").update(stableStringify(reviewOptions), "utf8").digest("hex")}`,
          options: reviewOptions,
        },
      };
      const pending = await store.create({
        agentId: "agt_workforce",
        tenantId: "tenant_a",
        toolName: "workforce_execute",
        arguments: args,
        review,
      });
      expect((await store.listPending())[0]?.review.workforce).toMatchObject({
        goal,
        planId: args.planId,
        requiredScopes: ["workforce:execute"],
      });
      await store.decide(pending.id, "approve", "operator");
      await expect(store.consumeApproved({
        approvalId: pending.id,
        agentId: "agt_workforce",
        tenantId: "tenant_a",
        toolName: "workforce_execute",
        argumentsHash: computeArgumentsHash(args),
        policyHash: review.policyHash,
        executionId: "workforce_retry_1",
      })).resolves.toMatchObject({ args, review: { workforce: { goal, planId: args.planId } } });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("consumes an approved argument envelope exactly once under concurrency", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      const args = { remote: "origin", branch: "main" };
      const pending = await store.create({
        agentId: "agt_approval",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: args,
        review: REVIEW,
      });
      await store.decide(pending.id, "approve", "approver_a");
      const results = await Promise.all([
        store.consumeApproved({
          agentId: "agt_approval",
          tenantId: "tenant_a",
          toolName: "git_push",
          argumentsHash: computeArgumentsHash(args),
          policyHash: REVIEW.policyHash,
          executionId: "exec_1",
        }),
        store.consumeApproved({
          agentId: "agt_approval",
          tenantId: "tenant_a",
          toolName: "git_push",
          argumentsHash: computeArgumentsHash(args),
          policyHash: REVIEW.policyHash,
          executionId: "exec_2",
        }),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.filter((result) => result === null)).toHaveLength(1);
      expect(await store.get(pending.id)).toMatchObject({
        status: "CONSUMED",
        consumedByExecutionId: expect.stringMatching(/^exec_[12]$/u),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on corrupt durable approval state", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-corrupt-"));
    try {
      const path = join(root, "approvals.json");
      await writeFile(path, "{broken", "utf8");
      const store = createAgentApprovalStore({
        storePath: path,
        secret: "test-only-governance-secret-material",
      });
      await expect(store.listPending()).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not commit approval state when its mandatory audit pre-commit fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-audit-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      await expect(store.create({
        agentId: "agt_audit",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "main" },
        review: REVIEW,
      }, async () => { throw new Error("audit unavailable"); })).rejects.toThrow(/audit unavailable/u);
      expect(await store.listPending()).toEqual([]);

      const pending = await store.create({
        agentId: "agt_audit",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "main" },
        review: REVIEW,
      });
      await expect(store.decide(
        pending.id,
        "approve",
        "approver",
        async () => { throw new Error("audit unavailable"); },
      )).rejects.toThrow(/audit unavailable/u);
      expect(await store.get(pending.id)).toMatchObject({ status: "PENDING" });

      const consumable = await store.create({
        agentId: "agt_audit",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "release" },
        review: { ...REVIEW, source: { ...REVIEW.source, branch: "release" }, destination: { branch: "release" } },
      });
      await store.decide(consumable.id, "approve", "approver");
      await expect(store.consumeApproved({
        approvalId: consumable.id,
        agentId: "agt_audit",
        tenantId: "tenant_a",
        toolName: "git_push",
        argumentsHash: computeArgumentsHash({ branch: "release" }),
        policyHash: REVIEW.policyHash,
        executionId: "exec_audit_failure",
      }, async () => { throw new Error("audit unavailable"); })).rejects.toThrow(/audit unavailable/u);
      expect(await store.get(consumable.id)).toMatchObject({ status: "APPROVED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects authenticated ciphertext transplanted across approval identities", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-aad-"));
    try {
      const path = join(root, "approvals.json");
      const secret = "test-only-governance-secret-material";
      const store = createAgentApprovalStore({ storePath: path, secret });
      const first = await store.create({
        agentId: "agt_first",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "main" },
        review: REVIEW,
      });
      const second = await store.create({
        agentId: "agt_second",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: { branch: "develop" },
        review: { ...REVIEW, source: { ...REVIEW.source, branch: "develop" }, destination: { branch: "develop" } },
      });
      const state = JSON.parse(await readFile(path, "utf8"));
      state.approvals[second.id].sealedArguments = state.approvals[first.id].sealedArguments;
      state.approvals[second.id].argumentsHash = state.approvals[first.id].argumentsHash;
      state.approvals[second.id].review = state.approvals[first.id].review;
      await writeFile(path, JSON.stringify(state), "utf8");

      const restarted = createAgentApprovalStore({ storePath: path, secret });
      await expect(restarted.listPending()).rejects.toMatchObject({
        name: "GovernanceStateIntegrityError",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("binds a fully reviewed MCP scalar envelope and rejects review/argument mismatch", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-governance-approval-mcp-"));
    try {
      const store = createAgentApprovalStore({
        storePath: join(root, "approvals.json"),
        secret: "test-only-governance-secret-material",
      });
      const rawArgs = { ticketId: "INC-42", priority: 2 };
      const canonical = { serverName: "ops", toolName: "create_ticket", args: rawArgs };
      const review = {
        schemaVersion: 1 as const,
        reviewable: true,
        effectType: "mcp:upstream-tool-call",
        policyHash: `sha256:${"f".repeat(64)}`,
        mcp: {
          serverId: "ops",
          toolName: "create_ticket",
          target: "mcp://ops/create_ticket",
          targetFingerprint: `sha256:${"1".repeat(64)}`,
          argumentsHash: computeArgumentsHash(rawArgs),
          argumentsBytes: Buffer.byteLength(JSON.stringify(rawArgs), "utf8"),
          externalEffectRequired: true,
          reviewedArguments: rawArgs,
          omittedArgumentKeys: [] as string[],
        },
      };
      const pending = await store.create({
        agentId: "agt_mcp",
        tenantId: "tenant_a",
        toolName: "mcp",
        arguments: canonical,
        review,
      });
      expect((await store.listPending())[0]?.review.mcp).toMatchObject({
        serverId: "ops",
        toolName: "create_ticket",
        reviewedArguments: rawArgs,
        omittedArgumentKeys: [],
      });
      await store.decide(pending.id, "approve", "approver");
      await expect(store.consumeApproved({
        approvalId: pending.id,
        agentId: "agt_mcp",
        tenantId: "tenant_a",
        toolName: "mcp",
        argumentsHash: computeArgumentsHash(canonical),
        policyHash: review.policyHash,
        executionId: "exec_mcp",
      })).resolves.toMatchObject({ args: canonical });

      await expect(store.create({
        agentId: "agt_mcp",
        tenantId: "tenant_a",
        toolName: "mcp",
        arguments: { ...canonical, args: { ...rawArgs, priority: 1 } },
        review,
      })).rejects.toMatchObject({
        name: "GovernanceApprovalStoreCorrupt",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
