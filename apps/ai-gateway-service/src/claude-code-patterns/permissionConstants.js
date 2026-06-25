/**
 * Permission Constants - 权限系统常量定义
 *
 * 从 permissionGate.js 提取的纯常量:
 * - RISK_LEVELS: 操作风险级别
 * - PERMISSION_BEHAVIORS: 权限检查行为
 * - CODEX_MODE_ALIASES: Codex 风格权限模式别名
 * - DEFAULT_RISK_RULES: 默认操作 -> 风险级别映射表
 * - DANGEROUS_COMMAND_PATTERNS: 危险命令模式
 * - SAFE_COMMAND_PATTERNS: 安全命令模式
 *
 * @module permissionConstants
 */

// ============================================================
// 风险级别定义
// ============================================================

/**
 * 操作风险级别
 * 借鉴 Claude Code 的 PermissionMode + bashClassifier 模式
 *
 * safe: 只读操作，无副作用，自动通过
 *   例: 读取文件、查询状态、获取健康检查
 *
 * cautious: 低风险写操作，需要配置允许
 *   例: 写入缓存、创建临时文件、修改配置
 *
 * dangerous: 高风险操作，需要显式审批
 *   例: 执行 shell 命令、删除文件、修改核心配置、调用付费 API
 *
 * forbidden: 禁止操作，永远拒绝
 *   例: 删除系统文件、推送生产环境、修改权限凭证
 */
export const RISK_LEVELS = Object.freeze({
  SAFE: "safe",
  CAUTIOUS: "cautious",
  DANGEROUS: "dangerous",
  FORBIDDEN: "forbidden",
});

/**
 * 权限检查行为
 * 借鉴 Claude Code 的 PermissionResult.behavior
 */
export const PERMISSION_BEHAVIORS = Object.freeze({
  ALLOW: "allow",         // 允许操作
  DENY: "deny",           // 拒绝操作
  PASSTHROUGH: "passthrough", // 需要进一步审批
});

/**
 * Codex 风格权限模式别名
 *
 * 对齐 Codex CLI 的 4 级审批模式:
 * - suggest: 只建议，不修改（映射到 readOnly）
 * - auto-edit: 自动编辑，危险操作需确认（映射到 default）
 * - full-auto: 全自动，仅禁止操作被阻止（映射到 dontAsk）
 * - interactive: 默认模式 + 每步确认（映射到 default + confirmEachStep）
 */
export const CODEX_MODE_ALIASES = Object.freeze({
  "suggest": { pmeMode: "readOnly", description: "只建议不修改: 仅允许只读操作" },
  "auto-edit": { pmeMode: "default", description: "自动编辑: safe/cautious 自动通过, dangerous 需审批" },
  "full-auto": { pmeMode: "dontAsk", description: "全自动: safe/cautious/dangerous 自动通过, forbidden 拒绝" },
  "interactive": { pmeMode: "default", confirmEachStep: true, description: "交互模式: 每步操作前确认" },
});

// ============================================================
// 默认风险分类规则
// ============================================================

/**
 * 默认的操作 -> 风险级别映射表
 * 借鉴 Claude Code 的危险命令模式和权限规则
 */
export const DEFAULT_RISK_RULES = {
  // safe 级别: 只读、查询、状态检查
  "file:read": RISK_LEVELS.SAFE,
  "session:read": RISK_LEVELS.SAFE,
  "dashboard:read": RISK_LEVELS.SAFE,
  "provider:read": RISK_LEVELS.SAFE,
  "knowledge:read": RISK_LEVELS.SAFE,
  "audit:read": RISK_LEVELS.SAFE,
  "health:check": RISK_LEVELS.SAFE,
  "tool:list": RISK_LEVELS.SAFE,
  "mcp:list": RISK_LEVELS.SAFE,

  // cautious 级别: 低风险写操作
  "file:write": RISK_LEVELS.CAUTIOUS,
  "knowledge:write": RISK_LEVELS.CAUTIOUS,
  "memory:write": RISK_LEVELS.CAUTIOUS,
  "cache:write": RISK_LEVELS.CAUTIOUS,
  "cache:invalidate": RISK_LEVELS.CAUTIOUS,
  "config:update": RISK_LEVELS.CAUTIOUS,
  "connector:write": RISK_LEVELS.CAUTIOUS,

  // dangerous 级别: 高风险操作
  "shell:exec": RISK_LEVELS.DANGEROUS,
  "code:run": RISK_LEVELS.DANGEROUS,
  "network:fetch": RISK_LEVELS.DANGEROUS,
  "file:delete": RISK_LEVELS.DANGEROUS,
  "provider:call:paid": RISK_LEVELS.DANGEROUS,
  "mcp:connect:project": RISK_LEVELS.DANGEROUS,
  "workflow:run": RISK_LEVELS.DANGEROUS,
  "evaluation:run": RISK_LEVELS.DANGEROUS,
  "model:deploy": RISK_LEVELS.DANGEROUS,
  "release:create": RISK_LEVELS.DANGEROUS,

  // forbidden 级别: 永久禁止
  "system:shutdown": RISK_LEVELS.FORBIDDEN,
  "credentials:modify": RISK_LEVELS.FORBIDDEN,
  "security:bypass": RISK_LEVELS.FORBIDDEN,
  "production:push": RISK_LEVELS.FORBIDDEN,
  "audit:delete": RISK_LEVELS.FORBIDDEN,
};

/**
 * 危险命令模式（借鉴 Claude Code 的 dangerousPatterns）
 * 匹配这些模式的 shell 命令会被自动提升风险级别
 */
export const DANGEROUS_COMMAND_PATTERNS = [
  // 破坏性文件操作
  { pattern: /rm\s+(-\w*\s+)*-?\w*r\w*\s+(-\w*\s+)*\//, description: "递归删除", level: RISK_LEVELS.FORBIDDEN },
  { pattern: /rm\s+(-\w*\s+)*-?\w*f\w*\s+(-\w*\s+)*\//, description: "强制删除", level: RISK_LEVELS.DANGEROUS },
  { pattern: /chmod\s+777/, description: "开放全部权限", level: RISK_LEVELS.DANGEROUS },
  { pattern: /chown\s+/, description: "修改文件所有权", level: RISK_LEVELS.DANGEROUS },

  // 网络操作
  { pattern: /curl\s+.*\|\s*(ba)?sh/, description: "远程脚本执行", level: RISK_LEVELS.FORBIDDEN },
  { pattern: /wget\s+.*\|\s*(ba)?sh/, description: "远程脚本执行", level: RISK_LEVELS.FORBIDDEN },

  // Git 危险操作
  { pattern: /git\s+push\s+.*--force/, description: "强制推送", level: RISK_LEVELS.DANGEROUS },
  { pattern: /git\s+reset\s+--hard/, description: "硬重置", level: RISK_LEVELS.DANGEROUS },
  { pattern: /git\s+clean\s+-\w*f/, description: "强制清理", level: RISK_LEVELS.DANGEROUS },

  // 部署/发布操作
  { pattern: /kubectl\s+delete/, description: "Kubernetes 资源删除", level: RISK_LEVELS.DANGEROUS },
  { pattern: /docker\s+rm\s+-f/, description: "强制删除容器", level: RISK_LEVELS.DANGEROUS },
  { pattern: /npm\s+publish/, description: "NPM 包发布", level: RISK_LEVELS.DANGEROUS },

  // 密钥/凭证操作
  { pattern: /ssh-keygen/, description: "SSH 密钥生成", level: RISK_LEVELS.CAUTIOUS },
  { pattern: /gpg\s+.*--delete/, description: "GPG 密钥删除", level: RISK_LEVELS.DANGEROUS },
];

/**
 * 安全命令模式（借鉴 Claude Code 的 readOnlyCommandValidation）
 * 匹配这些模式的命令被认为是安全的只读操作
 */
export const SAFE_COMMAND_PATTERNS = [
  /^ls\b/, /^dir\b/, /^cat\b/, /^head\b/, /^tail\b/,
  /^find\b/, /^grep\b/, /^rg\b/,
  /^wc\b/, /^sort\b/, /^uniq\b/, /^diff\b/,
  /^git\s+(status|log|diff|branch|remote|show|describe|tag\s+-l)/,
  /^node\s+--version/, /^npm\s+(list|outdated|view|info)/,
  /^echo\b/, /^date\b/, /^whoami\b/, /^hostname\b/,
  /^pwd\b/, /^env\b/, /^which\b/, /^type\b/,
];
