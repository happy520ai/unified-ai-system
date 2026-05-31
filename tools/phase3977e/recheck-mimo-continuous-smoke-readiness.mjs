import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

async function main() {
  console.log("[Phase3977E] MiMo Continuous Smoke Readiness Recheck");

  // Check CredentialRef resolver contract
  const resolverPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js");
  const resolver = await readFile(resolverPath, "utf8");
  const credentialRefReady = resolver.includes('providerId: "mimo"') && resolver.includes("credentialRef:mimo:default");

  // Check Safe Executor contract
  const executorPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js");
  const executor = await readFile(executorPath, "utf8");
  const safeExecutorReady = executor.includes('"mimo"') && executor.includes("credentialRef:mimo:default") && executor.includes("mimo-v2.5-pro");

  // Check approval
  const approvalPath = resolve(repoRoot, "docs/provider-smoke/mimo-continuous-smoke-approval.input.json");
  let approval = null;
  try {
    approval = JSON.parse(await readFile(approvalPath, "utf8"));
  } catch {}
  const approvalValid =
    approval?.decision === "approved_execute_mimo_continuous_real_provider_smoke" &&
    approval?.providerCallAllowed === true &&
    approval?.continuousRealSmokeAllowed === true &&
    approval?.credentialRefOnly === true &&
    approval?.rawSecretReadAllowed === false &&
    approval?.rawSecretPrintAllowed === false &&
    approval?.deployAllowed === false;

  const blockers = [];
  if (!credentialRefReady) blockers.push("mimo_credentialref_resolver_not_wired");
  if (!safeExecutorReady) blockers.push("mimo_safe_executor_not_wired");
  if (!approvalValid) blockers.push("mimo_continuous_smoke_approval_missing");

  const ready = blockers.length === 0;

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: ready ? null : blockers[0],
    phase: "Phase3977E-MiMoContinuousSmokeReadinessRecheck",
    provider: "mimo",
    readyForContinuousRealSmoke: ready,
    ownerApprovedContinuousRealSmoke: approvalValid,
    credentialRefReady,
    safeExecutorReady,
    approvalValid,
    credentialRefOnly: true,
    providerCallsMade: false,
    rawSecretRead: false,
    secretRead: false,
    secretValuePrinted: false,
    authorizationHeaderPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase3977e-mimo-continuous-smoke-readiness-recheck");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3977E] CredentialRef ready:", credentialRefReady);
  console.log("[Phase3977E] Safe Executor ready:", safeExecutorReady);
  console.log("[Phase3977E] Approval valid:", approvalValid);
  console.log("[Phase3977E] Ready for continuous smoke:", ready);
  console.log("[Phase3977E] Blocker:", result.blocker ?? "none");
  console.log("[Phase3977E] Provider calls made: false");
}

main().catch((error) => {
  console.error("[Phase3977E] Fatal:", error.message);
  process.exit(1);
});
