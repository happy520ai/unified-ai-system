import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const evidencePath =
  "apps/ai-gateway-service/evidence/phase607r/public-repo-hygiene-preflight-result.json";
const docs = [
  "docs/phase607r-public-repo-hygiene-preflight.md",
  "docs/phase607r-public-blocker-report.md",
  "docs/phase607r-execution-report.md",
];

const gitignoreRequired = [
  ".env",
  ".env.*",
  "node_modules/",
  "dist/",
  "build/",
  ".cache/",
  "cache/",
  "temp/",
  "logs/",
  "runtime/",
  ".codex/",
  ".codex/config.toml",
];

const requiredReportFlags = [
  "providerCallsMade=false",
  "secretValueExposed=false",
  "rawBaseUrlValueExposed=false",
  "deployExecuted=false",
  "releaseExecuted=false",
  "tagCreated=false",
  "artifactUploaded=false",
  "pushExecuted=false",
  "commitCreated=false",
  "chatModified=false",
  "chatGatewayExecuteModified=false",
  "codexConfigModified=false",
  "workspaceCleanClaimed=false",
];

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), "utf8");
}

function hasRawSecretLikeValue(text) {
  const patterns = [
    /sk-[A-Za-z0-9_-]{12,}/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /xox[abprs]-[A-Za-z0-9-]{20,}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/i,
    /access_token\s*[:=]\s*["'][^"']+["']/i,
    /refresh_token\s*[:=]\s*["'][^"']+["']/i,
    /id_token\s*[:=]\s*["'][^"']+["']/i,
    /webhook\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
    /base_url\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
    /openai_base_url\s*[:=]\s*["']https?:\/\/[^"']+["']/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function readmeFirstScreenPasses(readmeText) {
  const firstScreen = readmeText.slice(0, 2200).toLowerCase();
  return (
    firstScreen.includes("dry-run") &&
    firstScreen.includes("local preview") &&
    firstScreen.includes("governance demo") &&
    firstScreen.includes("default: no real provider calls") &&
    firstScreen.includes("no general availability claim") &&
    firstScreen.includes("no deployment promise")
  );
}

function publicBlockersFromState() {
  const blockers = [];
  if (!exists("LICENSE") && !exists("LICENSE.md")) {
    blockers.push("license_file_missing_decision_recorded");
  }
  if (!exists("SECURITY.md")) {
    blockers.push("security_policy_file_missing_placeholder_recorded");
  }
  if (!exists("CONTRIBUTING.md")) {
    blockers.push("contributing_file_missing_safety_guide_available");
  }
  return blockers;
}

const errors = [];
for (const doc of docs) {
  if (!exists(doc)) errors.push(`missing doc: ${doc}`);
}

const gitignoreText = exists(".gitignore") ? readText(".gitignore") : "";
if (!gitignoreText) errors.push("missing .gitignore");
for (const entry of gitignoreRequired) {
  if (!gitignoreText.includes(entry)) {
    errors.push(`.gitignore missing required entry: ${entry}`);
  }
}
if (gitignoreText.includes("~/.codex/config.toml")) {
  errors.push(".gitignore must not treat ~/.codex/config.toml as project file");
}

const readmeText = exists("README.md") ? readText("README.md") : "";
if (!readmeFirstScreenPasses(readmeText)) {
  errors.push("README first screen missing public preflight disclaimer");
}
if (/production\s+GA|globally\s+available|deployment\s+complete/i.test(readmeText.slice(0, 2200))) {
  errors.push("README first screen contains public readiness overclaim");
}

const docsText = docs.filter(exists).map(readText).join("\n");
if (!docsText.includes("publicBlockerReportGenerated=true")) {
  errors.push("public blocker report flag missing");
}
for (const flag of requiredReportFlags) {
  if (!docsText.includes(flag)) errors.push(`docs missing required safety flag: ${flag}`);
}
if (!docsText.includes("licenseDecisionRecorded=true")) {
  errors.push("license decision not recorded");
}
if (!docsText.includes("securityPolicyDecisionRecorded=true")) {
  errors.push("security policy decision not recorded");
}
if (!docsText.includes("contributingGuideDecisionRecorded=true")) {
  errors.push("contributing guide decision not recorded");
}
if (!docsText.includes("evidenceLocalPathPolicyRecorded=true")) {
  errors.push("evidence local path policy not recorded");
}
if (hasRawSecretLikeValue(docsText) || hasRawSecretLikeValue(readmeText.slice(0, 2200))) {
  errors.push("raw secret, webhook, or endpoint-like value detected");
}

const result = {
  phase: "Phase607R",
  title: "Public Repo Hygiene Preflight",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase607r_public_repo_hygiene_preflight_failed",
  publicBlockers: publicBlockersFromState(),
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
  workspaceCleanClaimed: false,
  publicBlockerReportGenerated: docsText.includes("publicBlockerReportGenerated=true"),
  readmeFirstScreenChecked: readmeFirstScreenPasses(readmeText),
  licenseDecisionRecorded: docsText.includes("licenseDecisionRecorded=true"),
  securityPolicyDecisionRecorded: docsText.includes("securityPolicyDecisionRecorded=true"),
  contributingGuideDecisionRecorded: docsText.includes("contributingGuideDecisionRecorded=true"),
  evidenceLocalPathPolicyRecorded: docsText.includes("evidenceLocalPathPolicyRecorded=true"),
  docs,
  evidenceJson: evidencePath,
  verifier: "tools/phase607r/validate-public-repo-hygiene-preflight.mjs",
  errors,
};

fs.mkdirSync(path.dirname(resolvePath(evidencePath)), { recursive: true });
fs.writeFileSync(resolvePath(evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
JSON.parse(readText(evidencePath));

if (errors.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
