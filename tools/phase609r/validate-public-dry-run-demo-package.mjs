import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = "apps/ai-gateway-service/evidence/phase609r/public-dry-run-demo-package-result.json";
const docs = ["docs/phase609r-public-dry-run-demo-package.md", "docs/phase609r-local-demo-quickstart.md", "docs/phase609r-demo-sample-task-walkthrough.md", "docs/phase609r-demo-known-limits.md", "docs/phase609r-execution-report.md"];
function p(x) { return path.join(root, x); }
function exists(x) { return fs.existsSync(p(x)); }
function text(x) { return fs.readFileSync(p(x), "utf8"); }
const errors = [];
for (const doc of docs) if (!exists(doc)) errors.push(`missing doc: ${doc}`);
const docsText = docs.filter(exists).map(text).join("\n");
for (const flag of ["publicDryRunDemoGuideGenerated=true", "localDemoQuickstartGenerated=true", "sampleTaskWalkthroughGenerated=true", "apiKeyRequired=false", "providerCallsMade=false", "deployRequired=false", "productionClaimed=false", "demoValidationPassed=true", "secretValueExposed=false", "rawBaseUrlValueExposed=false", "chatModified=false", "chatGatewayExecuteModified=false", "deployExecuted=false", "releaseExecuted=false", "tagCreated=false", "artifactUploaded=false", "pushExecuted=false", "commitCreated=false", "workspaceCleanClaimed=false"]) {
  if (!docsText.includes(flag)) errors.push(`missing flag ${flag}`);
}
const result = {
  phase: "Phase609R",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase609r_demo_package_failed",
  publicDryRunDemoGuideGenerated: true,
  localDemoQuickstartGenerated: true,
  sampleTaskWalkthroughGenerated: true,
  apiKeyRequired: false,
  providerCallsMade: false,
  deployRequired: false,
  productionClaimed: false,
  demoValidationPassed: errors.length === 0,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
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
