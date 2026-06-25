/**
 * PermissionGate - 权限门控系统模块
 *
 * 借鉴 Claude Code v2.1.88 的权限系统模式:
 * - PermissionMode: default / acceptEdits / plan / bypassPermissions / dontAsk
 * - PermissionResult: { behavior: "allow" | "deny" | "passthrough", message }
 * - PermissionRule: 允许/拒绝模式匹配（Bash(命令模式)、Read(路径模式)等）
 * - permissionRuleParser: 解析权限规则字符串为结构化对象
 * - bashClassifier: 将命令分类为 safe/readOnly/mutation/destructive/forbidden
 * - dangerousPatterns: 匹配危险操作（rm -rf, chmod 777, 等）
 * - approval gate: 审批作为一等公民的状态转换，可预览、解释、记录
 *
 * PME 适配:
 * - 定义操作风险级别: safe / cautious / dangerous / forbidden
 * - 每个 API 操作标注风险级别
 * - safe: 自动通过
 * - cautious: 需要配置允许
 * - dangerous: 需要显式审批（可配置自动审批策略）
 * - forbidden: 永远拒绝
 * - 审批记录持久化到 .data/permissions/audit.jsonl
 *
 * @module permissionGate
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  RISK_LEVELS,
  PERMISSION_BEHAVIORS,
  CODEX_MODE_ALIASES,
  DEFAULT_RISK_RULES,
} from "./permissionConstants.js";

import {
  resolvePermissionMode,
  parsePermissionRule,
  matchesRule,
} from "./permissionRuleParser.js";

import { classifyCommand } from "./commandClassifier.js";

/**
 * 创建审批记录
 *
 * @param {Object} params
 * @param {string} params.action - 操作标识
 * @param {string} params.riskLevel - 风险级别
 * @param {string} params.decision - 审批决定 (approved/denied/auto_approved)
 * @param {string} [params.reason] - 原因
 * @param {string} [params.approvedBy] - 审批者
 * @param {Object} [params.context] - 操作上下文
 * @returns {Object} 审批记录
 */
function createApprovalRecord(params) {
  return {
    id: randomUUID(),
    action: params.action,
    riskLevel: params.riskLevel,
    decision: params.decision,
    reason: params.reason || null,
    approvedBy: params.approvedBy || "system",
    context: params.context || {},
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// 权限门控系统
// ============================================================

/**
 * 创建权限门控系统
 *
 * 借鉴 Claude Code 的权限管理模式:
 * - PermissionMode: 全局权限模式（default / readOnly / bypass / dontAsk）
 * - PermissionRule: 细粒度规则（allow/deny + 类型 + 模式）
 * - 审批流程: cautious 需配置允许, dangerous 需显式审批
 * - 审批记录: 持久化到 .data/permissions/audit.jsonl
 *
 * @param {Object} options
 * @param {string} [options.mode] - 权限模式 (default/readOnly/bypass/dontAsk)
 * @param {string[]} [options.rules] - 权限规则字符串数组
 * @param {Object} [options.riskRules] - 自定义风险规则映射
 * @param {string} [options.auditLogPath] - 审计日志路径
 * @param {Object} [options.eventBus] - 事件总线
 * @param {Object} [options.autoApprovalPolicies] - 自动审批策略
 * @returns {Object} 权限门控系统实例
 */
export function createPermissionGate(options = {}) {
  const {
    mode: rawMode = "default",
    rules: ruleStrings = [],
    riskRules: customRiskRules = {},
    auditLogPath,
    eventBus = null,
    autoApprovalPolicies = {},
  } = options;

  // 解析权限模式（支持 Codex 别名）
  const resolved = resolvePermissionMode(rawMode);
  const mode = resolved.mode;
  const confirmEachStep = resolved.confirmEachStep;

  // 合并风险规则
  const riskRuleMap = { ...DEFAULT_RISK_RULES, ...customRiskRules };

  // 解析权限规则
  const parsedRules = ruleStrings.map(parsePermissionRule).filter(Boolean);

  // 审计日志路径
  const auditPath = auditLogPath || resolve(".data/permissions/audit.jsonl");
  const auditDir = resolve(".data/permissions");
  if (!existsSync(auditDir)) {
    mkdirSync(auditDir, { recursive: true });
  }

  // 内存中的审批记录
  const auditRecords = [];

  /** 写入审计日志 */
  function writeAuditRecord(record) {
    auditRecords.push(record);
    if (auditRecords.length > 10000) auditRecords.splice(0, auditRecords.length - 10000);
    try {
      const line = JSON.stringify(record) + "\n";
      appendFileSync(auditPath, line, "utf-8");
    } catch {
      // 审计写入失败不阻止操作
    }
  }

  /** 获取操作的风险级别 */
  function getRiskLevel(action, context = {}) {
    if (action === "shell:exec" && context.command) {
      return classifyCommand(context.command);
    }
    const level = riskRuleMap[action];
    if (level) {
      return { level, reason: `规则映射: ${action} -> ${level}` };
    }
    return { level: RISK_LEVELS.CAUTIOUS, reason: "未注册的操作，默认为 cautious" };
  }

  /** 检查自动审批策略 */
  function checkAutoApproval(action, riskLevel) {
    const policy = autoApprovalPolicies[action] || autoApprovalPolicies[riskLevel];
    if (policy && policy.enabled) {
      return {
        autoApproved: true,
        policy: policy.name || "unnamed-policy",
        reason: policy.reason || "自动审批策略匹配",
      };
    }
    return { autoApproved: false };
  }

  const gate = {
    /**
     * 核心权限检查方法
     *
     * 借鉴 Claude Code 的 checkPermissions + useCanUseTool 模式:
     * 1. 检查全局权限模式（bypass/dontAsk -> 直接通过）
     * 2. 检查细粒度规则（deny 优先于 allow）
     * 3. 根据风险级别决定行为:
     *    - safe: 自动通过
     *    - cautious: 检查是否有 allow 规则或自动审批策略
     *    - dangerous: 需要 PASSTHROUGH（外部审批）
     *    - forbidden: 直接拒绝
     */
    check(action, context = {}) {
      // 1. bypass 模式: 大部分通过，但 FORBIDDEN 操作仍拒绝
      if (mode === "bypass") {
        const classification = getRiskLevel(action, context);
        if (classification.level === RISK_LEVELS.FORBIDDEN) {
          const record = createApprovalRecord({
            action,
            riskLevel: classification.level,
            decision: "denied",
            reason: `bypass 模式仍拒绝 FORBIDDEN 操作: ${classification.reason}`,
          });
          writeAuditRecord(record);
          return {
            allowed: false,
            behavior: PERMISSION_BEHAVIORS.DENY,
            reason: `bypass 模式仍拒绝 FORBIDDEN 操作: ${classification.reason}`,
            riskLevel: classification.level,
          };
        }
        const record = createApprovalRecord({
          action, riskLevel: "any", decision: "auto_approved",
          reason: "权限模式: bypass",
        });
        writeAuditRecord(record);
        return {
          allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
          reason: "权限模式: bypass", riskLevel: "bypass",
        };
      }

      // 2. interactive 模式: 每步确认（Codex "interactive" 别名）
      if (confirmEachStep) {
        const classification = getRiskLevel(action, context);
        if (classification.level === RISK_LEVELS.SAFE) {
          return {
            allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
            reason: "交互模式: safe 操作自动通过",
            riskLevel: classification.level,
          };
        }
        if (classification.level === RISK_LEVELS.FORBIDDEN) {
          return {
            allowed: false, behavior: PERMISSION_BEHAVIORS.DENY,
            reason: `禁止操作: ${classification.reason}`,
            riskLevel: classification.level,
          };
        }
        const record = createApprovalRecord({
          action, riskLevel: classification.level, decision: "pending_approval",
          reason: `交互模式: 需要用户确认 "${action}"`, context,
        });
        writeAuditRecord(record);
        if (eventBus) {
          eventBus.emit("permission.confirmation_required", {
            action, riskLevel: classification.level,
            reason: `交互模式需要确认: ${action}`, approvalId: record.id,
          });
        }
        return {
          allowed: false, behavior: PERMISSION_BEHAVIORS.PASSTHROUGH,
          reason: `交互模式: 需要确认 "${action}" (${classification.level})`,
          riskLevel: classification.level, approvalId: record.id,
        };
      }

      // 3. 检查细粒度规则（deny 优先）
      for (const rule of parsedRules) {
        if (matchesRule(rule, action, context)) {
          if (rule.behavior === PERMISSION_BEHAVIORS.DENY) {
            const record = createApprovalRecord({
              action, riskLevel: "rule-denied", decision: "denied",
              reason: `规则拒绝: ${rule.raw}`, context,
            });
            writeAuditRecord(record);
            if (eventBus) {
              eventBus.emit("permission.denied", { action, reason: `规则拒绝: ${rule.raw}` });
            }
            return {
              allowed: false, behavior: PERMISSION_BEHAVIORS.DENY,
              reason: `规则拒绝: ${rule.raw}`, riskLevel: "rule-denied",
            };
          }
          const record = createApprovalRecord({
            action, riskLevel: "rule-allowed", decision: "approved",
            reason: `规则允许: ${rule.raw}`,
          });
          writeAuditRecord(record);
          return {
            allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
            reason: `规则允许: ${rule.raw}`, riskLevel: "rule-allowed",
          };
        }
      }

      // 4. 根据风险级别决定行为
      const classification = getRiskLevel(action, context);
      const { level, reason: classifyReason } = classification;

      switch (level) {
        case RISK_LEVELS.SAFE: {
          const record = createApprovalRecord({
            action, riskLevel: level, decision: "auto_approved",
            reason: `安全操作自动通过: ${classifyReason}`,
          });
          writeAuditRecord(record);
          return {
            allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
            reason: `安全操作: ${classifyReason}`, riskLevel: level,
          };
        }

        case RISK_LEVELS.CAUTIOUS: {
          if (mode === "readOnly") {
            const record = createApprovalRecord({
              action, riskLevel: level, decision: "denied",
              reason: "只读模式下禁止写操作",
            });
            writeAuditRecord(record);
            return {
              allowed: false, behavior: PERMISSION_BEHAVIORS.DENY,
              reason: "只读模式下禁止写操作", riskLevel: level,
            };
          }
          const autoApproval = checkAutoApproval(action, level);
          if (autoApproval.autoApproved) {
            const record = createApprovalRecord({
              action, riskLevel: level, decision: "auto_approved",
              reason: `自动审批: ${autoApproval.reason}`,
              approvedBy: `policy:${autoApproval.policy}`,
            });
            writeAuditRecord(record);
            return {
              allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
              reason: `自动审批: ${autoApproval.reason}`, riskLevel: level,
            };
          }
          const record = createApprovalRecord({
            action, riskLevel: level, decision: "auto_approved",
            reason: "cautious 操作在 default 模式下自动通过",
          });
          writeAuditRecord(record);
          return {
            allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
            reason: "cautious 操作默认通过（可在 strict 模式下需要审批）",
            riskLevel: level,
          };
        }

        case RISK_LEVELS.DANGEROUS: {
          const autoApproval = checkAutoApproval(action, level);
          if (autoApproval.autoApproved) {
            const record = createApprovalRecord({
              action, riskLevel: level, decision: "auto_approved",
              reason: `自动审批: ${autoApproval.reason}`,
              approvedBy: `policy:${autoApproval.policy}`,
            });
            writeAuditRecord(record);
            return {
              allowed: true, behavior: PERMISSION_BEHAVIORS.ALLOW,
              reason: `自动审批（dangerous）: ${autoApproval.reason}`, riskLevel: level,
            };
          }
          const record = createApprovalRecord({
            action, riskLevel: level, decision: "pending_approval",
            reason: `高风险操作需要审批: ${classifyReason}`,
          });
          writeAuditRecord(record);
          if (eventBus) {
            eventBus.emit("permission.approval_required", {
              action, riskLevel: level, reason: classifyReason, approvalId: record.id,
            });
          }
          return {
            allowed: false, behavior: PERMISSION_BEHAVIORS.PASSTHROUGH,
            reason: `高风险操作需要审批: ${classifyReason}`,
            riskLevel: level, approvalId: record.id,
          };
        }

        case RISK_LEVELS.FORBIDDEN: {
          const record = createApprovalRecord({
            action, riskLevel: level, decision: "denied",
            reason: `禁止操作: ${classifyReason}`,
          });
          writeAuditRecord(record);
          if (eventBus) {
            eventBus.emit("permission.denied", {
              action, riskLevel: level, reason: `禁止操作: ${classifyReason}`,
            });
          }
          return {
            allowed: false, behavior: PERMISSION_BEHAVIORS.DENY,
            reason: `禁止操作: ${classifyReason}`, riskLevel: level,
          };
        }

        default:
          return {
            allowed: false, behavior: PERMISSION_BEHAVIORS.DENY,
            reason: `未知风险级别: ${level}`, riskLevel: level,
          };
      }
    },

    /**
     * 显式审批一个待审批的操作
     * 借鉴 Claude Code 的 approval gate 模式:
     * 审批是一等公民的状态转换，可预览、解释、记录
     */
    approve(approvalId, params = {}) {
      const record = auditRecords.find((r) => r.id === approvalId);
      if (!record) {
        return { status: "error", error: `审批记录 ${approvalId} 不存在` };
      }
      if (record.decision !== "pending_approval") {
        return { status: "error", error: `审批记录 ${approvalId} 已被处理: ${record.decision}` };
      }

      record.decision = params.approved ? "approved" : "denied";
      record.approvedBy = params.approvedBy || "unknown";
      record.reason = params.reason || record.reason;
      record.resolvedAt = new Date().toISOString();

      writeAuditRecord({ ...record, type: "approval_resolution" });

      if (eventBus) {
        eventBus.emit(
          params.approved ? "permission.approved" : "permission.denied",
          { approvalId, action: record.action, decision: record.decision, approvedBy: record.approvedBy }
        );
      }

      return { status: "success", approvalId, decision: record.decision };
    },

    /** 获取当前权限模式的描述 */
    getMode() {
      const modeDescriptions = {
        default: "默认模式: safe/cautious 自动通过, dangerous 需审批, forbidden 拒绝",
        readOnly: "只读模式: 只允许 safe 操作",
        bypass: "旁路模式: 所有操作自动通过（仅限调试/测试）",
        dontAsk: "免询问模式: safe/cautious/dangerous 自动通过, forbidden 拒绝",
        strict: "严格模式: 仅 safe 自动通过, 其他全部需要审批",
      };
      const codexAlias = Object.entries(CODEX_MODE_ALIASES).find(([, v]) => v.pmeMode === mode);
      return {
        mode,
        codexAlias: codexAlias ? codexAlias[0] : null,
        description: modeDescriptions[mode] || `未知模式: ${mode}`,
        confirmEachStep,
        ruleCount: parsedRules.length,
      };
    },

    /** 获取风险级别映射表 */
    getRiskRules() {
      return { ...riskRuleMap };
    },

    /** 获取已解析的权限规则 */
    getParsedRules() {
      return parsedRules.map((r) => ({ ...r }));
    },

    /**
     * 获取审计记录
     * @param {Object} [filter]
     * @param {string} [filter.action] - 按操作过滤
     * @param {string} [filter.decision] - 按决定过滤
     * @param {string} [filter.riskLevel] - 按风险级别过滤
     * @param {number} [filter.limit] - 返回数量限制
     * @returns {Object[]} 审计记录数组
     */
    getAuditRecords(filter = {}) {
      let records = [...auditRecords];
      if (filter.action) records = records.filter((r) => r.action === filter.action);
      if (filter.decision) records = records.filter((r) => r.decision === filter.decision);
      if (filter.riskLevel) records = records.filter((r) => r.riskLevel === filter.riskLevel);
      if (filter.limit) records = records.slice(-filter.limit);
      return records;
    },

    /** 从磁盘加载历史审计记录 */
    loadAuditHistory() {
      try {
        if (!existsSync(auditPath)) return { status: "success", count: 0 };
        const content = readFileSync(auditPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        return { status: "success", count: lines.length, path: auditPath };
      } catch (err) {
        return { status: "error", error: err.message };
      }
    },

    /** 获取系统健康状态 */
    getHealth() {
      return {
        status: "ready",
        mode,
        parsedRuleCount: parsedRules.length,
        riskRuleCount: Object.keys(riskRuleMap).length,
        auditLogPath: auditPath,
        inMemoryAuditCount: auditRecords.length,
        pendingApprovals: auditRecords.filter((r) => r.decision === "pending_approval").length,
        autoApprovalPolicies: Object.keys(autoApprovalPolicies).length,
      };
    },
  };

  return gate;
}

// Re-exports for backward compatibility
export {
  RISK_LEVELS,
  PERMISSION_BEHAVIORS,
  CODEX_MODE_ALIASES,
  DEFAULT_RISK_RULES,
  DANGEROUS_COMMAND_PATTERNS,
  SAFE_COMMAND_PATTERNS,
} from "./permissionConstants.js";

export { resolvePermissionMode, parsePermissionRule } from "./permissionRuleParser.js";

export { classifyCommand } from "./commandClassifier.js";
