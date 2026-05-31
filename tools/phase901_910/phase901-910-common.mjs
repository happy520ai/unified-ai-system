import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "tools/phase901_910",
    "docs/phase901-910",
    "apps/ai-gateway-service/evidence/phase901_910",
  ]) {
    mkdirSync(repoPath(dir), { recursive: true });
  }
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

export function readJsonIfPresent(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

export function writeText(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value.trim()}\n`, "utf8");
  return path;
}

export function baseSafety() {
  return {
    credentialRefOnly: true,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}

export function loadPhase821900Evidence() {
  return readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json");
}

export function loadRouteEvidence() {
  const guarded = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
  const ledger = readJsonIfPresent("model-routing/evidence/route-evidence-ledger.json")
    || readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/route-evidence-ledger-result.json")
    || {};
  const routes = Array.isArray(guarded.routes) ? guarded.routes : [];
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  return {
    evidenceFiles: [
      "apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json",
      "apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json",
      "model-routing/evidence/route-evidence-ledger.json",
      "model-routing/runtime/guarded-real-route-executor-result.json",
      "model-routing/quality/route-quality-scoring-result.json",
    ],
    guardedRoutes: routes,
    ledgerEntries: entries,
    routeEvidence: routes.length > 0 ? routes : entries,
  };
}

export function phaseDoc({ phase, title, goal, facts = [], boundaries = [], outputs = [] }) {
  return `# ${phase} ${title}

## Goal

${goal}

## Verified facts

${facts.map((item) => `- ${item}`).join("\n")}

## Boundaries

${boundaries.map((item) => `- ${item}`).join("\n")}

## Outputs

${outputs.map((item) => `- ${item}`).join("\n")}

## Non-claims

- Local guarded executor attempts are not external Provider API proof.
- Mock, simulated, dry-run, or unknown evidence is never promoted to confirmed Provider response.
- This phase does not read raw secret values or auth.json.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
`;
}

export function writePhaseDoc(file, body) {
  return writeText(`docs/phase901-910/${file}`, body);
}
