import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const matrixPath = "docs/provider-reality-status-matrix.json";
const resultPath = "apps/ai-gateway-service/evidence/phase3962a-provider-reality-status-matrix/result.json";
const docPath = "docs/phase3962a-provider-reality-status-matrix.md";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

export function verifyProviderRealityStatusMatrix() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("matrix_exists", existsSync(resolve(repoRoot, matrixPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const matrix = existsSync(resolve(repoRoot, matrixPath)) ? readJson(matrixPath) : {};
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  const providers = Array.isArray(matrix.providers) ? matrix.providers : [];
  for (const name of ["NVIDIA", "OpenAI", "Claude", "OpenRouter", "MiMo"]) {
    check(`provider_present:${name}`, providers.some((provider) => provider.providerName === name));
  }
  for (const provider of providers) {
    for (const field of [
      "providerName",
      "configured",
      "credentialRefPresent",
      "credentialRefResolvable",
      "rawSecretRead",
      "lastRealSmokeStatus",
      "lastRealSmokeEvidence",
      "continuousStabilityVerified",
      "selectableAllowed",
      "productionClaimAllowed",
      "blocker",
    ]) {
      check(`${provider.providerName}:${field}_present`, Object.hasOwn(provider, field));
    }
    check(`${provider.providerName}:raw_secret_false`, provider.rawSecretRead === false);
    check(`${provider.providerName}:production_claim_false`, provider.productionClaimAllowed === false);
    check(`${provider.providerName}:stable_false`, provider.continuousStabilityVerified === false);
  }
  const openRouter = providers.find((provider) => provider.providerName === "OpenRouter");
  check("openrouter_credentialref_missing_blocker", openRouter?.blocker === "openrouter_credentialref_missing");
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("matrix_generated", result.providerRealityMatrixGenerated === true);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("provider_stability_not_claimed", result.providerStabilityClaimed === false);
  check("production_ready_not_claimed", result.productionReadyClaimed === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3962a-provider-reality-status-matrix"] ===
      "node tools/phase3962a/generate-provider-reality-status-matrix.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3962a-provider-reality-status-matrix"] ===
      "node tools/phase3962a/verify-provider-reality-status-matrix.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3962A-ProviderRealityStatusMatrix",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    providerRealityMatrixGenerated: result.providerRealityMatrixGenerated ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyProviderRealityStatusMatrix();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    providerRealityMatrixGenerated: result.providerRealityMatrixGenerated,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
