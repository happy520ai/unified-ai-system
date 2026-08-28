import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntimeCredentialStore } from "./runtimeCredentialStore.js";

const MASTER_KEY_A = Buffer.alloc(32, 0x11).toString("base64");
const MASTER_KEY_B = Buffer.alloc(32, 0x22).toString("base64");

function persistentEnv(mode, key = MASTER_KEY_A, extra = {}) {
  return {
    PME_RUNTIME_CREDENTIAL_STORE_MODE: mode,
    PME_RUNTIME_CREDENTIAL_MASTER_KEY: key,
    ...extra,
  };
}

function expectErrorCode(action, code) {
  let captured;
  try {
    action();
  } catch (error) {
    captured = error;
  }
  expect(captured).toMatchObject({ code });
}

describe("runtime credential store", () => {
  it("does not expose secret values through listRecords", () => {
    const store = createRuntimeCredentialStore({
      env: { PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory" },
    });
    store.set({
      providerId: "test",
      apiKey: "secret-value",
      endpoint: "https://example.com",
    });

    const [record] = store.listRecords();

    expect(record.apiKeyPresent).toBe(true);
    expect(record).not.toHaveProperty("apiKey");
    expect(JSON.stringify(record)).not.toContain("secret-value");
    expect(store.getApiKey("test")).toBe("secret-value");
  });

  it("removes its temp file when an atomic rename fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "credential-store-"));
    const blockedParent = join(root, "blocked-parent");
    const storagePath = join(blockedParent, "credentials.json");
    await writeFile(blockedParent, "not-a-directory", "utf8");

    try {
      const store = createRuntimeCredentialStore({
        env: persistentEnv("local-file"),
        storagePath,
      });
      expectErrorCode(() => store.set({
        providerId: "test",
        apiKey: "secret-value",
      }), "RUNTIME_CREDENTIAL_PERSIST_FAILED");
      expect(store.has("test")).toBe(false);
      expect(await readdir(root)).toEqual(["blocked-parent"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("defaults to memory-only and requires a key for explicit persistence", () => {
    const store = createRuntimeCredentialStore({ env: {} });
    const result = store.set({ providerId: "test", apiKey: "memory-secret" });
    expect(result).toMatchObject({ persisted: false, secretStorage: "memory-only" });

    expectErrorCode(() => createRuntimeCredentialStore({
      env: { PME_RUNTIME_CREDENTIAL_STORE_MODE: "local-file" },
    }), "RUNTIME_CREDENTIAL_MASTER_KEY_REQUIRED");
  });

  it("persists authenticated ciphertext without searchable secret material", async () => {
    const root = await mkdtemp(join(tmpdir(), "credential-store-encrypted-"));
    const storagePath = join(root, "credentials.json");
    try {
      const store = createRuntimeCredentialStore({
        env: persistentEnv("local-file"),
        storagePath,
      });
      const result = store.set({
        providerId: "openai",
        apiKey: "credential-must-not-appear-on-disk",
        endpoint: "https://api.example.test",
      });
      expect(result).toMatchObject({
        persisted: true,
        secretStorage: "encrypted-local-file",
      });

      const serialized = await readFile(storagePath, "utf8");
      expect(serialized).not.toContain("credential-must-not-appear-on-disk");
      expect(serialized).not.toContain("https://api.example.test");
      expect(JSON.parse(serialized)).toMatchObject({
        version: 2,
        encryption: "AES-256-GCM",
      });

      const reopened = createRuntimeCredentialStore({
        env: persistentEnv("local-file"),
        storagePath,
      });
      expect(reopened.getApiKey("openai")).toBe("credential-must-not-appear-on-disk");
      expect(reopened.getEndpoint("openai")).toBe("https://api.example.test");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects wrong keys and atomically reseals during key rotation", async () => {
    const root = await mkdtemp(join(tmpdir(), "credential-store-rotation-"));
    const storagePath = join(root, "credentials.json");
    try {
      const original = createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_A),
        storagePath,
      });
      original.set({ providerId: "openai", apiKey: "rotation-secret" });

      expectErrorCode(() => createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_B),
        storagePath,
      }), "RUNTIME_CREDENTIAL_MASTER_KEY_MISMATCH");

      const rotated = createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_B, {
          PME_RUNTIME_CREDENTIAL_PREVIOUS_MASTER_KEYS: MASTER_KEY_A,
        }),
        storagePath,
      });
      expect(rotated.getApiKey("openai")).toBe("rotation-secret");

      const newKeyOnly = createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_B),
        storagePath,
      });
      expect(newKeyOnly.getApiKey("openai")).toBe("rotation-secret");
      expectErrorCode(() => createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_A),
        storagePath,
      }), "RUNTIME_CREDENTIAL_MASTER_KEY_MISMATCH");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects plaintext stores unless one-time migration is explicit", async () => {
    const root = await mkdtemp(join(tmpdir(), "credential-store-migration-"));
    const storagePath = join(root, "credentials.json");
    const plaintextSecret = "legacy-plaintext-secret";
    await writeFile(storagePath, JSON.stringify({
      version: 1,
      records: [{
        providerId: "openai",
        apiKey: plaintextSecret,
        endpoint: "https://api.example.test",
      }],
    }), "utf8");

    try {
      expectErrorCode(() => createRuntimeCredentialStore({
        env: persistentEnv("local-file"),
        storagePath,
      }), "RUNTIME_CREDENTIAL_PLAINTEXT_STORE_REJECTED");

      const migrated = createRuntimeCredentialStore({
        env: persistentEnv("local-file", MASTER_KEY_A, {
          PME_RUNTIME_CREDENTIAL_ALLOW_PLAINTEXT_MIGRATION: "true",
        }),
        storagePath,
      });
      expect(migrated.getApiKey("openai")).toBe(plaintextSecret);
      const serialized = await readFile(storagePath, "utf8");
      expect(serialized).not.toContain(plaintextSecret);
      expect(JSON.parse(serialized).version).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
