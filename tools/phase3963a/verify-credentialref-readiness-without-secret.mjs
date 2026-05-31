import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3963a-credentialref-readiness-without-secret.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3963a-credentialref-readiness-without-secret/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyCredentialRefReadinessWithoutSecret() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  check("doc_forbids_raw_secret_read", doc.includes("without reading raw secrets"));
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("credentialref_checked", result.credentialRefReadinessChecked === true);
  check("inventory_array", Array.isArray(result.credentialRefInventory));
  check("missing_refs_array", Array.isArray(result.missingCredentialRefs));
  check("blocked_providers_array", Array.isArray(result.providersBlockedByCredentialRef));
  check("ready_for_owner_array", Array.isArray(result.providersReadyForOwnerAuthorizedRealSmoke));
  check("raw_secret_read_false", result.rawSecretRead === false);
  check("secret_value_printed_false", result.secretValuePrinted === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("openrouter_missing_true", result.openRouterCredentialRefStillMissing === true);
  check("no_forbidden_secret_files_read", (result.allowedFilesRead ?? []).every((file) => !/\.env|auth\.json|token|secret|key/i.test(file)));

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3963a-credentialref-readiness-without-secret"] ===
      "node tools/phase3963a/check-credentialref-readiness-without-secret.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3963a-credentialref-readiness-without-secret"] ===
      "node tools/phase3963a/verify-credentialref-readiness-without-secret.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3963A-CredentialRefReadinessWithoutSecret",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    credentialRefReadinessChecked: result.credentialRefReadinessChecked ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyCredentialRefReadinessWithoutSecret();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    credentialRefReadinessChecked: result.credentialRefReadinessChecked,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
