import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESPONSE_SESSION_MAX_ENTRIES,
  MAX_SESSION_CONTEXT_MESSAGES,
  bindResponseSessionStore,
  createResponseSessionStore,
  isResponseId,
} from "./responseSessionStore.js";

function createFakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe("responseSessionStore", () => {
  it("captures authenticated identity and isolates key callers from users and anonymous preview", () => {
    const store = createResponseSessionStore({});
    const identity = { tenantId: "tenant-a", userId: "alice", apiKeyFingerprint: "a".repeat(64) };
    const keyA = bindResponseSessionStore(store, identity);
    keyA.set({ responseId: "resp_identity", assistantOutput: "Key A" });
    identity.apiKeyFingerprint = "b".repeat(64);
    expect(keyA.get("resp_identity")?.assistantOutput).toBe("Key A");
    expect(bindResponseSessionStore(store, identity).get("resp_identity")).toBeNull();
    expect(bindResponseSessionStore(store, { tenantId: "tenant-a", userId: "alice" }).get("resp_identity")).toBeNull();
    expect(bindResponseSessionStore(store, null).get("resp_identity")).toBeNull();
    const sameKey = bindResponseSessionStore(store, { tenantId: "tenant-a", userId: "changed-display-id", apiKeyFingerprint: "a".repeat(64) });
    expect(sameKey.get("resp_identity")?.assistantOutput).toBe("Key A");
  });

  it("does not fall back to the anonymous scope for an incomplete authenticated identity", () => {
    const store = createResponseSessionStore({});
    store.set({ responseId: "resp_preview", assistantOutput: "Preview" });
    const incomplete = bindResponseSessionStore(store, { tenantId: "tenant-a" });
    expect(incomplete.enabled).toBe(false);
    expect(incomplete.get("resp_preview")).toBeNull();
    expect(incomplete.delete("resp_preview")).toBe(false);
    expect(incomplete.set({ responseId: "resp_new" }).stored).toBe(false);
    expect(store.size()).toBe(1);
    expect(() => store.set({ responseId: "resp_invalid" }, {})).toThrow(expect.objectContaining({ code: "RESPONSE_SESSION_SCOPE_INVALID" }));
    expect(store.size()).toBe(1);
  });

  it("keeps identical response ids distinct for authenticated tenant and owner scopes", () => {
    const store = createResponseSessionStore({});
    const alice = { tenantId: "tenant-a", subjectId: "user:alice" };
    const bob = { tenantId: "tenant-a", subjectId: "user:bob" };
    const otherTenant = { tenantId: "tenant-b", subjectId: "user:alice" };
    store.set({ responseId: "resp_shared", assistantOutput: "Alice" }, alice);
    store.set({ responseId: "resp_shared", assistantOutput: "Bob" }, bob);
    expect(store.get("resp_shared", alice)?.assistantOutput).toBe("Alice");
    expect(store.get("resp_shared", bob)?.assistantOutput).toBe("Bob");
    expect(store.get("resp_shared", otherTenant)).toBeNull();
    expect(store.get("resp_shared")).toBeNull();
    expect(store.size()).toBe(2);
  });

  it("does not let another scope delete an owner's response", () => {
    const store = createResponseSessionStore({});
    const owner = { tenantId: "tenant-a", subjectId: "user:alice" };
    store.set({ responseId: "resp_owned", assistantOutput: "Owned" }, owner);
    expect(store.delete("resp_owned", { tenantId: "tenant-b", subjectId: "user:alice" })).toBe(false);
    expect(store.delete("resp_owned")).toBe(false);
    expect(store.get("resp_owned", owner)?.assistantOutput).toBe("Owned");
    expect(store.delete("resp_owned", owner)).toBe(true);
  });

  it("stores and restores response session context", () => {
    const store = createResponseSessionStore({ ttlMs: 60_000, now: () => 1 });
    const { responseId } = store.set({
      responseId: "resp_abc123",
      instructions: "Be terse",
      contextMessages: [
        { role: "system", content: "Be terse" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello" },
      ],
      assistantOutput: "Hello",
      model: "agnes-2.0-flash",
      providerId: "generic-openai-compatible",
      reasoningEffort: "medium",
    });

    expect(responseId).toBe("resp_abc123");
    const record = store.get("resp_abc123");
    expect(record.contextMessages).toHaveLength(3);
    expect(record.assistantOutput).toBe("Hello");
    expect(record.model).toBe("agnes-2.0-flash");
    expect(record.reasoningEffort).toBe("medium");
  });

  it("expires records after the TTL and reports them as missing", () => {
    const clock = createFakeClock();
    const store = createResponseSessionStore({ ttlMs: 1_000, now: clock.now });
    store.set({ responseId: "resp_old", contextMessages: [{ role: "user", content: "x" }] });

    clock.advance(1_001);
    expect(store.get("resp_old")).toBeNull();
    expect(store.size()).toBe(0);
  });

  it("evicts the least recently used entry when the table is full", () => {
    const store = createResponseSessionStore({ ttlMs: 60_000, maxEntries: 2, now: () => 1 });
    store.set({ responseId: "resp_a", contextMessages: [] });
    store.set({ responseId: "resp_b", contextMessages: [] });
    store.get("resp_a");
    store.set({ responseId: "resp_c", contextMessages: [] });

    expect(store.get("resp_a")).not.toBeNull();
    expect(store.get("resp_b")).toBeNull();
    expect(store.get("resp_c")).not.toBeNull();
    expect(store.size()).toBe(2);
  });

  it("caps stored context messages while pinning system instructions", () => {
    const store = createResponseSessionStore({ ttlMs: 60_000, now: () => 1 });
    const contextMessages = [
      { role: "system", content: "system prompt" },
      ...Array.from({ length: MAX_SESSION_CONTEXT_MESSAGES + 20 }, (_, index) => ({
        role: "user",
        content: `message-${index}`,
      })),
    ];
    const { responseId } = store.set({ responseId: "resp_cap", contextMessages });

    const record = store.get(responseId);
    expect(record.contextMessages.length).toBeLessThanOrEqual(MAX_SESSION_CONTEXT_MESSAGES + 1);
    expect(record.contextMessages[0]).toEqual({ role: "system", content: "system prompt" });
    const last = record.contextMessages[record.contextMessages.length - 1];
    expect(last.content).toBe(`message-${MAX_SESSION_CONTEXT_MESSAGES + 19}`);
  });

  it("can be disabled with a zero TTL and then refuses nothing but stores nothing", () => {
    const store = createResponseSessionStore({ ttlMs: 0, now: () => 1 });
    expect(store.enabled).toBe(false);
    store.set({ responseId: "resp_none", contextMessages: [] });
    expect(store.get("resp_none")).not.toBeNull();
    expect(store.describeHealth()).toEqual(expect.objectContaining({
      enabled: false,
      storage: "memory-only",
      maxEntries: DEFAULT_RESPONSE_SESSION_MAX_ENTRIES,
    }));
  });

  it("validates response id shape", () => {
    expect(isResponseId("resp_abc")).toBe(true);
    expect(isResponseId("chatcmpl_abc")).toBe(false);
    expect(isResponseId("resp_" + "x".repeat(200))).toBe(false);
    expect(() => createResponseSessionStore({ ttlMs: 60_000, now: () => 1 })
      .set({ responseId: "not-a-response-id", contextMessages: [] })).toThrow(/resp_/);
  });
});
