import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const evidencePath =
  "apps/ai-gateway-service/evidence/phase606r/open-source-minimum-readiness-lock-result.json";
const phase605EvidencePath =
  "apps/ai-gateway-service/evidence/phase605r/safe-auto-runner-batch-result.json";

const docs = [
  "docs/phase606r-open-source-minimum-readiness-lock.md",
  "docs/phase606r-clone-read-dry-run-demo-guide.md",
  "docs/phase606r-contributor-safety-guide.md",
  "docs/phase606r-open-source-known-limits.md",
  "docs/phase606r-execution-report.md",
];

const requiredReadmeLine =
  "Phase606R Open Source Minimum Readiness Lock is sealed as a clone/read/dry-run-demo readiness lock";
const requiredAgentsLine =
  "Phase606R Open Source Minimum Readiness Lock may document clone/read/dry-run demo readiness";

function resolvePath(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(resolvePath(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(resolvePath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
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

function hasOverclaim(text) {
  const patterns = [
    /production\s+(ready|complete|deployed)/i,
    /global\s+release\s+complete/i,
    /real\s+provider\s+(ready|verified|passed)/i,
    /deployExecuted=true/,
    /releaseExecuted=true/,
    /tagCreated=true/,
    /artifactUploaded=true/,
    /providerCallsMade=true/,
    /workspaceCleanClaimed=true/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function packageScriptExists() {
  const pkg = readJson("package.json");
  return (
    pkg.scripts?.["verify:phase606r-open-source-minimum-readiness-lock"] ===
    "node tools/phase606r/validate-open-source-minimum-readiness-lock.mjs"
  );
}

const errors = [];
for (const doc of docs) {
  if (!exists(doc)) errors.push(`missing doc: ${doc}`);
}

let phase605 = null;
if (!exists(phase605EvidencePath)) {
  errors.push(`missing Phase605R evidence: ${phase605EvidencePath}`);
} else {
  try {
    phase605 = readJson(phase605EvidencePath);
  } catch (error) {
    errors.push(`Phase605R evidence JSON parse failed: ${error.message}`);
  }
}

if (phase605) {
  if (phase605.completed !== true) errors.push("Phase605R completed must be true");
  if (phase605.recommended_sealed !== true) {
    errors.push("Phase605R recommended_sealed must be true");
  }
  if (phase605.highRiskBrakeTriggered !== false) {
    errors.push("Phase605R highRiskBrakeTriggered must be false");
  }
  if (phase605.providerCallsMade !== false) {
    errors.push("Phase605R providerCallsMade must be false");
  }
}

if (!packageScriptExists()) {
  errors.push("missing package script verify:phase606r-open-source-minimum-readiness-lock");
}

const docsText = docs.filter(exists).map(readText).join("\n");
if (!docsText.includes("clone") || !docsText.includes("dry-run")) {
  errors.push("Phase606R docs must mention clone and dry-run readiness");
}
if (!docsText.includes("No real Provider") && !docsText.includes("no real Provider")) {
  errors.push("Phase606R docs must state no real Provider requirement");
}
if (!docsText.includes("not deployment") && !docsText.includes("not a deployment")) {
  errors.push("Phase606R docs must state this is not deployment");
}
if (hasRawSecretLikeValue(docsText)) {
  errors.push("Phase606R docs contain raw secret-like or endpoint-like value");
}
if (hasOverclaim(docsText)) {
  errors.push("Phase606R docs overclaim readiness or execution");
}

if (!readText("README.md").includes(requiredReadmeLine)) {
  errors.push("README managed block missing Phase606R readiness line");
}
if (!readText("AGENTS.md").includes(requiredAgentsLine)) {
  errors.push("AGENTS managed block missing Phase606R boundary line");
}

const result = {
  phase: "Phase606R",
  title: "Open Source Minimum Readiness Lock",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase606r_open_source_readiness_lock_failed",
  phase605Imported: Boolean(phase605),
  cloneReadableDocumented: docsText.includes("clone"),
  dryRunDemoDocumented: docsText.includes("dry-run"),
  noRealProviderRequired: /no real Provider/i.test(docsText),
  deploymentNotRequired: /not (a )?deployment/i.test(docsText),
  packageScriptPresent: errors.every(
    (error) => !error.startsWith("missing package script"),
  ),
  readmeManagedBlockUpdated: readText("README.md").includes(requiredReadmeLine),
  agentsManagedBlockUpdated: readText("AGENTS.md").includes(requiredAgentsLine),
  providerCallsMade: false,
  secretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  rawBaseUrlValueExposed: false,
  codexUserConfigModified: false,
  codexProjectConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  workspaceCleanClaimed: false,
  docs,
  evidenceJson: evidencePath,
  verifier: "tools/phase606r/validate-open-source-minimum-readiness-lock.mjs",
  validationCommands: [
    "cmd /c node --check tools/phase606r/validate-open-source-minimum-readiness-lock.mjs",
    "cmd /c pnpm verify:phase606r-open-source-minimum-readiness-lock",
    "cmd /c pnpm verify:phase107a-secret-safety",
    "cmd /c pnpm verify:phase321a-workbench-product-recovery",
    "cmd /c pnpm smoke:phase308a-desktop-workbench-ui",
    "cmd /c pnpm -r --if-present check",
  ],
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
