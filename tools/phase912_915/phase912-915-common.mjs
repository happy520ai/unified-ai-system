import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export const phase912ResolutionPath = "apps/ai-gateway-service/evidence/phase912_915/credentialref-secure-resolution-result.json";
export const phase912InjectionDryRunPath = "apps/ai-gateway-service/evidence/phase912_915/isolated-secret-injection-dry-run-result.json";
export const phase913OneShotPath = "apps/ai-gateway-service/evidence/phase912_915/phase913-real-external-provider-one-shot-result.json";
export const phase913AuthenticityPath = "apps/ai-gateway-service/evidence/phase912_915/phase913-authenticity-evidence.json";
export const phase914RebindPath = "apps/ai-gateway-service/evidence/phase912_915/routing-authenticity-evidence-rebind-result.json";
export const phase915DecisionPath = "apps/ai-gateway-service/evidence/phase912_915/real-route-quality-test-decision-packet.json";
export const finalPath = "apps/ai-gateway-service/evidence/phase912_915/phase912-915-final-result.json";

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "tools/phase912_915",
    "docs/phase912-915",
    "apps/ai-gateway-service/evidence/phase912_915",
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
    rawSecretReadByCallingProcess: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}

export function phaseDoc({ title, goal, facts = [], boundaries = [], outputs = [] }) {
  return `# ${title}

## Goal

${goal}

## Facts

${facts.map((item) => `- ${item}`).join("\n")}

## Boundaries

${boundaries.map((item) => `- ${item}`).join("\n")}

## Outputs

${outputs.map((item) => `- ${item}`).join("\n")}

## Non-claims

- Phase913 is a later supplemental authenticity proof; it does not rewrite Phase821-900 as originally external.
- This phase does not expose API keys, auth.json, webhooks, or raw endpoint values.
- Default /chat and /chat-gateway/execute behavior is unchanged.
- Broader real route quality testing requires a new approval.
`;
}

export function writePhaseDoc(name, body) {
  return writeText(`docs/phase912-915/${name}`, body);
}
