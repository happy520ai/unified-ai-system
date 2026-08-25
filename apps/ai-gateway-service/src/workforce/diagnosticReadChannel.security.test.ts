import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createWorkforceRoutes } from "../http/workforceRoutes.js";
import { createDiagnosticReadChannel } from "./diagnosticReadChannel.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function createRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "diagnostic-read-security-"));
  cleanupPaths.push(root);
  return root;
}

describe("diagnostic read zero-value disclosure boundary", () => {
  it("returns configuration structure without returning known or unknown values", async () => {
    const root = await createRoot();
    const ledgerPath = join(root, "diagnostic-ledger.jsonl");
    const unknownValue = "value-with-spaces:$not-covered-by-secret-regex";
    const nestedToken = "custom-scheme://user:password@example.test";
    await writeFile(join(root, ".env"), `CUSTOM_SETTING=${unknownValue}\nEMPTY_SETTING=\n`, "utf8");
    await writeFile(join(root, "auth.json"), JSON.stringify({ profile: { token: nestedToken, enabled: true } }), "utf8");
    const channel = createDiagnosticReadChannel({ rootDir: root, ledgerPath });

    const dotenvResult = await channel.read({ path: ".env", requestor: "auditor-1", reason: "configuration diagnosis" });
    const jsonResult = await channel.read({ path: "auth.json", requestor: "auditor-1", reason: "auth diagnosis" });
    const serialized = JSON.stringify({ dotenvResult, jsonResult, ledger: await readFile(ledgerPath, "utf8") });

    expect(dotenvResult).toEqual(expect.objectContaining({ allowed: true, present: true, redacted: true }));
    expect(dotenvResult.diagnostic.keys).toEqual(["CUSTOM_SETTING", "EMPTY_SETTING"]);
    expect(jsonResult.diagnostic.sensitiveKeys).toContain("profile.token");
    expect(serialized).not.toContain(unknownValue);
    expect(serialized).not.toContain(nestedToken);
    expect(dotenvResult.safety).toEqual(expect.objectContaining({
      rawContentReturned: false,
      valuesReturned: false,
      auditRecorded: true,
    }));
  });

  it("uses an exact file allowlist and denies reads when the audit ledger is unavailable", async () => {
    const root = await createRoot();
    await writeFile(join(root, ".env.backup"), "TOKEN=must-never-return", "utf8");
    await writeFile(join(root, ".env"), "TOKEN=must-never-return", "utf8");
    const channel = createDiagnosticReadChannel({ rootDir: root, ledgerPath: join(root, "ledger.jsonl") });
    const auditUnavailable = createDiagnosticReadChannel({ rootDir: root, ledgerPath: root });

    await expect(channel.read({ path: ".env.backup", requestor: "auditor-1" }))
      .resolves.toEqual(expect.objectContaining({ allowed: false, reason: "not_allowlisted" }));
    await expect(auditUnavailable.read({ path: ".env", requestor: "auditor-1" }))
      .resolves.toEqual(expect.objectContaining({
        allowed: false,
        reason: "audit_unavailable",
        safety: expect.objectContaining({ auditRecorded: false, rawContentReturned: false }),
      }));
  });

  it("binds the diagnostic audit requestor to the authenticated identity", async () => {
    const read = vi.fn(async () => ({ allowed: true }));
    const workforceExecutor = {
      getDiagnosticChannel: () => ({ read }),
      execute: vi.fn(),
      approveExecution: vi.fn(),
      revokeApproval: vi.fn(),
    };
    const writeJson = vi.fn();
    const routes = createWorkforceRoutes(
      { workforceExecutor, workforceService: {}, workflowService: {} },
      {
        readCapabilityJson: vi.fn(async () => ({ path: ".env", requestor: "forged-user" })),
        writeJson,
        writeServiceLog: vi.fn(),
        writeErrorResponse: vi.fn(),
        createOkEnvelope: (value: unknown) => value,
        createErrorEnvelope: vi.fn(),
      },
    );
    const route = routes.handlers.get("POST /workforce/diagnostic/read");

    await route.handler({ enterpriseIdentity: { userId: "auditor-1" } }, {}, { startedAt: new Date() });

    expect(route.permission).toBe("audit:read");
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ requestor: "auditor-1" }));
    expect(writeJson).toHaveBeenCalled();
  });
});
