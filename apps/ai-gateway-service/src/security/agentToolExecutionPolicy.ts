export const HIGH_RISK_AGENT_TOOLS = Object.freeze([
  "shell_exec",
  "code_run",
  "web_fetch",
  "git_push",
  "git_create_pr",
]);

const HIGH_RISK_AGENT_TOOL_SET = new Set<string>(HIGH_RISK_AGENT_TOOLS);

export function hasUsablePermissionChecker(value: unknown): value is {
  check(action: string, context?: Record<string, unknown>): unknown;
} {
  return Boolean(value && typeof (value as { check?: unknown }).check === "function");
}

export function shouldRegisterAgentTool({
  toolName,
  enableHighRiskTools,
  permissionChecker,
}: {
  toolName: string;
  enableHighRiskTools?: boolean;
  permissionChecker?: unknown;
}): boolean {
  if (!HIGH_RISK_AGENT_TOOL_SET.has(toolName)) return true;
  return enableHighRiskTools === true && hasUsablePermissionChecker(permissionChecker);
}

export function createToolPermissionContext({
  toolName,
  params,
  isReadOnly,
}: {
  toolName: string;
  params?: Record<string, unknown> | null;
  isReadOnly?: boolean;
}): Record<string, unknown> {
  const context: Record<string, unknown> = {
    toolName,
    isReadOnly: isReadOnly === true,
  };
  if (toolName === "shell_exec" && typeof params?.command === "string") {
    context.command = params.command;
  }
  return context;
}
