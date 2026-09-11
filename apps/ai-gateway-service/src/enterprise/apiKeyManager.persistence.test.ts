import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApiKeyManager } from "./apiKeyManager.js";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";
import { applyVirtualKeyRequestGate } from "../http/openAiCompatibilityRoutes.js";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "virtual-key-durability-"));
  directories.push(directory);
  const storePath = join(directory, "keys.json");
  const clock = { now: 1_000_000_020_000 };
  const open = () => createApiKeyManager({ storePath, now: () => clock.now });
  return { directory, storePath, clock, open };
}

describe("virtual key accounting persistence", () => {
  it("repairs a retained charge before continuation without a second admission or charge", () => {
    const { open, storePath } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    manager.authorizeUsage({ keyId: record.keyId });
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    expect(() => manager.recordUsage({ keyId: record.keyId, tokens: 80 })).toThrow();
    expect(() => manager.checkContinuation({ keyId: record.keyId })).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
    rmSync(storePath, { recursive: true });
    renameSync(`${storePath}.preserved`, storePath);
    expect(manager.checkContinuation({ keyId: record.keyId, estimatedTokens: 20 }).allowed).toBe(true);
    expect(open().describeUsage({ keyId: record.keyId })?.usage).toMatchObject({ tokensUsed: 80, requestCount: 1, rateRequestCount: 1 });
    expect(manager.getHealth().status).toBe("ready");
  });

  it("retains admissions and actual tokens without unrelated key-management writes", () => {
    const { open } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" }, rateLimit: { requestsPerMinute: 2 } });
    manager.authorizeUsage({ keyId: record.keyId, estimatedTokens: 1 });
    manager.recordUsage({ keyId: record.keyId, tokens: 90 });
    const restarted = open();
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(90);
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.requestCount).toBe(1);
    expect(restarted.authorizeUsage({ keyId: record.keyId, estimatedTokens: 11 }).code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");
    expect(restarted.authorizeUsage({ keyId: record.keyId, estimatedTokens: 1 }).allowed).toBe(true);
    expect(open().authorizeUsage({ keyId: record.keyId }).code).toBe("VIRTUAL_KEY_RATE_LIMITED");
  });

  it("rolls minutes independently from a daily token budget, including restart", () => {
    const { open, clock } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    manager.authorizeUsage({ keyId: record.keyId });
    manager.recordUsage({ keyId: record.keyId, tokens: 80 });
    clock.now += 60_000;
    expect(manager.authorizeUsage({ keyId: record.keyId }).allowed).toBe(true);
    const restarted = open();
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(80);
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.requestCount).toBe(2);
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.rateRequestCount).toBe(1);
    expect(restarted.authorizeUsage({ keyId: record.keyId }).code).toBe("VIRTUAL_KEY_RATE_LIMITED");
    clock.now += 60_000;
    expect(restarted.authorizeUsage({ keyId: record.keyId, estimatedTokens: 21 }).code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");
  });

  it("fails closed with a safe code when admission cannot persist", () => {
    const { open, storePath } = fixture();
    const manager = open();
    const { record } = manager.create({ rateLimit: { requestsPerMinute: 10 } });
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    expect(() => manager.authorizeUsage({ keyId: record.keyId })).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
    expect(manager.getHealth().status).toBe("degraded");
    expect(() => manager.authorizeUsage({ keyId: record.keyId })).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
  });

  it("keeps failed post-call accounting in memory and refuses further admission", () => {
    const { open, storePath } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" } });
    manager.authorizeUsage({ keyId: record.keyId });
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    expect(() => manager.recordUsage({ keyId: record.keyId, tokens: 80 })).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
    expect(manager.describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(80);
    expect(() => manager.authorizeUsage({ keyId: record.keyId })).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
  });

  it("does not replace a corrupt store with an empty key set", () => {
    const { open, storePath } = fixture();
    writeFileSync(storePath, "broken-synthetic-store");
    expect(open).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
    expect(readFileSync(storePath, "utf8")).toBe("broken-synthetic-store");
  });

  it("flushes retained accounting after storage repair before admitting further work", () => {
    const { open, storePath } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" } });
    manager.authorizeUsage({ keyId: record.keyId });
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    expect(() => manager.recordUsage({ keyId: record.keyId, tokens: 80 })).toThrow();
    rmSync(storePath, { recursive: true });
    renameSync(`${storePath}.preserved`, storePath);
    expect(manager.authorizeUsage({ keyId: record.keyId, estimatedTokens: 21 }).code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");
    expect(manager.getHealth().status).toBe("ready");
    expect(open().describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(80);
  });

  it("propagates write failure to governance health and safe compatibility HTTP 503", () => {
    const { storePath, directory } = fixture();
    const service = createEnterpriseGovernanceService({ env: { PME_API_KEY_STORE_PATH: storePath }, auditLogPath: join(directory, "audit.jsonl") });
    const manager = service.getApiKeyManager();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" } });
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    let status = 0;
    let body = "";
    const blocked = applyVirtualKeyRequestGate({
      enterpriseGovernanceService: service,
      request: { enterpriseIdentity: { apiKeyFingerprint: record.keyId } },
      gatewayInput: { messages: [{ role: "user", content: "hello" }] },
      response: { writeHead(code: number) { status = code; }, end(text: string) { body = text; } },
      startedAt: Date.now(), writeServiceLog() {},
    } as any);
    expect(blocked).toBe(true);
    expect(status).toBe(503);
    expect(body).toContain("VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE");
    expect(body).not.toContain(directory);
    expect(service.getHealth().status).toBe("degraded");
    expect(service.getPublicHealth().status).toBe("degraded");
  });

  it("rejects syntactically valid stored budgets with damaged usage", () => {
    const { open, storePath } = fixture();
    open().create({ budget: { limitTokens: 100, window: "daily" } });
    const old = JSON.parse(readFileSync(storePath, "utf8"));
    old.keys[0].usageState.tokensUsed = null;
    const damaged = JSON.stringify(old);
    writeFileSync(storePath, damaged);
    expect(open).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
    expect(readFileSync(storePath, "utf8")).toBe(damaged);
  });

  it("migrates a v1 budget record without discarding prior spend", () => {
    const { open, storePath, clock } = fixture();
    const { record } = open().create({ budget: { limitTokens: 100, window: "daily" }, rateLimit: { requestsPerMinute: 3 } });
    const old = JSON.parse(readFileSync(storePath, "utf8"));
    old.keys[0].usageState = { windowIndex: Math.floor(clock.now / 86_400_000), tokensUsed: 95, requestCount: 2, lastRecordedAt: new Date(clock.now).toISOString() };
    writeFileSync(storePath, JSON.stringify(old));
    const restarted = open();
    expect(restarted.describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(95);
    expect(restarted.authorizeUsage({ keyId: record.keyId, estimatedTokens: 6 }).code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");
  });

  it.each([NaN, Infinity, -1])("rejects invalid recorded tokens %s before corrupting persisted usage", (tokens) => {
    const { open } = fixture();
    const manager = open();
    const { record } = manager.create({ budget: { limitTokens: 100, window: "daily" } });
    expect(() => manager.recordUsage({ keyId: record.keyId, tokens })).toThrowError(expect.objectContaining({ code: "api_key_invalid_usage_tokens" }));
    expect(open().describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(0);
  });

  it("refuses configuration or charges that would write values its loader rejects", () => {
    const { open } = fixture();
    const manager = open();
    expect(() => manager.create({ budget: { limitTokens: Number.MAX_SAFE_INTEGER + 1, window: "daily" } })).toThrow();
    expect(() => manager.create({ budget: { limitTokens: 100, windowMs: Number.MAX_SAFE_INTEGER + 1 } })).toThrow();
    expect(() => manager.create({ rateLimit: { requestsPerMinute: Number.MAX_SAFE_INTEGER + 1 } })).toThrow();
    const { record } = manager.create({ budget: { limitTokens: Number.MAX_SAFE_INTEGER, window: "daily" } });
    manager.recordUsage({ keyId: record.keyId, tokens: Number.MAX_SAFE_INTEGER });
    expect(() => manager.recordUsage({ keyId: record.keyId, tokens: 1 })).toThrow();
    expect(open().describeUsage({ keyId: record.keyId })?.usage.tokensUsed).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each(["empty", "mismatch", "duplicate"])("rejects %s stored identities instead of bypassing the budget gate", (kind) => {
    const { open, storePath } = fixture();
    open().create({ budget: { limitTokens: 100, window: "daily" } });
    const data = JSON.parse(readFileSync(storePath, "utf8"));
    if (kind === "duplicate") data.keys.push(data.keys[0]);
    else data.keys[0].keyFingerprint = kind === "empty" ? "" : "wrong";
    writeFileSync(storePath, JSON.stringify(data));
    expect(open).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
  });

  it("refuses a dangling store link instead of treating it as a missing new store", () => {
    const { open, storePath, directory } = fixture();
    symlinkSync(join(directory, "missing-target"), storePath, process.platform === "win32" ? "junction" : "file");
    expect(open).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }));
  });
});
