import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "apps/ai-gateway-service/evidence/phase781_800",
    "apps/ai-gateway-service/evidence/model-library/provider-expansion",
    "provider-expansion/approvals",
    "provider-expansion/discovery",
    "provider-expansion/smoke",
    "provider-expansion/candidates",
    "provider-expansion/blocked",
    "docs/phase781-800",
  ]) {
    mkdirSync(repoPath(dir), { recursive: true });
  }
}

export function writeJson(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

export function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

export function readJsonIfPresent(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeText(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value.trim()}\n`, "utf8");
  return path;
}

export function exists(relativePath) {
  return existsSync(repoPath(relativePath));
}

export function baseSafety() {
  return {
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawSecretRead: false,
    secretValueExposed: false,
    credentialRefOnly: true,
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

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
`;
}
