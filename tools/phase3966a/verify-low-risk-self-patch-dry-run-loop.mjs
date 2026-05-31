import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { classifySelfPatchProposal } from "../../apps/ai-gateway-service/src/self-evolution/lowRiskSelfPatchPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3966a-low-risk-self-patch-dry-run-loop.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3966a-low-risk-self-patch-dry-run-loop/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

export function verifyLowRiskSelfPatchDryRunLoop() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  const safe = classifySelfPatchProposal({ proposalType: "evidence_schema_missing_field" });
  const risky = classifySelfPatchProposal({ proposalType: "chat_route" });
  check("policy_module_exists", existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/self-evolution/lowRiskSelfPatchPolicy.js")));
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  check("safe_proposal_allowed", safe.allowed === true);
  check("chat_route_blocked", risky.allowed === false);
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("dry_run_ready", result.lowRiskSelfPatchDryRunReady === true);
  check("patches_applied_false", result.patchesApplied === false);
  check("proposal_only_true", result.proposalOnly === true);
  check("high_risk_blocked", result.highRiskPatchBlocked === true);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("deploy_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3966a-low-risk-self-patch-dry-run-loop"] ===
      "node tools/phase3966a/generate-low-risk-self-patch-proposals.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3966a-low-risk-self-patch-dry-run-loop"] ===
      "node tools/phase3966a/verify-low-risk-self-patch-dry-run-loop.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3966A-LowRiskSelfPatchDryRunLoop",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    lowRiskSelfPatchDryRunReady: result.lowRiskSelfPatchDryRunReady ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyLowRiskSelfPatchDryRunLoop();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    lowRiskSelfPatchDryRunReady: result.lowRiskSelfPatchDryRunReady,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
