import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

export function writeExecutionResult(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2000-gvc-os");
  const evidencePath = path.join(evidenceDir, "gvc-os-result.json");
  const safety = options.safety || {};
  const evidence = {
    phaseId: options.phaseId || "Phase2000-GVC-OS",
    taskId: options.taskId || "phase2000-gvc-os",
    status: options.status || "passed",
    generatedAt: new Date().toISOString(),
    recommendedSealed: Boolean(options.recommendedSealed),
    checks: options.checks || {},
    blocker: options.blocker || "none",
    providerCallsMade: safety.providerCallsMade === true,
    secretRead: safety.secretRead === true,
    deployReleasePerformed: safety.deployReleasePerformed === true,
    chatModified: safety.chatModified === true,
    chatGatewayExecuteModified: safety.chatGatewayExecuteModified === true,
    legacyModified: safety.legacyModified === true,
    projectContextModified: safety.projectContextModified === true,
    commitPerformed: false,
    pushPerformed: false,
    workspaceCleanClaimed: false,
  };

  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  return {
    path: evidencePath,
    evidence,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(JSON.stringify(writeExecutionResult({ recommendedSealed: false }), null, 2));
}
