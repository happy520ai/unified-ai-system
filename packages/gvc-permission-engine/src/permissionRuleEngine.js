export const DECISIONS = ["allow", "deny", "approval_required", "forbidden"];

export const ACTIONS = [
  "file_mutation",
  "shell_command",
  "provider_call",
  "secret_read",
  "deploy",
  "chat_route_modify",
];

export const permissionResultSchema = {
  type: "object",
  required: ["decision", "matchedRuleId", "reason", "providerCallsMade", "secretRead"],
  properties: {
    decision: { type: "string", enum: DECISIONS },
    matchedRuleId: { type: ["string", "null"] },
    reason: { type: "string" },
    riskFlags: { type: "array", items: { type: "string" } },
    providerCallsMade: { type: "boolean" },
    secretRead: { type: "boolean" },
  },
};

const decisionRank = {
  allow: 1,
  deny: 2,
  approval_required: 3,
  forbidden: 4,
};

export function evaluatePermissionRules({ action, resource = "", rules = [] } = {}) {
  const normalizedAction = normalizeAction(action);
  const normalizedResource = normalizeResource(resource);
  const matchedRules = rules
    .filter((rule) => ruleMatches(rule, normalizedAction, normalizedResource))
    .sort((left, right) => decisionRank[right.effect] - decisionRank[left.effect]);
  const matchedRule = matchedRules[0] || null;
  const decision = matchedRule?.effect || "deny";
  return {
    decision,
    matchedRuleId: matchedRule?.id || null,
    reason: matchedRule?.reason || buildDefaultReason(decision, normalizedAction, normalizedResource),
    action: normalizedAction,
    resource: normalizedResource,
    riskFlags: buildRiskFlags(normalizedAction, normalizedResource, decision),
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  };
}

function ruleMatches(rule, action, resource) {
  if (!rule || !DECISIONS.includes(rule.effect)) return false;
  if (rule.action && rule.action !== action) return false;
  if (rule.pathPrefix && !resource.startsWith(normalizeResource(rule.pathPrefix))) return false;
  if (rule.resourceIncludes && !resource.includes(String(rule.resourceIncludes).toLowerCase())) return false;
  return true;
}

function normalizeAction(action) {
  const normalized = String(action || "").trim().toLowerCase();
  return ACTIONS.includes(normalized) ? normalized : "shell_command";
}

function normalizeResource(resource) {
  return String(resource || "").replaceAll("\\", "/").trim().toLowerCase();
}

function buildDefaultReason(decision, action, resource) {
  if (decision === "deny") return `No explicit PME permission rule matched action=${action} resource=${resource}.`;
  return `PME permission rule returned ${decision}.`;
}

function buildRiskFlags(action, resource, decision) {
  const flags = [];
  if (action === "provider_call" || /openai|openrouter|claude|mimo|nvidia/.test(resource)) flags.push("provider_risk");
  if (action === "secret_read" || /\.env|auth\.json|secret|token|api[_-]?key/.test(resource)) flags.push("secret_risk");
  if (action === "deploy" || /deploy|release|tag|artifact/.test(resource)) flags.push("deploy_risk");
  if (action === "chat_route_modify" || /\/chat|chat-gateway\/execute/.test(resource)) flags.push("chat_route");
  if (decision === "approval_required") flags.push("approval_required");
  if (decision === "forbidden") flags.push("forbidden");
  return Array.from(new Set(flags));
}
