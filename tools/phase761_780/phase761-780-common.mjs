import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase761_780");
export const modelLibraryEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/model-library");

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
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

export function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
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

- This phase does not call any Provider.
- This phase does not read API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not modify selectable model status.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
`;
}

export function baseSafety() {
  return {
    providerCallsMade: false,
    discoveryApiCalled: false,
    secretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    selectableModified: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
  };
}
