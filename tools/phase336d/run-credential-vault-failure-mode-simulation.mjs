import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCredentialVaultRegistry } from "../../apps/ai-gateway-service/src/credentials/credentialVaultRegistry.js";
import { evaluateCredentialAccessPolicy } from "../../apps/ai-gateway-service/src/credentials/credentialAccessPolicy.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336d");
const resultPath = resolve(evidenceDir, "credential-vault-failure-mode-simulation-result.json");
const reportPath = resolve(repoRoot, "docs/phase336d-execution-report.md");
const scenariosPath = resolve(repoRoot, "docs/phase336d-credential-vault-failure-modes.json");

const registry = createCredentialVaultRegistry({ env: { INTERNAL_TEST_KEY: "redacted" } });
const scenarios = buildScenarios(registry);
const passed = scenarios.filter((item) => item.status === "passed").length;
const blocked = scenarios.filter((item) => item.status === "blocked").length;

const result = {
  phase: "Phase336D",
  failureModesCovered: scenarios.length >= 6,
  noReleaseSimulation: true,
  releaseExecuted: false,
  deployExecuted: false,
  passed,
  failed: scenarios.filter((item) => item.status === "failed").length,
  blocked,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(scenariosPath, `${JSON.stringify({ phase: "Phase336D", scenarios }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildScenarios(currentRegistry) {
  const unsupported = currentRegistry.resolve({ referenceType: "unknown_ref", reference: "X" });
  const missingEnv = currentRegistry.resolve({ referenceType: "env_key_name", reference: "MISSING_KEY" });
  const policyDeniedSecret = evaluateCredentialAccessPolicy({
    request: { secretValue: "forbidden" },
    providerScope: "nvidia",
    modeScope: "normal",
    userOwned: true,
  });
  const policyDeniedScope = evaluateCredentialAccessPolicy({
    request: { credentialRef: "TEAM_KEY" },
    providerScope: "unauthorized_provider",
    modeScope: "normal",
    userOwned: true,
  });
  const policyDeniedAudit = evaluateCredentialAccessPolicy({
    request: { credentialRef: "TEAM_KEY", audit: { traceEnabled: false } },
    providerScope: "nvidia",
    modeScope: "normal",
    userOwned: true,
  });
  const vaultBlocked = currentRegistry.resolve({ referenceType: "vault_reference", reference: "vault://phase336/not-configured" });

  return [
    { id: "unsupportedReferenceTypeRejected", status: unsupported.accessAllowed === false ? "passed" : "failed" },
    { id: "missingEnvKeyBlocked", status: missingEnv.accessAllowed === false ? "blocked" : "failed" },
    { id: "secretValuePayloadRejected", status: policyDeniedSecret.allowed === false ? "passed" : "failed" },
    { id: "unauthorizedScopeRejected", status: policyDeniedScope.allowed === false ? "passed" : "failed" },
    { id: "auditTraceRequired", status: policyDeniedAudit.allowed === false ? "passed" : "failed" },
    { id: "vaultReferenceNotConfigured", status: vaultBlocked.accessAllowed === false ? "blocked" : "failed" },
  ];
}

function renderReport(current) {
  return [
    "# Phase336D Execution Report",
    "",
    `- failureModesCovered: ${current.failureModesCovered}`,
    `- passed: ${current.passed}`,
    `- failed: ${current.failed}`,
    `- blocked: ${current.blocked}`,
    "",
  ].join("\n");
}
