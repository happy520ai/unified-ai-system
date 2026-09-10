import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";
import { createExternalRunnerParameters, EXTERNAL_RUNNER_PERMISSION_BOUNDARY, inspectExternalRunnerFileChange, validateExternalRunnerFileChange } from "./workforceExternalRunnerPermissions.ts";
import type { WorkforceExternalRunnerProfileInput } from "@unified-ai-system/shared-contracts";

function draft(platform: "win32" | "linux" | "darwin" = "win32"): WorkforceExternalRunnerProfileInput {
  return { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native", projectId: "owned", roleId: "backend-engineer", baselineRevision: "a".repeat(40),
    binary: { path: platform === "win32" ? "E:/Native/codex.exe" : "/opt/native/codex", sha256: "b".repeat(64), version: "0.153.4", platform },
    nativeModel: { modelId: "unchanged-model", providerId: "unchanged-provider" }, disabledMcpServers: ["server_b", "server-a"],
    limits: { timeoutMs: 5000, maxInputBytes: 4096, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "test", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: "c".repeat(64) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
}
const proposal = (path = "src/value.mjs", type = "update", diff = "@@ -1 +1 @@\n-old\n+new\n") => ({ id: "patch-one", type: "fileChange", status: "inProgress",
  changes: [{ path, kind: type === "update" ? { type, move_path: null } : { type }, diff }] });
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function files() {
  const base = resolve("apps/ai-gateway-service/evidence/product-final"), root = await mkdtemp(join(base, "t064-permissions-")), workspace = join(root, "workspace");
  cleanups.push(async () => { expect(await realpath(root)).toBe(resolve(root)); expect(resolve(root).startsWith(resolve(base) + sep)).toBe(true); await rm(root, { recursive: true, force: true }); });
  await mkdir(join(workspace, "src"), { recursive: true }); await mkdir(join(root, "outside")); await writeFile(join(workspace, "src/value.mjs"), "old\n");
  return { root, workspace, profile: freezeWorkforceExternalRunnerProfile(draft(process.platform as "win32" | "linux" | "darwin")), target: join(workspace, "src/value.mjs") };
}

describe("fixed native permissions and file proposal boundaries", () => {
  it("uses unique experimental named profiles with only exact reviewed read paths", () => {
    const profile = freezeWorkforceExternalRunnerProfile(draft()), result = createExternalRunnerParameters(profile, "E:/Owned Worktree");
    const again = createExternalRunnerParameters(profile, "E:/Owned Worktree"), name = result.threadParams.permissions as string;
    expect(again.threadParams.permissions).not.toBe(name); expect(result.turnParams.permissions).toBe(name);
    expect(result.args.slice(0, 3)).toEqual(["app-server", "--listen", "stdio://"]);
    const overrides = result.args.slice(3).filter((_value, index) => index % 2 === 1);
    expect(overrides).toEqual(["shell_tool", "apps", "plugins", "hooks", "multi_agent", "view_image", "image_generation", "goals", "sleep_tool", "tool_suggest", "shell_snapshot", "shell_snapshot_v2"].map(name => `features.${name}=false`)
      .concat(['web_search="disabled"', "notify=[]", "mcp_servers.server-a.enabled=false", "mcp_servers.server_b.enabled=false"]));
    expect(result.threadParams).toMatchObject({ cwd: "E:\\Owned Worktree", runtimeWorkspaceRoots: ["E:\\Owned Worktree"], approvalPolicy: "untrusted", approvalsReviewer: "user", ephemeral: false,
      config: { permissions: { [name]: { filesystem: { ":root": "deny", ":minimal": "read", ":workspace_roots": { ".": "deny", "src/value.mjs": "read", "test/value.test.mjs": "read" } }, network: { enabled: false } } } } });
    expect(result.turnParams).toEqual({ permissions: name, runtimeWorkspaceRoots: ["E:\\Owned Worktree"], cwd: "E:\\Owned Worktree", approvalPolicy: "untrusted", approvalsReviewer: "user" });
    expect(JSON.stringify(result)).not.toMatch(/sandboxPolicy|sandbox_mode|sandbox_policy|--profile|apply_patch_freeform|unchanged-model|unchanged-provider/);
    expect(EXTERNAL_RUNNER_PERMISSION_BOUNDARY).toEqual({ experimentalApiRequired: true, runtimeReadConfinementProofRequired: true, mcpExclusions: "profile-listed-servers-only" });
    expect(Object.isFrozen(result.args)).toBe(true);
  });

  it("refuses ambiguous MCP override IDs and unowned roots without a fallback", () => {
    const profile = freezeWorkforceExternalRunnerProfile(draft());
    for (const root of ["relative", "E:/", "E:/owned/../other", "\\\\server\\share", "E:/owned\u0000"]) expect(() => createExternalRunnerParameters(profile, root)).toThrow();
    const dotted = freezeWorkforceExternalRunnerProfile({ ...draft(), disabledMcpServers: ["server.with.dot"] });
    expect(() => createExternalRunnerParameters(dotted, "E:/Owned")).toThrowError(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_MCP_OVERRIDE_ID_UNSUPPORTED" }));
    const empty = createExternalRunnerParameters(freezeWorkforceExternalRunnerProfile({ ...draft(), disabledMcpServers: [] }), "E:/Owned");
    expect(empty.args.some(arg => arg.startsWith("mcp_servers"))).toBe(false);
  });

  it("normalizes only approved target paths and retains complete diff metadata", () => {
    const profile = freezeWorkforceExternalRunnerProfile(draft());
    const relative = validateExternalRunnerFileChange(profile, "E:/Owned", proposal());
    const absolute = validateExternalRunnerFileChange(profile, "E:/Owned", proposal("E:/Owned/src/value.mjs"));
    expect(absolute).toEqual(relative); expect(relative.edits[0]).toMatchObject({ path: "src/value.mjs", absolutePath: "E:\\Owned\\src\\value.mjs", change: "modified", diffSha256: sha(proposal().changes[0]!.diff) });
    expect(relative.edits[0]!.diffBytes).toBe(Buffer.byteLength(relative.edits[0]!.diff)); expect(Object.isFrozen(relative.edits)).toBe(true);
    for (const type of ["add", "delete"]) expect(validateExternalRunnerFileChange(profile, "E:/Owned", proposal("src/value.mjs", type)).edits[0]!.change).toBe(type === "add" ? "added" : "deleted");
  });

  it("rejects protected or escaping paths, moves, extra fields, duplicates and oversized proposals", () => {
    const profile = freezeWorkforceExternalRunnerProfile(draft()), item = proposal();
    for (const path of ["../outside.mjs", "E:/other/value.mjs", ".env", ".mcp.json", ".git/config", "test/value.test.mjs", "src/../src/value.mjs", "src/value.mjs:alternate", "E:src/value.mjs"]) {
      expect(() => validateExternalRunnerFileChange(profile, "E:/Owned", proposal(path))).toThrow();
    }
    for (const value of [{ ...item, command: "anything" }, { ...item, changes: [] }, { ...item, changes: [item.changes[0], item.changes[0]] },
      { ...item, changes: [{ ...item.changes[0], kind: { type: "update", move_path: "outside.mjs" } }] },
      { ...item, changes: [{ ...item.changes[0], kind: { type: "update", permission: "session" } }] }, proposal("src/value.mjs", "update", "x".repeat(8193)),
      proposal("src/value.mjs", "update", "password=private-value")]) expect(() => validateExternalRunnerFileChange(profile, "E:/Owned", value)).toThrow();
    const getter = vi.fn(), accessor = Object.defineProperty({ ...item }, "changes", { enumerable: true, get: getter });
    expect(() => validateExternalRunnerFileChange(profile, "E:/Owned", accessor)).toThrow(); expect(getter).not.toHaveBeenCalled();
  });

  it("reads current file identity and hash without applying the native patch", async () => {
    const f = await files(), before = await readFile(f.target);
    const result = await inspectExternalRunnerFileChange(f.profile, f.workspace, proposal());
    expect(result.edits[0]).toMatchObject({ path: "src/value.mjs", beforeSha256: sha(before), beforeBytes: before.length });
    expect(result.edits[0]!.identity).toHaveProperty("ino"); expect(result.rootIdentity).toHaveProperty("dev");
    expect(await readFile(f.target)).toEqual(before);
    const controller = new AbortController(); controller.abort();
    await expect(inspectExternalRunnerFileChange(f.profile, f.workspace, proposal(), controller.signal)).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_CANCELLED" });
  });

  it("rejects current hard links and redirected parent or root directories", async () => {
    const f = await files(); await link(f.target, join(f.root, "outside/hard.mjs"));
    await expect(inspectExternalRunnerFileChange(f.profile, f.workspace, proposal())).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_FILE_IDENTITY_INVALID" });
    const g = await files(); await rename(join(g.workspace, "src"), join(g.root, "outside/moved"));
    await symlink(join(g.root, "outside/moved"), join(g.workspace, "src"), process.platform === "win32" ? "junction" : "dir");
    await expect(inspectExternalRunnerFileChange(g.profile, g.workspace, proposal())).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_FILE_IDENTITY_INVALID" });
    const linkedRoot = join(g.root, "linked-workspace"); await symlink(g.workspace, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    await expect(inspectExternalRunnerFileChange(g.profile, linkedRoot, proposal())).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_FILE_IDENTITY_INVALID" });
  });

  it("accepts only a missing approved added target and refuses type or size mismatches", async () => {
    const f = await files(); await rename(f.target, join(f.root, "outside/original.mjs"));
    expect((await inspectExternalRunnerFileChange(f.profile, f.workspace, proposal("src/value.mjs", "add"))).edits[0]).toMatchObject({ beforeSha256: null, beforeBytes: 0, identity: null });
    await expect(inspectExternalRunnerFileChange(f.profile, f.workspace, proposal())).rejects.toThrow();
    await mkdir(f.target); await expect(inspectExternalRunnerFileChange(f.profile, f.workspace, proposal())).rejects.toThrow();
    const g = await files(); await writeFile(g.target, "x".repeat(4097)); await expect(inspectExternalRunnerFileChange(g.profile, g.workspace, proposal())).rejects.toThrow();
    const h = await files(); await expect(inspectExternalRunnerFileChange(h.profile, h.workspace, proposal("src/value.mjs", "add"))).rejects.toThrow();
  });
});
