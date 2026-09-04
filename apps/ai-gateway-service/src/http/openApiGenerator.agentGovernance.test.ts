// @test-isolation process
import { describe, expect, it } from "vitest";
import { generateOpenApiSpec } from "./openApiGenerator.js";

type OpenApiDocument = Record<string, unknown> & {
  paths: Record<string, Record<string, Record<string, any>>>;
  components: { schemas: Record<string, Record<string, any>> };
};

function generateSpec(routeModules: Map<unknown, unknown>[] = []): OpenApiDocument {
  return generateOpenApiSpec(routeModules) as unknown as OpenApiDocument;
}

const CANONICAL_OPERATIONS = new Map([
  ["POST /v1/agents/generate", "workflow:run"],
  ["GET /v1/agents", "dashboard:read"],
  ["GET /v1/agents/{agentId}", "dashboard:read"],
  ["GET /v1/agents/{agentId}/effective-policy", "dashboard:read"],
  ["POST /v1/agents/{agentId}/run", "workflow:run"],
  ["POST /v1/agents/{agentId}/revoke", "workflow:approve"],
  ["GET /v1/agents/{agentId}/audit", "audit:read"],
  ["GET /v1/approvals", "dashboard:read"],
  ["POST /v1/approvals/{approvalId}/approve", "workflow:approve"],
  ["POST /v1/approvals/{approvalId}/reject", "workflow:approve"],
  ["POST /v1/policies", "user:admin"],
  ["GET /v1/policies", "audit:read"],
  ["POST /v1/policies/{policyKey}/{version}/activate", "user:admin"],
  ["GET /v1/governance/stats", "dashboard:read"],
]);

describe("Agent Governance OpenAPI surface", () => {
  it("publishes every canonical REST operation with auth, tenant binding and exact permissions", () => {
    const spec = generateSpec();

    for (const [route, permission] of CANONICAL_OPERATIONS) {
      const [method, path] = route.split(" ");
      const operation = spec.paths[path]?.[method.toLowerCase()];
      expect(operation, route).toBeDefined();
      expect(operation.security, route).toEqual([{ bearerAuth: [] }]);
      expect(operation["x-required-permission"], route).toBe(permission);
      expect(operation["x-server-derived-identity"], route).toEqual(["tenantId", "userId"]);
      expect(operation.parameters, route).toContainEqual({
        $ref: "#/components/parameters/EnterpriseTenantHeader",
      });
      expect(operation.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, route)
        .toMatch(/^#\/components\/schemas\/[A-Za-z0-9]+Result$/);
      expect(operation.responses?.["403"], route).toEqual({
        $ref: "#/components/responses/GovernanceForbidden",
      });
      expect(operation.responses?.["503"], route).toEqual({
        $ref: "#/components/responses/GovernanceUnavailable",
      });
    }

    expect(spec.paths["/v1/policies"].post["x-platform-tenant-required"]).toBe(true);
    expect(spec.paths["/v1/policies"].get["x-platform-tenant-required"]).toBe(true);
    expect(spec.paths["/v1/policies/{policyKey}/{version}/activate"].post["x-platform-tenant-required"])
      .toBe(true);
    expect(spec.paths["/v1/governance/stats"].get["x-platform-tenant-required"]).toBe(true);
    expect(spec.paths["/v1/agents/{agentId}/run"].post["x-agent-owner-or-delegation-required"])
      .toBe(true);
  });

  it("references the shared DTO contracts without accepting caller authority fields", () => {
    const spec = generateSpec();
    const schemas = spec.components.schemas;

    expect(spec.paths["/v1/agents/generate"].post.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/GenerateGovernedAgentRequest" });
    expect(spec.paths["/v1/agents/{agentId}/run"].post.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/RunGovernedAgentRequest" });
    expect(spec.paths["/v1/agents/{agentId}/revoke"].post.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/RevokeGovernedAgentRequest" });
    expect(spec.paths["/v1/policies"].post.requestBody.content["application/json"].schema)
      .toEqual({ $ref: "#/components/schemas/CreateGovernancePolicyRequest" });

    expect(schemas.GenerateGovernedAgentRequest["x-shared-contract"])
      .toBe("GenerateGovernedAgentRequest");
    expect(schemas.RunGovernedAgentRequest["x-shared-contract"]).toBe("RunGovernedAgentRequest");
    expect(schemas.GovernedAgentRunResponse.required).toContain("compaction");
    expect(schemas.GovernedAgentRunResponse.properties.compaction.additionalProperties).toBe(false);
    expect(schemas.CreateGovernancePolicyRequest["x-shared-contract"])
      .toBe("CreateGovernancePolicyRequest");
    expect(schemas.AgentToolApprovalRecord["x-shared-contract"]).toBe("AgentToolApprovalRecord");
    expect(schemas.AgentGovernanceAuditEvent["x-shared-contract"])
      .toBe("AgentGovernanceAuditEvent");

    expect(schemas.GenerateGovernedAgentRequest.additionalProperties).toBe(false);
    expect(schemas.GenerateGovernedAgentRequest.properties).not.toHaveProperty("tenantId");
    expect(schemas.GenerateGovernedAgentRequest.properties).not.toHaveProperty("ownerUserId");
    expect(schemas.GenerateGovernedAgentRequest["x-server-derived-fields"])
      .toContain("ownerUserId");
    expect(schemas.RunGovernedAgentRequest.properties).not.toHaveProperty("agentId");
    expect(schemas.RunGovernedAgentRequest.properties).not.toHaveProperty("policyHash");
    expect(schemas.AgentToolApprovalRecord.description).toContain("Raw tool arguments");
    expect(schemas.CreateGovernancePolicyRequest.properties.version.maximum).toBe(999_999_999);

    expect(spec.paths["/v1/approvals/{approvalId}/approve"].post).not.toHaveProperty("requestBody");
    expect(spec.paths["/v1/approvals/{approvalId}/reject"].post).not.toHaveProperty("requestBody");
    expect(spec.paths["/v1/policies/{policyKey}/{version}/activate"].post).not.toHaveProperty("requestBody");
  });

  it("does not advertise compatibility aliases or any internal Tool Proxy bypass", () => {
    const spec = generateSpec();
    const serialized = JSON.stringify(spec);

    expect(spec.paths).not.toHaveProperty("/internal/v1/tools/execute");
    expect(spec.paths).not.toHaveProperty("/agent-exec/run");
    expect(spec.paths).not.toHaveProperty("/v1/agents/list");
    expect(spec.paths).not.toHaveProperty("/v1/approvals/decide");
    expect(spec.paths).not.toHaveProperty("/v1/policies/create");
    expect(serialized).not.toContain("AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY");
    expect(serialized).not.toContain("secret.key");
  });

  it("emits only resolvable local component references", () => {
    const spec = generateSpec();
    const refs: string[] = [];
    collectReferences(spec, refs);

    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(resolveLocalReference(spec, ref), ref).toBeDefined();
    }
  });

  it("preserves generic route-module generation beside the canonical governance surface", () => {
    const handlers = new Map([
      ["GET /example/:exampleId", { description: "Example route", public: true }],
    ]);
    const spec = generateSpec([handlers]);

    expect(spec.paths["/example/{exampleId}"].get).toMatchObject({
      summary: "Example route",
      operationId: "GET__example__exampleId",
    });
    expect(spec.paths["/example/{exampleId}"].get).not.toHaveProperty("security");
    expect(spec.paths["/v1/agents/generate"].post.operationId).toBe("generateGovernedAgent");
  });
});

function collectReferences(value: unknown, refs: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, refs);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.$ref === "string") refs.push(record.$ref);
  for (const nested of Object.values(record)) collectReferences(nested, refs);
}

function resolveLocalReference(document: unknown, ref: string): unknown {
  if (!ref.startsWith("#/")) return undefined;
  return ref.slice(2).split("/").reduce<unknown>((current, segment) => (
    current && typeof current === "object"
      ? (current as Record<string, unknown>)[segment]
      : undefined
  ), document);
}
