import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../../../..");

export const defaultReviewPaths = {
  inboxMarkdownPath: resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.md"),
  inboxJsonPath: resolve(repoRoot, ".codex-handoff/inbox/latest-codex-result.json"),
  taskJsonPath: resolve(repoRoot, ".codex-handoff/outbox/latest-codex-task.json"),
  reviewDir: resolve(repoRoot, ".codex-handoff/review"),
  reviewJsonPath: resolve(repoRoot, ".codex-handoff/review/latest-desktop-review.json"),
  reviewMarkdownPath: resolve(repoRoot, ".codex-handoff/review/latest-desktop-review.md"),
  feedbackMarkdownPath: resolve(repoRoot, ".codex-handoff/review/latest-feedback-to-codex.md"),
};

export async function reviewLatestCodexDesktopResult(paths = defaultReviewPaths) {
  const resultMarkdown = await readFile(paths.inboxMarkdownPath, "utf8");
  const resultMetadata = await readJsonIfPresent(paths.inboxJsonPath);
  const task = await readJsonIfPresent(paths.taskJsonPath);
  const review = buildReview({ resultMarkdown, resultMetadata, task });
  await writeReviewOutputs({ review, paths });
  return review;
}

export async function writeReviewOutputs({ review, paths = defaultReviewPaths }) {
  await mkdir(paths.reviewDir, { recursive: true });
  await writeFile(paths.reviewJsonPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  await writeFile(paths.reviewMarkdownPath, renderReviewMarkdown(review), "utf8");
  await writeFile(paths.feedbackMarkdownPath, renderFeedbackMarkdown(review), "utf8");
}

export function buildReview({ resultMarkdown, resultMetadata, task }) {
  const text = resultMarkdown || "";
  const boundaryFindings = [
    finding("legacyModification", "mentions modifying legacy/", hasLegacyModification(text)),
    finding("projectContextCreated", "mentions creating PROJECT_CONTEXT.md", hasProjectContextCreated(text)),
    finding("commitPushPrRelease", "mentions commit/push/PR/release", hasCommitPushPrRelease(text)),
    finding("codexCliOrExec", "mentions codex CLI / codex exec invocation", hasCodexCliOrExec(text)),
    finding("worktreeCreated", "mentions creating worktree", hasWorktreeCreated(text)),
    finding("workflowRunnerConnected", "mentions workflow runner connection", hasWorkflowRunnerConnected(text)),
    finding("plaintextApiKey", "possible plaintext API key leak", containsPlaintextSecret(text)),
    finding("previewOnlyAsProductionReady", "claims preview-only as production-ready", claimsProductionReady(text)),
    finding("automaticExecutionSuccess", "claims automatic execution success", claimsAutomaticExecutionSuccess(text)),
  ];

  const verificationFindings = [
    finding("hasCommandList", "contains executed command list", !hasCommandList(text)),
    finding("hasModifiedFileList", "contains modified file list", !hasModifiedFileList(text)),
    finding("hasVerificationResult", "contains verification result", !hasVerificationResult(text)),
    finding("hasBlockerStatement", "contains blocker or known-issues statement", !hasBlockerStatement(text)),
    finding("hasAMSummary", "contains A-M summary", !hasAMSummary(text)),
  ];

  const evidenceFindings = [
    finding("hasEvidencePathOrStatement", "contains evidence path or evidence statement", !hasEvidencePathOrStatement(text)),
  ];

  const boundaryViolations = boundaryFindings.filter((item) => item.failed);
  const verificationGaps = verificationFindings.filter((item) => item.failed);
  const evidenceGaps = evidenceFindings.filter((item) => item.failed);
  const goNoGo = decideGoNoGo({ boundaryViolations, verificationGaps, evidenceGaps });

  return {
    reviewedAt: new Date().toISOString(),
    inputPaths: {
      resultMarkdown: ".codex-handoff/inbox/latest-codex-result.md",
      resultMetadata: ".codex-handoff/inbox/latest-codex-result.json",
      taskJson: ".codex-handoff/outbox/latest-codex-task.json",
    },
    outputPaths: {
      reviewJson: ".codex-handoff/review/latest-desktop-review.json",
      reviewMarkdown: ".codex-handoff/review/latest-desktop-review.md",
      feedbackMarkdown: ".codex-handoff/review/latest-feedback-to-codex.md",
    },
    task: task ? {
      taskId: task.taskId || null,
      title: task.title || null,
      mode: task.mode || null,
    } : null,
    importedResult: resultMetadata ? {
      importedAt: resultMetadata.importedAt || null,
      source: resultMetadata.source || null,
      contentLength: resultMetadata.contentLength || text.length,
    } : null,
    goNoGo,
    boundaryViolationCount: boundaryViolations.length,
    verificationGapCount: verificationGaps.length,
    evidenceGapCount: evidenceGaps.length,
    requiresHumanReview: goNoGo !== "go",
    recommendedNextAction: buildRecommendedNextAction(goNoGo),
    boundaryFindings,
    verificationFindings,
    evidenceFindings,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "Desktop review is a local inbox/review/go-no-go gate. It is not Codex execution and does not grant commit/push permission.",
  };
}

export function renderReviewMarkdown(review) {
  return [
    "# Codex Desktop Result Review",
    "",
    `- reviewedAt: ${review.reviewedAt}`,
    `- goNoGo: ${review.goNoGo}`,
    `- boundaryViolationCount: ${review.boundaryViolationCount}`,
    `- verificationGapCount: ${review.verificationGapCount}`,
    `- evidenceGapCount: ${review.evidenceGapCount}`,
    `- requiresHumanReview: ${review.requiresHumanReview}`,
    `- recommendedNextAction: ${review.recommendedNextAction}`,
    "",
    "## Boundary Findings",
    ...review.boundaryFindings.map((item) => `- ${item.id}: ${item.failed ? "failed" : "passed"} - ${item.label}`),
    "",
    "## Verification Findings",
    ...review.verificationFindings.map((item) => `- ${item.id}: ${item.failed ? "missing" : "present"} - ${item.label}`),
    "",
    "## Evidence Findings",
    ...review.evidenceFindings.map((item) => `- ${item.id}: ${item.failed ? "missing" : "present"} - ${item.label}`),
    "",
    "## Safety",
    "- codexCliInvoked=false",
    "- codexExecInvoked=false",
    "- workflowRunnerEnabled=false",
    "- worktreeCreated=false",
    "- autoCommit=false",
    "- autoPush=false",
    "",
  ].join("\n");
}

export function renderFeedbackMarkdown(review) {
  const failedItems = [
    ...review.boundaryFindings.filter((item) => item.failed),
    ...review.verificationFindings.filter((item) => item.failed),
    ...review.evidenceFindings.filter((item) => item.failed),
  ];

  return [
    "# 给 Codex 的审查反馈",
    "",
    `审查结论：${review.goNoGo}`,
    "",
    "## 发现的问题",
    ...toFeedbackLines(failedItems),
    "",
    "## 需要补充什么",
    review.goNoGo === "go"
      ? "- 暂无必须补充项。"
      : "- 请补齐缺失的执行命令列表、修改文件列表、验证结果、evidence 路径或说明、blocker 说明和 A-M 总结。",
    "",
    "## 是否允许继续",
    review.goNoGo === "go"
      ? "- 可以由人工决定是否继续生成下一步任务。"
      : "- 不允许自动继续；请先处理上述问题。",
    "",
    "## 必须保留的边界",
    "- 不修改 legacy/",
    "- 不创建 PROJECT_CONTEXT.md",
    "- 不 commit/push/PR/release",
    "- 不调用 codex CLI",
    "- 不使用 codex exec",
    "- 不创建 worktree",
    "- 不接 workflow runner",
    "- 不写入真实 API key",
    "- 不把 preview-only 写成 production-ready",
    "- Codex 返回结果后仍必须进入 inbox/review/go-no-go。",
    "",
  ].join("\n");
}

function finding(id, label, failed) {
  return { id, label, failed: Boolean(failed) };
}

function decideGoNoGo({ boundaryViolations, verificationGaps, evidenceGaps }) {
  if (boundaryViolations.length > 0) return "no-go";
  if (verificationGaps.length >= 5 && evidenceGaps.length > 0) return "human-review-required";
  if (verificationGaps.length > 0 || evidenceGaps.length > 0) return "review-required";
  return "go";
}

function buildRecommendedNextAction(goNoGo) {
  if (goNoGo === "go") return "边界清楚且验证/evidence 完整；可以人工决定是否生成下一步任务。";
  if (goNoGo === "no-go") return "stop and reject: 停止并修复 boundary violation，不要继续扩展任务。";
  if (goNoGo === "review-required") return "要求 Codex 补齐验证命令、修改文件列表、验证结果、evidence 说明或 A-M 总结。";
  return "无法判断；请人工复核后再决定。";
}

function hasLegacyModification(text) {
  return hasAffirmativeBoundaryLine(text, /legacy\//i, /(modified|changed|updated|edited|修改|改动|被修改)/i)
    || /修改了\s*legacy|改动了\s*legacy/i.test(text);
}

function hasProjectContextCreated(text) {
  return hasAffirmativeBoundaryLine(text, /PROJECT_CONTEXT\.md/i, /(created|创建|已创建)/i)
    || /created\s+PROJECT_CONTEXT\.md/i.test(text);
}

function hasCommitPushPrRelease(text) {
  return hasAffirmativeBoundaryLine(text, /(commit|push|PR|release|提交|推送|发布)/i, /(committed|pushed|opened|created|released|已提交|已推送|创建|已发布|自动发布)/i);
}

function hasCodexCliOrExec(text) {
  return hasAffirmativeBoundaryLine(text, /codex\s+(cli|exec)/i, /(called|invoked|run|executed|调用|执行|已调用|已执行)/i)
    || hasAffirmativeBoundaryLine(text, /codex/i, /(调用|执行|已调用|已执行)/i);
}

function hasWorktreeCreated(text) {
  return hasAffirmativeBoundaryLine(text, /worktree/i, /(created|创建|已创建)/i)
    || /创建了\s*worktree/i.test(text);
}

function hasWorkflowRunnerConnected(text) {
  return hasAffirmativeBoundaryLine(text, /workflow runner/i, /(connected|enabled|接入|启用|已接入|已启用)/i)
    || /接入了\s*workflow runner/i.test(text);
}

function claimsProductionReady(text) {
  return hasAffirmativeBoundaryLine(text, /(preview-only|production|生产)/i, /(production-ready|ready for production|生产可用|生产级已完成)/i);
}

function claimsAutomaticExecutionSuccess(text) {
  return hasAffirmativeBoundaryLine(text, /(自动执行|unattended|automatic execution|execution completed)/i, /(成功|completed|succeeded|automatically)/i);
}

function hasAffirmativeBoundaryLine(text, subjectPattern, actionPattern) {
  return String(text || "").split(/\r?\n/).some((line) => {
    if (!subjectPattern.test(line) || !actionPattern.test(line)) return false;
    return !/\b(no|false|none|not|disabled|blocked)\b|否|不|未|无|没有|禁止/i.test(line);
  });
}

function hasCommandList(text) {
  return /(Commands Run|实际执行命令|执行命令列表|执行命令|必须执行|cmd \/c pnpm run)/i.test(text);
}

function hasModifiedFileList(text) {
  return /(Changed Files|实际修改文件|修改文件列表|文件列表|Changed files)/i.test(text);
}

function hasVerificationResult(text) {
  return /(Tests Passed|验证结果|是否通过|passed|verify:|health:|doctor:)/i.test(text);
}

function hasEvidencePathOrStatement(text) {
  return /(Evidence Paths|evidence 路径|evidence|证据|\.codex-handoff\/runs|\.codex-handoff\/inbox)/i.test(text);
}

function hasBlockerStatement(text) {
  return /(Known Issues|blocker|阻塞|当前 blocker|none|无)/i.test(text);
}

function hasAMSummary(text) {
  return /(^|\n)\s*A\.\s/m.test(text) && /(^|\n)\s*M\.\s/m.test(text);
}

function containsPlaintextSecret(value) {
  return /(?:sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,}|BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY)/i.test(String(value || ""));
}

function toFeedbackLines(items) {
  if (items.length === 0) return ["- 未发现阻塞问题。"];
  return items.map((item) => `- ${item.label}：需要处理`);
}

async function readJsonIfPresent(pathValue) {
  try {
    return JSON.parse(await readFile(pathValue, "utf8"));
  } catch {
    return null;
  }
}
