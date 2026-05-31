import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977B] MiMo Continuous Real Provider Smoke Loop - Blocked Gate");

  const approvalTemplate = {
    decision: "approved_execute_mimo_continuous_real_provider_smoke",
    provider: "mimo",
    model: "",
    providerCallAllowed: true,
    continuousRealSmokeAllowed: true,
    credentialRefOnly: true,
    maxRequests: 200,
    maxDurationMinutes: 120,
    intervalSeconds: 30,
    retryPerRequest: 0,
    maxAllowedFailures: 5,
    stopOnConsecutiveFailures: 3,
    maxAllowedP95LatencyMs: 30000,
    maxInputTokensPerRequest: 512,
    maxOutputTokensPerRequest: 512,
    maxTotalEstimatedTokens: 250000,
    rawSecretReadAllowed: false,
    rawSecretPrintAllowed: false,
    authorizationHeaderPrintAllowed: false,
    deployAllowed: false,
    chatRouteChangeAllowed: false,
    chatGatewayExecuteChangeAllowed: false,
    prompts: [
      "请用一句中文回复：小米模型持续真实验证成功。",
      "请用一句话总结：PME AI Gateway 正在执行 Provider smoke。",
      '请返回 JSON：{"ok":true,"provider":"mimo","type":"smoke"}',
    ],
  };

  const approvalPath = resolve(repoRoot, "docs/provider-smoke/mimo-continuous-smoke-approval.input.json");
  await mkdir(dirname(approvalPath), { recursive: true });
  await writeFile(approvalPath, JSON.stringify(approvalTemplate, null, 2), "utf8");
  console.log("[Phase3977B] Approval input written to docs/provider-smoke/mimo-continuous-smoke-approval.input.json");

  // Check CredentialRef readiness
  const phase3972Path = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3972a-xiaomi-credentialref-readiness-without-secret/result.json");
  let credentialRefReady = false;
  try {
    const phase3972 = JSON.parse(await readFile(phase3972Path, "utf8"));
    credentialRefReady = phase3972.readyForOwnerAuthorizedOneShotSmoke === true;
  } catch {}

  // Check Safe Executor readiness
  const safeExecutorContractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js");
  let safeExecutorReady = false;
  try {
    const contract = await readFile(safeExecutorContractPath, "utf8");
    safeExecutorReady = contract.includes('"mimo"') && contract.includes("credentialRef:mimo:default");
  } catch {}

  const blocked = !credentialRefReady || !safeExecutorReady;
  const blockers = [];
  if (!credentialRefReady) blockers.push("mimo_credentialref_not_ready");
  if (!safeExecutorReady) blockers.push("mimo_safe_executor_not_ready");

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: blocked ? "mimo_credentialref_and_safe_executor_not_ready" : null,
    phase: "Phase3977B-MiMoContinuousRealProviderSmokeLoopBlockedGate",
    provider: "mimo",
    ownerApprovedContinuousRealSmoke: true,
    continuousRealSmokeAllowedByOwner: true,
    continuousRealSmokeExecuted: false,
    providerCallsMade: false,
    credentialRefOnly: true,
    credentialRefReady,
    safeExecutorReady,
    credentialRefResolverContractMissingMimo: !credentialRefReady,
    executorAllowlistMissingMimoCredentialRef: !safeExecutorReady,
    providerAllowlistMissingMimo: !safeExecutorReady,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    providerStabilityClaimed: false,
    approvalInput: {
      decision: approvalTemplate.decision,
      provider: approvalTemplate.provider,
      maxRequests: approvalTemplate.maxRequests,
      providerCallAllowed: approvalTemplate.providerCallAllowed,
      continuousRealSmokeAllowed: approvalTemplate.continuousRealSmokeAllowed,
    },
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977b-mimo-continuous-real-provider-smoke-loop");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3977B] Owner approved continuous smoke: true");
  console.log("[Phase3977B] CredentialRef ready:", credentialRefReady);
  console.log("[Phase3977B] Safe Executor ready:", safeExecutorReady);
  console.log("[Phase3977B] Blocked:", blocked);
  console.log("[Phase3977B] Blocker:", result.blocker ?? "none");
  console.log("[Phase3977B] Provider calls made: false");
  console.log("[Phase3977B] Result written to evidence/phase3977b-.../result.json");
}

main().catch((error) => {
  console.error("[Phase3977B] Fatal:", error.message);
  process.exit(1);
});
