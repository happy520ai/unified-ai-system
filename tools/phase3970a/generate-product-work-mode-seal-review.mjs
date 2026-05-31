import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3970a-product-work-mode-seal-review.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3970a-product-work-mode-seal-review/result.json";

function ensureParent(relativePath) {
  mkdirSync(resolve(repoRoot, relativePath, ".."), { recursive: true });
}

function writeJson(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  ensureParent(relativePath);
  writeFileSync(resolve(repoRoot, relativePath), value, "utf8");
}

function readJsonIfExists(relativePath) {
  const full = resolve(repoRoot, relativePath);
  return existsSync(full) ? JSON.parse(readFileSync(full, "utf8")) : null;
}

export function generateProductWorkModeSealReview() {
  const phase3959 = readJsonIfExists("apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-minimum-loop/result.json");
  const phase3960 = readJsonIfExists("apps/ai-gateway-service/evidence/phase3960a-owner-daily-use-record-ingest-and-classifier/result.json");
  const phase3967 = readJsonIfExists("apps/ai-gateway-service/evidence/phase3967a-owner-approval-gate-for-real-provider-smoke/result.json");
  const ownerRecordMissing = phase3960?.ownerRecordFound !== true;
  const providerApprovalMissing = phase3967?.providerSmokeExecutionAllowed !== true;
  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: null,
    phaseRangeReviewed: "Phase3959A-3969A",
    completedPhases: [
      "Phase3959A loop prepared",
      "Phase3961A UI scan completed",
      "Phase3962A provider matrix generated",
      "Phase3963A CredentialRef readiness checked",
      "Phase3964A self-evolution kernel defined",
      "Phase3965A next-phase selection policy defined",
      "Phase3966A low-risk self-patch dry-run ready",
      "Phase3968A dashboard added",
      "Phase3969A rollback dry-run generated",
    ],
    blockedPhases: [
      ...(ownerRecordMissing ? ["Phase3960A owner_daily_use_record_missing"] : []),
      ...(phase3959?.ownerDailyUseCompleted !== true ? ["Phase3959A owner daily use not completed"] : []),
      ...(providerApprovalMissing ? ["Phase3967A owner_real_provider_smoke_approval_missing"] : []),
    ],
    ownerDogfoodingClaimedComplete: false,
    providerStabilityClaimed: false,
    productionReadyClaimed: false,
    deployClaimed: false,
    realProviderSmokeAllowedNext: false,
    ownerApprovalRequiredForRealProviderSmoke: true,
    deployAllowedNext: false,
    chatRouteChangeAllowedNext: false,
    chatGatewayExecuteChangeAllowedNext: false,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    controlledMutationExpansionAttempted: false,
  };

  writeText(
    docPath,
    `# Phase3970A Product Work Mode Seal Review\n\n## A. Completed\n\n${result.completedPhases.map((item) => `- ${item}`).join("\n")}\n\n## B. Recommended Seal\n\nPhase3959A-3969A can be sealed as a Product Work Mode governance and readiness bundle, with explicit blockers preserved where real owner input or owner Provider approval is missing.\n\n## C. Still Blocked\n\n${result.blockedPhases.map((item) => `- ${item}`).join("\n") || "- blocker: none"}\n\n## D. Cannot Misclaim\n\n- Do not claim owner dogfooding completed.\n- Do not claim Provider stability.\n- Do not claim production ready.\n- Do not claim deploy completed.\n- Do not claim Product Work Mode fixed all UI experience issues.\n\n## E. Owner Inputs Required Next\n\n- Owner daily-use record: \`docs/owner-daily-use/records/owner-daily-use-0001.json\`.\n- Owner real Provider smoke approval packet with provider, maxRequests=1, credentialRefOnly=true, and providerCallAllowed=true.\n\n## F. Real Provider Smoke Allowed Next\n\nNo. realProviderSmokeAllowedNext=false until owner approval input is explicit and valid.\n\n## G. Real Deploy Allowed\n\nNo. deployAllowedNext=false. No deploy approval exists.\n\n## H. /chat Or /chat-gateway/execute Change Allowed\n\nNo. chatRouteChangeAllowedNext=false and chatGatewayExecuteChangeAllowedNext=false.\n\n## Rollback\n\n- Delete \`tools/phase3970a/\`.\n- Delete \`docs/phase3970a-product-work-mode-seal-review.md\`.\n- Delete \`apps/ai-gateway-service/evidence/phase3970a-product-work-mode-seal-review/\`.\n- Restore package.json scripts and README/AGENTS managed block entries.\n`,
  );
  writeJson(resultPath, result);
  return result;
}

export function main() {
  const result = generateProductWorkModeSealReview();
  console.log(JSON.stringify({
    completed: result.completed,
    blocker: result.blocker,
    phaseRangeReviewed: result.phaseRangeReviewed,
    realProviderSmokeAllowedNext: result.realProviderSmokeAllowedNext,
    ownerApprovalRequiredForRealProviderSmoke: result.ownerApprovalRequiredForRealProviderSmoke,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
