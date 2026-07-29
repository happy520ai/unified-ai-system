import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntimeCredentialStore } from "./runtimeCredentialStore.js";

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
    const storagePath = join(root, "destination-is-a-directory");
    await mkdir(storagePath);

    try {
      const store = createRuntimeCredentialStore({
        env: { PME_RUNTIME_CREDENTIAL_STORE_MODE: "local-file" },
        storagePath,
      });
      const result = store.set({
        providerId: "test",
        apiKey: "secret-value",
      });

      expect(result.persisted).toBe(false);
      expect(await readdir(root)).toEqual(["destination-is-a-directory"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
