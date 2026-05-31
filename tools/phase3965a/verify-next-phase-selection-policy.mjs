import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { selectNextPhaseCandidate } from "../../apps/ai-gateway-service/src/self-evolution/nextPhaseSelectionPolicy.js";

const repoRoot = process.cwd();
const docPath = "docs/phase3965a-codex-next-phase-selection-policy.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3965a-codex-next-phase-selection-policy/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyNextPhaseSelectionPolicy() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  const banned = ["controlled", "fifty-seven", "tool", "mutation"].join("-");
  const rejected = selectNextPhaseCandidate({
    proposedPhaseName: banned,
    valueClass: "file_count_expansion",
    expectedUserValue: "Only increase changedFileCount.",
    changeType: "file_count_expansion",
  });
  const missingValue = selectNextPhaseCandidate({ proposedPhaseName: "PhaseNext", valueClass: "", expectedUserValue: "" });
  check("policy_module_exists", existsSync(resolve(repoRoot, "apps/ai-gateway-service/src/self-evolution/nextPhaseSelectionPolicy.js")));
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  check("doc_mentions_value_gate", doc.includes("value gate"));
  check("doc_mentions_owner_daily_use", doc.includes("Owner daily-use"));
  check("banned_expansion_rejected", rejected.accepted === false);
  check("missing_value_rejected", missingValue.accepted === false);
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("policy_defined", result.nextPhaseSelectionPolicyDefined === true);
  check("low_value_rejected", result.lowValuePhaseExpansionRejectedByDefault === true);
  check("controlled_57_rejected", result.controlledFiftySevenMutationRejected === true);
  check("product_work_preferred", result.productWorkModePreferred === true);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("deploy_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3965a-codex-next-phase-selection-policy"] ===
      "node tools/phase3965a/generate-next-phase-selection-policy.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3965a-codex-next-phase-selection-policy"] ===
      "node tools/phase3965a/verify-next-phase-selection-policy.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3965A-CodexNextPhaseSelectionPolicy",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    nextPhaseSelectionPolicyDefined: result.nextPhaseSelectionPolicyDefined ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyNextPhaseSelectionPolicy();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    nextPhaseSelectionPolicyDefined: result.nextPhaseSelectionPolicyDefined,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
