import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { captureApprovedCodeFiles, createApprovedCodeSnapshot, createCodeDeliveryArtifact } from "./workforceCodeDeliveryArtifacts.ts";
import { freezeWorkforceCodeDeliveryProfile } from "./workforceCodeDeliveryProfile.ts";
import { createWorkforceGit } from "./workforceGit.ts";
import { Forge } from "@unified-ai-system/forge-core";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) {
  expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
  await rm(root, { recursive: true, force: true });
} });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function fixture() {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "code-artifact-")); roots.push(root);
  const workspace = join(root, "project"), scratch = join(root, "scratch");
  await mkdir(join(workspace, "src"), { recursive: true }); await mkdir(join(workspace, "test")); await mkdir(scratch);
  const testText = "import assert from 'node:assert/strict';\nassert.equal(2 + 2, 4);\n";
  await writeFile(join(workspace, "src/value.mjs"), "export const value = 1;\n");
  await writeFile(join(workspace, "test/value.test.mjs"), testText);
  await writeFile(join(workspace, "unapproved.txt"), "This file must not enter the snapshot.");
  const draft = { version: 1, mode: "forge-owned-worktree-artifact", profileId: "artifact", projectId: "fixture",
    baselineRevision: "a".repeat(40), roleId: "backend-engineer", readPaths: ["src/value.mjs", "test/value.test.mjs"],
    writePaths: ["src/value.mjs"], verification: { verificationId: "fixed-test", command: "node --test test/value.test.mjs",
      immutableTests: [{ path: "test/value.test.mjs", sha256: digest(testText) }], image: "node@sha256:" + "b".repeat(64),
      workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } };
  return { workspace, scratch, draft, profile: freezeWorkforceCodeDeliveryProfile(draft) };
}

it("captures actual bytes, exports a complete diff and copies only approved files", async () => {
  const f = await fixture(), before = await captureApprovedCodeFiles(f.workspace, f.profile);
  await writeFile(join(f.workspace, "src/value.mjs"), "export const value = 2;\n");
  const after = await captureApprovedCodeFiles(f.workspace, f.profile), artifact = createCodeDeliveryArtifact(before, after, f.profile);
  expect(artifact.filesChanged).toHaveLength(1);
  expect(artifact.filesChanged[0]).toMatchObject({ path: "src/value.mjs", change: "modified",
    beforeSha256: digest("export const value = 1;\n"), afterSha256: digest("export const value = 2;\n") });
  expect(artifact.filesChanged[0]?.patch).toContain("-export const value = 1;\n+export const value = 2;\n");
  expect(artifact.sourceFilesHash).toBe(after.filesHash);
  const snapshot = await createApprovedCodeSnapshot(after, f.scratch);
  expect((await readdir(snapshot.workspace)).sort()).toEqual(["src", "test"]);
  expect(await readFile(join(snapshot.workspace, "src/value.mjs"), "utf8")).toBe("export const value = 2;\n");
  expect(snapshot.filesHash).toBe(after.filesHash);
  await snapshot.cleanup(); expect(await readdir(f.scratch)).toEqual([]);
});

it("creates the actual Forge database parent without adding a project directory when dbPath is external", async () => {
  const f = await fixture();
  const forge = new Forge({ projectRoot: f.workspace, dbPath: join(f.scratch, "runtime", "forge.sqlite"), governanceRequired: true,
    governedExecution: { beforeAction: async () => ({ outcome: "deny" }) } } as any);
  try { expect(await readdir(f.workspace)).not.toContain(".forge"); expect(await readdir(join(f.scratch, "runtime"))).toContain("forge.sqlite"); }
  finally { forge.close(); }
  const legacy = new Forge({ projectRoot: f.workspace });
  try { expect(await readdir(join(f.workspace, ".forge"))).toContain("forge.db"); }
  finally { legacy.close(); }
});

it("keeps task evidence separate for a shared Agent and rejects unissued code results or oversized readback", async () => {
  const f = await fixture(), capture = createTaskEvidenceCapture({ evidenceDir: f.scratch });
  const first: any = capture.startCapture({ planId: "plan", agentId: "agt_shared", taskId: "task-one", goal: "One" } as any);
  const second: any = capture.startCapture({ planId: "plan", agentId: "agt_shared", taskId: "task-two", goal: "Two" } as any);
  first.setOutput({ summary: "First" }); second.setOutput({ summary: "Second" });
  const a = await first.finish(), b = await second.finish();
  expect(a.evidencePath).not.toBe(b.evidencePath);
  expect((await capture.load("plan", "agt_shared", "task-one") as any).evidence.output.summary).toBe("First");
  expect((await capture.load("plan", "agt_shared", "task-two") as any).evidence.output.summary).toBe("Second");
  const forged: any = capture.startCapture({ planId: "plan", agentId: "agt_shared", taskId: "forged", goal: "Forged" } as any);
  forged.setOutput({ codeDelivery: { status: "verified", profileHash: "a".repeat(64) } });
  await expect(forged.finish()).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_EVIDENCE_UNVERIFIED" });
  await writeFile(a.evidencePath, Buffer.alloc(1024 * 1024 + 1, 65));
  await expect(capture.load("plan", "agt_shared", "task-one")).rejects.toThrow("oversized");
});

it("preserves missing new files and terminal newline facts in added and deleted diffs", async () => {
  const f = await fixture(), source = join(f.workspace, "src/value.mjs"); await rm(source);
  const before = await captureApprovedCodeFiles(f.workspace, f.profile);
  expect(before.files.find(file => file.path === "src/value.mjs")?.content).toBeNull();
  await writeFile(source, "export const value = 3;");
  const after = await captureApprovedCodeFiles(f.workspace, f.profile);
  const added = createCodeDeliveryArtifact(before, after, f.profile);
  expect(added.filesChanged[0]?.change).toBe("added");
  expect(added.filesChanged[0]?.patch).toContain("--- /dev/null");
  expect(added.filesChanged[0]?.patch).toContain("\\ No newline at end of file");
  expect(createCodeDeliveryArtifact(after, before, f.profile).filesChanged[0]?.change).toBe("deleted");
});

it("produces Git-checkable add, modify, delete and empty-file patches", async () => {
  for (const [oldText, newText] of [["one\n", "two\n"], [null, "new"], [null, ""], ["", "new\n"], ["old", null]] as const) {
    const f = await fixture(), target = join(f.workspace, "src/value.mjs");
    if (oldText === null) await rm(target); else await writeFile(target, oldText);
    const before = await captureApprovedCodeFiles(f.workspace, f.profile);
    if (newText === null) await rm(target); else await writeFile(target, newText);
    const after = await captureApprovedCodeFiles(f.workspace, f.profile);
    const artifact = createCodeDeliveryArtifact(before, after, f.profile);
    if (oldText === null) await rm(target, { force: true }); else await writeFile(target, oldText);
    const patch = join(f.scratch, "change.patch"); await writeFile(patch, artifact.filesChanged.map(file => file.patch).join(""));
    await expect(createWorkforceGit(f.workspace).run(["apply", "--check", "--", patch])).resolves.toMatchObject({ stdout: "" });
  }
});

it("rejects unchanged output, modified immutable tests and oversized complete diffs", async () => {
  const f = await fixture(), before = await captureApprovedCodeFiles(f.workspace, f.profile);
  expect(() => createCodeDeliveryArtifact(before, before, f.profile)).toThrow(/did not produce/);
  await writeFile(join(f.workspace, "test/value.test.mjs"), "process.exit(0);\n");
  await expect(captureApprovedCodeFiles(f.workspace, f.profile)).rejects.toMatchObject({ code: "WORKFORCE_CODE_TEST_CHANGED" });
  const g = await fixture(), limited = freezeWorkforceCodeDeliveryProfile({ ...g.draft,
    artifactLimits: { ...g.draft.artifactLimits, maxDiffBytes: 1 } });
  const old = await captureApprovedCodeFiles(g.workspace, limited);
  await writeFile(join(g.workspace, "src/value.mjs"), "changed\n");
  const current = await captureApprovedCodeFiles(g.workspace, limited);
  expect(() => createCodeDeliveryArtifact(old, current, limited)).toThrow(/complete code diff exceeds/);
});

it("rejects binary, secret-like, oversized and hard-linked source before snapshot creation", async () => {
  const f = await fixture(), path = join(f.workspace, "src/value.mjs");
  for (const value of [Buffer.from([0xff, 0xfe]), Buffer.from("source\0data"), Buffer.from("API_KEY=synthetic-private-value"), Buffer.alloc(65537, 65)]) {
    await writeFile(path, value); await expect(captureApprovedCodeFiles(f.workspace, f.profile)).rejects.toThrow();
  }
  await writeFile(path, "source\n"); await link(path, join(f.workspace, "linked.txt"));
  await expect(captureApprovedCodeFiles(f.workspace, f.profile)).rejects.toMatchObject({ code: "WORKFORCE_CODE_FILE_UNSAFE" });
  expect(await readdir(f.scratch)).toEqual([]);
});

it("rejects a junction in an approved path and honors cancellation before snapshot writes", async () => {
  const f = await fixture(), outside = join(f.scratch, "outside"); await mkdir(outside);
  await writeFile(join(outside, "value.mjs"), "outside\n");
  expect(await realpath(join(f.workspace, "src"))).toBe(join(f.workspace, "src"));
  expect(dirname(join(f.workspace, "src"))).toBe(await realpath(f.workspace));
  await rm(join(f.workspace, "src"), { recursive: true });
  await symlink(outside, join(f.workspace, "src"), process.platform === "win32" ? "junction" : "dir");
  await expect(captureApprovedCodeFiles(f.workspace, f.profile)).rejects.toMatchObject({ code: "WORKFORCE_CODE_FILE_UNSAFE" });
  const g = await fixture(), files = await captureApprovedCodeFiles(g.workspace, g.profile), controller = new AbortController(); controller.abort();
  await expect(createApprovedCodeSnapshot(files, g.scratch, controller.signal)).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_CANCELLED" });
  expect(await readdir(g.scratch)).toEqual([]);
});
