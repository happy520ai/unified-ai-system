import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3973A] Xiaomi One-Shot Smoke Approval Gate");

  const phase3971Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json");
  let phase3971;
  try {
    phase3971 = JSON.parse(await readFile(phase3971Path, "utf8"));
  } catch {
    console.error("[Phase3973A] FAIL: Phase3971A result.json not found.");
    process.exit(1);
  }

  const providerId = phase3971.matrix?.providerId ?? "mimo";

  const approvalInput = {
    decision: "rejected",
    provider: providerId,
    model: "",
    maxRequests: 1,
    providerCallAllowed: false,
    credentialRefOnly: true,
    rawSecretReadAllowed: false,
    rawSecretPrintAllowed: false,
    authorizationHeaderPrintAllowed: false,
    deployAllowed: false,
    chatRouteChangeAllowed: false,
    chatGatewayExecuteChangeAllowed: false,
    prompt: "请用一句中文回复：小米模型真实 smoke 测试成功。",
  };

  const approvalInputPath = resolve(repoRoot, "docs/provider-smoke/xiaomi-one-shot-smoke-approval.input.json");
  await mkdir(dirname(approvalInputPath), { recursive: true });

  let existingApproval = null;
  try {
    existingApproval = JSON.parse(await readFile(approvalInputPath, "utf8"));
  } catch {
    // Not exists yet
  }

  if (!existingApproval) {
    await writeFile(approvalInputPath, JSON.stringify(approvalInput, null, 2), "utf8");
    console.log("[Phase3973A] Created approval input template (decision=rejected).");
  } else {
    console.log("[Phase3973A] Approval input already exists:", existingApproval.decision);
  }

  const effectiveApproval = existingApproval || approvalInput;

  const executionAllowed =
    effectiveApproval.decision === "approved_execute_xiaomi_one_shot_real_provider_smoke" &&
    effectiveApproval.providerCallAllowed === true &&
    effectiveApproval.maxRequests === 1 &&
    effectiveApproval.credentialRefOnly === true &&
    effectiveApproval.rawSecretReadAllowed === false &&
    effectiveApproval.rawSecretPrintAllowed === false &&
    effectiveApproval.deployAllowed === false;

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: executionAllowed ? null : "xiaomi_one_shot_smoke_approval_missing",
    xiaomiOneShotApprovalGatePrepared: true,
    providerSmokeExecutionAllowed: executionAllowed,
    providerCallsMade: false,
    secretRead: false,
    rawSecretPrinted: false,
    deployExecuted: false,
    approvalInput: {
      decision: effectiveApproval.decision,
      provider: effectiveApproval.provider,
      maxRequests: effectiveApproval.maxRequests,
      providerCallAllowed: effectiveApproval.providerCallAllowed,
      credentialRefOnly: effectiveApproval.credentialRefOnly,
    },
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3973a-xiaomi-one-shot-smoke-approval-gate");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3973A] Provider:", providerId);
  console.log("[Phase3973A] Decision:", effectiveApproval.decision);
  console.log("[Phase3973A] Execution allowed:", executionAllowed);
  console.log("[Phase3973A] Provider calls made: false");
  console.log("[Phase3973A] Result written to evidence/phase-3973a-xiaomi-one-shot-smoke-approval-gate/result.json");

  return result;
}

main().catch((error) => {
  console.error("[Phase3973A] Fatal:", error.message);
  process.exit(1);
});
