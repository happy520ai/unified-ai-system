import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { captureScreenshot } from "./phase378-common.mjs";
import { readJson, readText, writeJson, writeText } from "./phase373-common.mjs";

export const characterDir = "apps/ai-gateway-service/src/ui/assets/yiyi/character";
export const canonSchemaPath = `${characterDir}/yiyi-character-canon.schema.json`;
export const canonPath = `${characterDir}/yiyi-character-canon.json`;
export const scenarioSchemaPath = `${characterDir}/yiyi-scenario-lines.schema.json`;
export const scenarioLinesPath = `${characterDir}/yiyi-scenario-lines.json`;
export const canonMapPath = `${characterDir}/yiyi-emotion-behavior-canon-map.json`;

export const phase380Safety = {
  yiyiCanExecuteActions: false,
  yiyiCanReadSecrets: false,
  yiyiCanCallProviders: false,
  yiyiCanDeploy: false,
  yiyiCanModifyEvidence: false,
  yiyiCanForgeApproval: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  externalUploadPerformed: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
  noMedicalClaim: true,
  noTherapyClaim: true,
  noSensitiveHealthInference: true,
  noHiddenSystemPromptLeakage: true,
};

export const phase380Screenshots = {
  overview: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-character-settings-overview.png",
  canon: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-canon-section.png",
  scenarioLines: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-scenario-lines.png",
  editorDryRun: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-persona-editor-dry-run.png",
  unsafeRejected: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-unsafe-entry-rejected.png",
  safetyBoundary: "apps/ai-gateway-service/evidence/phase380f/screenshots/yiyi-safety-boundary.png",
};

export function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

export function fileExists(relativePath) {
  return existsSync(resolve(relativePath));
}

export function fileSize(relativePath) {
  return statSync(resolve(relativePath)).size;
}

export async function readCanon() {
  return readJson(canonPath);
}

export async function readScenarioLines() {
  return readJson(scenarioLinesPath);
}

export async function readCanonMap() {
  return readJson(canonMapPath);
}

export async function readPhase380Source() {
  const files = [
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
    "apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js",
    "apps/ai-gateway-service/src/ui/components/YiyiEmotionPanel.js",
    "apps/ai-gateway-service/src/ui/components/YiyiCharacterSettingsPanel.js",
    "apps/ai-gateway-service/src/ui/copy/yiyiCopy.js",
  ];
  const parts = [];
  for (const file of files) {
    if (fileExists(file)) parts.push(await readText(file));
  }
  return parts.join("\n");
}

export async function writeArtifacts({ reportPath, reportLines, resultPath, result }) {
  if (reportPath) await writeText(reportPath, reportLines.join("\n"));
  await writeJson(resultPath, result);
}

export function classifyPersonaEntry(entry) {
  const text = String(entry?.entryText || "");
  const lower = text.toLowerCase();
  const unsafeRules = [
    { id: "secret", pattern: /(api key|secret|密钥|token|\.env|读取.*key|显示.*key)/i, reason: "attempts_to_grant_yiyi_secret_access", blockedCapabilities: ["read_secret"] },
    { id: "provider", pattern: /(openai|claude|openrouter|mimo|调用.*provider|绕过.*provider|provider gate|未配置 provider)/i, reason: "attempts_to_grant_yiyi_provider_access", blockedCapabilities: ["call_provider", "bypass_provider_gate"] },
    { id: "deploy", pattern: /(deploy|release|create tag|upload artifact|部署|发布|创建 tag|上传 artifact)/i, reason: "attempts_to_grant_yiyi_deploy_authority", blockedCapabilities: ["deploy", "release", "create_tag", "upload_artifact"] },
    { id: "governance", pattern: /(伪造.*approval|修改.*evidence|隐藏.*audit|绕过.*security shield|forge approval|tamper evidence)/i, reason: "attempts_to_bypass_governance", blockedCapabilities: ["forge_approval", "modify_evidence", "bypass_security"] },
    { id: "medical", pattern: /(therapy|治疗|心理诊断|焦虑症|抑郁症|医疗|健康画像|敏感身份)/i, reason: "medical_or_therapy_claim_not_allowed", blockedCapabilities: ["medical_claim", "therapy_claim", "sensitive_health_inference"] },
    { id: "prompt", pattern: /(hidden system prompt|system prompt|内部 policy|隐藏.*prompt|泄露.*policy)/i, reason: "hidden_prompt_or_policy_leakage_request", blockedCapabilities: ["hidden_prompt_leakage"] },
  ];
  const unsafe = unsafeRules.find((rule) => rule.pattern.test(text) || rule.pattern.test(lower));
  if (unsafe) {
    return {
      entryId: "yiyi_entry_rejected_001",
      classification: "rejected_unsafe_entry",
      decision: "rejected",
      reason: unsafe.reason,
      blockedCapabilities: unsafe.blockedCapabilities,
      safeAlternative: "依依可以解释为什么不能越权，并引导查看 credentialRef、安全护盾或 evidence 状态。",
      safetyPassed: false,
      requiresHumanReview: false,
      mappedFields: ["safetyRules", "capabilityLimits"],
      providerCallsMade: false,
      secretValueExposed: false,
    };
  }
  const hint = String(entry?.entryTypeHint || "").toLowerCase();
  let classification = "editable_profile";
  let mappedFields = ["personalityProfile", "speechStyle"];
  if (hint.includes("scenario") || /台词|文案|说/.test(text)) {
    classification = "scenario_line";
    mappedFields = ["scenarioLines", "speechStyle"];
  } else if (hint.includes("behavior") || /动作|行为|姿态/.test(text)) {
    classification = "behavior_rule";
    mappedFields = ["behaviorStateMachine", "editableProfile"];
  } else if (hint.includes("emotion") || /情绪|温柔|鼓励/.test(text)) {
    classification = "emotion_mapping";
    mappedFields = ["personalityProfile", "speechStyle", "fallback_sorry"];
  } else if (hint.includes("visual") || /视觉|颜色|帽|发/.test(text)) {
    classification = "visual_note";
    mappedFields = ["visualProfile", "futureCanonCandidates"];
  }
  return {
    entryId: "yiyi_entry_001",
    classification,
    decision: classification === "editable_profile" ? "accepted_as_candidate" : "accepted_as_candidate",
    safetyPassed: true,
    requiresHumanReview: false,
    mappedFields,
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

export async function fetchUi(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, text: await response.text(), error: null };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error.message };
  }
}

export async function capturePhase380Screenshot({ url, outputPath, viewport = "1700,2600" }) {
  return captureScreenshot({ url, outputPath, viewport });
}
