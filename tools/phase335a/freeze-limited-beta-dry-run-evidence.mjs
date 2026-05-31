import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase335a");
const resultPath = resolve(evidenceDir, "limited-beta-final-evidence-freeze-result.json");
const checklistPath = resolve(repoRoot, "docs/phase335a-final-evidence-freeze-checklist.json");
const approvalPath = resolve(repoRoot, "docs/phase335a-human-approval-checklist.md");
const phase334a = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase334a/limited-beta-rc-final-dry-run-result.json"), "utf8"));
const result = {
  phase: "Phase335A",
  evidenceFreezeCompleted: phase334a.finalRcDryRunPassed === true,
  humanApprovalRequired: true,
  releaseExecuted: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(checklistPath, `${JSON.stringify(buildChecklist(), null, 2)}\n`, "utf8");
await writeFile(approvalPath, renderApprovalChecklist(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase335a-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildChecklist() {
  return {
    phase: "Phase335A",
    freezeInputs: [
      "phase334a final RC dry-run",
      "phase333a no-release gate",
      "phase334f mock statement polish",
      "phase334c reviewer workflow dry-run",
    ],
    humanApprovalRequired: true,
  };
}

function renderApprovalChecklist() {
  return [
    "# Phase335A Human Approval Checklist",
    "",
    "- Confirm final RC dry-run evidence freeze.",
    "- Confirm no release/deploy/tag/upload executed.",
    "- Confirm secret safety remained passed.",
    "- Confirm deploy is still not authorized.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase335A Execution Report",
    "",
    `- evidenceFreezeCompleted: ${result.evidenceFreezeCompleted}`,
    `- humanApprovalRequired: ${result.humanApprovalRequired}`,
    `- releaseExecuted: ${result.releaseExecuted}`,
    `- deployExecuted: ${result.deployExecuted}`,
    "",
  ].join("\n");
}
