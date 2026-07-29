import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_SCRIPT_PAIRS = [
  ["benchmark:token-saving", "benchmark:token-saving"],
  ["calibrate:token-estimator", "calibrate:token-estimator"],
  ["benchmark:rag-source-selection", "benchmark:rag-source-selection"],
  ["benchmark:response-cache-hardening", "benchmark:response-cache-hardening"],
  ["benchmark:quality-cost-routing", "benchmark:quality-cost-routing"],
  ["import:public-knowledge:preview", "import:public-knowledge:preview"],
  ["audit:full-codebase", "audit:full-codebase"],
  ["verify:phase107a-secret-safety", "verify:phase107a-secret-safety"],
  ["verify:phase245a-personal-value-closure", "verify:phase245a-personal-value-closure"],
  ["verify:phase255a-personal-knowledge-value-closure", "verify:phase255a-personal-knowledge-value-closure"],
  ["verify:phase268a-token-cost-guard", "verify:phase268a-token-cost-guard"],
  ["verify:phase269a-mimo-paid-api-safe-smoke", "verify:phase269a-mimo-paid-api-safe-smoke"],
  ["verify:phase270a-token-saving-benchmark", "verify:phase270a-token-saving-benchmark"],
  ["verify:phase271a-mimo-model-id-discovery", "verify:phase271a-mimo-model-id-discovery"],
  ["verify:phase272a-token-estimator-calibration", "verify:phase272a-token-estimator-calibration"],
  ["verify:phase273a-rag-source-selection-benchmark", "verify:phase273a-rag-source-selection-benchmark"],
  ["verify:phase274a-system-capability-benchmark", "verify:phase274a-system-capability-benchmark"],
  ["verify:phase275a-response-cache-hardening", "verify:phase275a-response-cache-hardening"],
  ["verify:phase276a-quality-cost-routing-preview", "verify:phase276a-quality-cost-routing-preview"],
  ["verify:phase277a-public-knowledge-import-preview", "verify:phase277a-public-knowledge-import-preview"],
  ["verify:phase279a-full-codebase-audit", "verify:phase279a-full-codebase-audit"],
];

export function auditPackageScripts(repoRoot) {
  const rootPackage = readJson(resolve(repoRoot, "package.json"));
  const servicePackage = readJson(resolve(repoRoot, "apps/ai-gateway-service/package.json"));
  const missing = [];
  const present = [];

  for (const [rootScript, serviceScript] of REQUIRED_SCRIPT_PAIRS) {
    const rootExists = Boolean(rootPackage.scripts?.[rootScript]);
    const serviceExists = Boolean(servicePackage.scripts?.[serviceScript]);
    present.push({ rootScript, serviceScript, rootExists, serviceExists });
    if (!rootExists || !serviceExists) {
      missing.push({ rootScript, serviceScript, rootExists, serviceExists });
    }
  }

  const phase278RootExists = Boolean(rootPackage.scripts?.["verify:phase278a-daily-knowledge-enrichment"]);
  const phase278ServiceExists = Boolean(servicePackage.scripts?.["verify:phase278a-daily-knowledge-enrichment"]);

  return {
    status: missing.length === 0 ? "pass" : "fail",
    packageScriptsChecked: Object.keys(rootPackage.scripts ?? {}).length + Object.keys(servicePackage.scripts ?? {}).length,
    requiredPairsChecked: REQUIRED_SCRIPT_PAIRS.length,
    present,
    missing,
    optionalPhases: [
      {
        phase: "278A-daily-knowledge-enrichment",
        status: phase278RootExists && phase278ServiceExists ? "available" : "not_available_or_not_sealed",
      },
    ],
  };
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
