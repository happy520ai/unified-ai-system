import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "apps/ai-gateway-service/evidence/phase801_820",
    "docs",
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
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    rawSecretRead: false,
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

export function loadRoutingEvidenceInputs() {
  return {
    phase761: readJson("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json"),
    phase781: readJson("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json"),
    usabilityMatrix: readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-usability-matrix.json") || {},
    verificationState: readJsonIfPresent("apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json") || {},
    globalSeed: readJsonIfPresent("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json") || {},
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

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
`;
}
