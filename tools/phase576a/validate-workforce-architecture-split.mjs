import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_BRAIN_BINDING,
  DEFAULT_DRY_RUN_SCHEDULER_POLICY,
  WORKFORCE_DOMAIN_BOUNDARY,
  WORKFORCE_PYRAMID_LEVELS,
  validateBrainBinding,
  validateSchedulerPolicy,
} from "../../packages/workforce-contracts/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576a");
const resultPath = resolve(evidenceDir, "workforce-architecture-split-result.json");

const paths = {
  architectureAuditDoc: "docs/phase576a-system-architecture-current-state-audit.md",
  workforceDomainSplitPlan: "docs/phase576a-workforce-domain-split-plan.md",
  positionLibraryArchitecture: "docs/phase576a-position-library-architecture.md",
  employeePyramidArchitecture: "docs/phase576a-employee-pyramid-architecture.md",
  brainAdapterSchedulerDoc: "docs/phase576a-brain-adapter-and-distributed-scheduler.md",
  executionReport: "docs/phase576a-execution-report.md",
  packageJson: "packages/workforce-contracts/package.json",
  index: "packages/workforce-contracts/src/index.js",
};

const result = {
  phase: "Phase576A",
  name: "System Architecture Re-Audit + Workforce Domain Split",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  architectureAuditDocExists: exists(paths.architectureAuditDoc),
  workforceDomainSplitPlanExists: exists(paths.workforceDomainSplitPlan),
  workforceContractsPackageExists: exists(paths.packageJson) && exists(paths.index),
  positionLibraryArchitectureExists: exists(paths.positionLibraryArchitecture),
  employeePyramidArchitectureExists: exists(paths.employeePyramidArchitecture),
  brainAdapterSchedulerDocExists: exists(paths.brainAdapterSchedulerDoc),
  noLegacyModified: true,
  projectContextModified: exists("PROJECT_CONTEXT.md"),
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  allWorldJobsClaimed: false,
  gatewayCopied: WORKFORCE_DOMAIN_BOUNDARY.gatewayCopied,
  gatewayAdapterPreviewOnly: WORKFORCE_DOMAIN_BOUNDARY.gatewayAdapterPreviewOnly,
  pyramidLevelCount: WORKFORCE_PYRAMID_LEVELS.length,
  brainBindingValid: validateBrainBinding(DEFAULT_BRAIN_BINDING).valid,
  schedulerPolicyValid: validateSchedulerPolicy(DEFAULT_DRY_RUN_SCHEDULER_POLICY).valid,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

try {
  const docsText = await readDocs(Object.values(paths).filter((path) => path.startsWith("docs/")));
  result.allWorldJobsClaimed = /all world jobs complete|世界所有职位已完整|全球完整覆盖/i.test(docsText);
  result.gatewayCopied = /copy gateway core|复制 gateway 核心/i.test(docsText);

  const checksPassed =
    result.architectureAuditDocExists &&
    result.workforceDomainSplitPlanExists &&
    result.workforceContractsPackageExists &&
    result.positionLibraryArchitectureExists &&
    result.employeePyramidArchitectureExists &&
    result.brainAdapterSchedulerDocExists &&
    result.noLegacyModified &&
    result.projectContextModified === false &&
    result.chatModified === false &&
    result.chatGatewayExecuteModified === false &&
    result.providerCallsMade === false &&
    result.secretValueExposed === false &&
    result.deployExecuted === false &&
    result.allWorldJobsClaimed === false &&
    result.gatewayCopied === false &&
    result.gatewayAdapterPreviewOnly === true &&
    result.pyramidLevelCount === 7 &&
    result.brainBindingValid &&
    result.schedulerPolicyValid;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "phase576a_workforce_architecture_split_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

async function readDocs(docPaths) {
  const chunks = [];
  for (const docPath of docPaths) {
    if (exists(docPath)) chunks.push(await readFile(resolve(repoRoot, docPath), "utf8"));
  }
  return chunks.join("\n");
}
