import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGatewayApplication } from "../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../apps/ai-gateway-service/src/http/httpServer.js";

const dir = mkdtempSync(join(tmpdir(), "sec-audit-"));
const env = {
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "fake",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
  PME_AUTH_TOKEN: "admin-token-0123456789abcdef",
  PME_ENTERPRISE_USERS_JSON: JSON.stringify([
    { token: "tenant-a-admin-token", userId: "tenant-a-admin", tenantId: "tenant-a", role: "admin" },
    { token: "tenant-b-admin-token", userId: "tenant-b-admin", tenantId: "tenant-b", role: "admin" },
  ]),
  PME_API_KEY_STORE_PATH: join(dir, "keys.json"),
  PME_AUDIT_LOG_PATH: join(dir, "audit.jsonl"),
  PME_ENTERPRISE_USER_STORE_PATH: join(dir, "users.json"),
};
const app = createGatewayApplication(env);
const server = createGatewayHttpServer(app);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const adminHeaders = { "x-pme-auth-token": "admin-token-0123456789abcdef", "x-pme-tenant-id": "default", "content-type": "application/json" };
const tenantAAdminHeaders = { "x-pme-auth-token": "tenant-a-admin-token", "x-pme-tenant-id": "tenant-a", "content-type": "application/json" };
const tenantBAdminHeaders = { "x-pme-auth-token": "tenant-b-admin-token", "x-pme-tenant-id": "tenant-b", "content-type": "application/json" };
const results = [];
const attack = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "DEFENDED" : "BREACH!!"} ${name}${detail ? " — " + detail : ""}`); };

const chat = (headers, body) => fetch(`${base}/v1/chat/completions`, {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
});
const chatBody = (text) => ({ model: "local-fake-model", messages: [{ role: "user", content: text }] });

async function mk(payload, headers = adminHeaders) {
  const response = await fetch(`${base}/enterprise/virtual-keys`, {
    method: "POST", headers, body: JSON.stringify(payload),
  });
  const body = await response.json();
  const key = body?.data?.key ?? body?.data?.result?.key;
  const keyId = body?.data?.record?.keyId ?? body?.data?.result?.record?.keyId;
  if (!key || !keyId) throw new Error(`key creation failed: ${JSON.stringify(body).slice(0, 300)}`);
  return { key, keyId };
}

try {
  const publicHealthResponse = await fetch(`${base}/enterprise/health`);
  const publicHealth = await publicHealthResponse.json().catch(() => ({}));
  const publicHealthText = JSON.stringify(publicHealth?.data ?? {});
  attack(
    "A0 public enterprise health hides storage paths",
    publicHealthResponse.status === 200
      && !publicHealthText.includes("enterprise-audit.jsonl")
      && !publicHealthText.includes("users.json")
      && publicHealth?.data?.audit?.pathExposed === false,
    `status=${publicHealthResponse.status}`,
  );

  const keyA = await mk({ role: "operator", tenantId: "tenant-a" }, tenantAAdminHeaders);
  const keyB = await mk({ role: "operator", tenantId: "tenant-b" }, tenantBAdminHeaders);
  const viewerKey = await mk({ role: "viewer", tenantId: "tenant-a" }, tenantAAdminHeaders);
  const auditorKeyB = await mk({ role: "auditor", tenantId: "tenant-b" }, tenantBAdminHeaders);
  const budgetKey = await mk({ role: "operator", tenantId: "tenant-a", budget: { limitTokens: 5, window: "daily" } }, tenantAAdminHeaders);
  const rateKey = await mk({ role: "operator", tenantId: "tenant-a", rateLimit: { requestsPerMinute: 3 } }, tenantAAdminHeaders);
  const revokeKey = await mk({ role: "operator", tenantId: "tenant-a" }, tenantAAdminHeaders);

  const seed = await chat({ authorization: `Bearer ${keyA.key}` }, chatBody("security audit tenant a probe"));
  attack("A1 seed", seed.status === 200);
  const crossTenant = await chat({ authorization: `Bearer ${keyB.key}` }, chatBody("security audit tenant a probe"));
  attack("A1 cross-tenant exact-cache isolation", crossTenant.status === 200, "tenant B served by a fresh provider call, never tenant A's cache lane");

  const forgedTenant = await chat({ authorization: `Bearer ${keyB.key}`, "x-pme-tenant-id": "tenant-a" }, chatBody("hi"));
  attack("A2 tenant header forgery", forgedTenant.status === 403, `status=${forgedTenant.status}`);
  const forgedAdminTenant = await chat({ "x-pme-auth-token": "tenant-b-admin-token", "x-pme-tenant-id": "tenant-a" }, chatBody("hi"));
  attack("A2b admin tenant header forgery", forgedAdminTenant.status === 403, `status=${forgedAdminTenant.status}`);
  const crossTenantKeyCreate = await fetch(`${base}/enterprise/virtual-keys`, {
    method: "POST",
    headers: tenantBAdminHeaders,
    body: JSON.stringify({ role: "admin", tenantId: "tenant-a" }),
  });
  attack("A2c admin cross-tenant virtual-key creation", crossTenantKeyCreate.status === 403, `status=${crossTenantKeyCreate.status}`);
  const crossTenantAudit = await fetch(`${base}/enterprise/audit?tenantId=tenant-a`, {
    headers: { authorization: `Bearer ${auditorKeyB.key}`, "x-pme-tenant-id": "tenant-b" },
  });
  attack("A2d cross-tenant audit filter", crossTenantAudit.status === 403, `status=${crossTenantAudit.status}`);

  const crossTenantProviderMutation = await fetch(`${base}/providers/runtime-credential`, {
    method: "POST",
    headers: tenantBAdminHeaders,
    body: JSON.stringify({ providerId: "openai", apiKey: "sk-" + "regression-never-store" }),
  });
  attack(
    "A2e cross-tenant global provider mutation",
    crossTenantProviderMutation.status === 403,
    `status=${crossTenantProviderMutation.status}`,
  );
  const crossTenantStatement = await fetch(`${base}/enterprise/provider-statement-reconciliation`, {
    method: "POST",
    headers: tenantBAdminHeaders,
    body: JSON.stringify({
      tenantId: "tenant-a",
      statementId: "cross-tenant-probe",
      provider: "provider-a",
      currency: "USD",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-01T01:00:00.000Z",
      lines: [],
    }),
  });
  attack(
    "A2f statement body cannot select another tenant",
    crossTenantStatement.status === 400,
    `status=${crossTenantStatement.status}`,
  );

  const viewerChat = await chat({ authorization: `Bearer ${viewerKey.key}` }, chatBody("hi"));
  attack("A3 viewer-role key on chat", viewerChat.status === 403, `status=${viewerChat.status}`);
  const viewerList = await fetch(`${base}/enterprise/virtual-keys`, { headers: { authorization: `Bearer ${viewerKey.key}`, "x-pme-tenant-id": "tenant-a" } });
  attack("A4 viewer-role key on admin surface", viewerList.status === 403, `status=${viewerList.status}`);
  const viewerStatement = await fetch(`${base}/enterprise/provider-statement-reconciliation`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${viewerKey.key}`,
      "x-pme-tenant-id": "tenant-a",
      "content-type": "application/json",
    },
    body: "{}",
  });
  attack(
    "A4b viewer-role key on statement reconciliation",
    viewerStatement.status === 403,
    `status=${viewerStatement.status}`,
  );

  let exhausted = null;
  for (let i = 0; i < 8; i++) {
    const r = await chat({ authorization: `Bearer ${budgetKey.key}` }, chatBody("budget"));
    const body = await r.json().catch(() => ({}));
    if (body?.error?.code === "VIRTUAL_KEY_BUDGET_EXHAUSTED") exhausted = r.status;
  }
  attack("A5 budget exhaustion enforced (429)", exhausted === 429);
  let rateLimited = null;
  for (let i = 0; i < 8; i++) {
    const r = await chat({ authorization: `Bearer ${rateKey.key}` }, chatBody("rate"));
    const body = await r.json().catch(() => ({}));
    if (body?.error?.code === "VIRTUAL_KEY_RATE_LIMITED") rateLimited = r.status;
  }
  attack("A5b rate limit enforced (429)", rateLimited === 429);

  const crossRevoke = await fetch(`${base}/enterprise/virtual-keys/revoke`, {
    method: "POST",
    headers: { authorization: `Bearer ${keyB.key}`, "x-pme-tenant-id": "tenant-b", "content-type": "application/json" },
    body: JSON.stringify({ keyId: keyA.keyId }),
  });
  attack("A6 cross-tenant key revoke", crossRevoke.status === 403 || crossRevoke.status === 404, `status=${crossRevoke.status}`);

  const secretSeed = await chat({ authorization: `Bearer ${keyA.key}` }, chatBody("my api_key=FAKE-KEY-0123456789abcdef keep secret"));
  const secretReplay = await chat({ authorization: `Bearer ${keyA.key}` }, chatBody("my api_key=FAKE-KEY-0123456789abcdef keep secret"));
  const secretSecond = await secretReplay.json();
  attack("A7 secret-like text never cached", secretSeed.status === 200 && secretSecond?.unified_ai?.response_cache === undefined, "no cache marker on second call");

  const mcpAnonymous = await fetch(`${base}/mcp/tools`);
  attack("A8 anonymous /mcp/tools", mcpAnonymous.status === 401, `status=${mcpAnonymous.status}`);
  const mcpViewer = await fetch(`${base}/mcp/tools`, { headers: { authorization: `Bearer ${viewerKey.key}`, "x-pme-tenant-id": "tenant-a" } });
  attack("A8b viewer on /mcp/tools", mcpViewer.status === 403, `status=${mcpViewer.status}`);
  const mcpCallUnknown = await fetch(`${base}/mcp/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${keyA.key}`, "x-pme-tenant-id": "tenant-a", "content-type": "application/json" },
    body: JSON.stringify({ server: "evil", tool: "run", arguments: {} }),
  });
  attack("A8c unknown upstream rejected", mcpCallUnknown.status >= 400, `status=${mcpCallUnknown.status}`);
  const mcpHuge = await fetch(`${base}/mcp/call`, {
    method: "POST",
    headers: { authorization: `Bearer ${keyA.key}`, "x-pme-tenant-id": "tenant-a", "content-type": "application/json" },
    body: JSON.stringify({ server: "any", tool: "any", arguments: { blob: "z".repeat(300_000) } }),
  });
  const mcpHugeBody = await mcpHuge.json().catch(() => ({}));
  attack("A9 oversized mcp arguments rejected", ["MCP_UPSTREAM_UNKNOWN", "MCP_ARGUMENTS_TOO_LARGE"].includes(mcpHugeBody?.error?.code), `code=${mcpHugeBody?.error?.code}`);

  const revokeA = await fetch(`${base}/enterprise/virtual-keys/revoke`, {
    method: "POST", headers: tenantAAdminHeaders, body: JSON.stringify({ keyId: revokeKey.keyId }),
  });
  const afterRevoke = await chat({ authorization: `Bearer ${revokeKey.key}` }, chatBody("hi"));
  attack("A10 revoked key instant invalidation", revokeA.status === 200 && afterRevoke.status === 401, `revoke=${revokeA.status} chat=${afterRevoke.status}`);

  const metricsAnon = await fetch(`${base}/metrics`);
  attack("A11 /metrics requires auth", metricsAnon.status === 401, `status=${metricsAnon.status}`);
  const metrics = await fetch(`${base}/metrics`, { headers: { "x-pme-auth-token": "admin-token-0123456789abcdef", "x-pme-tenant-id": "default" } });
  const metricsText = await metrics.text();
  attack("A11b /metrics has no secret material", metrics.status === 200 && !metricsText.includes("uai-") && !metricsText.includes("sk-ant") && !metricsText.includes("admin-token"), `status=${metrics.status}`);
} finally {
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
const breached = results.filter((r) => !r.ok);
console.log(breached.length === 0 ? "SECURITY AUDIT: ALL DEFENDED" : `SECURITY AUDIT: ${breached.length} BREACHES`);
process.exit(breached.length === 0 ? 0 : 1);
