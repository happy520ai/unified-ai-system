import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const approvalPath = "model-routing/approvals/phase916_930-real-route-quality-test.input.json";
export const gatePath = "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-approval-gate-result.json";
export const scenarioPath = "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-scenario-pack.json";
export const finalPath = "apps/ai-gateway-service/evidence/phase916_930/phase916-930-final-result.json";
export const requiredFinalPath = "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-test-final-result.json";
export const decisionPath = "apps/ai-gateway-service/evidence/phase916_930/phase930-next-decision.json";

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function ensurePhaseDirs() {
  for (const dir of [
    "tools/phase916_930",
    "docs/phase916-930",
    "apps/ai-gateway-service/evidence/phase916_930",
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
}

export function writeText(relativePath, value) {
  const path = repoPath(relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${value.trim()}\n`, "utf8");
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

- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- Missing approval blocks broader real Provider route quality execution.
- No human test, seven-day soak, production traffic, or stability claim is made.
`;
}
