import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executeLowRiskMutationPlan } from "../gvc/low-risk-autonomous-executor.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3983A-GVC-Single-File-Real-Repair-Pilot";
const targetFile = "tools/phase3983a/phase3983a-gvc-single-file-target.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase-3983a-gvc-single-file-real-repair-pilot";

const fixedContent = `# Phase3983A GVC Single-file Target

status: FIXED
ownerFacingPurpose: Provide a low-risk controlled target for one real GVC repair pilot.
safetyBoundary: No provider, no secret, no deploy, no chat route mutation.
repairEvidence: GVC single-file real repair pilot changed only the status marker from BROKEN to FIXED.
`;

async function main() {
  console.log(`[${phaseId}] runner`);
  const beforeContent = await readFile(resolve(repoRoot, targetFile), "utf8");
  const beforeHash = sha256(beforeContent);
  const approval = buildApproval();
  const plan = buildPlan();
  const mutationResult = await executeLowRiskMutationPlan({
    repoRoot,
    approval,
    plan,
    evidenceDir: `${evidenceDir}/mutation`,
  });
  const afterContent = await readFile(resolve(repoRoot, targetFile), "utf8");
  const afterHash = sha256(afterContent);

  const evidence = {
    phaseId,
    completed: mutationResult.status === "passed" && afterContent.includes("status: FIXED"),
    recommended_sealed: mutationResult.status === "passed" && afterContent.includes("status: FIXED"),
    blocker: mutationResult.status === "passed" ? "none" : mutationResult.blocker,
    gvcRealRepairExecuted: mutationResult.realWritePerformed === true,
    mutationCount: mutationResult.mutationCount,
    mutatedFiles: mutationResult.mutatedFiles,
    targetFile,
    beforeHash,
    afterHash,
    beforeContent,
    afterContent,
    rollbackContent: beforeContent,
    rollbackHash: beforeHash,
    mutationResult,
    providerCallsMade: false,
    secretsRead: false,
    rawSecretPrinted: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    verificationCommands: [
      "node --check tools/phase3983a/run-gvc-single-file-real-repair-pilot.mjs",
      "node --check tools/phase3983a/verify-gvc-single-file-real-repair-pilot.mjs",
      "pnpm run run:phase3983a-gvc-single-file-real-repair-pilot",
      "pnpm run verify:phase3983a-gvc-single-file-real-repair-pilot",
      "pnpm -r --if-present check",
    ],
    nextRecommendedPhases: [
      "Phase3984A CredentialRef Multi-Provider One-Shot Real Smoke",
      "Phase3985A Isolated Normal/God/Tianshu Runtime Route Smoke",
    ],
    generatedAt: new Date().toISOString(),
  };

  await writeText("docs/gvc-real-repair/PHASE3983A_SINGLE_FILE_REAL_REPAIR.md", buildDoc(evidence));
  await writeText(`${evidenceDir}/result.json`, JSON.stringify(evidence, null, 2));
  console.log(`[${phaseId}] status=${mutationResult.status}`);
  console.log(`[${phaseId}] mutatedFiles=${mutationResult.mutatedFiles.join(",")}`);
  console.log(`[${phaseId}] providerCallsMade=false`);
}

function buildApproval() {
  return {
    approved: true,
    scope: "low_risk_only",
    maxMutationsPerLoop: 3,
    dailyRealExecutionLoopLimit: 100,
    rollbackRequired: true,
    providerAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
    chatRouteModificationAllowed: false,
    legacyModificationAllowed: false,
    projectContextModificationAllowed: false,
  };
}

function buildPlan() {
  return {
    planId: "phase3983a-gvc-single-file-real-repair",
    operations: ["docs_update"],
    mutations: [
      {
        type: "write_file",
        path: targetFile,
        content: fixedContent,
      },
    ],
    verifierCommands: [
      {
        command: process.execPath,
        args: [
          "tools/phase3983a/check-gvc-single-file-target-fixed.mjs",
        ],
      },
    ],
  };
}

function buildDoc(evidence) {
  return [
    "# Phase3983A GVC Single-file Real Repair Pilot",
    "",
    "## Goal",
    "",
    "执行一次低风险、单文件、可回滚的 GVC 真实修复试点：把专用目标文件的 `status: BROKEN` 修复为 `status: FIXED`。",
    "",
    "## Result",
    "",
    `- gvcRealRepairExecuted: ${evidence.gvcRealRepairExecuted}`,
    `- mutationCount: ${evidence.mutationCount}`,
    `- mutatedFiles: ${evidence.mutatedFiles.join(", ")}`,
    `- beforeHash: ${evidence.beforeHash}`,
    `- afterHash: ${evidence.afterHash}`,
    `- providerCallsMade: ${evidence.providerCallsMade}`,
    `- secretsRead: ${evidence.secretsRead}`,
    `- chatRouteModified: ${evidence.chatRouteModified}`,
    `- chatGatewayExecuteModified: ${evidence.chatGatewayExecuteModified}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker}`,
    "",
    "## Rollback",
    "",
    "把目标文件内容恢复为 evidence.result.json 中的 `rollbackContent`，并确认 SHA256 等于 `rollbackHash`。",
    "",
  ].join("\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeText(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
