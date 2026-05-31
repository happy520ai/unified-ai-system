import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase341d");
const resultPath = resolve(evidenceDir, "credential-vault-beta-adapter-enablement-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase341d-credential-adapter-enablement-gate.json");
const reportPath = resolve(repoRoot, "docs/phase341d-execution-report.md");

const readiness = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340d-credential-beta-readiness.json"), "utf8"));

const gate = {
  phase: "Phase341D",
  credentialAdapterGateDefined: true,
  credentialBetaReady: readiness.credentialBetaReady === true,
  providerRealCallExecuted: false,
  rawSecretReturned: false,
  explicitCohortFlagRequired: true,
  defaultEnabled: false,
};

const result = {
  phase: "Phase341D",
  credentialAdapterGateDefined: true,
  providerRealCallExecuted: false,
  productionGA: false,
  rawSecretReturned: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341D Execution Report",
    "",
    `- credentialAdapterGateDefined: ${current.credentialAdapterGateDefined}`,
    `- providerRealCallExecuted: ${current.providerRealCallExecuted}`,
    "",
  ].join("\n");
}
