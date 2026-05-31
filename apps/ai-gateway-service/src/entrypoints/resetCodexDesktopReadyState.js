import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const runsDir = resolve(repoRoot, ".codex-handoff/runs");
const latestResetJsonPath = resolve(runsDir, "latest-ready-state-reset.json");
const latestResetMarkdownPath = resolve(runsDir, "latest-ready-state-reset.md");

const snapshotFiles = [
  ".codex-handoff/inbox/latest-codex-result.md",
  ".codex-handoff/inbox/latest-codex-result.json",
  ".codex-handoff/review/latest-desktop-review.json",
  ".codex-handoff/review/latest-desktop-review.md",
  ".codex-handoff/review/latest-feedback-to-codex.md",
];

async function main() {
  const resetAt = new Date().toISOString();
  const resetId = resetAt.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
  const resetDir = resolve(runsDir, "ready-state-reset", resetId);
  await mkdir(resetDir, { recursive: true });

  const previousReview = await readJsonIfPresent(".codex-handoff/review/latest-desktop-review.json");
  const archivedFiles = [];
  for (const relativePath of snapshotFiles) {
    const file = await inspectFile(relativePath);
    if (!file.exists) {
      archivedFiles.push({
        relativePath,
        exists: false,
        archivedPath: null,
      });
      continue;
    }
    const archiveName = relativePath.replaceAll("/", "__").replaceAll("\\", "__");
    const archivedPath = resolve(resetDir, archiveName);
    await copyFile(resolve(repoRoot, relativePath), archivedPath);
    archivedFiles.push({
      relativePath,
      exists: true,
      archivedPath: relativeFromRoot(archivedPath),
      sizeBytes: file.sizeBytes,
      modifiedAt: file.modifiedAt,
    });
  }

  const resetRecord = {
    status: "ready",
    resetAt,
    resetId,
    mode: "desktop-automation-ready-state-reset",
    reason: "Archive the previous latest inbox/review/feedback state and mark the desktop automation loop as standby-ready for the next manual handoff.",
    previous: {
      goNoGo: previousReview?.goNoGo || null,
      boundaryViolationCount: previousReview?.boundaryViolationCount ?? null,
      verificationGapCount: previousReview?.verificationGapCount ?? null,
      evidenceGapCount: previousReview?.evidenceGapCount ?? null,
      recommendedNextAction: previousReview?.recommendedNextAction || null,
    },
    activeState: {
      latestGoNoGo: "standby-ready",
      currentBlocker: "none",
      recommendedNextAction: "待命状态：上一轮 inbox/review 已归档为 reset snapshot；可以生成或复制下一条任务，或等待新的 Codex result inbox。",
    },
    archivedFiles,
    resetDir: relativeFromRoot(resetDir),
    doesNotDeleteEvidence: true,
    doesNotMarkFailedEvidencePassed: true,
    executionEnabled: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    realSendExecuted: false,
    note: "Ready-state reset is a local status reset only. It does not send to Codex, does not call codex CLI, does not use codex exec, and does not rewrite failed review results as passed.",
  };

  const resetArchiveJsonPath = resolve(resetDir, "ready-state-reset.json");
  const resetArchiveMarkdownPath = resolve(resetDir, "ready-state-reset.md");
  await writeFile(resetArchiveJsonPath, `${JSON.stringify(resetRecord, null, 2)}\n`, "utf8");
  await writeFile(resetArchiveMarkdownPath, renderResetMarkdown(resetRecord), "utf8");
  await writeFile(latestResetJsonPath, `${JSON.stringify(resetRecord, null, 2)}\n`, "utf8");
  await writeFile(latestResetMarkdownPath, renderResetMarkdown(resetRecord), "utf8");

  console.log(JSON.stringify({
    status: "ready",
    resetAt,
    previousGoNoGo: resetRecord.previous.goNoGo,
    latestGoNoGo: resetRecord.activeState.latestGoNoGo,
    currentBlocker: resetRecord.activeState.currentBlocker,
    resetJsonPath: ".codex-handoff/runs/latest-ready-state-reset.json",
    resetMarkdownPath: ".codex-handoff/runs/latest-ready-state-reset.md",
    resetArchiveDir: resetRecord.resetDir,
    archivedFileCount: archivedFiles.filter((file) => file.exists).length,
    codexCliInvoked: false,
    codexExecInvoked: false,
    realSendExecuted: false,
  }, null, 2));
}

async function inspectFile(relativePath) {
  try {
    const info = await stat(resolve(repoRoot, relativePath));
    return {
      exists: info.isFile(),
      sizeBytes: info.size,
      modifiedAt: info.mtime.toISOString(),
    };
  } catch {
    return {
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
    };
  }
}

async function readJsonIfPresent(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function relativeFromRoot(pathValue) {
  return resolve(pathValue).replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}

function renderResetMarkdown(record) {
  return [
    "# Codex Desktop Ready State Reset",
    "",
    `- status: ${record.status}`,
    `- resetAt: ${record.resetAt}`,
    `- mode: ${record.mode}`,
    `- previousGoNoGo: ${record.previous.goNoGo || "none"}`,
    `- latestGoNoGo: ${record.activeState.latestGoNoGo}`,
    `- currentBlocker: ${record.activeState.currentBlocker}`,
    `- recommendedNextAction: ${record.activeState.recommendedNextAction}`,
    `- resetDir: ${record.resetDir}`,
    `- doesNotDeleteEvidence: ${record.doesNotDeleteEvidence}`,
    `- doesNotMarkFailedEvidencePassed: ${record.doesNotMarkFailedEvidencePassed}`,
    "- executionEnabled=false",
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "- realSendExecuted=false",
    "",
    "## Archived Files",
    ...record.archivedFiles.map((file) => `- ${file.relativePath}: ${file.exists ? file.archivedPath : "missing"}`),
    "",
    record.note,
    "",
  ].join("\n");
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
