import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting, getVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { assertIssuedResidentGrant, createResidentExecution, getResidentExecution, inheritResidentExecution,
  issueResidentGrant, readResidentGrant, readResidentState } from "./governedAgentTaskResident.ts";

function grant() {
  return issueResidentGrant({ taskId: randomUUID(), tenantId: "tenant", userId: "owner", agentId: "agt_resident",
    profileHash: "sha256:" + "a".repeat(64), reviewHash: "sha256:" + "b".repeat(64), planHash: "sha256:" + "c".repeat(64),
    authorityIdentityHash: "sha256:" + "d".repeat(64),
    authority: { version: 1, kind: "configured-user", fingerprint: "a".repeat(12), tenantId: "tenant", userId: "owner" },
    expiresAt: Date.now() + 60000, chunkIterations: 1, maxChunks: 5 });
}
describe("resident execution capabilities", () => {
  it("retains a signed-data projection while JSON cannot mint a scheduling or execution capability", () => {
    const original = grant(), copy = JSON.parse(JSON.stringify(original));
    expect(readResidentGrant(copy)).toEqual(original); expect(() => assertIssuedResidentGrant(original)).not.toThrow();
    expect(() => assertIssuedResidentGrant(copy)).toThrow();
    for (const changed of [{ ...copy, tenantId: "other" }, { ...copy, maxChunks: 999 }, { ...copy, expiresAt: original.expiresAt + 1 }]) {
      expect(() => readResidentGrant(changed)).toThrow();
    }
    const state = readResidentState({ grant: copy, enabled: true, chunks: 4, stopReason: null });
    expect(state?.chunks).toBe(4);
    expect(() => readResidentState({ grant: copy, enabled: true, chunks: 6, stopReason: null })).toThrow();
    const source = { signal: new AbortController().signal, timeoutMs: 1000, deadlineAt: Date.now() + 1000 };
    const execution = createResidentExecution({ grant: original, source, async assertActive() {} });
    expect(execution.providerDispatchRoute).toBe(`/internal/agent-pool/${original.taskId}/run`);
    expect(getResidentExecution({ ...execution })).toBeUndefined();
    expect(getResidentExecution(JSON.parse(JSON.stringify(execution)))).toBeUndefined();
    expect(getResidentExecution(execution)?.taskId).toBe(original.taskId);
    expect(() => createResidentExecution({ grant: original, source: { ...source, deadlineAt: original.expiresAt + 1 }, async assertActive() {} })).toThrow();
  });
  it("fresh chunks keep real accounting authority and current revocation checks without reusing dispatch keys", async () => {
    const manager = createApiKeyManager({}), events: unknown[] = [];
    const issued = manager.create({ tenantId: "tenant", role: "operator", budget: { limitTokens: 10, window: "daily" } });
    const accounting = createVirtualKeyRequestAccounting({ manager, keyFingerprint: issued.record.keyFingerprint, onEvent(event) { events.push(event); } });
    const original = grant(), source = { signal: new AbortController().signal, timeoutMs: 1000, deadlineAt: Date.now() + 1000 };
    bindVirtualKeyRequestAccounting(source, accounting);
    let active = true;
    const create = () => createResidentExecution({ grant: original, source, async assertActive() { if (!active) throw Error("Revoked"); } });
    const first = create(), second = create();
    expect(first.providerDispatchKeyHash).not.toBe(second.providerDispatchKeyHash);
    expect(getVirtualKeyRequestAccounting(first)).toBe(accounting);
    const wrapped = { ...first }; inheritResidentExecution(first, wrapped);
    expect(getResidentExecution(wrapped)).toBe(getResidentExecution(first));
    const invocation = getVirtualKeyRequestAccounting(first)!.beginInvocation(1);
    await accounting.settle(invocation, { tokens: 3, source: "reported", incomplete: false });
    expect(events).toHaveLength(1); expect(manager.describeUsage({ keyId: issued.record.keyFingerprint })?.usage.tokensUsed).toBe(3);
    active = false; await expect(getResidentExecution(wrapped)!.assertActive()).rejects.toThrow("Revoked");
    manager.revoke({ keyId: issued.record.keyFingerprint });
    expect(() => getVirtualKeyRequestAccounting(second)!.beginInvocation(1)).toThrow();
  });
});
