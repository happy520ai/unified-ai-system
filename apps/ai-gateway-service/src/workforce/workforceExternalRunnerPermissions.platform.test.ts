import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createExternalRunnerParameters } from "./workforceExternalRunnerPermissions.ts";
import { freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";
import type { WorkforceExternalRunnerProfileInput } from "@unified-ai-system/shared-contracts";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const immutable = "import assert from 'node:assert/strict'; import { value } from '../src/value.mjs'; assert.equal(value, 2);\n";

function draft(platform: "win32" | "linux" | "darwin"): WorkforceExternalRunnerProfileInput {
  return { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-fixture", projectId: "fixture-project", roleId: "backend-engineer",
    baselineRevision: "a".repeat(40),
    binary: { path: platform === "win32" ? "E:/Synthetic Native/codex.exe" : "/synthetic-native/codex", sha256: "a".repeat(64), version: "0.153.4", platform },
    nativeModel: { modelId: "expected-native-model", providerId: "expected-native-provider" },
    disabledMcpServers: [], limits: { timeoutMs: 30000, maxInputBytes: 65536, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "fixed-test", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: sha(immutable) }],
        image: "node@sha256:" + "b".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
}

describe("ownedRoot platform symmetry", () => {
  it("accepts a POSIX root for a linux profile", () => {
    const parameters = createExternalRunnerParameters(
      freezeWorkforceExternalRunnerProfile(draft("linux")),
      "/home/runner/work/unified-ai-system/unified-ai-system/apps/ai-gateway-service/evidence/product-final/t064-controlled-abc",
    );
    expect(parameters.turnParams.cwd).toBe("/home/runner/work/unified-ai-system/unified-ai-system/apps/ai-gateway-service/evidence/product-final/t064-controlled-abc");
  });

  it("accepts a Windows root for a win32 profile", () => {
    expect(() => createExternalRunnerParameters(
      freezeWorkforceExternalRunnerProfile(draft("win32")),
      "E:\\UserData\\Temp\\t064-controlled-abc",
    )).not.toThrow();
  });

  it("rejects a POSIX root for a win32 profile (the previous CI failure)", () => {
    expect(() => createExternalRunnerParameters(
      freezeWorkforceExternalRunnerProfile(draft("win32")),
      "/home/runner/work/t064",
    )).toThrowError(/cannot be safely accepted/);
  });
});
