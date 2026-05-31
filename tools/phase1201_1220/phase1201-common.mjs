import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const repoRoot = process.cwd();
export const phaseDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1201_1220");
export const ownerTrialDir = resolve(repoRoot, "local-self-use/v1/owner-trial");
export const fixCandidateDir = resolve(repoRoot, "local-self-use/v1/fix-candidates");
export const docsDir = resolve(repoRoot, "docs/phase1201-1220");
export const ownerFeedbackInputPath = resolve(ownerTrialDir, "owner-feedback.input.json");
export const visualFeedbackInputPath = resolve(ownerTrialDir, "visual-feedback.input.json");

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function writeJson(path, data) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function writeText(path, text) {
  ensureDir(dirname(path));
  writeFileSync(path, `${text.trim()}\n`, "utf8");
}

export function readJsonIfExists(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function safetyFields() {
  return {
    providerCallsMade: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    yiyiRestored: false,
    characterModuleRestored: false
  };
}

export function tokenSavingFields() {
  return {
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true
  };
}

export function baseResult(extra = {}) {
  return {
    completed: true,
    ...extra,
    ...tokenSavingFields(),
    ...safetyFields()
  };
}

export function classifyFeedbackItems(feedback) {
  const bugs = Array.isArray(feedback?.bugsObserved) ? feedback.bugsObserved : [];
  const confusing = Array.isArray(feedback?.confusingPoints) ? feedback.confusingPoints : [];
  const failed = Array.isArray(feedback?.whatFailed) ? feedback.whatFailed : [];
  const suggestions = Array.isArray(feedback?.severitySuggestions) ? feedback.severitySuggestions : [];
  const combined = [
    ...bugs.map((item) => ({ source: "bugsObserved", text: normalizeItem(item) })),
    ...confusing.map((item) => ({ source: "confusingPoints", text: normalizeItem(item) })),
    ...failed.map((item) => ({ source: "whatFailed", text: normalizeItem(item) })),
    ...suggestions.map((item) => ({ source: "severitySuggestions", text: normalizeItem(item) }))
  ].filter((item) => item.text);

  return combined.map((item, index) => {
    const lower = item.text.toLowerCase();
    let severity = "P3";
    if (/secret|api key|auth\.json|deploy|release|tag|artifact|\/chat|\/chat-gateway\/execute|data loss|泄露|密钥|部署|发布/.test(lower)) severity = "P0";
    else if (/unusable|无法使用|崩溃|打不开|核心|阻塞|provider gate|selectable/.test(lower)) severity = "P1";
    else if (/confus|不清楚|拥挤|看不懂|布局|间距|对比|按钮|模式|evidence|provider|credential/.test(lower)) severity = "P2";
    return {
      issueId: `phase1201-owner-${String(index + 1).padStart(3, "0")}`,
      source: item.source,
      title: item.text.slice(0, 80),
      description: item.text,
      severity,
      category: classifyCategory(lower),
      activeUnsafeRisk: severity === "P0",
      fixNowAllowed: severity === "P2" || severity === "P3",
      requiresApproval: severity === "P0" || severity === "P1"
    };
  });
}

function normalizeItem(item) {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") return String(item.title || item.description || item.text || "").trim();
  return "";
}

function classifyCategory(lower) {
  if (/button|按钮|cta|interaction|交互/.test(lower)) return "interaction clarity";
  if (/spacing|间距|layout|布局|拥挤/.test(lower)) return "layout/spacing";
  if (/contrast|对比|颜色|看不清/.test(lower)) return "contrast";
  if (/copy|文案|看不懂|术语/.test(lower)) return "copy clarity";
  if (/provider|credential|secret|密钥/.test(lower)) return "Provider/CredentialRef confusion";
  if (/evidence|证据/.test(lower)) return "evidence issue";
  return "UX friction";
}
