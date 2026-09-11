// =============================================================================
// openApiGenerator.js — 从路由模块元数据生成 OpenAPI 3.0 spec
// =============================================================================

/**
 * 从路由模块元数据生成 OpenAPI 3.0 spec
 * @param {Array<Map>} routeModules - 路由模块 handlers 数组
 * @param {Object} options - { title, version, description, serverUrl }
 * @returns {Object} OpenAPI 3.0 spec
 */
export function generateOpenApiSpec(routeModules, options = {}) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: options.title ?? "AI Gateway API",
      version: options.version ?? "0.1.0",
      description: options.description ?? "Unified AI System Gateway API",
    },
    servers: [
      { url: options.serverUrl ?? "http://127.0.0.1:3100", description: "Local" },
    ],
    paths: {},
    tags: [],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "A scoped enterprise bearer token. Never place a real token in an OpenAPI example or URL.",
        },
      },
      parameters: {},
      responses: {},
      schemas: {},
    },
  };

  for (const handlers of routeModules) {
    if (!handlers || typeof handlers.forEach !== "function") continue;
    handlers.forEach?.((routeDef, key) => {
      if (!key || typeof key !== "string") return;
      const [method, path] = key.split(" ");
      if (!method || !path) return;

      const httpMethod = method.toLowerCase();
      const openApiPath = path.replace(/:([a-zA-Z_]+)/g, "{$1}");

      if (!spec.paths[openApiPath]) {
        spec.paths[openApiPath] = {};
      }

      spec.paths[openApiPath][httpMethod] = {
        summary: routeDef.description ?? key,
        operationId: key.replace(/[^a-zA-Z0-9]/g, "_"),
        responses: {
          "200": {
            description: "成功",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
          "400": { description: "请求参数错误" },
          "500": { description: "服务器内部错误" },
        },
      };

      if (!routeDef.public) {
        spec.paths[openApiPath][httpMethod].security = [{ bearerAuth: [] }];
      }
    });
  }

  installAgentGovernanceOpenApi(spec);

  return spec;
}

const AGENT_GOVERNANCE_TAG = "Agent Governance";
const AGENT_ID_PATTERN = "^agt_[A-Za-z0-9_-]{1,128}$";
const APPROVAL_ID_PATTERN = "^appr_[A-Za-z0-9_-]{1,128}$";
const POLICY_TYPES = [
  "emergency",
  "root",
  "tenant",
  "family",
  "domain",
  "subclass",
  "trait",
  "instance",
  "task",
];
const AGENT_TRAITS = [
  "read_only",
  "write_capable",
  "external_communication",
  "handles_sensitive_data",
  "financial_operation",
  "code_execution",
  "subagent_creator",
  "destructive_operation",
];

function installAgentGovernanceOpenApi(spec) {
  spec.tags.push({
    name: AGENT_GOVERNANCE_TAG,
    description: [
      "Human/operator Agent lifecycle and policy control-plane APIs.",
      "Tenant and user authority are derived from the authenticated enterprise identity, never from request JSON.",
      "The in-process Tool Proxy is deliberately not exposed as an HTTP operation.",
    ].join(" "),
  });
  Object.assign(spec.components.parameters, createAgentGovernanceParameters());
  Object.assign(spec.components.responses, createAgentGovernanceErrorResponses());
  Object.assign(spec.components.schemas, createAgentGovernanceSchemas());
  for (const [path, pathItem] of Object.entries(createAgentGovernancePaths())) {
    spec.paths[path] = { ...(spec.paths[path] ?? {}), ...pathItem };
  }
}

function createAgentGovernanceParameters() {
  return {
    EnterpriseTenantHeader: {
      name: "x-pme-tenant-id",
      in: "header",
      required: true,
      description: [
        "Enterprise tenant selector authenticated by the gateway.",
        "It is not authority by itself and cannot override the tenant bound to the bearer identity.",
      ].join(" "),
      schema: { type: "string", minLength: 1, maxLength: 160 },
    },
    GovernedAgentId: {
      name: "agentId",
      in: "path",
      required: true,
      description: "Server-issued governed Agent identifier. Path identity is authoritative.",
      schema: { type: "string", pattern: AGENT_ID_PATTERN },
    },
    ApprovalId: {
      name: "approvalId",
      in: "path",
      required: true,
      description: "Server-issued approval identifier. The decision applies only to the sealed arguments recorded for this approval.",
      schema: { type: "string", pattern: APPROVAL_ID_PATTERN },
    },
    PolicyKey: {
      name: "policyKey",
      in: "path",
      required: true,
      description: "Canonical policy key encoded as one URL path segment.",
      schema: { type: "string", minLength: 1, maxLength: 160 },
    },
    PolicyVersion: {
      name: "version",
      in: "path",
      required: true,
      description: "Positive immutable policy version.",
      schema: { type: "integer", minimum: 1, maximum: 999999999 },
    },
  };
}

function createAgentGovernanceErrorResponses() {
  return Object.fromEntries([
    ["GovernanceBadRequest", "The request does not match the public governance contract."],
    ["GovernanceUnauthorized", "A valid enterprise authentication token is required."],
    ["GovernanceForbidden", "The authenticated identity lacks the required permission, tenant binding, ownership, or delegated authority."],
    ["GovernanceNotFound", "The tenant-scoped Agent, approval, or policy was not found."],
    ["GovernanceConflict", "The path identity conflicts with the body or the requested immutable/lifecycle transition is stale."],
    ["GovernanceRateLimited", "The bounded route admission limit was reached."],
    ["GovernanceInternalFailure", "Governance integrity verification failed closed."],
    ["GovernanceUnavailable", "Agent Governance is disabled, not ready, owner-fenced, or recovering."],
  ].map(([name, description]) => [name, {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/GovernanceErrorEnvelope" },
      },
    },
  }]));
}

function createAgentGovernanceSchemas() {
  const responseMetadata = {
    type: "object",
    description: "Shared ResultEnvelope response metadata.",
    properties: {
      requestId: { type: "string" },
      traceId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      durationMs: { type: "number", minimum: 0 },
      metadata: { type: "object", additionalProperties: true },
    },
    additionalProperties: false,
  };
  const agentClassification = contractSchema("AgentClassification", {
    type: "object",
    required: ["family", "domain", "subclass"],
    properties: {
      family: {
        type: "string",
        enum: ["analysis", "execution", "communication", "monitoring", "development", "orchestration", "governance"],
      },
      domain: { type: "string", minLength: 1 },
      subclass: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  });
  const policyLimits = contractSchema("PolicyLimits", {
    type: "object",
    properties: Object.fromEntries([
      "maxGenerationDepth",
      "maxChildrenPerAgent",
      "maxWorkforceRoles",
      "maxRuntimeSeconds",
      "maxSteps",
      "maxToolCalls",
      "maxRecords",
    ].map((name) => [name, { type: "integer", minimum: 0 }])),
    additionalProperties: false,
  });
  const policyRequirements = contractSchema("PolicySafetyRequirements", {
    type: "object",
    properties: Object.fromEntries([
      "auditRequired",
      "outputRedactionRequired",
      "approvalRequired",
      "sandboxRequired",
      "detailedLoggingRequired",
    ].map((name) => [name, { type: "boolean" }])),
    additionalProperties: false,
  });
  const policyPermissions = contractSchema("PolicyPermissions", {
    type: "object",
    properties: Object.fromEntries([
      "canCreateChildren",
      "canWrite",
      "canSendExternalMessage",
      "canExecuteCode",
    ].map((name) => [name, { type: "boolean" }])),
    additionalProperties: false,
  });
  const policyMandatory = contractSchema("PolicyMandatoryRules", {
    type: "object",
    properties: {
      auditRequired: { type: "boolean" },
      credentialsExposedToAgent: {
        type: "boolean",
        enum: [false],
        description: "Credentials remain server-side; true is rejected by policy validation.",
      },
      crossTenantAccess: { type: "string", enum: ["allow", "deny"] },
      selfPolicyModification: { type: "string", enum: ["allow", "deny"] },
      gatewayBypass: { type: "string", enum: ["allow", "deny"] },
      permissionExpansion: { type: "string", enum: ["allow", "deny"] },
    },
    additionalProperties: false,
  });
  const policyResourceScope = contractSchema("PolicyResourceScope", {
    type: "object",
    properties: {
      allowedTenants: { type: "array", items: { type: "string" }, uniqueItems: true },
      allowedResourceSets: {
        type: "object",
        additionalProperties: { type: "array", items: { type: "string" }, uniqueItems: true },
      },
      resourceRanges: {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: { from: { type: "string" }, to: { type: "string" } },
          additionalProperties: false,
        },
      },
      deniedResources: { type: "array", items: { type: "string" }, uniqueItems: true },
      deniedOutputFields: { type: "array", items: { type: "string" }, uniqueItems: true },
    },
    additionalProperties: false,
  });
  const policyLayerContent = contractSchema("PolicyLayerContent", {
    type: "object",
    properties: {
      mandatory: { $ref: "#/components/schemas/PolicyMandatoryRules" },
      limits: { $ref: "#/components/schemas/PolicyLimits" },
      capabilityCeiling: { type: "array", items: safeToolNameSchema(), uniqueItems: true },
      toolRules: {
        type: "object",
        additionalProperties: { type: "string", enum: ["allow", "require_approval", "deny"] },
      },
      dataRules: { $ref: "#/components/schemas/PolicyResourceScope" },
      requirements: { $ref: "#/components/schemas/PolicySafetyRequirements" },
      permissions: { $ref: "#/components/schemas/PolicyPermissions" },
    },
    additionalProperties: false,
  });
  const generateRequest = contractSchema("GenerateGovernedAgentRequest", {
    type: "object",
    required: ["name", "task", "requestedTools", "ttlSeconds"],
    description: [
      "Public Agent generation request.",
      "tenantId, ownerUserId, createdBy, grantedTools, policyHash and status are server-derived and are not request fields.",
      "Any model classification is only a proposal; deterministic validation and policy compilation remain authoritative.",
    ].join(" "),
    properties: {
      name: { type: "string", minLength: 1, maxLength: 200 },
      task: { type: "string", minLength: 1, maxLength: 4000 },
      requestedTools: { type: "array", items: safeToolNameSchema(), uniqueItems: true },
      ttlSeconds: { type: "integer", minimum: 1, maximum: 2592000 },
      parentAgentId: { type: "string", pattern: AGENT_ID_PATTERN, nullable: true },
      classification: { $ref: "#/components/schemas/AgentClassification" },
      proposedTraits: { type: "array", items: { $ref: "#/components/schemas/AgentTrait" }, uniqueItems: true },
      proposedRiskLevel: { $ref: "#/components/schemas/RiskLevel" },
      instanceRules: { $ref: "#/components/schemas/PolicyLayerContent" },
      taskPolicyKeys: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    },
    additionalProperties: false,
    "x-server-derived-fields": ["tenantId", "ownerUserId", "createdBy", "grantedTools", "policyHash", "status"],
  });
  const generateResponse = contractSchema("GenerateGovernedAgentResponse", {
    type: "object",
    required: ["agentId", "status", "classification", "traits", "riskLevel", "addedTraits", "riskEscalated", "grantedTools", "policyHash", "expiresAt"],
    properties: {
      agentId: { $ref: "#/components/schemas/GovernedAgentId" },
      status: { $ref: "#/components/schemas/AgentStatus" },
      classification: { $ref: "#/components/schemas/AgentClassification" },
      traits: { type: "array", items: { $ref: "#/components/schemas/AgentTrait" } },
      riskLevel: { $ref: "#/components/schemas/RiskLevel" },
      addedTraits: { type: "array", items: { $ref: "#/components/schemas/AgentTrait" } },
      riskEscalated: { type: "boolean" },
      grantedTools: { type: "array", items: safeToolNameSchema() },
      policyHash: sha256Schema(),
      expiresAt: { type: "string", format: "date-time" },
    },
    additionalProperties: false,
  });
  const runRequest = contractSchema("RunGovernedAgentRequest", {
    type: "object",
    required: ["goal"],
    description: "Execution identity comes only from the canonical agentId path and authenticated enterprise principal.",
    properties: {
      goal: { type: "string", minLength: 1, maxLength: 4000 },
      maxIterations: { type: "integer", minimum: 1, maximum: 25, default: 8 },
      timeoutMs: { type: "integer", minimum: 1000, maximum: 120000, default: 60000 },
      maxTokensPerTurn: { type: "integer", minimum: 256, maximum: 8192, default: 2048 },
      toolMode: { type: "string", enum: ["readonly", "none"], default: "readonly" },
      toolAllowlist: { type: "array", items: safeToolNameSchema(), uniqueItems: true },
      providerId: { type: "string", minLength: 1 },
      modelId: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
    "x-server-derived-fields": ["agentId", "tenantId", "userId", "policyHash", "runId"],
  });
  const runResponse = contractSchema("GovernedAgentRunResponse", {
    type: "object",
    required: ["status", "goal", "finalAnswer", "iterations", "timing", "tools", "usage", "compaction", "provider", "sessionId", "governance"],
    properties: {
      status: { type: "string" },
      goal: { type: "string" },
      finalAnswer: { type: "string" },
      iterations: {
        type: "object",
        required: ["used", "max"],
        properties: { used: { type: "integer", minimum: 0 }, max: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
      timing: {
        type: "object",
        required: ["durationMs", "timeoutMs", "timedOut"],
        properties: {
          durationMs: { type: "number", minimum: 0 },
          timeoutMs: { type: "number", minimum: 0 },
          timedOut: { type: "boolean" },
        },
        additionalProperties: false,
      },
      tools: {
        type: "object",
        required: ["mode", "allowlist", "usage"],
        properties: {
          mode: { type: "string" },
          allowlist: { type: "array", items: { type: "string" } },
          usage: { type: "object", additionalProperties: true },
        },
        additionalProperties: false,
      },
      usage: { nullable: true },
      compaction: {
        type: "object",
        required: ["engine", "policy"],
        properties: {
          engine: { type: "string" },
          policy: {
            type: "object",
            required: ["maxContextTokens", "recentTurnsToKeep"],
            properties: {
              maxContextTokens: { type: "integer", minimum: 1 },
              recentTurnsToKeep: { type: "integer", minimum: 0 },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
      provider: {
        type: "object",
        required: ["id", "modelId"],
        properties: { id: { type: "string" }, modelId: { type: "string", nullable: true } },
        additionalProperties: false,
      },
      sessionId: { type: "string", nullable: true },
      governance: {
        type: "object",
        required: ["enforced"],
        properties: {
          enforced: { type: "boolean" },
          agentId: { $ref: "#/components/schemas/GovernedAgentId" },
          runId: { type: "string" },
          policyHash: sha256Schema(),
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  });
  const agentRecord = contractSchema("AgentRegistryRecord", {
    type: "object",
    required: ["agentId", "name", "purpose", "tenantId", "ownerUserId", "createdBy", "parentAgentId", "generationDepth", "classification", "traits", "riskLevel", "requestedTools", "grantedTools", "policyHash", "status", "createdAt", "expiresAt"],
    properties: {
      agentId: { $ref: "#/components/schemas/GovernedAgentId" },
      name: { type: "string" },
      purpose: { type: "string" },
      tenantId: { type: "string" },
      ownerUserId: { type: "string" },
      createdBy: { type: "string" },
      parentAgentId: { type: "string", pattern: AGENT_ID_PATTERN, nullable: true },
      generationDepth: { type: "integer", minimum: 0 },
      classification: { $ref: "#/components/schemas/AgentClassification" },
      traits: { type: "array", items: { $ref: "#/components/schemas/AgentTrait" } },
      riskLevel: { $ref: "#/components/schemas/RiskLevel" },
      requestedTools: { type: "array", items: safeToolNameSchema() },
      grantedTools: { type: "array", items: safeToolNameSchema() },
      policyHash: sha256Schema(),
      status: { $ref: "#/components/schemas/AgentStatus" },
      createdAt: { type: "string", format: "date-time" },
      expiresAt: { type: "string", format: "date-time" },
      revokedAt: { type: "string", format: "date-time" },
    },
    additionalProperties: false,
  });
  const approvalRecord = contractSchema("AgentToolApprovalRecord", {
    type: "object",
    required: ["id", "agentId", "toolName", "argumentsHash", "status", "requestedAt", "expiresAt", "review"],
    description: "Operator-safe approval view. Raw tool arguments, transport credentials and secrets are never returned.",
    properties: {
      id: { type: "string", pattern: APPROVAL_ID_PATTERN },
      agentId: { $ref: "#/components/schemas/GovernedAgentId" },
      toolName: safeToolNameSchema(),
      argumentsHash: sha256Schema(),
      status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CONSUMED"] },
      requestedAt: { type: "string", format: "date-time" },
      expiresAt: { type: "string", format: "date-time" },
      review: {
        type: "object",
        required: ["schemaVersion", "reviewable", "effectType", "policyHash"],
        description: "Bounded allowlisted review material; never raw credentials or an unsealed execution payload.",
        properties: {
          schemaVersion: { type: "integer", enum: [1] },
          reviewable: { type: "boolean" },
          effectType: { type: "string" },
          policyHash: sha256Schema(),
          unavailableReason: { type: "string" },
        },
        additionalProperties: true,
      },
      decidedAt: { type: "string", format: "date-time" },
      decidedBy: { type: "string" },
      consumedAt: { type: "string", format: "date-time" },
      consumedByExecutionId: { type: "string" },
    },
    additionalProperties: false,
  });
  const policyRecord = contractSchema("PolicyRecord", {
    type: "object",
    required: ["policyKey", "version", "policyType", "scopeKey", "content", "contentHash", "status", "createdAt"],
    properties: {
      policyKey: { type: "string", minLength: 1 },
      version: { type: "integer", minimum: 1 },
      policyType: { type: "string", enum: POLICY_TYPES },
      scopeKey: { type: "string", minLength: 1 },
      content: { $ref: "#/components/schemas/PolicyLayerContent" },
      contentHash: sha256Schema(),
      status: { type: "string", enum: ["draft", "active", "superseded"] },
      createdAt: { type: "string", format: "date-time" },
      activatedAt: { type: "string", format: "date-time" },
      supersededAt: { type: "string", format: "date-time" },
    },
    additionalProperties: false,
  });
  const auditEvent = contractSchema("AgentGovernanceAuditEvent", {
    type: "object",
    required: ["eventType", "timestamp"],
    description: "Redacted Agent governance audit event. Raw tool arguments are never returned.",
    properties: {
      id: { type: "string" },
      eventType: {
        type: "string",
        enum: [
          "AUDIT_CHECKPOINT", "AGENT_DRAFT_CREATED", "AGENT_CLASSIFIED", "POLICY_VALIDATED", "POLICY_REJECTED",
          "AGENT_ACTIVATED", "AGENT_RUN_STARTED", "TOOL_REQUESTED", "TOOL_ALLOWED", "TOOL_DENIED",
          "TOOL_COMPLETED", "TOOL_FAILED", "APPROVAL_REQUESTED", "APPROVAL_APPROVED", "APPROVAL_CONSUMED",
          "APPROVAL_REJECTED", "AGENT_EXPIRED", "AGENT_REVOKED", "POLICY_RECOMPILED", "POLICY_SIGNATURE_FAILED",
        ],
      },
      requestId: { type: "string" },
      agentId: { type: "string", pattern: AGENT_ID_PATTERN },
      parentAgentId: { type: "string", pattern: AGENT_ID_PATTERN, nullable: true },
      tenantId: { type: "string" },
      toolName: { type: "string" },
      decision: { type: "string", enum: ["allow", "require_approval", "deny"] },
      argumentsRedacted: { type: "boolean" },
      resultStatus: { type: "string", enum: ["success", "error", "denied", "pending"] },
      reason: { type: "string" },
      policyHash: sha256Schema(),
      previousPolicyHash: sha256Schema(),
      timestamp: { type: "string", format: "date-time" },
      checkpoint: { type: "object", additionalProperties: true },
      metadata: { type: "object", additionalProperties: true },
    },
    additionalProperties: false,
  });

  return {
    ResponseMetadata: responseMetadata,
    GovernedAgentId: contractSchema("AgentRegistryRecord.agentId", { type: "string", pattern: AGENT_ID_PATTERN }),
    AgentTrait: contractSchema("AgentTrait", { type: "string", enum: AGENT_TRAITS }),
    RiskLevel: contractSchema("RiskLevel", { type: "string", enum: ["low", "medium", "high", "critical"] }),
    AgentStatus: contractSchema("AgentStatus", { type: "string", enum: ["DRAFT", "VALIDATED", "ACTIVE", "COMPLETED", "EXPIRED", "REVOKED", "FAILED", "ARCHIVED"] }),
    AgentClassification: agentClassification,
    PolicyLimits: policyLimits,
    PolicySafetyRequirements: policyRequirements,
    PolicyPermissions: policyPermissions,
    PolicyMandatoryRules: policyMandatory,
    PolicyResourceScope: policyResourceScope,
    PolicyLayerContent: policyLayerContent,
    GenerateGovernedAgentRequest: generateRequest,
    GenerateGovernedAgentResponse: generateResponse,
    RunGovernedAgentRequest: runRequest,
    GovernedAgentRunResponse: runResponse,
    RevokeGovernedAgentRequest: contractSchema("RevokeGovernedAgentRequest", {
      type: "object",
      properties: { reason: { type: "string" }, cascade: { type: "boolean", default: true } },
      additionalProperties: false,
      "x-server-derived-fields": ["agentId"],
    }),
    CreateGovernancePolicyRequest: contractSchema("CreateGovernancePolicyRequest", {
      type: "object",
      required: ["policyKey", "version", "policyType", "scopeKey", "content"],
      properties: {
        policyKey: { type: "string", minLength: 1 },
        version: { type: "integer", minimum: 1, maximum: 999999999 },
        policyType: { type: "string", enum: POLICY_TYPES },
        scopeKey: { type: "string", minLength: 1 },
        content: { $ref: "#/components/schemas/PolicyLayerContent" },
      },
      additionalProperties: false,
      description: "Creates one immutable policy version. Activation is a separate operator action.",
    }),
    AgentRegistryRecord: agentRecord,
    AgentToolApprovalRecord: approvalRecord,
    PolicyRecord: policyRecord,
    AgentGovernanceAuditEvent: auditEvent,
    GovernanceErrorEnvelope: contractSchema("ResultEnvelope", {
      type: "object",
      required: ["status", "error"],
      properties: {
        status: { type: "string", enum: ["error"] },
        error: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            category: {
              type: "string",
              enum: [
                "validation", "authentication", "authorization", "rate_limit", "provider",
                "routing", "governance", "knowledge", "network", "timeout", "internal",
              ],
            },
            retryable: { type: "boolean" },
            details: { type: "object", additionalProperties: true },
          },
          additionalProperties: false,
        },
        meta: { $ref: "#/components/schemas/ResponseMetadata" },
      },
      additionalProperties: false,
    }),
    GenerateGovernedAgentResult: successEnvelopeSchema("GenerateGovernedAgentResult", { $ref: "#/components/schemas/GenerateGovernedAgentResponse" }),
    GovernedAgentListResult: successEnvelopeSchema("GovernedAgentListResult", objectData("agents", { type: "array", items: { $ref: "#/components/schemas/AgentRegistryRecord" } })),
    GovernedAgentDescribeResult: successEnvelopeSchema("GovernedAgentDescribeResult", objectData("agent", { $ref: "#/components/schemas/AgentRegistryRecord" })),
    GovernedAgentPolicyResult: successEnvelopeSchema("GovernedAgentPolicyResult", objectData("effectivePolicy", {
      type: "object",
      description: "Redacted Agent-facing policy view; lineage and resource-scope internals are omitted.",
      additionalProperties: true,
    })),
    GovernedAgentAuditResult: successEnvelopeSchema("GovernedAgentAuditResult", objectData("events", { type: "array", items: { $ref: "#/components/schemas/AgentGovernanceAuditEvent" } })),
    GovernedAgentRunResult: successEnvelopeSchema("GovernedAgentRunResult", { $ref: "#/components/schemas/GovernedAgentRunResponse" }),
    RevokeGovernedAgentResult: successEnvelopeSchema("RevokeGovernedAgentResult", objectData("revoked", { type: "array", items: { $ref: "#/components/schemas/GovernedAgentId" } })),
    GovernedApprovalListResult: successEnvelopeSchema("GovernedApprovalListResult", objectData("approvals", { type: "array", items: { $ref: "#/components/schemas/AgentToolApprovalRecord" } })),
    GovernedApprovalDecisionResult: successEnvelopeSchema("GovernedApprovalDecisionResult", objectData("approval", { $ref: "#/components/schemas/AgentToolApprovalRecord" })),
    GovernancePolicyListResult: successEnvelopeSchema("GovernancePolicyListResult", objectData("policies", { type: "array", items: { $ref: "#/components/schemas/PolicyRecord" } })),
    CreateGovernancePolicyResult: successEnvelopeSchema("CreateGovernancePolicyResult", objectData("policy", { $ref: "#/components/schemas/PolicyRecord" })),
    ActivateGovernancePolicyResult: successEnvelopeSchema("ActivateGovernancePolicyResult", {
      type: "object",
      required: ["policy", "affected"],
      properties: {
        policy: { $ref: "#/components/schemas/PolicyRecord" },
        affected: {
          type: "array",
          items: {
            type: "object",
            required: ["agentId", "previousPolicyHash", "policyHash", "clamped"],
            properties: {
              agentId: { $ref: "#/components/schemas/GovernedAgentId" },
              previousPolicyHash: sha256Schema(),
              policyHash: sha256Schema(),
              clamped: { type: "integer", minimum: 0 },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    }),
    AgentGovernanceStatsResult: successEnvelopeSchema("AgentGovernanceStatsResult", objectData("stats", { type: "object", additionalProperties: true })),
  };
}

function createAgentGovernancePaths() {
  const agentPath = [{ $ref: "#/components/parameters/GovernedAgentId" }];
  const approvalPath = [{ $ref: "#/components/parameters/ApprovalId" }];
  return {
    "/v1/agents/generate": {
      post: governanceOperation({
        summary: "Generate a governed Agent",
        operationId: "generateGovernedAgent",
        permission: "workflow:run",
        description: [
          "Creates a tenant- and owner-bound Agent from a public draft.",
          "Model output can propose classification only; the gateway deterministically validates traits, parent/creator ceilings, TTL and effective policy before activation.",
        ].join(" "),
        requestSchema: "GenerateGovernedAgentRequest",
        responseSchema: "GenerateGovernedAgentResult",
        mutation: true,
      }),
    },
    "/v1/agents": {
      get: governanceOperation({
        summary: "List tenant Agents",
        operationId: "listGovernedAgents",
        permission: "dashboard:read",
        description: "Returns only Registry records bound to the authenticated tenant.",
        responseSchema: "GovernedAgentListResult",
      }),
    },
    "/v1/agents/{agentId}": {
      get: governanceOperation({
        summary: "Describe a governed Agent",
        operationId: "describeGovernedAgent",
        permission: "dashboard:read",
        description: "Returns a tenant-scoped Registry record for the server-issued Agent path identity.",
        responseSchema: "GovernedAgentDescribeResult",
        pathParameters: agentPath,
        notFound: true,
      }),
    },
    "/v1/agents/{agentId}/effective-policy": {
      get: governanceOperation({
        summary: "Read the Agent-facing effective policy",
        operationId: "getGovernedAgentEffectivePolicy",
        permission: "dashboard:read",
        description: "Returns a tenant-scoped, redacted policy view. Internal lineage and resource-scope details are not exposed.",
        responseSchema: "GovernedAgentPolicyResult",
        pathParameters: agentPath,
        notFound: true,
      }),
    },
    "/v1/agents/{agentId}/run": {
      post: governanceOperation({
        summary: "Run a governed Agent",
        operationId: "runGovernedAgent",
        permission: "workflow:run",
        description: [
          "Executes only after the path Agent is bound to the authenticated tenant and owner (or an explicit agent:run:any delegation).",
          "The request cannot supply Agent identity, policy authority, credentials or working-directory authority.",
        ].join(" "),
        requestSchema: "RunGovernedAgentRequest",
        responseSchema: "GovernedAgentRunResult",
        pathParameters: agentPath,
        notFound: true,
        conflict: true,
        mutation: true,
        extra: { "x-agent-owner-or-delegation-required": true },
      }),
    },
    "/v1/agents/{agentId}/revoke": {
      post: governanceOperation({
        summary: "Revoke a governed Agent",
        operationId: "revokeGovernedAgent",
        permission: "workflow:approve",
        description: "Revokes the path-bound Agent and, by default, its descendants. The path identity cannot be replaced by JSON input.",
        requestSchema: "RevokeGovernedAgentRequest",
        responseSchema: "RevokeGovernedAgentResult",
        pathParameters: agentPath,
        notFound: true,
        conflict: true,
        mutation: true,
      }),
    },
    "/v1/agents/{agentId}/audit": {
      get: governanceOperation({
        summary: "Read the Agent audit trail",
        operationId: "readGovernedAgentAudit",
        permission: "audit:read",
        description: "Returns at most the bounded tenant-scoped audit view with tool arguments omitted or redacted.",
        responseSchema: "GovernedAgentAuditResult",
        pathParameters: agentPath,
        notFound: true,
      }),
    },
    "/v1/approvals": {
      get: governanceOperation({
        summary: "List pending Agent approvals",
        operationId: "listGovernedApprovals",
        permission: "dashboard:read",
        description: "Returns only pending approvals owned by Agents in the authenticated tenant. Raw sealed arguments and credentials are never returned.",
        responseSchema: "GovernedApprovalListResult",
        queryParameters: [{
          name: "agentId",
          in: "query",
          required: false,
          description: "Optional server-issued Agent filter.",
          schema: { type: "string", pattern: AGENT_ID_PATTERN },
        }],
      }),
    },
    "/v1/approvals/{approvalId}/approve": {
      post: governanceOperation({
        summary: "Approve sealed Agent tool arguments once",
        operationId: "approveGovernedAgentToolCall",
        permission: "workflow:approve",
        description: "Approves exactly the operator-reviewed, hash-locked arguments for one later consumption. No replacement arguments are accepted here.",
        responseSchema: "GovernedApprovalDecisionResult",
        pathParameters: approvalPath,
        notFound: true,
        conflict: true,
        mutation: true,
      }),
    },
    "/v1/approvals/{approvalId}/reject": {
      post: governanceOperation({
        summary: "Reject sealed Agent tool arguments",
        operationId: "rejectGovernedAgentToolCall",
        permission: "workflow:approve",
        description: "Rejects the tenant-scoped approval identified by the path. The sealed arguments cannot be replaced by this request.",
        responseSchema: "GovernedApprovalDecisionResult",
        pathParameters: approvalPath,
        notFound: true,
        conflict: true,
        mutation: true,
      }),
    },
    "/v1/policies": {
      post: governanceOperation({
        summary: "Create an immutable governance policy version",
        operationId: "createGovernancePolicyVersion",
        permission: "user:admin",
        description: "Creates a draft policy version under the configured platform tenant. Creation does not activate or expand an Agent policy.",
        requestSchema: "CreateGovernancePolicyRequest",
        responseSchema: "CreateGovernancePolicyResult",
        conflict: true,
        mutation: true,
        platformTenant: true,
      }),
      get: governanceOperation({
        summary: "List governance policy versions",
        operationId: "listGovernancePolicyVersions",
        permission: "audit:read",
        description: "Returns the authorized global policy catalog without HMAC secrets or recovery state.",
        responseSchema: "GovernancePolicyListResult",
        platformTenant: true,
        extra: { "x-agent-governance-scope": "global-catalog-read" },
      }),
    },
    "/v1/policies/{policyKey}/{version}/activate": {
      post: governanceOperation({
        summary: "Activate a governance policy version",
        operationId: "activateGovernancePolicyVersion",
        permission: "user:admin",
        description: "Activates the immutable path-bound version and recompiles affected active Agents with no-expansion clamping. The path key/version are authoritative.",
        responseSchema: "ActivateGovernancePolicyResult",
        pathParameters: [
          { $ref: "#/components/parameters/PolicyKey" },
          { $ref: "#/components/parameters/PolicyVersion" },
        ],
        notFound: true,
        conflict: true,
        mutation: true,
        platformTenant: true,
      }),
    },
    "/v1/governance/stats": {
      get: governanceOperation({
        summary: "Read Agent Governance aggregate statistics",
        operationId: "getAgentGovernanceStats",
        permission: "dashboard:read",
        description: "Returns authorized non-secret control-plane counts; it does not include Agent records, policy bodies, approval arguments or key material.",
        responseSchema: "AgentGovernanceStatsResult",
        platformTenant: true,
        extra: { "x-agent-governance-scope": "control-plane-summary" },
      }),
    },
  };
}

function governanceOperation({
  summary,
  operationId,
  permission,
  description,
  responseSchema,
  requestSchema,
  pathParameters = [],
  queryParameters = [],
  notFound = false,
  conflict = false,
  mutation = false,
  platformTenant = false,
  extra = {},
}) {
  const responses = {
    "200": {
      description: "Successful shared ResultEnvelope response.",
      content: { "application/json": { schema: { $ref: `#/components/schemas/${responseSchema}` } } },
    },
    "400": { $ref: "#/components/responses/GovernanceBadRequest" },
    "401": { $ref: "#/components/responses/GovernanceUnauthorized" },
    "403": { $ref: "#/components/responses/GovernanceForbidden" },
    "429": { $ref: "#/components/responses/GovernanceRateLimited" },
    "500": { $ref: "#/components/responses/GovernanceInternalFailure" },
    "503": { $ref: "#/components/responses/GovernanceUnavailable" },
  };
  if (notFound) responses["404"] = { $ref: "#/components/responses/GovernanceNotFound" };
  if (conflict) responses["409"] = { $ref: "#/components/responses/GovernanceConflict" };
  const operation = {
    tags: [AGENT_GOVERNANCE_TAG],
    summary,
    description,
    operationId,
    security: [{ bearerAuth: [] }],
    parameters: [
      { $ref: "#/components/parameters/EnterpriseTenantHeader" },
      ...pathParameters,
      ...queryParameters,
    ],
    responses,
    "x-required-permission": permission,
    "x-server-derived-identity": ["tenantId", "userId"],
    "x-agent-governance-mutation": mutation,
    ...(platformTenant ? { "x-platform-tenant-required": true } : {}),
    ...extra,
  };
  if (requestSchema) {
    operation.requestBody = {
      required: true,
      description: "JSON contract. Identity and authority-bearing fields are server-derived.",
      content: { "application/json": { schema: { $ref: `#/components/schemas/${requestSchema}` } } },
    };
  }
  return operation;
}

function contractSchema(name, schema) {
  return { ...schema, "x-shared-contract": name };
}

function successEnvelopeSchema(contractName, dataSchema) {
  return contractSchema(contractName, {
    type: "object",
    required: ["status", "data"],
    properties: {
      status: { type: "string", enum: ["ok"] },
      data: dataSchema,
      meta: { $ref: "#/components/schemas/ResponseMetadata" },
    },
    additionalProperties: false,
  });
}

function objectData(propertyName, propertySchema) {
  return {
    type: "object",
    required: [propertyName],
    properties: { [propertyName]: propertySchema },
    additionalProperties: false,
  };
}

function safeToolNameSchema() {
  return {
    type: "string",
    minLength: 1,
    maxLength: 256,
    description: "Trimmed registered tool name; JavaScript Object.prototype property names are reserved.",
  };
}

function sha256Schema() {
  return { type: "string", pattern: "^sha256:[a-f0-9]{64}$" };
}
