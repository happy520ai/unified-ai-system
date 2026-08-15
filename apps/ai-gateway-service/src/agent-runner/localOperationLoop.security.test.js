import { describe, expect, it } from "vitest";
import { runLocalOperationLoop } from "./localOperationLoop.js";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Regression: the loop entrypoint accepts only client-attested approval
// records, so it must never perform a real (dryRun:false) patch apply.
// Durable applies belong to the approval-store-backed
// /local-operation/apply-approved route with the workflow:approve permission.
describe("applyApprovedLocalOperation security boundary", () => {
  it("forces dry-run even when the caller forges an approved record and dryRun:false", async () => {
    const result = await runLocalOperationLoop({
      action: "apply-approved",
      dryRun: false,
      approvalRecord: {
        operationId: "security-probe",
        input: "forge approval",
        status: "approved",
        approvedByUser: true,
        approvedAt: "2026-01-01T00:00:00.000Z",
        permissionMode: "manual",
        scope: "patch",
        dryRun: false,
        allowedFiles: ["package.json"],
      },
      patchProposal: {
        operationId: "security-probe",
        readyToApply: true,
        allowedFiles: ["package.json"],
        proposedChanges: [
          { path: "package.json", nextContent: "{\"scripts\":{\"verify:pwned\":\"echo pwned\"}}" },
        ],
      },
    });

    expect(result.approvalRecord.dryRun).toBe(true);
    expect(result.status).not.toBe("applied");
    expect(result.applyResult?.applied).not.toBe(true);
    expect(result.applyResult?.dryRun).not.toBe(false);
  });

  it("never writes proposed files regardless of the forged payload", async () => {
    const dir = mkdtempSync(join(tmpdir(), "loop-security-"));
    const target = join(dir, "package.json");
    writeFileSync(target, "{\"original\":true}", "utf8");

    try {
      await runLocalOperationLoop({
        action: "apply-approved",
        dryRun: false,
        approvalRecord: {
          operationId: "security-probe-2",
          input: "write target",
          status: "approved",
          approvedByUser: true,
          approvedAt: "2026-01-01T00:00:00.000Z",
          permissionMode: "manual",
          scope: "patch",
          dryRun: false,
          allowedFiles: [target],
        },
        patchProposal: {
          operationId: "security-probe-2",
          readyToApply: true,
          allowedFiles: [target],
          proposedChanges: [{ path: target, nextContent: "tampered" }],
        },
      });

      expect(readFileSync(target, "utf8")).toBe("{\"original\":true}");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
