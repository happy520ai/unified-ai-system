import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3983A-GVC-Single-File-Real-Repair-Pilot";
const evidencePath = "apps/ai-gateway-service/evidence/phase-3983a-gvc-single-file-real-repair-pilot/result.json";
const targetFile = "tools/phase3983a/phase3983a-gvc-single-file-target.md";

async function main() {
  console.log(`[${phaseId}] verifier`);
  const evidence = JSON.parse(await readRequired(evidencePath));
  const target = await readRequired(targetFile);
  const doc = await readRequired("docs/gvc-real-repair/PHASE3983A_SINGLE_FILE_REAL_REPAIR.md");

  const checks = [
    ["phase id", evidence.phaseId === phaseId],
    ["completed=true", evidence.completed === true],
    ["recommended_sealed=true", evidence.recommended_sealed === true],
    ["blocker none", evidence.blocker === "none"],
    ["real repair executed", evidence.gvcRealRepairExecuted === true],
    ["one mutation", evidence.mutationCount === 1],
    ["only target mutated", Array.isArray(evidence.mutatedFiles) && evidence.mutatedFiles.length === 1 && evidence.mutatedFiles[0] === targetFile],
    ["target fixed", target.includes("status: FIXED") && !target.includes("status: BROKEN")],
    ["after hash matches", evidence.afterHash === sha256(target)],
    ["rollback content has broken marker", evidence.rollbackContent.includes("status: BROKEN")],
    ["rollback hash matches", evidence.rollbackHash === sha256(evidence.rollbackContent)],
    ["mutation result passed", evidence.mutationResult.status === "passed"],
    ["mutation result real write", evidence.mutationResult.realWritePerformed === true],
    ["no provider", evidence.providerCallsMade === false && evidence.mutationResult.providerCallsMade === false],
    ["no secret", evidence.secretsRead === false && evidence.mutationResult.secretRead === false],
    ["no deploy", evidence.deployExecuted === false && evidence.mutationResult.deployExecuted === false],
    ["no legacy", evidence.legacyModified === false && evidence.mutationResult.legacyModified === false],
    ["no project context", evidence.projectContextModified === false && evidence.mutationResult.projectContextModified === false],
    ["no chat route", evidence.chatRouteModified === false && evidence.mutationResult.chatModified === false],
    ["no chat gateway execute", evidence.chatGatewayExecuteModified === false && evidence.mutationResult.chatGatewayExecuteModified === false],
    ["doc includes rollback", doc.includes("Rollback") && doc.includes("rollbackContent")],
  ];

  let failed = false;
  for (const [label, ok] of checks) {
    if (!ok) failed = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  }

  if (failed) {
    console.error(`[${phaseId}] FAIL`);
    process.exit(1);
  }

  console.log(`[${phaseId}] PASS`);
}

async function readRequired(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`missing required file ${relativePath}: ${error.message}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
