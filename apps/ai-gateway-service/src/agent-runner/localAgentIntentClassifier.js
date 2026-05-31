const BLOCKED_RULES = [
  {
    intentType: "unsafe_secret_or_env_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. Secret, .env, and API key access remain blocked.",
    patterns: [
      ".env",
      "api key",
      "apikey",
      "print key",
      "读取 .env",
      "告诉我 api key",
      "打印 api key",
    ],
    reasons: [
      "secret-access-blocked",
      "env-access-blocked",
    ],
  },
  {
    intentType: "unsafe_git_destructive_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. Destructive git cleanup remains blocked.",
    patterns: [
      "git reset --hard",
      "git clean",
      "清理工作区",
      "reset --hard",
    ],
    reasons: [
      "destructive-git-command-blocked",
    ],
  },
  {
    intentType: "unsafe_release_or_deploy_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. Commit, push, deploy, and release remain blocked.",
    patterns: [
      "commit",
      "push",
      "deploy",
      "release",
      "发布",
      "部署",
      "push 到 github",
      "commit 并 push",
    ],
    reasons: [
      "commit-push-release-deploy-blocked",
    ],
  },
  {
    intentType: "unsafe_release_or_deploy_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. full_open is not available.",
    patterns: [
      "full_open",
      "full open",
      "开启 full_open",
      "full-open",
    ],
    reasons: [
      "full-open-disabled",
    ],
  },
  {
    intentType: "unsafe_release_or_deploy_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. Real Codex exec remains blocked.",
    patterns: [
      "codex exec",
      "运行 codex exec",
    ],
    reasons: [
      "real-codex-exec-blocked",
    ],
  },
  {
    intentType: "unsafe_release_or_deploy_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. Real provider and paid smoke calls remain blocked in this path.",
    patterns: [
      "provider smoke",
      "真实 provider smoke",
      "paid api",
      "mimo",
      "embedding",
    ],
    reasons: [
      "external-provider-call-blocked",
    ],
  },
  {
    intentType: "unsafe_release_or_deploy_request",
    riskLevel: "blocked",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: true,
    suggestedNextStep: "Stop and refuse the request. legacy/ and PROJECT_CONTEXT.md remain blocked.",
    patterns: [
      "legacy",
      "project_context.md",
      "创建 project_context.md",
      "改 legacy",
      "修改 legacy",
    ],
    reasons: [
      "blocked-path-requested",
    ],
  },
];

const ALLOWED_RULES = [
  {
    intentType: "phase_verification",
    riskLevel: "low",
    recommendedPermissionMode: "auto_review",
    requiresApproval: false,
    blocked: false,
    suggestedNextStep: "Preview safe local verifier commands and keep execution disabled.",
    patterns: [
      "检查 phase",
      "验证 phase",
      "只读检查",
      "状态检查",
      "run local verify",
      "verify 脚本",
    ],
    reasons: [
      "verification-preview-supported",
    ],
  },
  {
    intentType: "verifier_fix_request",
    riskLevel: "high",
    recommendedPermissionMode: "manual",
    requiresApproval: true,
    blocked: false,
    suggestedNextStep: "Preview a repair plan and approval points before any future write-capable phase.",
    patterns: [
      "修 verifier",
      "verifier 报错",
      "fix verifier",
      "修复 verifier",
    ],
    reasons: [
      "repair-plan-preview-only",
    ],
  },
  {
    intentType: "documentation_update_request",
    riskLevel: "medium",
    recommendedPermissionMode: "manual",
    requiresApproval: true,
    blocked: false,
    suggestedNextStep: "Preview a documentation update plan and keep actual edits out of this phase.",
    patterns: [
      "更新文档",
      "文档草稿",
      "documentation",
      "doc draft",
    ],
    reasons: [
      "documentation-plan-preview-only",
    ],
  },
  {
    intentType: "patch_proposal_request",
    riskLevel: "high",
    recommendedPermissionMode: "manual",
    requiresApproval: true,
    blocked: false,
    suggestedNextStep: "Generate a patch proposal preview only, with explicit approval points and no apply path.",
    patterns: [
      "patch 计划",
      "patch proposal",
      "生成 patch",
      "修复计划",
    ],
    reasons: [
      "patch-proposal-preview-only",
    ],
  },
  {
    intentType: "read_only_audit_request",
    riskLevel: "low",
    recommendedPermissionMode: "manual",
    requiresApproval: false,
    blocked: false,
    suggestedNextStep: "Preview a read-only audit path and recommended verifier commands.",
    patterns: [
      "只读审查",
      "read-only audit",
      "审查",
      "audit",
    ],
    reasons: [
      "read-only-audit-preview-supported",
    ],
  },
  {
    intentType: "local_command_request",
    riskLevel: "medium",
    recommendedPermissionMode: "auto_review",
    requiresApproval: true,
    blocked: false,
    suggestedNextStep: "Preview only safe allowed command prefixes and approval requirements; do not execute commands in this phase.",
    patterns: [
      "本地 verify",
      "建议命令",
      "local command",
      "运行本地 verify",
    ],
    reasons: [
      "command-preview-only",
    ],
  },
];

function normalizeInput(input) {
  return String(input ?? "").trim().toLowerCase();
}

export function classifyLocalAgentIntent(input) {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return {
      isLocalAgentIntent: false,
      intentType: "unknown",
      riskLevel: "low",
      recommendedPermissionMode: "manual",
      fullOpenAllowed: false,
      requiresApproval: false,
      blocked: false,
      reasons: ["empty-input"],
      suggestedNextStep: "Provide a clearer local task request for preview classification.",
    };
  }

  for (const rule of BLOCKED_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return buildResult(rule, true);
    }
  }

  for (const rule of ALLOWED_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return buildResult(rule, true);
    }
  }

  return {
    isLocalAgentIntent: inferLocalIntent(normalized),
    intentType: "unknown",
    riskLevel: inferLocalIntent(normalized) ? "medium" : "low",
    recommendedPermissionMode: "manual",
    fullOpenAllowed: false,
    requiresApproval: inferLocalIntent(normalized),
    blocked: false,
    reasons: inferLocalIntent(normalized) ? ["unmapped-local-intent-preview"] : ["non-local-or-unclear-intent"],
    suggestedNextStep: inferLocalIntent(normalized)
      ? "Preview the request under manual mode and ask for a narrower local task description before any future action."
      : "Keep the request in normal chat flow unless a clearer local task is intended.",
  };
}

function inferLocalIntent(normalized) {
  return [
    "phase",
    "verifier",
    "patch",
    "audit",
    "文档",
    "verify",
    "本地",
    "local",
    "检查",
    "修复",
  ].some((keyword) => normalized.includes(keyword));
}

function buildResult(rule, isLocalAgentIntent) {
  return {
    isLocalAgentIntent,
    intentType: rule.intentType,
    riskLevel: rule.riskLevel,
    recommendedPermissionMode: rule.recommendedPermissionMode,
    fullOpenAllowed: false,
    requiresApproval: rule.requiresApproval,
    blocked: rule.blocked,
    reasons: rule.reasons,
    suggestedNextStep: rule.suggestedNextStep,
  };
}
