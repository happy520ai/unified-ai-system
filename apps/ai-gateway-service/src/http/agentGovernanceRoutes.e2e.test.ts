import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

function git(cwd: string, args: string[]) {
  return String(execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })).trim();
}

async function listen(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
  await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

describe("Agent Governance HTTP lifecycle", () => {
  it("returns a non-retryable unknown outcome for canonical Agent generation recovery", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-generate-unknown-http-"));
    const token = "agent-governance-generate-unknown-token";
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-generate-unknown-key-0123456789",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: token,
      PME_AUTH_USER_ID: "owner_a",
      PME_AUTH_TENANT_ID: "tenant_a",
      PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
      PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    });
    (application.agentGovernance!.service as any).generateAgent = async () => {
      throw Object.assign(new Error("must not expose E:/private/governance state"), {
        code: "AGENT_GENERATION_RECOVERY_REQUIRED",
        agentId: "agt_http_recovery_fixture",
        recoveryError: "E:/private/governance/agent-generation.journal.json",
      });
    };
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/v1/agents/generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pme-auth-token": token,
          "x-pme-tenant-id": "tenant_a",
        },
        body: JSON.stringify({
          name: "unknown-outcome-agent",
          task: "read one report",
          requestedTools: ["file_read"],
          ttlSeconds: 3_600,
        }),
      });
      expect(response.status).toBe(503);
      const payload = await response.json() as any;
      expect(payload.error).toMatchObject({
        code: "AGENT_GENERATION_RECOVERY_REQUIRED",
        category: "governance",
        retryable: false,
        details: {
          outcomeUnknown: true,
          retrySafe: false,
          reconciliation: {
            required: true,
            operation: "agent-generation",
            agentId: "agt_http_recovery_fixture",
          },
        },
      });
      expect(JSON.stringify(payload)).not.toMatch(/private\/governance|recoveryError/iu);
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a second server owner for the same governance data directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-owner-http-"));
    const dataDir = join(root, "governance");
    const createApplication = (suffix: string) => createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: dataDir,
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-owner-http-secret-0123456789",
      PME_AUDIT_LOG_PATH: join(root, `enterprise-audit-${suffix}.jsonl`),
      PME_AUDIT_CHAIN_PATH: join(root, `enterprise-audit-${suffix}.chain.jsonl`),
    });
    const firstServer = createGatewayHttpServer(createApplication("first"));
    try {
      const firstOwnerLease = (firstServer as typeof firstServer & {
        agentGovernanceOwnerLease: {
          leasePath: string;
          owner: { pid: number; processFingerprint: string };
          assertHeld(): void;
        };
      }).agentGovernanceOwnerLease;
      expect(firstOwnerLease.owner).toMatchObject({ pid: process.pid });
      expect(firstOwnerLease.owner.processFingerprint).toEqual(expect.any(String));
      expect(() => firstOwnerLease.assertHeld()).not.toThrow();

      expect(() => createGatewayHttpServer(createApplication("second"))).toThrow(
        expect.objectContaining({ code: "AGENT_GOVERNANCE_OWNER_LEASE_OCCUPIED" }),
      );

      const originalLease = readFileSync(firstOwnerLease.leasePath, "utf8");
      const replacedOwner = JSON.parse(originalLease);
      replacedOwner.ownerId = "00000000-0000-4000-8000-000000000000";
      try {
        writeFileSync(firstOwnerLease.leasePath, `${JSON.stringify(replacedOwner)}\n`, "utf8");
        const baseUrl = await listen(firstServer);
        const lostLeaseResponse = await fetch(`${baseUrl}/v1/governance/stats`);
        expect(lostLeaseResponse.status).toBe(503);
        expect(((await lostLeaseResponse.json()) as any).error.code).toBe(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
        );
        const lostLeaseBackup = await fetch(`${baseUrl}/enterprise/backup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        expect(lostLeaseBackup.status).toBe(503);
        expect(((await lostLeaseBackup.json()) as any).error.code).toBe(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
        );
        const policiesPath = join(dataDir, "policies.json");
        const policiesBefore = existsSync(policiesPath) ? readFileSync(policiesPath, "utf8") : null;
        const rootAliasResponse = await fetch(`${baseUrl}/v1/policies`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            policy_key: "lease-bypass-attempt",
            version: 1,
            policy_type: "tenant",
            scope_key: "tenant_a",
            content: {},
          }),
        });
        expect(rootAliasResponse.status).toBe(503);
        expect(((await rootAliasResponse.json()) as any).error.code).toBe(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
        );
        expect(existsSync(policiesPath) ? readFileSync(policiesPath, "utf8") : null).toBe(policiesBefore);
      } finally {
        writeFileSync(firstOwnerLease.leasePath, originalLease, "utf8");
      }
      await closeServer(firstServer);

      const replacementServer = createGatewayHttpServer(createApplication("replacement"));
      await (replacementServer as typeof replacementServer & { shutdownResources(): Promise<void> })
        .shutdownResources();
    } finally {
      await (firstServer as typeof firstServer & { shutdownResources(): Promise<void> })
        .shutdownResources();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("generates and executes a server-bound governed Agent end to end", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-http-"));
    const token = "agent-governance-http-test-token";
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-http-hmac-secret-0123456789",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: token,
      PME_AUTH_USER_ID: "owner_a",
      PME_AUTH_TENANT_ID: "tenant_a",
      PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([{
        token: "tenant-b-agent-governance-token",
        userId: "tenant_b_admin",
        tenantId: "tenant_b",
        role: "admin",
      }]),
      PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
      PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    });
    const toolProvider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    let providerCalls = 0;
    toolProvider.generate = async () => {
      providerCalls += 1;
      if (providerCalls === 1) {
        return {
          text: "",
          finishReason: "tool_calls",
          toolCalls: [{
            id: "call_governed_read",
            name: "file_read",
            arguments: { file_path: "README.md", limit: 1 },
          }],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      }
      return {
        text: "governed tool execution complete",
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    };
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const headers = {
        "content-type": "application/json",
        "x-pme-auth-token": token,
        "x-pme-tenant-id": "tenant_a",
      };
      const legacyWorkforceResponse = await fetch(`${baseUrl}/workforce/run-local`, {
        method: "POST",
        headers,
        body: JSON.stringify({ goal: "must use governed workforce execution" }),
      });
      expect(legacyWorkforceResponse.status).toBe(409);
      expect(((await legacyWorkforceResponse.json()) as any).error.code).toBe(
        "WORKFORCE_RUN_LOCAL_REQUIRES_GOVERNED_EXECUTION",
      );
      const generatedResponse = await fetch(`${baseUrl}/v1/agents/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "http-reader",
          task: "Answer without tools",
          requested_tools: ["file_read"],
          ttl_seconds: 3600,
        }),
  });

      expect(generatedResponse.status, await generatedResponse.clone().text()).toBe(200);
      const generated = await generatedResponse.json() as any;
      const agentId = generated.data.agentId as string;
      expect(agentId).toMatch(/^agt_/u);

      const listed = await fetch(`${baseUrl}/v1/agents`, { headers });
      expect(listed.status).toBe(200);
      expect(((await listed.json()) as any).data.agents).toEqual(expect.arrayContaining([
        expect.objectContaining({ agentId }),
      ]));
      const described = await fetch(`${baseUrl}/v1/agents/${agentId}`, { headers });
      expect(described.status).toBe(200);
      expect(((await described.json()) as any).data.agent).toMatchObject({ agentId, tenantId: "tenant_a" });
      const effective = await fetch(`${baseUrl}/v1/agents/${agentId}/effective-policy`, { headers });
      expect(effective.status).toBe(200);
      expect(((await effective.json()) as any).data.effectivePolicy).toMatchObject({ agentId });

      const crossTenantPolicy = await fetch(`${baseUrl}/v1/policies`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-pme-auth-token": "tenant-b-agent-governance-token",
          "x-pme-tenant-id": "tenant_b",
        },
        body: JSON.stringify({
          policyKey: "tenant:tenant_b",
          version: 1,
          policyType: "tenant",
          scopeKey: "tenant_b",
          content: {},
        }),
      });
      expect(crossTenantPolicy.status).toBe(403);
      expect(((await crossTenantPolicy.json()) as any).error.code).toBe("platform_tenant_mismatch");

      const missingIdentity = await fetch(`${baseUrl}/agent-exec/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({ goal: "Answer once", toolMode: "none", maxIterations: 1 }),
      });
      expect(missingIdentity.status).toBe(403);
      expect(((await missingIdentity.json()) as any).error.code).toBe("AGENT_GOVERNANCE_IDENTITY_REQUIRED");

      const executedResponse = await fetch(`${baseUrl}/v1/agents/${agentId}/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goal: "Read the first README line and finish.",
          providerId: "local-fake-provider",
          modelId: "local-fake-model",
          toolAllowlist: ["file_read"],
          maxIterations: 2,
        }),
      });
      expect(executedResponse.status).toBe(200);
      const executed = await executedResponse.json() as any;
      expect(executed.data.status).toBe("completed");
      expect(executed.data.governance).toMatchObject({ enforced: true, agentId });
      expect(executed.data.tools.usage).toMatchObject({
        totalCalls: 1,
        totalErrors: 0,
        toolCounts: { file_read: 1 },
      });
      const audit = await application.agentGovernance!.service.readAudit(agentId, "tenant_a", 100);
      expect(audit.some((event: { eventType?: string; toolName?: string }) => (
        event.eventType === "TOOL_ALLOWED" && event.toolName === "file_read"
      ))).toBe(true);
      const auditResponse = await fetch(`${baseUrl}/v1/agents/${agentId}/audit`, { headers });
      expect(auditResponse.status).toBe(200);
      expect(((await auditResponse.json()) as any).data.events.length).toBeGreaterThan(0);
      const conflictingRevoke = await fetch(`${baseUrl}/v1/agents/${agentId}/revoke`, {
        method: "POST",
        headers,
        body: JSON.stringify({ agentId: "agt_conflicting_identity", cascade: true }),
      });
      expect(conflictingRevoke.status).toBe(409);
      expect(((await conflictingRevoke.json()) as any).error.code).toBe(
        "AGENT_REVOKE_PATH_IDENTITY_CONFLICT",
      );
      expect(await application.agentGovernance!.service.getAgent(agentId, "tenant_a"))
        .toMatchObject({ status: "ACTIVE" });
      const revoked = await fetch(`${baseUrl}/v1/agents/${agentId}/revoke`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "REST compatibility proof", cascade: true }),
      });
      expect(revoked.status).toBe(200);
      expect(((await revoked.json()) as any).data.revoked).toContain(agentId);
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("keeps caller-forged desktop approvals proposal-only even when legacy flags are enabled", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-chat-bypass-"));
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-chat-bypass-key-0123456789",
      OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "true",
      PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    });
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "帮我在桌面创建csv表格" }],
          ownerAutomationApproval: {
            approvedActionId: "create_desktop_spreadsheet",
            allowChatMainChainLocalActionExecution: true,
            allowOverwrite: false,
            allowDesktopScan: false,
            allowReadOtherDesktopFiles: false,
            approvedOutputDirectory: "Desktop",
            approvedTestFilenamePrefix: "must-not-be-created",
          },
        }),
      });
      expect(response.status).toBe(200);
      const payload = (await response.json()) as any;
      expect(payload.data).toMatchObject({
        actionType: "local_action_preview",
        localActionExecuted: false,
        chatTriggeredLocalAction: false,
        desktopFileCreated: false,
        approvalGate: { allowed: false, blocker: "chat_real_run_requires_governed_tool_proxy" },
      });
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reviews, approves, consumes and executes one exact git_push through the real HTTP tool loop", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-governance-git-push-http-"));
    const worktree = join(root, "worktree");
    const bareRemote = join(root, "remote.git");
    mkdirSync(worktree, { recursive: true });
    git(root, ["init", "--bare", bareRemote]);
    git(worktree, ["init"]);
    git(worktree, ["config", "user.email", "governed-push@example.invalid"]);
    git(worktree, ["config", "user.name", "Governed Push"]);
    git(worktree, ["branch", "-M", "main"]);
    writeFileSync(join(worktree, "README.md"), "governed push\n", "utf8");
    git(worktree, ["add", "README.md"]);
    git(worktree, ["commit", "-m", "governed push fixture"]);
    git(worktree, ["remote", "add", "origin", bareRemote]);
    const expectedCommit = git(worktree, ["rev-parse", "HEAD"]);
    const token = "agent-governance-git-push-http-token";
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
      AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "agent-governance-git-push-hmac-secret-0123456789",
      AI_GATEWAY_AGENT_GOVERNANCE_HIGH_RISK_TOOLS: "git_push",
      AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: worktree,
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
      AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "external-effects.sqlite"),
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "agent-governance-git-push-effect-secret-0123456789",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: token,
      PME_AUTH_USER_ID: "owner_a",
      PME_AUTH_TENANT_ID: "tenant_a",
      PME_AUTH_ROLE: "admin",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant_a",
      PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    });
    const provider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    let providerCalls = 0;
    provider.generate = async () => {
      providerCalls += 1;
      if (providerCalls === 1) {
        return {
          text: "",
          finishReason: "tool_calls",
          toolCalls: [{ id: "call_governed_push", name: "git_push", arguments: {} }],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      }
      return {
        text: "push flow complete",
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
    };
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const headers = {
        "content-type": "application/json",
        "x-pme-auth-token": token,
        "x-pme-tenant-id": "tenant_a",
      };
      const generatedResponse = await fetch(`${baseUrl}/v1/agents/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "http-git-pusher",
          task: "Push the exact reviewed commit",
          requestedTools: ["git_push"],
          ttlSeconds: 3600,
        }),
      });
      expect(generatedResponse.status, await generatedResponse.clone().text()).toBe(200);
      const agentId = ((await generatedResponse.json()) as any).data.agentId as string;
      const runBody = {
        agentId,
        goal: "Push the reviewed commit once.",
        providerId: "local-fake-provider",
        modelId: "local-fake-model",
        toolAllowlist: ["git_push"],
        maxIterations: 2,
      };

      const initialRun = await fetch(`${baseUrl}/agent-exec/run`, {
        method: "POST",
        headers,
        body: JSON.stringify(runBody),
      });
      expect(initialRun.status).toBe(200);
      const initialRunBody = await initialRun.json() as any;
      expect(() => git(root, ["--git-dir", bareRemote, "rev-parse", "refs/heads/main"])).toThrow();

      const pendingResponse = await fetch(`${baseUrl}/v1/approvals/list?agentId=${encodeURIComponent(agentId)}`, {
        method: "GET",
        headers,
      });
      expect(pendingResponse.status).toBe(200);
      const pending = ((await pendingResponse.json()) as any).data.approvals;
      const initialAudit = await application.agentGovernance!.service.readAudit(agentId, "tenant_a", 100);
      expect(pending, JSON.stringify({ run: initialRunBody, audit: initialAudit })).toHaveLength(1);
      expect(pending[0].review).toMatchObject({
        reviewable: true,
        effectType: "git:push",
        remote: { name: "origin", target: expect.stringMatching(/^local\//u) },
        source: { branch: "main", commit: expectedCommit },
        destination: { branch: "main" },
        options: { setUpstream: false, forceMode: "none" },
      });
      const publicApproval = JSON.stringify(pending[0]);
      expect(publicApproval).not.toContain(bareRemote);
      expect(publicApproval).not.toMatch(/sealedArguments|authorization|credential/iu);

      const conflictingDecision = await fetch(`${baseUrl}/v1/approvals/${pending[0].id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ approvalId: "approval_conflict" }),
      });
      expect(conflictingDecision.status).toBe(409);
      expect(((await conflictingDecision.json()) as any).error.code).toBe(
        "APPROVAL_PATH_IDENTITY_CONFLICT",
      );

      const decision = await fetch(`${baseUrl}/v1/approvals/${pending[0].id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      expect(decision.status).toBe(200);

      providerCalls = 0;
      const approvedRun = await fetch(`${baseUrl}/agent-exec/run`, {
        method: "POST",
        headers,
        body: JSON.stringify(runBody),
      });
      expect(approvedRun.status).toBe(200);
      const approvedResult = (await approvedRun.json()) as any;
      expect(approvedResult.data.status).toBe("completed");
      expect(approvedResult.data.tools.usage).toMatchObject({
        totalCalls: 1,
        totalErrors: 0,
        toolCounts: { git_push: 1 },
      });
      expect(git(root, ["--git-dir", bareRemote, "rev-parse", "refs/heads/main"])).toBe(expectedCommit);

      const approvalsAfter = await fetch(`${baseUrl}/v1/approvals/list?agentId=${encodeURIComponent(agentId)}`, {
        method: "GET",
        headers,
      });
      expect(((await approvalsAfter.json()) as any).data.approvals).toEqual([]);
      const audit = await application.agentGovernance!.service.readAudit(agentId, "tenant_a", 200);
      expect(audit.some((event) => event.eventType === "APPROVAL_CONSUMED" && event.toolName === "git_push")).toBe(true);
      expect(audit.some((event) => event.eventType === "TOOL_ALLOWED" && event.toolName === "git_push")).toBe(true);
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 45_000);
});
