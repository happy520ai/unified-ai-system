import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutionApprovalGate } from "./executionApprovalGate.js";

const cleanupPaths = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => (
    rm(path, { recursive: true, force: true })
  )));
});

describe("execution approval gate persistence", () => {
  it("atomically persists approvals without leaving temp files", async () => {
    const root = await mkdtemp(join(tmpdir(), "approval-gate-"));
    cleanupPaths.push(root);
    const storePath = join(root, "approvals.json");
    const gate = createExecutionApprovalGate({ storePath });

    await gate.approve({
      planId: "plan-1",
      userId: "user-1",
      approvedScopes: ["read"],
    });

    const stored = JSON.parse(await readFile(storePath, "utf8"));
    expect(stored.approvals).toHaveLength(1);
    expect(stored.approvals[0].planId).toBe("plan-1");
    expect(await readdir(root)).toEqual(["approvals.json"]);
  });
});
