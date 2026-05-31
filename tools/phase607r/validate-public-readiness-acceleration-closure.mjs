import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath =
  "apps/ai-gateway-service/evidence/phase607r-610r-public-readiness-acceleration.json";
const closureDoc = "docs/phase607r-610r-public-readiness-acceleration-closure.md";
const inputs = {
  autoscale: "apps/ai-gateway-service/evidence/phase607r/autoscale-safe-runner-batch-result.json",
  hygiene: "apps/ai-gateway-service/evidence/phase608r/public-repo-hygiene-preflight-result.json",
  demo: "apps/ai-gateway-service/evidence/phase609r/public-dry-run-demo-package-result.json",
  blocker: "apps/ai-gateway-service/evidence/phase610r/open-source-release-blocker-review-result.json",
};

function p(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(p(relativePath), "utf8"));
}

const errors = [];
if (!exists(closureDoc)) errors.push(`missing closure doc: ${closureDoc}`);

const data = {};
for (const [key, relativePath] of Object.entries(inputs)) {
  if (!exists(relativePath)) {
    errors.push(`missing evidence: ${relativePath}`);
  } else {
    data[key] = readJson(relativePath);
  }
}

const falseFlags = [
  "providerCallsMade",
  "secretValueExposed",
  "rawBaseUrlValueExposed",
  "deployExecuted",
  "releaseExecuted",
  "tagCreated",
  "artifactUploaded",
  "pushExecuted",
  "commitCreated",
  "chatModified",
  "chatGatewayExecuteModified",
  "workspaceCleanClaimed",
];

for (const [key, item] of Object.entries(data)) {
  if (item.completed !== true) errors.push(`${key} completed must be true`);
  for (const flag of falseFlags) {
    if (item[flag] !== false) errors.push(`${key}.${flag} must be false`);
  }
}

if (data.autoscale?.codexConfigModified !== false) {
  errors.push("autoscale.codexConfigModified must be false");
}
if (data.blocker?.releaseCandidateReady !== false) {
  errors.push("releaseCandidateReady must be false while P0 blockers remain");
}
if (data.blocker?.p0BlockerCount !== 2) {
  errors.push("p0BlockerCount must be 2");
}

const result = {
  phase: "Phase607R-610R",
  title: "Public Open-Source Readiness Acceleration Bundle Closure",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? "public_release_blockers_present" : "public_readiness_acceleration_failed",
  phase607rAutoscaleCompleted: data.autoscale?.completed === true,
  phase608rHygieneCompleted: data.hygiene?.completed === true,
  phase609rDemoPackageCompleted: data.demo?.completed === true,
  phase610rBlockerReviewCompleted: data.blocker?.completed === true,
  failed: errors,
  releaseCandidateReady: false,
  p0BlockerCount: data.blocker?.p0BlockerCount ?? null,
  p1BlockerCount: data.blocker?.p1BlockerCount ?? null,
  providerCallsMade: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  codexConfigModified: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
  docs: [closureDoc],
  evidenceInputs: inputs,
  evidenceJson: evidencePath,
};

fs.mkdirSync(path.dirname(p(evidencePath)), { recursive: true });
fs.writeFileSync(p(evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");

if (errors.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
