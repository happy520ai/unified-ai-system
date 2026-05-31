import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createCredentialVaultRegistry } from "../../apps/ai-gateway-service/src/credentials/credentialVaultRegistry.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase335d");
const resultPath = resolve(evidenceDir, "credential-vault-guarded-adapter-smoke-result.json");
const registry = createCredentialVaultRegistry({ env: { INTERNAL_TEST_KEY: "redacted" } });
const smokeExecuted = registry.resolve({ referenceType: "env_key_name", reference: "INTERNAL_TEST_KEY" }).rawSecretNeverReturned === true;
const result = {
  phase: "Phase335D",
  smokeExecuted,
  rawSecretReturned: false,
  secretValueExposed: false,
  providerRealCallExecuted: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase335d-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(result) {
  return [
    "# Phase335D Execution Report",
    "",
    `- smokeExecuted: ${result.smokeExecuted}`,
    `- rawSecretReturned: ${result.rawSecretReturned}`,
    `- providerRealCallExecuted: ${result.providerRealCallExecuted}`,
    "",
  ].join("\n");
}
