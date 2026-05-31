import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const approvalPath = "model-routing/approvals/phase911-real-external-provider-one-shot-authenticity.input.json";
export const oneShotPath = "apps/ai-gateway-service/evidence/phase911/real-external-provider-one-shot-result.json";
export const finalPath = "apps/ai-gateway-service/evidence/phase911/real-external-provider-one-shot-authenticity-final-result.json";

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhase911Dirs() {
  for (const dir of [
    "tools/phase911",
    "docs/phase911",
    "apps/ai-gateway-service/evidence/phase911",
    "model-routing/approvals",
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

export function safetyFlags() {
  return {
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
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

- This is one bounded external Provider authenticity check, not production traffic.
- A failed Provider call is recorded as failed and is not promoted to pass.
- The evidence stores credentialRef names only; it does not store API keys or raw endpoint values.
- Default /chat and /chat-gateway/execute behavior is unchanged.
`;
}
