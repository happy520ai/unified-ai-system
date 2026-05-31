import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const inputPath = "docs/provider-smoke/owner-real-provider-smoke-approval.input.json";
const docPath = "docs/phase3967a-owner-approval-gate-for-real-provider-smoke.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3967a-owner-approval-gate-for-real-provider-smoke/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

export function verifyOwnerProviderSmokeApprovalGate() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("input_template_exists", existsSync(resolve(repoRoot, inputPath)));
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const input = existsSync(resolve(repoRoot, inputPath)) ? readJson(inputPath) : {};
  check("input_max_requests_one", input.maxRequests === 1);
  check("input_provider_call_default_false", input.providerCallAllowed === false);
  check("input_secret_read_default_false", input.secretReadAllowed === false);
  check("input_credentialref_only", input.credentialRefOnly === true);
  check("input_raw_secret_print_false", input.rawSecretPrintAllowed === false);
  check("input_deploy_false", input.deployAllowed === false);
  check("input_chat_route_change_false", input.chatRouteChangeAllowed === false);
  check("input_chat_gateway_execute_change_false", input.chatGatewayExecuteChangeAllowed === false);
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_approval_missing", result.blocker === "owner_real_provider_smoke_approval_missing");
  check("gate_prepared", result.providerSmokeApprovalGatePrepared === true);
  check("execution_allowed_false", result.providerSmokeExecutionAllowed === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("credentialref_only_true", result.credentialRefOnly === true);
  check("deploy_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3967a-owner-provider-smoke-approval-gate"] ===
      "node tools/phase3967a/prepare-owner-provider-smoke-approval-gate.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3967a-owner-provider-smoke-approval-gate"] ===
      "node tools/phase3967a/verify-owner-provider-smoke-approval-gate.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3967A-OwnerApprovalGateForRealProviderSmoke",
    status: completed ? "sealed/blocked" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? "owner_real_provider_smoke_approval_missing" : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    providerSmokeApprovalGatePrepared: result.providerSmokeApprovalGatePrepared ?? false,
    providerSmokeExecutionAllowed: result.providerSmokeExecutionAllowed ?? null,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyOwnerProviderSmokeApprovalGate();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    providerSmokeExecutionAllowed: result.providerSmokeExecutionAllowed,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
