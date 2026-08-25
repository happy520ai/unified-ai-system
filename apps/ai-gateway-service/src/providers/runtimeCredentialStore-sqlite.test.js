import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntimeCredentialStore } from "./runtimeCredentialStore.js";

function storeWithPath(dbPath) {
  return createRuntimeCredentialStore({
    env: { PME_RUNTIME_CREDENTIAL_STORE_MODE: "sqlite" },
    storagePath: dbPath,
  });
}

describe("runtimeCredentialStore — sqlite backend", () => {
  it("persists a credential and reads it back across instances", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "rcs-sqlite-")), "credentials.db");

    const store = storeWithPath(dbPath);
    store.set({ providerId: "openai", apiKey: "sk-test-123", endpoint: "https://api.openai.com" });
    expect(store.getApiKey("openai")).toBe("sk-test-123");

    // A second instance over the same SQLite file (simulates restart / another process).
    const store2 = storeWithPath(dbPath);
    expect(store2.getApiKey("openai")).toBe("sk-test-123");
    expect(store2.getEndpoint("openai")).toBe("https://api.openai.com");
    expect(store2.has("openai")).toBe(true);
  });

  it("clear removes the credential", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "rcs-sqlite-")), "credentials.db");

    const store = storeWithPath(dbPath);
    store.set({ providerId: "openai", apiKey: "sk-test-123" });
    expect(store.clear("openai")).toBe(true);
    expect(store.has("openai")).toBe(false);
  });
});
