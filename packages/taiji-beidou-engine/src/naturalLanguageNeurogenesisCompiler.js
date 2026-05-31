import { normalizeCapabilityId } from "./capabilityNeuronManifest.js";

const patterns = [
  { type: "safety", keywords: ["风险", "risk", "安全", "拦截"], pressureTypes: ["risk"], modes: ["normal", "god", "tianshu"] },
  { type: "review", keywords: ["god", "review", "评审", "审查"], pressureTypes: ["quality"], modes: ["god"] },
  { type: "context", keywords: ["上下文", "context", "token", "压缩", "省"], pressureTypes: ["token"], modes: ["codex", "normal"] },
  { type: "evidence", keywords: ["回滚", "rollback", "证据", "失败"], pressureTypes: ["evidence"], modes: ["normal"] },
  { type: "ui", keywords: ["展示", "显示", "为什么", "可见"], pressureTypes: ["explainability"], modes: ["normal"] },
  { type: "planning", keywords: ["计划", "规划", "tianshu", "天枢"], pressureTypes: ["planning"], modes: ["tianshu"] },
];

export function compileNaturalLanguageCapability(intakeText, options = {}) {
  const text = String(intakeText || "").trim();
  const lower = text.toLowerCase();
  const match = patterns.find((pattern) => pattern.keywords.some((keyword) => lower.includes(keyword.toLowerCase())));
  const type = options.type || match?.type || "other";
  const capabilityId = normalizeCapabilityId(options.capabilityId || text || "capability-neuron");

  return {
    compilerVersion: "phase651-666-deterministic-neurogenesis-v1",
    deterministic: true,
    modelCallsMade: false,
    capabilityId,
    displayName: options.displayName || inferDisplayName(text, type),
    description: inferDescription(text, type),
    intakeText: text,
    type,
    requestedRuntime: "dry_run",
    pressureTypes: match?.pressureTypes || ["general"],
    modes: match?.modes || ["normal"],
    dependencies: options.dependencies || [],
    requiredArtifacts: ["manifest", "scaffoldPlan", "fixture", "verifier", "evidence", "rollback"],
    safetyBoundary: {
      providerCallsAllowed: false,
      secretReadAllowed: false,
      deployAllowed: false,
      chatMutationAllowed: false,
      chatGatewayExecuteMutationAllowed: false,
      codexConfigMutationAllowed: false,
      selfApprovalAllowed: false,
    },
  };
}

export function compileNaturalLanguageCapabilities(intakes) {
  return intakes.map((intakeText, index) =>
    compileNaturalLanguageCapability(intakeText, {
      capabilityId: `trial-${index + 1}-${intakeText}`,
    }));
}

function inferDisplayName(text, type) {
  if (text.includes("God")) return "God Mode Need Classifier";
  if (text.includes("上下文") || text.toLowerCase().includes("token")) return "Context Compression Token Saver";
  if (text.includes("回滚")) return "Failure Rollback Advisor";
  if (text.includes("为什么")) return "Capability Disabled Reason Viewer";
  if (text.includes("风险")) return "Task Risk Level Classifier";
  return `${type} Capability Neuron`;
}

function inferDescription(text, type) {
  return `Deterministic dry-run capability spec compiled from natural-language intake: ${text || type}.`;
}
