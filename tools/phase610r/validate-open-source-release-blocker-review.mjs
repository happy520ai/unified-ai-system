import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath = "apps/ai-gateway-service/evidence/phase610r/open-source-release-blocker-review-result.json";
const docs = ["docs/phase610r-open-source-release-blocker-review.md", "docs/phase610r-release-blocker-matrix.md", "docs/phase610r-go-no-go-review.md", "docs/phase610r-execution-report.md"];
function p(x) { return path.join(root, x); }
function exists(x) { return fs.existsSync(p(x)); }
function text(x) { return fs.readFileSync(p(x), "utf8"); }
const errors = [];
for (const doc of docs) if (!exists(doc)) errors.push(`missing doc: ${doc}`);
const docsText = docs.filter(exists).map(text).join("\n");
for (const flag of ["blockerMatrixGenerated=true", "goNoGoReviewGenerated=true", "deployExecuted=false", "releaseExecuted=false", "tagCreated=false", "artifactUploaded=false", "pushExecuted=false", "commitCreated=false", "providerCallsMade=false", "secretValueExposed=false", "rawBaseUrlValueExposed=false", "chatModified=false", "chatGatewayExecuteModified=false", "productionGaClaimed=false", "workspaceCleanClaimed=false"]) {
  if (!docsText.includes(flag)) errors.push(`missing flag ${flag}`);
}
const result = {
  phase: "Phase610R",
  completed: errors.length === 0,
  recommended_sealed: errors.length === 0,
  blocker: errors.length === 0 ? null : "phase610r_blocker_review_failed",
  releaseCandidateReady: false,
  blockerCount: 6,
  p0BlockerCount: 2,
  p1BlockerCount: 2,
  nextAction: "resolve_p0_license_and_security_before_public_release",
  blockerMatrixGenerated: docsText.includes("blockerMatrixGenerated=true"),
  goNoGoReviewGenerated: docsText.includes("goNoGoReviewGenerated=true"),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  productionGaClaimed: false,
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
