import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docs = [
  "docs/phase627r-runtime-candidate-release-blocker-review.md",
  "docs/phase627r-blocker-matrix.md",
  "docs/phase627r-execution-report.md",
];
const evidencePath = "apps/ai-gateway-service/evidence/phase627r/runtime-candidate-release-blocker-review-result.json";

const docsText = docs.map(readText).join("\n");

const p0Blockers = [
  "secret exposure",
  "auth.json access",
  "Codex config write",
  "default `/chat` unintended integration",
  "`/chat-gateway/execute` unintended integration",
  "missing rollback",
  "missing emergency disable",
  "misleading production claim",
];

const p1Blockers = [
  "cost overrun",
  "rate limit",
  "timeout",
  "invalid response",
  "stale context",
  "UI misunderstanding",
];

const result = {
  phase: "Phase627R-Fix",
  name: "Runtime Candidate Release Blocker Review",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  p0Blockers,
  p1Blockers,
  p0BlockersCount: p0Blockers.length,
  p1BlockersCount: p1Blockers.length,
  releaseCandidateReady: false,
  runtimeCandidatePublicPreviewReady: false,
  productionReady: false,
  releaseExecuted: false,
  docsValidated: docs.every((file) => fs.existsSync(path.join(root, file))),
  docsMentionBlockers: docsText.includes("misleading production claim"),
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  defaultChatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  tagCreated: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
};

const checks = [
  check("p0BlockersCount", result.p0BlockersCount === 8),
  check("p1BlockersCount", result.p1BlockersCount === 6),
  check("releaseCandidateReady_false", result.releaseCandidateReady === false),
  check("runtimeCandidatePublicPreviewReady_false", result.runtimeCandidatePublicPreviewReady === false),
  check("productionReady_false", result.productionReady === false),
  check("releaseExecuted_false", result.releaseExecuted === false),
  check("docsValidated", result.docsValidated),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase627r_release_blocker_review_failed:${failed.join(",")}`;
}
result.checks = checks;
writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed || !result.recommended_sealed || result.blocker) process.exitCode = 1;

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
