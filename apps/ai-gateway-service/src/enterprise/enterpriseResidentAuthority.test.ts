import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";
import { bindVirtualKeyRequestAccounting, getVirtualKeyRequestAccounting } from "./virtualKeyRequestAccounting.ts";

type Service = ReturnType<typeof createEnterpriseGovernanceService>;
const resources: Array<{ root: string; services: Service[] }> = [];
afterEach(async () => {
  try {
    for (const resource of resources.splice(0).reverse()) {
      for (const service of resource.services) await service.close();
      expect(await realpath(resource.root)).toBe(resource.root); expect(dirname(resource.root)).toBe(await realpath(tmpdir()));
      await rm(resource.root, { recursive: true, force: false });
    }
  } finally { vi.restoreAllMocks(); }
});
const admin = { tenantId: "resident-tenant", userId: "fixture-admin", role: "admin", permissions: ["*"] };
const userToken = "resident-fixture-owner-token";
async function fixture(options: { badAudit?: boolean; env?: Record<string, string> } = {}) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "resident-authority-")), services: Service[] = [];
  resources.push({ root, services });
  const audit = join(root, "audit.jsonl"); if (options.badAudit) await mkdir(audit);
  const env = { NODE_ENV: "test", PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: "resident-fixture-admin-token", PME_AUTH_ROLE: "admin",
    PME_AUTH_USER_ID: admin.userId, PME_AUTH_TENANT_ID: admin.tenantId, PME_ENTERPRISE_PLATFORM_TENANT_ID: admin.tenantId,
    PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: audit, PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"), ...options.env };
  const create = (extra: Record<string, string> = {}) => { const service = createEnterpriseGovernanceService({ env: { ...env, ...extra } }); services.push(service); return service; };
  const service = create();
  const owner = { userId: "fixture-owner", tenantId: admin.tenantId, role: "operator", token: userToken,
    permissions: ["workflow:run", "chat:use", "dashboard:read"] };
  return { root, env, service, create, owner, addOwner: () => service.upsertUser(owner, admin) };
}
function authenticate(service: Service, token: string) {
  const request: any = { method: "POST", url: "/v1/agents/agt_fixture/tasks/original/run", headers: { authorization: "Bearer " + token }, socket: { remoteAddress: "127.0.0.1" } };
  const result = service.authorize(request, "workflow:run"); expect(result.allowed).toBe(true); request.enterpriseIdentity = result.identity;
  return request;
}

it("captures only an actually authenticated request and preserves a nonsecret original reference across service restart", async () => {
  const f = await fixture(); f.addOwner(); const request = authenticate(f.service, userToken);
  const ref = f.service.captureResidentAuthority(request);
  expect(ref).toEqual({ version: 1, kind: "configured-user", fingerprint: createHash("sha256").update(userToken).digest("hex").slice(0, 12), tenantId: admin.tenantId, userId: "fixture-owner" });
  expect(JSON.stringify(ref)).not.toContain(userToken); expect(Object.keys(ref)).toHaveLength(5);
  expect(() => f.service.captureResidentAuthority({ ...request })).toThrow();
  expect(() => f.service.captureResidentAuthority({ enterpriseIdentity: request.enterpriseIdentity })).toThrow();
  const first = f.service.authorizeResidentAuthority(ref); expect(first.identityHash).toMatch(/^sha256:[a-f0-9]{64}$/u); expect(first.accounting).toBeUndefined();
  await first.assertActive(); await f.service.close();
  const restarted = f.create(); expect(() => restarted.captureResidentAuthority(request)).toThrow();
  // The internal caller represents a separately authenticated signed original-task grant; JSON itself is not an admission proof.
  const current = restarted.authorizeResidentAuthority(JSON.parse(JSON.stringify(ref)));
  expect(current.identity).toEqual(first.identity); expect(current.identityHash).toBe(first.identityHash); await current.assertActive();
  await expect(first.assertActive()).rejects.toMatchObject({ code: "RESIDENT_AUTHORITY_UNAVAILABLE" });
});

it("does not carry a prior request brand after failed authentication or an effective actor/identity replacement", async () => {
  const f = await fixture(); f.addOwner(); const request = authenticate(f.service, userToken);
  for (const change of [{ actorAgentId: "agt_other" }, { managedClientId: "client_other" }, { userId: "other" }, { role: "admin", permissions: ["*"] }]) {
    const original = request.enterpriseIdentity; request.enterpriseIdentity = { ...original, ...change };
    expect(() => f.service.captureResidentAuthority(request)).toThrow(); request.enterpriseIdentity = original;
  }
  request.headers.authorization = "Bearer unrecognized-fixture-token";
  expect(f.service.authenticate(request).authenticated).toBe(false); expect(() => f.service.captureResidentAuthority(request)).toThrow();
});

it("refuses local-preview authority and either missing workflow or chat permission", async () => {
  const preview = await fixture({ env: { PME_ENTERPRISE_AUTH_ENABLED: "false" } });
  const request: any = { method: "POST", url: "/v1/chat/completions", headers: {}, socket: { remoteAddress: "127.0.0.1" } };
  expect(preview.service.authenticate(request).authenticated).toBe(true); expect(() => preview.service.captureResidentAuthority(request)).toThrow();
  const f = await fixture();
  for (const permissions of [["workflow:run"], ["chat:use"]]) {
    f.service.upsertUser({ ...f.owner, permissions }, admin);
    const candidate: any = { headers: { authorization: "Bearer " + userToken }, socket: { remoteAddress: "127.0.0.1" } };
    expect(f.service.authenticate(candidate).authenticated).toBe(true);
    expect(() => f.service.captureResidentAuthority(candidate)).toThrow();
  }
});

it("refreshes managed-user revocation, expiry and role changes without preserving stale permissions", async () => {
  const f = await fixture(); f.addOwner(); const request = authenticate(f.service, userToken), ref = f.service.captureResidentAuthority(request);
  const first = f.service.authorizeResidentAuthority(ref);
  f.service.upsertUser({ ...f.owner, role: "admin", permissions: ["*"] }, admin);
  await expect(first.assertActive()).rejects.toMatchObject({ code: "RESIDENT_AUTHORITY_IDENTITY_CHANGED" });
  expect(() => f.service.captureResidentAuthority(request)).toThrow();
  const expanded = f.service.authorizeResidentAuthority(ref); expect(expanded.identityHash).not.toBe(first.identityHash);
  f.service.upsertUser({ ...f.owner, expiresAt: "2000-01-01T00:00:00.000Z" }, admin);
  expect(() => f.service.authorizeResidentAuthority(ref)).toThrow();
  f.service.upsertUser({ ...f.owner, expiresAt: "2099-01-01T00:00:00.000Z" }, admin);
  f.service.revokeUser({ userId: f.owner.userId }, admin);
  expect(() => f.service.authorizeResidentAuthority(ref)).toThrow();
});

it("rejects altered references, credential rotation and globally ambiguous public key fingerprints", async () => {
  const f = await fixture(); f.addOwner(); const ref = f.service.captureResidentAuthority(authenticate(f.service, userToken));
  for (const forged of [{ ...ref, tenantId: "other" }, { ...ref, userId: "other" }, { ...ref, permissions: ["*"] }, { ...ref, fingerprint: "f".repeat(12) }]) {
    expect(() => f.service.authorizeResidentAuthority(forged)).toThrow();
  }
  f.service.upsertUser({ ...f.owner, token: "rotated-fixture-token" }, admin); expect(() => f.service.authorizeResidentAuthority(ref)).toThrow();
  const manager = f.service.getApiKeyManager(), generated = manager.create({ role: "operator", tenantId: admin.tenantId });
  const request = authenticate(f.service, generated.key), publicKeys = manager.list();
  vi.spyOn(manager, "list").mockReturnValue({ ...publicKeys, keys: [...publicKeys.keys, { ...publicKeys.keys[0]!, tenantId: "other" }] });
  expect(() => f.service.captureResidentAuthority(request)).toThrow();
});

it("creates a fresh authentic accounting capability per chunk while health rechecks consume no RPM", async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-01-01T00:00:05Z"));
  const f = await fixture(), manager = f.service.getApiKeyManager();
  const generated = manager.create({ role: "operator", tenantId: admin.tenantId, budget: { limitTokens: 100, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
  const ref = f.service.captureResidentAuthority(authenticate(f.service, generated.key));
  const first = f.service.authorizeResidentAuthority(ref), second = f.service.authorizeResidentAuthority(ref);
  expect(first.accounting).not.toBe(second.accounting); expect(first.identity.apiKeyFingerprint).toBe(generated.record.keyFingerprint);
  const execution = {}; bindVirtualKeyRequestAccounting(execution, first.accounting!); expect(getVirtualKeyRequestAccounting(execution)).toBe(first.accounting);
  for (let i = 0; i < 3; i++) await first.assertActive();
  expect(manager.describeUsage({ keyId: ref.fingerprint })!.usage.rateRequestCount).toBe(0);
  const invocation = first.accounting!.beginInvocation(2);
  const settlement = first.accounting!.settle(invocation, { tokens: 6, source: "reported", incomplete: false });
  expect(first.accounting!.settle(invocation, { tokens: 60, source: "reported", incomplete: false })).toBe(settlement);
  expect(await settlement).toMatchObject({ state: "recorded", auditRecorded: true });
  expect(manager.describeUsage({ keyId: ref.fingerprint })!.usage).toMatchObject({ tokensUsed: 6, requestCount: 1, rateRequestCount: 1 });
  await second.assertActive(); expect(() => second.accounting!.beginInvocation(1)).toThrow();
  const audit = await f.service.listAudit({ actorIdentity: admin });
  expect(audit.entries.some((entry: Record<string, unknown>) => entry.code === "VIRTUAL_KEY_USAGE_SETTLED" && entry.path === "resident-agent:chunk" && entry.method === "INTERNAL")).toBe(true);
});

it("rechecks virtual-key budget, revocation and expiry from the actual manager", async () => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-01-01T00:00:05Z"));
  const f = await fixture(), manager = f.service.getApiKeyManager();
  const key = manager.create({ role: "operator", tenantId: admin.tenantId, budget: { limitTokens: 10, window: "daily" } });
  const ref = f.service.captureResidentAuthority(authenticate(f.service, key.key)), current = f.service.authorizeResidentAuthority(ref);
  const invocation = current.accounting!.beginInvocation(1); await current.accounting!.settle(invocation, { tokens: 11, source: "reported", incomplete: false });
  await expect(current.assertActive()).rejects.toMatchObject({ code: "VIRTUAL_KEY_BUDGET_EXHAUSTED", statusCode: 429 });
  manager.revoke({ keyId: ref.fingerprint }); expect(() => f.service.authorizeResidentAuthority(ref)).toThrow();
  const expiring = manager.create({ role: "operator", tenantId: admin.tenantId, expiresAt: "2030-01-01T00:00:06Z" });
  const expiryRef = f.service.captureResidentAuthority(authenticate(f.service, expiring.key)), expiryContext = f.service.authorizeResidentAuthority(expiryRef);
  clock.mockReturnValue(Date.parse("2030-01-01T00:00:07Z"));
  await expect(expiryContext.assertActive()).rejects.toMatchObject({ code: "RESIDENT_AUTHORITY_EXPIRED" });
});

it("honors the original enterprise revocation list on key reference authorization after restart", async () => {
  const f = await fixture(), generated = f.service.getApiKeyManager().create({ role: "operator", tenantId: admin.tenantId });
  const ref = f.service.captureResidentAuthority(authenticate(f.service, generated.key)); await f.service.close();
  const restarted = f.create({ PME_ENTERPRISE_REVOKED_TOKENS: generated.key });
  expect(() => restarted.authorizeResidentAuthority(ref)).toThrow();
});

it("latches a real server audit failure after charging and prevents further protected actions", async () => {
  const f = await fixture({ badAudit: true }), manager = f.service.getApiKeyManager();
  const generated = manager.create({ role: "operator", tenantId: admin.tenantId, budget: { limitTokens: 100, window: "daily" } });
  const ref = f.service.captureResidentAuthority(authenticate(f.service, generated.key)), current = f.service.authorizeResidentAuthority(ref);
  const invocation = current.accounting!.beginInvocation(1);
  const outcome = await current.accounting!.settle(invocation, { tokens: 5, source: "reported", incomplete: false });
  expect(outcome).toMatchObject({ state: "recorded", auditRecorded: false });
  expect(manager.describeUsage({ keyId: ref.fingerprint })!.usage.tokensUsed).toBe(5);
  await expect(current.assertActive()).rejects.toMatchObject({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", statusCode: 503 });
  expect(() => f.service.authorizeResidentAuthority(ref)).toThrow();
});
