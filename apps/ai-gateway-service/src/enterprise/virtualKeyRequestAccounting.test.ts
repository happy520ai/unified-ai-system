import { mkdtempSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiKeyManager } from "./apiKeyManager.js";
import {
  bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting,
  getVirtualKeyRequestAccounting, inheritVirtualKeyRequestAccounting,
  type VirtualKeyAccountingEvent, type VirtualKeySettlement,
} from "./virtualKeyRequestAccounting.ts";

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const reported = (tokens: number): VirtualKeySettlement => ({ tokens, source: "reported", incomplete: false });
function fixture(options: { storePath?: string; rpm?: number; budget?: boolean } = {}) {
  const manager = createApiKeyManager({ storePath: options.storePath ?? null });
  const { key, record } = manager.create({ budget: options.budget === false ? undefined : { limitTokens: 100, window: "daily" },
    rateLimit: { requestsPerMinute: options.rpm ?? 1 } });
  const identity = manager.validate(key);
  if (!identity.valid || !identity.record) throw new Error("Synthetic key authentication failed.");
  const events: VirtualKeyAccountingEvent[] = [];
  const actualAuthorize = manager.authorizeUsage.bind(manager);
  const admissions = vi.spyOn(manager, "authorizeUsage");
  const charges = vi.spyOn(manager, "recordUsage");
  const makeScope = (onEvent = async (event: VirtualKeyAccountingEvent) => { events.push(event); }) =>
    createVirtualKeyRequestAccounting({ manager, keyFingerprint: identity.record!.keyFingerprint, onEvent });
  return { manager, record, events, admissions, actualAuthorize, charges, makeScope, scope: makeScope(),
    usage: () => manager.describeUsage({ keyId: record.keyId })!.usage };
}

describe("private virtual-key request accounting with actual manager", () => {
  it("shares one admission across concurrent child invocations, settling each exactly once", async () => {
    const f = fixture();
    expect(f.scope.admit(2).allowed).toBe(true);
    const first = f.scope.beginInvocation(1);
    const second = f.scope.beginInvocation(1);
    const one = f.scope.settle(first, reported(12));
    const duplicate = f.scope.settle(first, reported(90));
    expect(duplicate).toBe(one);
    await Promise.all([one, duplicate, f.scope.settle(second, reported(7))]);
    expect(f.admissions).toHaveBeenCalledOnce();
    expect(f.charges).toHaveBeenCalledTimes(2);
    expect(f.usage()).toMatchObject({ tokensUsed: 19, requestCount: 1, rateRequestCount: 1 });
    expect(f.events.map((event) => event.tokens)).toEqual([12, 7]);
    expect(new Set(f.events.map((event) => event.requestAccountingId)).size).toBe(1);
  });

  it("binds only server capabilities and explicitly projects frozen execution contexts", () => {
    const f = fixture();
    const source = Object.freeze({ apiKeyFingerprint: f.record.keyFingerprint });
    const target = Object.freeze({ ...source });
    bindVirtualKeyRequestAccounting(source, f.scope);
    expect(getVirtualKeyRequestAccounting(source)).toBe(f.scope);
    expect(getVirtualKeyRequestAccounting(target)).toBeUndefined();
    expect(getVirtualKeyRequestAccounting(JSON.parse(JSON.stringify(source)))).toBeUndefined();
    inheritVirtualKeyRequestAccounting(source, target);
    expect(getVirtualKeyRequestAccounting(target)).toBe(f.scope);
    expect(() => bindVirtualKeyRequestAccounting({}, { ...f.scope })).toThrow();
    expect(() => bindVirtualKeyRequestAccounting(source, f.makeScope())).toThrow();
    expect(f.admissions).not.toHaveBeenCalled();
  });

  it("rejects copied invocation handles and handles belonging to another scope", async () => {
    const f = fixture({ rpm: 2 });
    const invocation = f.scope.beginInvocation(1);
    await expect(f.scope.settle({ ...invocation }, reported(5))).rejects.toMatchObject({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" });
    await expect(f.makeScope().settle(invocation, reported(5))).rejects.toMatchObject({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" });
    expect(f.charges).not.toHaveBeenCalled();
  });

  it("denies a separate request after RPM exhaustion and does not re-admit a denied scope", () => {
    const f = fixture();
    f.scope.beginInvocation(1);
    const secondRequest = f.makeScope();
    expect(secondRequest.admit(1)).toMatchObject({ allowed: false, code: "VIRTUAL_KEY_RATE_LIMITED" });
    expect(() => secondRequest.beginInvocation(1)).toThrowError(expect.objectContaining({ statusCode: 429 }));
    expect(f.admissions).toHaveBeenCalledTimes(2);
    expect(f.usage().requestCount).toBe(1);
  });

  it("rechecks token exhaustion and revocation for already admitted children", async () => {
    const f = fixture();
    await f.scope.settle(f.scope.beginInvocation(1), reported(100));
    expect(() => f.scope.beginInvocation(1)).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_BUDGET_EXHAUSTED" }));
    f.manager.revoke({ keyId: f.record.keyId });
    expect(() => f.scope.beginInvocation(0)).toThrowError(expect.objectContaining({ code: "api_key_invalid", statusCode: 401 }));
    expect(f.admissions).toHaveBeenCalledOnce();
  });

  it("records explicit zero and known partial use; unknown use never calls recordUsage(0)", async () => {
    const f = fixture();
    await f.scope.settle(f.scope.beginInvocation(0), reported(0));
    await f.scope.settle(f.scope.beginInvocation(0), { tokens: 9, source: "partial", incomplete: true });
    await f.scope.settle(f.scope.beginInvocation(0), { tokens: null, source: "unknown", incomplete: true });
    expect(f.charges.mock.calls.map(([input]) => input!.tokens)).toEqual([0, 9]);
    expect(f.events.at(-1)).toMatchObject({ tokens: null, source: "unknown", state: "unknown", incomplete: true });
    expect(f.usage().tokensUsed).toBe(9);
  });

  it("snapshots a settlement before callers can mutate it", async () => {
    const f = fixture();
    const usage = reported(8);
    const receipt = f.scope.settle(f.scope.beginInvocation(1), usage);
    usage.tokens = 90;
    expect(await receipt).toMatchObject({ tokens: 8, state: "recorded", auditRecorded: true });
    expect(f.usage().tokensUsed).toBe(8);
  });

  it("rejects unsupported token-budgeted operations while allowing RPM-only operations", async () => {
    const budgeted = fixture();
    expect(() => budgeted.scope.beginInvocation(0, "unsupported")).toThrowError(expect.objectContaining({ code: "VIRTUAL_KEY_METERING_UNSUPPORTED", statusCode: 400 }));
    expect(budgeted.admissions).not.toHaveBeenCalled();
    const rateOnly = fixture({ budget: false });
    await rateOnly.scope.settle(rateOnly.scope.beginInvocation(0, "unsupported"), { tokens: null, source: "unknown", incomplete: true });
    expect(rateOnly.usage().requestCount).toBe(1);
    expect(rateOnly.charges).not.toHaveBeenCalled();
  });

  it("retains a failed persisted charge and repairs it without repeating admission or settlement", async () => {
    const directory = mkdtempSync(join(tmpdir(), "virtual-key-request-accounting-"));
    directories.push(directory);
    const storePath = join(directory, "synthetic-keys.json");
    const f = fixture({ storePath });
    const invocation = f.scope.beginInvocation(1);
    renameSync(storePath, `${storePath}.preserved`);
    mkdirSync(storePath);
    const receipt = f.scope.settle(invocation, reported(30));
    expect(await receipt).toMatchObject({ state: "accounting-unavailable", tokens: 30 });
    expect(() => f.scope.beginInvocation(1)).toThrowError(expect.objectContaining({ statusCode: 503 }));
    expect(f.usage().tokensUsed).toBe(30);
    rmSync(storePath, { recursive: true });
    renameSync(`${storePath}.preserved`, storePath);
    expect(f.scope.settle(invocation, reported(90))).toBe(receipt);
    f.scope.beginInvocation(1);
    expect(f.charges).toHaveBeenCalledOnce();
    expect(f.admissions).toHaveBeenCalledOnce();
    expect(createApiKeyManager({ storePath }).describeUsage({ keyId: f.record.keyId })?.usage)
      .toMatchObject({ tokensUsed: 30, requestCount: 1, rateRequestCount: 1 });
  });

  it("does not retry a failed admission whose manager already counted the request", () => {
    const f = fixture();
    f.admissions.mockImplementationOnce((input) => { f.actualAuthorize(input); throw new Error("synthetic persistence failure"); });
    expect(() => f.scope.admit(1)).toThrow();
    expect(() => f.scope.admit(1)).toThrow();
    expect(f.usage().requestCount).toBe(1);
    expect(f.admissions).toHaveBeenCalledOnce();
  });

  it("marks partial facts incomplete even when a caller omits that distinction", async () => {
    const f = fixture();
    const receipt = await f.scope.settle(f.scope.beginInvocation(1), { tokens: 5, source: "partial", incomplete: false });
    expect(receipt).toMatchObject({ tokens: 5, incomplete: true, source: "partial" });
  });

  it("does not exempt fake-provider work using a money-ledger billable flag", async () => {
    const f = fixture();
    const facts = { ...reported(4), billable: false, executionMode: "fake" };
    await f.scope.settle(f.scope.beginInvocation(1), facts);
    expect(f.usage()).toMatchObject({ tokensUsed: 4, requestCount: 1 });
  });

  it("does not turn an audit failure after charged work into a retryable provider error", async () => {
    const f = fixture();
    const scope = f.makeScope(async () => { throw new Error("synthetic audit failure"); });
    const invocation = scope.beginInvocation(1);
    const receipt = scope.settle(invocation, reported(6));
    expect(await receipt).toMatchObject({ state: "recorded", auditRecorded: false });
    expect(scope.settle(invocation, reported(6))).toBe(receipt);
    expect(() => scope.beginInvocation(1)).toThrowError(expect.objectContaining({ retryable: false, statusCode: 503 }));
    expect(f.charges).toHaveBeenCalledOnce();
  });
});
