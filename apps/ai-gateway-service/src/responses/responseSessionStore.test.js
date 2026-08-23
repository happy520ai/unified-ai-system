import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESPONSE_SESSION_MAX_ENTRIES,
  MAX_SESSION_CONTEXT_MESSAGES,
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
