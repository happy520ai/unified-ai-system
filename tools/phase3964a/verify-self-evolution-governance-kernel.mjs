import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getSelfEvolutionPolicy } from "../../apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3964a-self-evolution-governance-kernel.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3964a-self-evolution-governance-kernel/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

export function verifySelfEvolutionGovernanceKernel() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  const moduleFiles = [
    "apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js",
    "apps/ai-gateway-service/src/self-evolution/selfEvolutionLedgerSchema.js",
    "apps/ai-gateway-service/src/self-evolution/selfEvolutionValueGate.js",
  ];
  for (const file of moduleFiles) check(`module_exists:${file}`, existsSync(resolve(repoRoot, file)));
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const policy = getSelfEvolutionPolicy();
  check("evolution_mode_governed", policy.evolutionMode === "governed");
  check("autonomous_code_mutation_false", policy.autonomousCodeMutationAllowed === false);
  check("autonomous_provider_call_false", policy.autonomousProviderCallAllowed === false);
  check("autonomous_secret_read_false", policy.autonomousSecretReadAllowed === false);
  check("autonomous_deploy_false", policy.autonomousDeployAllowed === false);
  check("autonomous_chat_route_change_false", policy.autonomousChatRouteChangeAllowed === false);
  check("autonomous_chat_gateway_execute_change_false", policy.autonomousChatGatewayExecuteChangeAllowed === false);
  check("human_approval_required", policy.humanApprovalRequiredForHighRisk === true);
  check("low_value_phase_expansion_blocked", policy.lowValuePhaseExpansionBlocked === true);
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("kernel_defined", result.selfEvolutionKernelDefined === true);
  check("result_autonomous_code_false", result.autonomousCodeMutationAllowed === false);
  check("result_provider_calls_false", result.providerCallsMade === false);
  check("result_secret_read_false", result.secretRead === false);
  check("result_deploy_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3964a-self-evolution-governance-kernel"] ===
      "node tools/phase3964a/define-self-evolution-governance-kernel.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3964a-self-evolution-governance-kernel"] ===
      "node tools/phase3964a/verify-self-evolution-governance-kernel.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3964A-SelfEvolutionGovernanceKernel",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    selfEvolutionKernelDefined: result.selfEvolutionKernelDefined ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifySelfEvolutionGovernanceKernel();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    selfEvolutionKernelDefined: result.selfEvolutionKernelDefined,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
