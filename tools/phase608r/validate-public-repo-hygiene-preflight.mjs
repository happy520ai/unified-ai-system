import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath =
  "apps/ai-gateway-service/evidence/phase608r/public-repo-hygiene-preflight-result.json";
const docs = [
  "docs/phase608r-public-repo-hygiene-preflight.md",
  "docs/phase608r-public-blocker-report.md",
  "docs/phase608r-execution-report.md",
];
const gitignoreRequired = [".env", ".env.*", "node_modules/", "dist/", "build/", "cache/", "temp/", "logs/", "runtime/", ".codex/config.toml"];
const falseFlags = ["providerCallsMade", "secretValueExposed", "rawBaseUrlValueExposed", "deployExecuted", "releaseExecuted", "tagCreated", "artifactUploaded", "pushExecuted", "commitCreated", "chatModified", "chatGatewayExecuteModified", "workspaceCleanClaimed"];

function p(relativePath) { return path.join(root, relativePath); }
function exists(relativePath) { return fs.existsSync(p(relativePath)); }
function text(relativePath) { return fs.readFileSync(p(relativePath), "utf8"); }

const errors = [];
for (const doc of docs) if (!exists(doc)) errors.push(`missing doc: ${doc}`);
const gitignore = exists(".gitignore") ? text(".gitignore") : "";
for (const entry of gitignoreRequired) if (!gitignore.includes(entry)) errors.push(`.gitignore missing ${entry}`);
const readmeFirst = exists("README.md") ? text("README.md").slice(0, 2200).toLowerCase() : "";
if (!readmeFirst.includes("dry-run") || !readmeFirst.includes("default: no real provider calls")) errors.push("README first screen missing dry-run provider boundary");
const docsText = docs.filter(exists).map(text).join("\n");
for (const flag of ["publicBlockerReportGenerated=true", "readmeFirstScreenChecked=true", "gitignoreChecked=true", "licenseDecisionRecorded=true", "securityPolicyDecisionRecorded=true", "contributingGuideDecisionRecorded=true"]) {
  if (!docsText.includes(flag)) errors.push(`missing flag ${flag}`);
}
for (const flag of falseFlags) if (!docsText.includes(`${flag}=false`)) errors.push(`missing false flag ${flag}`);

const result = {
  phase: "Phase608R",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase608r_hygiene_failed",
  publicBlockers: ["license_file_missing_decision_recorded", "security_policy_file_missing_placeholder_recorded", "contributing_file_missing_safety_guide_available", "evidence_local_path_scrub_required", "public_readme_polish_required"],
  publicBlockerReportGenerated: docsText.includes("publicBlockerReportGenerated=true"),
  readmeFirstScreenChecked: docsText.includes("readmeFirstScreenChecked=true"),
  gitignoreChecked: docsText.includes("gitignoreChecked=true"),
  licenseDecisionRecorded: docsText.includes("licenseDecisionRecorded=true"),
  securityPolicyDecisionRecorded: docsText.includes("securityPolicyDecisionRecorded=true"),
  contributingGuideDecisionRecorded: docsText.includes("contributingGuideDecisionRecorded=true"),
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
  workspaceCleanClaimed: false,
  docs,
  evidenceJson: evidencePath,
  errors,
};
fs.mkdirSync(path.dirname(p(evidencePath)), { recursive: true });
fs.writeFileSync(p(evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
if (errors.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
