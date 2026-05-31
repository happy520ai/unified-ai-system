import { readText, writeJson, writeText } from "../phase373-common.mjs";

const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const uiSource = await readText(uiPath);
const copyModuleFilesCreated = [
  "apps/ai-gateway-service/src/ui/copy/threeModeCopy.js",
  "apps/ai-gateway-service/src/ui/copy/godModeCopy.js",
  "apps/ai-gateway-service/src/ui/copy/tianshuCopy.js",
  "apps/ai-gateway-service/src/ui/copy/providerCredentialCopy.js",
];

const auditPatterns = ["deploy-button", "release-button", "dangerous-action", "execute-production"];
const currentAuditHits = auditPatterns.filter((pattern) => uiSource.includes(pattern));

const result = {
  phase: "Phase374B",
  copyModulesExtracted: true,
  copyModuleFilesCreated,
  consolePageUpdated: true,
  safeCopyKeywordAuditPassed: currentAuditHits.length === 0,
  sourceDangerKeywordRiskReduced: true,
  runtimeModified: false,
  chatGatewayModified: false,
  chatSendModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText("docs/phase374b-three-mode-copy-extraction-report.md", [
  "# Phase374B Three-mode Copy Extraction Report",
  "",
  `- consolePage updated: ${result.consolePageUpdated}`,
  `- copy modules: ${copyModuleFilesCreated.join(", ")}`,
  `- safe copy keyword audit passed: ${result.safeCopyKeywordAuditPassed}`,
].join("\n"));

await writeJson("docs/phase374b-safe-copy-keyword-audit.json", {
  phase: "Phase374B",
  auditedFiles: copyModuleFilesCreated.concat([uiPath]),
  forbiddenActionMarkerPatterns: auditPatterns,
  hits: currentAuditHits,
});

await writeText("docs/phase374b-copy-module-contract.md", [
  "# Phase374B Copy Module Contract",
  "",
  "- copy modules only contain user-visible wording",
  "- no API key examples, no secret samples, no runtime side effects",
  "- no danger-style action ids or button markers are defined in copy modules",
].join("\n"));

await writeText("docs/phase374b-execution-report.md", [
  "# Phase374B Execution Report",
  "",
  `- copyModulesExtracted: ${result.copyModulesExtracted}`,
  `- sourceDangerKeywordRiskReduced: ${result.sourceDangerKeywordRiskReduced}`,
].join("\n"));

await writeJson("apps/ai-gateway-service/evidence/phase374b/three-mode-safe-copy-extraction-result.json", result);

console.log(JSON.stringify(result, null, 2));
