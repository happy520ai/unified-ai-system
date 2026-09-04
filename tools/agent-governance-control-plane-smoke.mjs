import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAgentGovernanceService } from "../apps/ai-gateway-service/src/agent-governance/agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "../apps/ai-gateway-service/src/agent-governance/toolProxy.ts";

const dataDir = await mkdtemp(join(tmpdir(), "agent-governance-public-smoke-"));
const checks = {};
try {
  const context = {
    tenantId: "public-smoke-tenant",
    userId: "public-smoke-admin",
    role: "admin",
    permissions: ["*"],
    requestId: "public-smoke-request",
  };
  const service = createAgentGovernanceService({
    dataDir,
    env: {
      AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "public-smoke-governance-secret-0123456789",
      PME_ENTERPRISE_PLATFORM_TENANT_ID: context.tenantId,
    },
  });
  const proxy = createAgentGovernanceToolProxy({ service });

  const reader = await service.generateAgent({
    name: "public-smoke-reader",
    task: "read one public file",
    requestedTools: ["file_read"],
    ttlSeconds: 600,
    parentAgentId: null,
    instanceRules: { limits: { maxToolCalls: 1 } },
  }, context);
  checks.generatedActive = reader.status === "ACTIVE";
  checks.tenantScoped = await service.getAgent(reader.agentId, "other-tenant") === null;
  const firstRead = await proxy.enforce({
    context: { agentId: reader.agentId, tenantId: context.tenantId, requestId: "read-1" },
    toolName: "file_read",
    params: { file_path: "README.md" },
  });
  firstRead.executionLease?.release();
  const secondRead = await proxy.enforce({
    context: { agentId: reader.agentId, tenantId: context.tenantId, requestId: "read-2" },
    toolName: "file_read",
    params: { file_path: "README.md" },
  });
  checks.atomicUsageCeiling = firstRead.outcome === "allow"
    && secondRead.code === "TOOL_CALL_LIMIT_REACHED";

  const publisher = await service.generateAgent({
    name: "public-smoke-publisher",
    task: "publish an approved branch",
    requestedTools: ["git_push"],
    ttlSeconds: 600,
    parentAgentId: null,
  }, context);
  const pushCall = {
    context: { agentId: publisher.agentId, tenantId: context.tenantId, requestId: "push-1" },
    toolName: "git_push",
    params: { remote: "origin", branch: "smoke" },
    resourceContext: {
      approvalReview: {
        schemaVersion: 1,
        reviewable: true,
        effectType: "git:push",
        repository: { displayName: "public-smoke", fingerprint: `sha256:${"a".repeat(64)}` },
        remote: { name: "origin", target: "example/public-smoke", urlFingerprint: `sha256:${"b".repeat(64)}` },
        source: { branch: "smoke", commit: "c".repeat(40) },
        destination: { branch: "smoke" },
        options: { setUpstream: false, forceMode: "none" },
      },
    },
  };
  const pending = await proxy.enforce(pushCall);
  await service.decideApproval(pending.approvalId, "approve", context);
  const approved = await proxy.enforce(pushCall);
  approved.executionLease?.release();
  const repeated = await proxy.enforce({ ...pushCall, context: { ...pushCall.context, requestId: "push-2" } });
  checks.oneShotApproval = pending.outcome === "approval_required"
    && approved.outcome === "allow"
    && repeated.outcome === "approval_required"
    && repeated.approvalId !== pending.approvalId;

  const audit = await service.readAudit(publisher.agentId, context.tenantId, 100);
  checks.tamperEvidentAuditReadable = audit.some((event) => event.eventType === "APPROVAL_CONSUMED")
    && audit.some((event) => event.eventType === "TOOL_ALLOWED");

  const ok = Object.values(checks).every(Boolean);
  process.stdout.write(`${JSON.stringify({
    ok,
    checks,
    executionMode: "local-governance-no-provider",
    realProviderCallsMade: false,
    externalEffectPerformed: false,
  }, null, 2)}\n`);
  if (!ok) process.exitCode = 1;
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
