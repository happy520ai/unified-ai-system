import { classifyShellCommand } from "./shellCommandClassifier.js";
import { evaluatePermissionRules } from "./permissionRuleEngine.js";

const rank = {
  allow: 0,
  approval_required: 1,
  deny: 2,
  forbidden: 3,
};

export function buildTimedRunnerPermissionDecision({ task, riskGateDecision = "deny" } = {}) {
  const targetFiles = collectTargetFiles(task);
  const operations = Array.isArray(task?.operations) ? task.operations : [];
  const commandPreviewInfo = collectCommandPreviewInfo(task);
  const commandPreview = commandPreviewInfo.commandPreview;
  const commandCategory = commandPreview ? classifyShellCommand(commandPreview).category : inferCommandCategory(operations, targetFiles);
  const providerRisk = hasProviderRisk({ operations, targetFiles, commandCategory });
  const secretRisk = hasSecretRisk({ operations, targetFiles, commandCategory });
  const deployRisk = hasDeployRisk({ operations, targetFiles, commandCategory });
  const chatRouteRisk = hasChatRouteRisk({ operations, targetFiles });
  const action = inferPermissionAction({
    providerRisk,
    secretRisk,
    deployRisk,
    chatRouteRisk,
    commandPreview,
    commandPreviewSource: commandPreviewInfo.source,
    targetFiles,
  });
  const permissionResource = action === "shell_command"
    ? `${commandPreview} ${targetFiles.join(" ")}`
    : targetFiles.join(",") || task?.taskId || "no-task-selected";
  const rules = buildTimedRunnerRules();
  const permissionResult = evaluatePermissionRules({
    action,
    resource: permissionResource,
    rules,
  });
  const riskLevel = task?.riskLevel || "none";
  const decision = task ? permissionResult.decision : "deny";
  return {
    phaseId: "Phase2056-GVC-Permission-Engine-Timed-Runner-Decision-Path",
    taskId: task?.taskId || null,
    decision,
    reason: task ? permissionResult.reason : "No timed-runner task was selected.",
    matchedRules: task && permissionResult.matchedRuleId ? [permissionResult.matchedRuleId] : [],
    riskGateDecision,
    riskLevel,
    targetFiles,
    operations,
    commandCategory,
    commandPreviewSource: commandPreviewInfo.source,
    providerRisk,
    secretRisk,
    deployRisk,
    chatRouteRisk,
    shadowOnly: true,
    finalExecutionGate: "existing_gvc_risk_gate_and_low_risk_executor",
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    copiedClaudeCodeSource: false,
  };
}

export function reconcilePermissionWithRiskGate({ permissionDecision, riskGateDecision = "deny" } = {}) {
  const permission = normalizeDecision(permissionDecision?.decision);
  const riskGate = normalizeDecision(riskGateDecision);
  const finalDecision = rank[permission] >= rank[riskGate] ? permission : riskGate;
  const conflict = permission !== riskGate;
  return {
    permissionDecision: permission,
    riskGateDecision: riskGate,
    finalDecision,
    conflict,
    selectedConservativeDecision: true,
    shouldExecuteTask: finalDecision === "allow" && conflict === false,
    shadowOnly: true,
    realMutationBehaviorExpanded: false,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatGatewayExecuteModified: false,
  };
}

function buildTimedRunnerRules() {
  return [
    { id: "phase2056-forbid-secret-read", effect: "forbidden", action: "secret_read", reason: "Secret, token, auth, and .env reads are forbidden." },
    { id: "phase2056-forbid-deploy", effect: "forbidden", action: "deploy", reason: "Deploy, release, tag, upload, push, and commit are forbidden." },
    { id: "phase2056-forbid-chat-route", effect: "forbidden", action: "chat_route_modify", reason: "Chat route and chat-gateway execution modifications are forbidden in Phase2056." },
    { id: "phase2056-provider-approval", effect: "approval_required", action: "provider_call", reason: "Provider calls require separate owner approval." },
    { id: "phase2056-allow-safe-test-command", effect: "allow", action: "shell_command", resourceIncludes: "verify:", reason: "Verifier command previews may be shadow-allowed; original GVC gate remains final." },
    { id: "phase2056-allow-evidence", effect: "allow", action: "file_mutation", pathPrefix: "apps/ai-gateway-service/evidence/", reason: "Low-risk evidence writes may be allowed by the original GVC gate." },
    { id: "phase2056-allow-docs", effect: "allow", action: "file_mutation", pathPrefix: "docs/", reason: "Low-risk docs writes may be allowed by the original GVC gate." },
    { id: "phase2056-allow-phase-tools", effect: "allow", action: "file_mutation", pathPrefix: "tools/phase", reason: "Low-risk phase verifier/tool files may be allowed by the original GVC gate." },
    { id: "phase2056-allow-gvc-tools", effect: "allow", action: "file_mutation", pathPrefix: "tools/gvc/", reason: "GVC tooling changes may be allowed only when the original GVC gate permits them." },
    { id: "phase2056-allow-package", effect: "allow", action: "file_mutation", pathPrefix: "package.json", reason: "Package script changes may be allowed only when the original GVC gate permits them." },
  ];
}

function collectTargetFiles(task) {
  const touches = Array.isArray(task?.touches) ? task.touches : [];
  const mutationFiles = Array.isArray(task?.mutationPlan?.mutations)
    ? task.mutationPlan.mutations.map((mutation) => mutation.path)
    : [];
  return Array.from(new Set([...touches, ...mutationFiles].filter(Boolean).map((file) => String(file).replaceAll("\\", "/"))));
}

function collectCommandPreviewInfo(task) {
  if (typeof task?.command === "string") {
    return { commandPreview: task.command, source: "task.command" };
  }
  if (typeof task?.verifierCommand === "string") {
    return { commandPreview: task.verifierCommand, source: "task.verifierCommand" };
  }
  const verifier = task?.mutationPlan?.verifierCommands?.[0];
  if (verifier?.command) {
    return {
      commandPreview: [verifier.command, ...(verifier.args || [])].join(" "),
      source: "mutationPlan.verifierCommands",
    };
  }
  return { commandPreview: "", source: "none" };
}

function inferCommandCategory(operations, targetFiles) {
  if (operations.some((operation) => String(operation).includes("verifier"))) return "safe_test";
  if (targetFiles.length > 0) return "mutation";
  return "safe_read";
}

function inferPermissionAction({
  providerRisk,
  secretRisk,
  deployRisk,
  chatRouteRisk,
  commandPreview,
  commandPreviewSource,
  targetFiles,
}) {
  if (secretRisk) return "secret_read";
  if (deployRisk) return "deploy";
  if (chatRouteRisk) return "chat_route_modify";
  if (providerRisk) return "provider_call";
  if (commandPreviewSource === "mutationPlan.verifierCommands" && targetFiles.length > 0) return "file_mutation";
  if (commandPreview) return "shell_command";
  return "file_mutation";
}

function hasProviderRisk({ operations, targetFiles, commandCategory }) {
  return commandCategory === "provider_risk" ||
    operations.some((operation) => ["provider_call", "paid_api_call"].includes(operation)) ||
    targetFiles.some((file) => /provider|credentialref|openai|openrouter|claude|mimo|nvidia/i.test(file));
}

function hasSecretRisk({ operations, targetFiles, commandCategory }) {
  return commandCategory === "secret_risk" ||
    operations.some((operation) => /secret|auth_json|token|credential/i.test(operation)) ||
    targetFiles.some((file) => /(^|\/)(\.env(?:\.[^/]*)?|auth\.json)$|secret|token|api[_-]?key/i.test(file));
}

function hasDeployRisk({ operations, targetFiles, commandCategory }) {
  return commandCategory === "deploy_risk" || commandCategory === "git_risk" ||
    operations.some((operation) => ["deploy", "release", "tag", "artifact_upload", "push", "commit"].includes(operation)) ||
    targetFiles.some((file) => /deploy|release|artifact|docker-compose|github\/workflows/i.test(file));
}

function hasChatRouteRisk({ operations, targetFiles }) {
  return operations.some((operation) => ["chat_modify", "chat_gateway_execute_modify"].includes(operation)) ||
    targetFiles.some((file) => /(^|\/)chat(\/|$)|chat-gateway\/execute|src\/chat-gateway/i.test(file));
}

function normalizeDecision(decision) {
  if (decision === "allowed") return "allow";
  if (["allow", "approval_required", "deny", "forbidden"].includes(decision)) return decision;
  return "deny";
}
