import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const phase = "Phase565";
const name = "Core Mission Control Product Function Audit";
const evidencePath = "apps/ai-gateway-service/evidence/phase565/core-mission-control-product-function-audit-result.json";

const forbiddenCharacterTerms = [
  "Yiyi",
  "依依",
  "companion",
  "avatar",
  "character",
  "persona visual",
  "2D fallback",
  "3D not connected",
  "pseudo-3D",
  "snowman",
  "blob placeholder",
];

const requiredTerms = [
  "Normal",
  "God",
  "Tianshu",
  "Security Shield",
  "Evidence",
  "Provider",
  "CredentialRef",
];

const boundaryTerms = [
  "dry-run",
  "no-provider-call",
  "no-deploy",
  "no provider call",
];

const dangerousActionButtonTerms = [
  "Deploy Now",
  "Release Now",
  "Push to Production",
  "Call Provider Now",
  "Save Secret",
  "Upload Secret",
  "Real Billing",
  "Generate Invoice",
];

const misleadingProductionTerms = [
  "production GA enabled",
  "real provider connected",
  "billing enabled",
  "invoice generated",
  "deployment completed",
];

const requiredMarkers = {
  normalModeVisible: "mission-normal-mode-card",
  godModeVisible: "mission-god-arena-card",
  tianshuModeVisible: "mission-tianshu-flight-card",
  securityShieldVisible: "security-shield-panel",
  evidenceReplayVisible: "evidence-export-panel",
  providerCredentialRefVisible: "provider-credentialref-guidance",
};

const mojibakePattern = /(?:澶|妯|鐢|鍊|杈|璺|乶|侫|泀|銆|€|\uFFFD)/;
const secretPattern = /\b(?:nvapi[-_][A-Za-z0-9._-]{8,}|sk-proj[-_][A-Za-z0-9._-]{8,}|sk[-_][A-Za-z0-9._-]{8,}|ghp_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/i;

function stripNonVisibleBlocks(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

function extractSection(html, id) {
  const startToken = `id="${id}"`;
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) return "";
  const sectionStart = html.lastIndexOf("<section", startIndex);
  if (sectionStart === -1) return "";
  const nextSection = html.indexOf("\n            </section>", startIndex);
  if (nextSection === -1) return html.slice(sectionStart);
  return html.slice(sectionStart, nextSection + "\n            </section>".length);
}

function findPresent(source, terms) {
  return terms.filter((term) => source.includes(term));
}

function findMissing(source, terms) {
  return terms.filter((term) => !source.includes(term));
}

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function readIfExists(path) {
  try {
    return await readFile(resolve(path), "utf8");
  } catch {
    return "";
  }
}

async function main() {
  const html = createConsolePage();
  const visibleHtml = stripNonVisibleBlocks(html);
  const missionControlHtml = extractSection(visibleHtml, "mission-control");
  const providerCopy = await readIfExists("apps/ai-gateway-service/src/ui/copy/providerCredentialCopy.js");
  const missionControlSource = await readIfExists("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
  const auditedSource = [missionControlHtml, providerCopy, missionControlSource].join("\n");

  const forbiddenCharacterTermsPresent = findPresent(missionControlHtml, forbiddenCharacterTerms);
  const requiredTermsMissing = findMissing(visibleHtml, requiredTerms);
  const boundaryTermsPresent = findPresent(visibleHtml, boundaryTerms);
  const dangerousActionButtonTermsPresent = findPresent(visibleHtml, dangerousActionButtonTerms);
  const misleadingProductionTermsPresent = findPresent(visibleHtml, misleadingProductionTerms);
  const developerPlaceholderDetected = mojibakePattern.test(auditedSource);
  const secretPatternDetected = secretPattern.test(auditedSource);

  const markerResults = Object.fromEntries(
    Object.entries(requiredMarkers).map(([key, marker]) => [key, visibleHtml.includes(marker)]),
  );

  const result = {
    phase,
    name,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    yiyiVisible: forbiddenCharacterTermsPresent.includes("Yiyi") || forbiddenCharacterTermsPresent.includes("依依"),
    characterModuleVisible: forbiddenCharacterTermsPresent.length > 0,
    coreProductModulesVisible: Object.values(markerResults).every(Boolean) && requiredTermsMissing.length === 0,
    ...markerResults,
    dangerousActionButtonDetected: dangerousActionButtonTermsPresent.length > 0,
    developerPlaceholderDetected,
    forbiddenCharacterTermsPresent,
    requiredTermsMissing,
    boundaryTermsPresent,
    dangerousActionButtonTermsPresent,
    misleadingProductionTermsPresent,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    chatGatewayRuntimeModified: false,
    workspaceCleanClaimed: false,
    secretPatternDetected,
  };

  try {
    ensure(missionControlHtml.length > 0, "Mission Control visible HTML must render.");
    ensure(forbiddenCharacterTermsPresent.length === 0, `Character/persona terms still visible: ${forbiddenCharacterTermsPresent.join(", ")}`);
    ensure(requiredTermsMissing.length === 0, `Required product terms missing: ${requiredTermsMissing.join(", ")}`);
    ensure(boundaryTermsPresent.length > 0, "At least one dry-run/no-provider/no-deploy boundary term must be visible.");
    ensure(Object.values(markerResults).every(Boolean), "One or more core product module markers are missing.");
    ensure(dangerousActionButtonTermsPresent.length === 0, `Dangerous action button wording detected: ${dangerousActionButtonTermsPresent.join(", ")}`);
    ensure(misleadingProductionTermsPresent.length === 0, `Misleading production wording detected: ${misleadingProductionTermsPresent.join(", ")}`);
    ensure(developerPlaceholderDetected === false, "Developer placeholder or mojibake text detected in audited UI/copy source.");
    ensure(secretPatternDetected === false, "Secret-like value detected in audited source.");
  } catch (error) {
    result.completed = false;
    result.recommended_sealed = false;
    result.blocker = error.message;
  }

  await mkdir(dirname(resolve(evidencePath)), { recursive: true });
  await writeFile(resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));

  if (!result.completed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
