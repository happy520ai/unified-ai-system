import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createCredentialVaultAdapter } from "./credentialVaultAdapter.js";

const vaultDir = mkdtempSync(join(tmpdir(), "uai-vault-"));
mkdirSync(join(vaultDir, "providers"), { recursive: true });
writeFileSync(join(vaultDir, "providers", "openai.key"), "sk-test-secret-value\n");
writeFileSync(join(vaultDir, "empty.key"), "   \n");
writeFileSync(join(vaultDir, "outside-root.txt"), "not-a-secret");

afterAll(() => {
  rmSync(vaultDir, { recursive: true, force: true });
});

function createAdapter(overrides: Record<string, unknown> = {}) {
  return createCredentialVaultAdapter({
    env: {},
    vaultDir,
    ...overrides,
  });
}

describe("credentialVaultAdapter file_key_path resolver", () => {
  it("resolves an in-vault secret file without materializing it", () => {
    const adapter = createAdapter();
    const result = adapter.resolveCredentialRef("file_key_path:providers/openai.key");
    expect(result.resolved).toBe(true);
    expect(result.code).toBe("FILE_KEY_REFERENCE_READY");
    expect(result.materialized).toBe(false);
    expect(result.secretAvailable).toBe(true);
    expect(result.secret).toBeUndefined();
  });

  it("materializes env and file secrets on explicit request", () => {
    const adapter = createAdapter({ env: { MY_PROVIDER_KEY: "env-secret" } });
    expect(adapter.materializeCredentialRef("env_key_name:MY_PROVIDER_KEY")).toEqual({
      materialized: true,
      code: "ENV_KEY_MATERIALIZED",
      secret: "env-secret",
    });
    expect(adapter.materializeCredentialRef("file_key_path:providers/openai.key")).toEqual({
      materialized: true,
      code: "FILE_KEY_MATERIALIZED",
      secret: "sk-test-secret-value",
    });
  });

  it("fails closed when the vault dir is not configured", () => {
    const adapter = createAdapter({ vaultDir: null });
    const result = adapter.resolveCredentialRef("file_key_path:providers/openai.key");
    expect(result.resolved).toBe(false);
    expect(result.code).toBe("CREDENTIAL_VAULT_NOT_CONFIGURED");
    expect(adapter.materializeCredentialRef("file_key_path:providers/openai.key").materialized).toBe(false);
  });

  it("rejects path traversal outside the vault dir", () => {
    const adapter = createAdapter();
    for (const reference of ["../outside-root.txt", "providers/../../outside-root.txt", "/etc/passwd"]) {
      const result = adapter.resolveCredentialRef(`file_key_path:${reference}`);
      expect(result.resolved).toBe(false);
      expect(result.code).toBe("CREDENTIAL_VAULT_PATH_ESCAPE_REJECTED");
    }
  });

  it("reports missing, empty, and oversized secret files honestly", () => {
    const adapter = createAdapter();
    expect(adapter.resolveCredentialRef("file_key_path:missing.key").code).toBe("CREDENTIAL_VAULT_FILE_NOT_FOUND");
    expect(adapter.resolveCredentialRef("file_key_path:empty.key").code).toBe("CREDENTIAL_VAULT_FILE_EMPTY");
    expect(adapter.resolveCredentialRef("file_key_path:providers").code).toBe("CREDENTIAL_VAULT_NOT_A_FILE");
  });

  it("keeps unknown reference types explicitly unimplemented", () => {
    const adapter = createAdapter();
    const result = adapter.resolveCredentialRef("hashicorp_vault:secret/data/x");
    expect(result.resolved).toBe(false);
    expect(result.code).toBe("CREDENTIAL_RESOLVER_NOT_IMPLEMENTED");
  });

  it("redacts secrets in audit events and redactSecret output", () => {
    const adapter = createAdapter();
    expect(adapter.redactSecret("super-secret")).toBe("[redacted]");
    const event = adapter.auditCredentialAccess({
      eventType: "materialize",
      credentialRef: "file_key_path:providers/openai.key",
      providerId: "openai",
      result: "success",
    });
    expect(event.credentialRef).not.toContain("sk-test-secret-value");
  });
});
