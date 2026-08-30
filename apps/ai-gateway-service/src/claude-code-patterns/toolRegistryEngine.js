/**
 * toolRegistryEngine.js — Tool registry factory and helper utilities.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import vm from "node:vm";
import { buildTool, createToolUseContext } from "./toolCore.js";
import { createBuiltInTools } from "./developerTools.js";
import { createGitTools } from "../tools/gitTools.js";
import { createLspTools } from "../tools/lspTool.js";
import { createToolResultCache } from "./toolResultCache.js";
import { createAgentManager } from "./toolAgentManager.js";
import {
  createToolPermissionContext,
  hasUsablePermissionChecker,
  shouldRegisterAgentTool,
} from "../security/agentToolExecutionPolicy.ts";
import { createExternalEffectToolBoundary } from "../external-effects/externalEffectToolBoundary.ts";
import { AGENT_GOVERNANCE_REDACTED_FIELDS } from "@unified-ai-system/shared-contracts";
import { isSafePublicObjectKey, redactSecretsInText } from "../security/secretSafety.js";
import {
  GOVERNED_GIT_ENVELOPE_KEY,
  prepareGovernedApprovalParameters,
} from "../agent-governance/governedGitApproval.ts";

// Agent 定义结构: agentType, whenToUse, tools (allowlist), disallowedTools (denylist), permissionMode, model

/**
 * 创建工具注册表 — 工具注册/发现、过滤、权限检查、工具链调用。
 * @param {Object} options
 * @param {Object} [options.permissionChecker] - 权限检查器
 * @param {Object} [options.eventBus] - 事件总线
 * @param {number} [options.maxChainDepth] - 工具链最大深度 (default 5)
 * @param {string} [options.workingDirectory] - 工具文件系统边界
 * @param {boolean} [options.enableHighRiskTools] - 显式启用高风险工具
 * @param {string[]} [options.highRiskToolAllowlist] - 精确启用的高风险工具名
 * @param {Object} [options.externalEffectGate] - Durable irreversible-effect gate
 * @param {Object} [options.externalEffectFence] - Trusted execution fence
 * @param {string} [options.externalEffectTenantId] - Server-derived tenant identity
 * @param {Object} [options.governanceToolProxy] - Agent governance Tool Proxy;
 *   enforced per call whenever the caller context carries agentGovernance identity
 * @param {boolean} [options.governanceRequired] - Fail closed when a governed
 *   registry call omits its server-bound agent identity.
 * @param {string[]} [options.governanceProtectedPaths] - Absolute runtime
 *   state roots that governed tools must never read or mutate.
 */
export function createAgentToolRegistry(options = {}) {
  const {
    permissionChecker = null,
    eventBus = null,
    maxChainDepth = 5,
  } = options;
  const permissionCheckerConfigured = hasUsablePermissionChecker(permissionChecker);
  const exactHighRiskTools = Array.isArray(options.highRiskToolAllowlist)
    ? Object.freeze(Array.from(new Set(options.highRiskToolAllowlist.filter((name) => typeof name === "string"))))
    : null;
  const highRiskToolsEnabled = permissionCheckerConfigured
    && (exactHighRiskTools ? exactHighRiskTools.length > 0 : options.enableHighRiskTools === true);
  const externalEffectGate = options.externalEffectGate;
  const externalEffectFence = options.externalEffectFence;
  const externalEffectTenantId = options.externalEffectTenantId;
  const governanceToolProxy = options.governanceToolProxy ?? null;
  const governanceRequired = options.governanceRequired === true;
  if (governanceRequired && !governanceToolProxy) {
    const error = new Error("A governance Tool Proxy is required for this agent tool registry.");
    error.code = "AGENT_GOVERNANCE_PROXY_REQUIRED";
    throw error;
  }

  /** 已注册的工具映射 name -> tool */
  const tools = new Map();

  /** 已注册的 Agent 定义映射 agentType -> agentDef */
  const agents = new Map();

  /** 工具执行历史记录（审计用）— capped to prevent memory leak */
  const executionLog = [];
  const MAX_EXECUTION_LOG_SIZE = 1000;

  /** Cap the log to MAX_EXECUTION_LOG_SIZE by dropping oldest entries */
  function capExecutionLog() {
    if (executionLog.length > MAX_EXECUTION_LOG_SIZE) {
      const excess = executionLog.length - MAX_EXECUTION_LOG_SIZE;
      executionLog.splice(0, excess);
    }
  }

  // Tool result cache — extracted to toolResultCache.js for 分层律
  const resultCache = createToolResultCache();

  // 注册所有内置工具（传入 workingDirectory 确保文件操作正确解析路径）
  const builtInTools = createBuiltInTools(options.workingDirectory || process.cwd());
  for (const [name, tool] of Object.entries(builtInTools)) {
    if (!shouldRegisterAgentTool({
      toolName: name,
      enableHighRiskTools: highRiskToolsEnabled,
      highRiskToolAllowlist: exactHighRiskTools,
      permissionChecker,
    })) continue;
    tools.set(name, tool);
  }

  // 注册 Git 工具集 (7 个: status/diff/log/branch/commit/push/create_pr)
  const gitToolOptions = { workingDirectory: options.workingDirectory || process.cwd() };
  for (const gitTool of createGitTools(gitToolOptions)) {
    if (!shouldRegisterAgentTool({
      toolName: gitTool.name,
      enableHighRiskTools: highRiskToolsEnabled,
      highRiskToolAllowlist: exactHighRiskTools,
      permissionChecker,
    })) continue;
    tools.set(gitTool.name, gitTool);
  }

  // 注册 LSP 工具集 (4 个: definition/references/hover/symbols)
  let _lspShutdownAll = null;
  try {
    const lspToolOptions = { workingDirectory: options.workingDirectory || process.cwd() };
    const lspResult = createLspTools(lspToolOptions);
    // createLspTools returns { tools: [], shutdownAll, getClientCount, getPoolStats }
    const lspToolList = Array.isArray(lspResult) ? lspResult : (lspResult.tools || []);
    for (const lspTool of lspToolList) {
      if (lspTool && lspTool.name) {
        tools.set(lspTool.name, lspTool);
      }
    }
    // Store shutdown callback for cleanup
    if (typeof lspResult?.shutdownAll === "function") {
      _lspShutdownAll = lspResult.shutdownAll;
    }
  } catch {
    // LSP server 不可用时跳过注册 — 非致命
  }

  /**
   * 工具过滤函数
   * 借鉴 Claude Code 的 filterToolsForAgent():
   * - 根据 allowlist（tools）和 denylist（disallowedTools）过滤
   * - 根据权限模式（permissionMode）调整可用工具
   */
  function filterToolsForAgent({ allowlist, denylist, permissionMode } = {}) {
    let availableTools = [...tools.values()];

    // 如果有 allowlist，只保留列表中的工具
    if (allowlist && allowlist.length > 0) {
      const allowSet = new Set(allowlist);
      availableTools = availableTools.filter((t) => allowSet.has(t.name));
    }

    // 如果有 denylist，移除列表中的工具
    if (denylist && denylist.length > 0) {
      const denySet = new Set(denylist);
      availableTools = availableTools.filter((t) => !denySet.has(t.name));
    }

    // 如果是只读权限模式，过滤掉写操作工具
    if (permissionMode === "readOnly") {
      availableTools = availableTools.filter((t) => t.isReadOnly);
    }

    return availableTools;
  }

  /**
   * 验证输入参数是否符合工具的 inputSchema
   * 简化版 JSON Schema 验证（无外部依赖）
   */
  /**
   * 强转工具参数类型 — LLM 经常将数字/布尔值以字符串形式返回。
   * 例如: "0" → 0, "true" → true, "100" → 100
   */
  function coerceParams(schema, params) {
    if (!schema?.properties || !params || typeof params !== "object") return params;
    const coerced = { ...params };
    for (const [key, value] of Object.entries(coerced)) {
      const prop = schema.properties[key];
      if (!prop || value === undefined || value === null) continue;
      if (prop.type === "integer" && typeof value === "string") {
        const parsed = Number(value);
        if (Number.isInteger(parsed)) coerced[key] = parsed;
      } else if (prop.type === "number" && typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) coerced[key] = parsed;
      } else if (prop.type === "boolean" && typeof value === "string") {
        if (value === "true") coerced[key] = true;
        else if (value === "false") coerced[key] = false;
      }
    }
    return coerced;
  }

  function validateInput(tool, params) {
    const schema = tool.inputSchema;
    const errors = [];

    // 检查 required 字段
    if (schema.required) {
      for (const field of schema.required) {
        if (params[field] === undefined || params[field] === null) {
          errors.push(`缺少必填参数: ${field}`);
        }
      }
    }

    // 检查类型（简化验证）
    if (schema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const prop = schema.properties[key];
        if (!prop) {
          if (schema.additionalProperties === false) {
            errors.push(`未知参数: ${key}`);
          }
          continue;
        }
        if (prop.type === "string" && typeof value !== "string") {
          errors.push(`参数 ${key} 应为字符串类型`);
        }
        if (prop.type === "integer" && (!Number.isInteger(value))) {
          errors.push(`参数 ${key} 应为整数类型`);
        }
        if (prop.enum && !prop.enum.includes(value)) {
          errors.push(`参数 ${key} 的值不在允许范围 [${prop.enum.join(", ")}] 内`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  const registry = {
    /**
     * 注册一个新工具
     *
     * @param {Object} toolDef - 工具定义（使用 buildTool 创建）
     * @returns {Object} 注册结果
     */
    registerTool(toolDef) {
      if (
        typeof toolDef?.name !== "string"
        || !toolDef.name.trim()
        || toolDef.name !== toolDef.name.trim()
        || toolDef.name.length > 128
        || /[\u0000-\u001f\u007f]/u.test(toolDef.name)
        || typeof toolDef.execute !== "function"
      ) {
        return { status: "error", code: "CUSTOM_TOOL_DEFINITION_INVALID", error: "工具必须有合法 name 和 execute 属性" };
      }
      const existing = tools.get(toolDef.name);
      if (existing?.source === "built-in") {
        return { status: "error", code: "TOOL_BUILTIN_OVERRIDE_BLOCKED", error: `内置工具 ${toolDef.name} 已存在，不能覆盖` };
      }
      if (existing) {
        return { status: "error", code: "CUSTOM_TOOL_ALREADY_REGISTERED", error: `工具 ${toolDef.name} 已存在；请先显式注销` };
      }
      if (
        !Array.isArray(toolDef.requiredPermissions)
        || toolDef.requiredPermissions.length === 0
        || toolDef.requiredPermissions.some((permission) => (
          typeof permission !== "string"
          || !permission.trim()
          || permission !== permission.trim()
          || permission.length > 128
          || /[\u0000-\u001f\u007f]/u.test(permission)
        ))
      ) {
        return { status: "error", code: "CUSTOM_TOOL_PERMISSION_REQUIRED", error: "动态工具必须声明至少一个权限" };
      }
      if (toolDef.isReadOnly === true && toolDef.readOnlyAttested !== true) {
        return { status: "error", code: "CUSTOM_TOOL_READ_ONLY_ATTESTATION_REQUIRED", error: "动态只读工具必须显式声明可信只读证明" };
      }
      if (
        toolDef.isReadOnly !== true
        && (
          typeof toolDef.externalEffectType !== "string"
          || !toolDef.externalEffectType.trim()
          || toolDef.externalEffectType !== toolDef.externalEffectType.trim()
          || toolDef.externalEffectType.length > 128
          || /[\u0000-\u001f\u007f]/u.test(toolDef.externalEffectType)
          || toolDef.externalEffectRequiresFence !== true
        )
      ) {
        return { status: "error", code: "CUSTOM_TOOL_EFFECT_CONTRACT_REQUIRED", error: "动态写工具必须声明 fence-required external effect contract" };
      }
      tools.set(toolDef.name, buildTool({ ...toolDef, source: "custom" }));
      return { status: "success", toolName: toolDef.name };
    },

    /**
     * 注销一个工具
     */
    unregisterTool(toolName) {
      const tool = tools.get(toolName);
      if (!tool) return { status: "error", error: `工具 ${toolName} 不存在` };
      if (tool.source === "built-in") {
        return { status: "error", error: `不能注销内置工具 ${toolName}` };
      }
      tools.delete(toolName);
      return { status: "success", toolName };
    },

    /**
     * 获取工具信息
     */
    getTool(toolName) {
      return tools.get(toolName) || null;
    },

    /**
     * 列出所有已注册工具
     *
     * @param {Object} [filter] - 过滤条件（借鉴 filterToolsForAgent 模式）
     * @param {string[]} [filter.allowlist] - 允许的工具名列表
     * @param {string[]} [filter.denylist] - 禁止的工具名列表
     * @param {string} [filter.permissionMode] - 权限模式
     * @returns {Object[]} 工具信息数组
     */
    listTools(filter) {
      const filtered = filter ? filterToolsForAgent(filter) : [...tools.values()];
      return filtered.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        requiredPermissions: t.requiredPermissions,
        isReadOnly: t.isReadOnly,
        source: t.source,
        version: t.version,
      }));
    },

    /**
     * 执行工具
     *
     * 借鉴 Claude Code 的工具执行流程:
     * 1. 查找工具
     * 2. 验证输入
     * 3. 检查权限
     * 4. 检查工具链深度
     * 5. 执行工具
     * 6. 截断超长结果
     * 7. 记录执行日志
     *
     * @param {string} toolName - 工具名称
     * @param {Object} params - 输入参数
     * @param {Object} [contextOverride] - 上下文覆盖
     * @returns {Object} 执行结果
     */
    async executeTool(toolName, params = {}, contextOverride = null) {
      const tool = tools.get(toolName);
      if (!tool) {
        return { status: "error", error: `工具 ${toolName} 未注册` };
      }

      // Provider output is untrusted. A model may fabricate a call for a
      // registered tool that was not exposed for this run, so the per-run
      // allowlist must be enforced again at the execution boundary. The
      // frozen array is carried by the trusted server context and inherited
      // by nested callTool() invocations.
      if (Array.isArray(contextOverride?.runAllowedTools)
        && !contextOverride.runAllowedTools.includes(toolName)) {
        const record = {
          id: randomUUID(),
          toolName,
          params: sanitizeParams(params),
          status: "denied",
          reason: "The tool was not allowed for this agent run.",
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();
        return {
          status: "denied",
          code: "TOOL_NOT_ALLOWED_FOR_RUN",
          error: record.reason,
        };
      }

      // Agent governance Tool Proxy — the per-call enforcement point.
      // Runs before coercion so approval argument hashes lock exactly the
      // arguments the agent sent. Legacy callers without governed
      // identity are untouched.
      if (governanceRequired && !contextOverride?.agentGovernance) {
        const record = {
          id: randomUUID(),
          toolName,
          params: sanitizeParams(params),
          status: "denied",
          reason: "A server-bound governed agent identity is required for every tool call.",
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();
        return {
          status: "denied",
          code: "AGENT_GOVERNANCE_CONTEXT_REQUIRED",
          error: record.reason,
        };
      }
      let governancePolicy = null;
      let governanceExecutionLease = null;

      try {
      // 强转参数类型 (LLM 常将数字/布尔值以字符串形式返回)
      let coercedParams = coerceParams(tool.inputSchema, params);

      // 验证输入参数
      const validation = validateInput(tool, coercedParams);
      if (!validation.valid) {
        return { status: "error", error: "参数验证失败", details: validation.errors };
      }

      if (governanceToolProxy && contextOverride?.agentGovernance) {
        const prepared = prepareGovernedApprovalParameters({
          toolName,
          params: coercedParams,
          workingDirectory: options.workingDirectory || process.cwd(),
        });
        coercedParams = prepared.params;
        const resourceContext = buildTrustedToolResourceContext({
          toolName,
          params: coercedParams,
          workingDirectory: options.workingDirectory || process.cwd(),
          protectedPaths: options.governanceProtectedPaths ?? [],
        });
        if (prepared.review) resourceContext.approvalReview = prepared.review;
        if (resourceContext.protectedPathDenied) {
          return {
            status: "denied",
            code: "AGENT_GOVERNANCE_PROTECTED_RESOURCE",
            error: "The tool request targets protected Agent Governance runtime state.",
          };
        }
        if (resourceContext.workspaceEscapeDenied) {
          return {
            status: "denied",
            code: "AGENT_GOVERNANCE_WORKSPACE_ESCAPE",
            error: "The governed tool request escapes its trusted workspace boundary.",
          };
        }
        const verdict = await governanceToolProxy.enforce({
          context: contextOverride.agentGovernance,
          toolName,
          params: coercedParams,
          resourceContext,
        });
        if (verdict.outcome !== "allow") {
          const record = {
            id: randomUUID(),
            toolName,
            params: sanitizeParams(params),
            status: "denied",
            reason: verdict.reason ?? verdict.code ?? "Denied by the agent governance tool proxy.",
            timestamp: new Date().toISOString(),
          };
          executionLog.push(record);
          capExecutionLog();
          return {
            status: "denied",
            code: verdict.code ?? "TOOL_GOVERNANCE_DENIED",
            error: record.reason,
            ...(verdict.approvalId ? { approvalId: verdict.approvalId } : {}),
          };
        }
        governancePolicy = verdict.policy ?? null;
        governanceExecutionLease = verdict.executionLease ?? null;
        if (verdict.approvedParams !== undefined) {
          if (!verdict.approvedParams || typeof verdict.approvedParams !== "object"
            || Array.isArray(verdict.approvedParams)) {
            return {
              status: "denied",
              code: "APPROVED_TOOL_ARGUMENTS_INVALID",
              error: "The authenticated approved tool arguments are malformed.",
            };
          }
          const approvedForValidation = { ...verdict.approvedParams };
          delete approvedForValidation[GOVERNED_GIT_ENVELOPE_KEY];
          const approvedValidation = validateInput(tool, approvedForValidation);
          if (!approvedValidation.valid) {
            return {
              status: "denied",
              code: "APPROVED_TOOL_ARGUMENTS_INVALID",
              error: "The authenticated approved tool arguments no longer satisfy the tool schema.",
            };
          }
          coercedParams = verdict.approvedParams;
        }
      }

      // 创建执行上下文
      const baseContext = contextOverride || createToolUseContext({
        registry: this,
        permissionChecker,
        eventBus,
      });
      let context = { ...baseContext };
      const permissionSatisfiedByGovernance = Boolean(
        governancePolicy && contextOverride?.agentGovernance,
      );
      if (permissionSatisfiedByGovernance
        && !governanceSatisfiesToolPermissions(tool, governancePolicy)) {
        return {
          status: "denied",
          code: "AGENT_GOVERNANCE_PERMISSION_MISMATCH",
          error: "The effective Agent policy does not satisfy the tool's registered permission contract.",
        };
      }

      // 检查工具链深度
      if (context._chainDepth > maxChainDepth) {
        return {
          status: "error",
          error: `工具链深度超过最大限制 (${maxChainDepth})`,
        };
      }

      // 权限检查
      if (tool.requiredPermissions.length > 0
        && !permissionCheckerConfigured
        && !permissionSatisfiedByGovernance) {
        const record = {
          id: randomUUID(),
          toolName,
          params: sanitizeParams(params),
          status: "denied",
          reason: "A permission checker is required before agent tools can execute.",
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();
        return {
          status: "denied",
          code: "TOOL_PERMISSION_CHECKER_REQUIRED",
          error: record.reason,
        };
      }
      if (tool.requiredPermissions.length > 0 && !permissionSatisfiedByGovernance) {
        for (const perm of tool.requiredPermissions) {
          let permResult;
          try {
            permResult = await permissionChecker.check(perm, createToolPermissionContext({
              toolName,
              params: coercedParams,
              isReadOnly: tool.isReadOnly,
            }));
          } catch {
            permResult = { allowed: false, reason: "Permission evaluation failed closed." };
          }
          if (!permResult || permResult.allowed !== true) {
            const record = {
              id: randomUUID(),
              toolName,
              params: sanitizeParams(params),
              status: "denied",
              reason: permResult?.reason || `缺少权限: ${perm}`,
              timestamp: new Date().toISOString(),
            };
            executionLog.push(record);
            capExecutionLog();
            return { status: "denied", error: record.reason, permission: perm };
          }
        }
      }

      const externalEffectBoundary = createExternalEffectToolBoundary({
        tool,
        toolName,
        params: coercedParams,
        context,
        gate: externalEffectGate,
        trustedFence: externalEffectFence,
        tenantId: externalEffectTenantId,
      });
      if (externalEffectBoundary.denied) {
        return recordExternalEffectDenial(
          toolName,
          params,
          externalEffectBoundary.denied.code,
          externalEffectBoundary.denied.error,
        );
      }
      context = externalEffectBoundary.context;

      // Permission-protected results are never shared through the registry
      // cache because its key intentionally has no caller/session identity.
      const cacheEligible = tool.isReadOnly === true
        && tool.requiredPermissions.length === 0
        && !contextOverride?.agentGovernance;
      const cachedResult = cacheEligible ? resultCache.get(toolName, coercedParams) : null;
      if (cachedResult !== null) {
        const cacheRecord = {
          toolName,
          params: sanitizeParams(coercedParams),
          status: "cache_hit",
          durationMs: 0,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(cacheRecord);
        capExecutionLog();
        return cachedResult;
      }

      // 执行工具
      const executionId = randomUUID();
      const startTime = Date.now();
      try {
        // 发布执行开始事件
        if (eventBus) {
          eventBus.emit("tool.execution.started", {
            executionId,
            toolName,
            params: sanitizeParams(params),
            timestamp: new Date().toISOString(),
          });
        }

        // Timeout wrapper: prevent hung tools from blocking the agent loop
        const TOOL_EXECUTION_TIMEOUT = tool.executionTimeoutMs || 60_000;
        let result = await Promise.race([
          tool.execute(coercedParams, context),
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`Tool "${toolName}" execution timed out after ${TOOL_EXECUTION_TIMEOUT}ms`)),
              TOOL_EXECUTION_TIMEOUT
            );
            // Allow the timer to not prevent process exit
            if (timer.unref) timer.unref();
          }),
        ]);
        if (
          externalEffectBoundary.required
          && result
          && typeof result === "object"
          && (result.success === true || result.status === "success")
          && externalEffectBoundary.isCommitted() !== true
        ) {
          result = {
            status: "error",
            code: "TOOL_EXTERNAL_EFFECT_COMMIT_MISSING",
            error: "The irreversible tool returned success without committing its external-effect fence.",
          };
        }
        if (governancePolicy && (
          isSuccessfulToolResult(result)
          || typeof governancePolicy.limits?.maxRecords === "number"
        )) {
          if (typeof governanceToolProxy?.enforceResult === "function") {
            const metered = await governanceToolProxy.enforceResult({
              context: contextOverride.agentGovernance,
              toolName,
              policy: governancePolicy,
              result,
              descriptor: tool.source === "built-in" ? tool.resultRecordDescriptor : null,
            });
            result = metered.result;
          } else if (typeof governancePolicy.limits?.maxRecords === "number") {
            result = {
              status: "denied",
              code: "RECORD_METER_UNAVAILABLE",
              error: "The governed record-result meter is unavailable.",
            };
          }
        }
        const durationMs = Date.now() - startTime;

        // 截断超长结果（借鉴 Claude Code 的 maxResultSizeChars 模式）
        if (typeof result === "string" && result.length > tool.maxResultSizeChars) {
          result = result.slice(0, tool.maxResultSizeChars) + "\n...(结果已截断)";
        }
        if (governancePolicy) {
          result = redactGovernedToolResult(result, governancePolicy);
        }

        // Cache invalidation: when a write tool modifies a file, invalidate
        // related read-tool cache entries to prevent stale reads.
        const WRITE_TOOLS = new Set(["file_write", "file_edit", "file_insert", "shell_exec"]);
        if (WRITE_TOOLS.has(toolName) && result && typeof result === "object" && result.status !== "error") {
          resultCache.invalidateForFileWrite(coercedParams);
        }

        // Cache the result for read-only tools
        if (cacheEligible) resultCache.set(toolName, coercedParams, result);

        // 记录执行日志
        const record = {
          id: executionId,
          toolName,
          params: sanitizeParams(params),
          status: result.status || "success",
          durationMs,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();

        // 发布执行完成事件
        if (eventBus) {
          eventBus.emit("tool.execution.completed", {
            ...record,
            resultSummary: summarizeResult(result),
          });
        }

        return result;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const safeError = redactGovernedString(err?.message ?? String(err));
        const record = {
          id: executionId,
          toolName,
          params: sanitizeParams(params),
          status: "error",
          error: safeError,
          durationMs,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();

        if (eventBus) {
          eventBus.emit("tool.execution.failed", record);
        }

        return { status: "error", error: safeError };
      }
      } finally {
        governanceExecutionLease?.release?.();
      }
    },

    /**
     * 获取执行历史
     */
    getExecutionLog({ limit = 100, offset = 0 } = {}) {
      return executionLog.slice(-limit - offset, limit > 0 ? -offset || undefined : undefined);
    },

    /**
     * 获取注册表健康状态摘要
     */
    getHealth() {
      return {
        status: "ready",
        registeredTools: tools.size,
        builtInTools: [...tools.values()].filter((t) => t.source === "built-in").length,
        customTools: [...tools.values()].filter((t) => t.source !== "built-in").length,
        registeredAgents: agents.size,
        executionLogSize: executionLog.length,
        maxChainDepth,
        permissionMode: permissionCheckerConfigured ? "configured" : "fail-closed",
        highRiskToolsEnabled,
        highRiskToolAllowlist: exactHighRiskTools ? [...exactHighRiskTools] : null,
        governanceToolProxyConfigured: Boolean(governanceToolProxy),
        governanceRequired,
        externalEffectGateConfigured: Boolean(
          externalEffectGate && typeof externalEffectGate.reserve === "function",
        ),
        cacheSize: resultCache.size,
        cacheMaxSize: resultCache.maxSize,
        cacheableTools: [...resultCache.cacheableTools],
      };
    },
  };

  // Mix in agent management methods (extracted to toolAgentManager.js)
  Object.assign(registry, createAgentManager(agents, tools, filterToolsForAgent));

  registry.clearCache = () => resultCache.clear();

  registry.invalidateFileCache = (params) => resultCache.invalidateForFileWrite(params);

  registry.shutdownLsp = async () => {
    if (_lspShutdownAll) {
      await _lspShutdownAll();
      return { status: "shutdown" };
    }
    return { status: "no_lsp" };
  };

  return registry;

  function recordExternalEffectDenial(toolName, params, code, reason) {
    executionLog.push({
      id: randomUUID(),
      toolName,
      params: sanitizeParams(params),
      status: "denied",
      reason,
      timestamp: new Date().toISOString(),
    });
    capExecutionLog();
    return { status: "denied", code, error: reason };
  }
}

// ============================================================
// 辅助函数
// ============================================================

const GOVERNED_RESULT_MAX_DEPTH = 12;
const GOVERNED_RESULT_MAX_NODES = 10_000;
const GOVERNED_RESULT_DEPTH_OMITTED = "[output omitted: depth limit exceeded]";
const GOVERNED_RESULT_BUDGET_OMITTED = "[output omitted: node budget exceeded]";
const LOG_PARAMS_MAX_DEPTH = 8;
const LOG_PARAMS_MAX_NODES = 2_000;
const LOG_PARAMS_DEPTH_OMITTED = "[value omitted: depth limit exceeded]";
const LOG_PARAMS_BUDGET_OMITTED = "[value omitted: node budget exceeded]";

function redactGovernedToolResult(result, policy) {
  const policyFields = Array.isArray(policy?.scope?.deniedOutputFields)
    ? policy.scope.deniedOutputFields
    : [];
  const redactionRequired = policy?.requirements?.outputRedactionRequired === true
    || policy?.mandatory?.credentialsExposedToAgent !== true;
  const fields = new Set([
    ...(redactionRequired ? AGENT_GOVERNANCE_REDACTED_FIELDS : []),
    ...policyFields,
  ].map((field) => String(field).toLowerCase()));
  const seen = new WeakSet();
  const budget = { nodes: 0 };
  const visit = (value, depth) => {
    if (budget.nodes >= GOVERNED_RESULT_MAX_NODES) return GOVERNED_RESULT_BUDGET_OMITTED;
    budget.nodes += 1;
    if (depth > GOVERNED_RESULT_MAX_DEPTH) return GOVERNED_RESULT_DEPTH_OMITTED;
    if (typeof value === "string") return redactionRequired ? redactGovernedString(value) : value;
    if (typeof value === "function") return "[callable output omitted]";
    if (value === null || typeof value !== "object") return value;
    if (Buffer.isBuffer(value)) return "[binary output omitted]";
    if (seen.has(value)) return "[circular output omitted]";
    seen.add(value);
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value) {
        if (budget.nodes >= GOVERNED_RESULT_MAX_NODES) {
          output.push(GOVERNED_RESULT_BUDGET_OMITTED);
          break;
        }
        output.push(visit(item, depth + 1));
      }
      return output;
    }
    const output = Object.create(null);
    let redactedKeyIndex = 0;
    for (const key of Object.keys(value)) {
      if (budget.nodes >= GOVERNED_RESULT_MAX_NODES) {
        defineSanitizedProperty(output, "__truncated__", GOVERNED_RESULT_BUDGET_OMITTED);
        break;
      }
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property || !("value" in property) || !isSafePublicObjectKey(key)) {
        defineSanitizedProperty(output, `[redacted-key-${redactedKeyIndex}]`, "***REDACTED***");
        redactedKeyIndex += 1;
        budget.nodes += 1;
        continue;
      }
      const nested = property.value;
      const normalized = key.toLowerCase();
      const redactedField = [...fields].some((field) => normalized.includes(field));
      const sanitized = redactedField ? "***REDACTED***" : visit(nested, depth + 1);
      if (redactedField) budget.nodes += 1;
      defineSanitizedProperty(output, key, sanitized);
    }
    return output;
  };
  return visit(result, 0);
}

function buildTrustedToolResourceContext({ toolName, params, workingDirectory, protectedPaths }) {
  const record = params && typeof params === "object" && !Array.isArray(params) ? params : {};
  const resources = new Set();
  const absoluteResources = [];
  let root = resolve(workingDirectory);
  try { root = realpathSync.native(root); } catch { /* The tool owns missing workspace errors. */ }
  for (const key of ["file_path", "path", "root", "directory", "working_directory"]) {
    const value = record[key];
    if (typeof value !== "string" || value.trim() === "") continue;
    const raw = value.replace(/\\/gu, "/").replace(/^\.\//u, "");
    const lexical = resolve(root, value);
    let canonical = lexical;
    try {
      canonical = existsSync(lexical)
        ? realpathSync.native(lexical)
        : resolve(realpathSync.native(dirname(lexical)), lexical.slice(dirname(lexical).length + 1));
    } catch {
      // Tool-specific validation will reject paths whose parent cannot be resolved.
    }
    const comparable = normalizeComparablePath(canonical);
    absoluteResources.push(comparable);
    resources.add(raw);
    resources.add(relative(root, canonical).replace(/\\/gu, "/").replace(/^\.\//u, ""));
    resources.add(comparable);
  }
  for (const key of ["url", "uri"]) {
    const value = record[key];
    if (typeof value !== "string" || value.trim() === "") continue;
    resources.add(value);
    try { resources.add(new URL(value).href); } catch { /* Tool validation owns malformed URLs. */ }
  }
  for (const value of Array.isArray(record.resources) ? record.resources : []) {
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  const protectedRoots = (Array.isArray(protectedPaths) ? protectedPaths : [])
    .filter((value) => typeof value === "string" && value !== "")
    .map((value) => normalizeComparablePath(resolve(value)));
  const protectedPathDenied = absoluteResources.some((resource) => protectedRoots.some((protectedRoot) => (
    resource === protectedRoot || resource.startsWith(`${protectedRoot}${sep}`)
  )));
  const comparableRoot = normalizeComparablePath(root);
  const workspaceEscapeDenied = absoluteResources.some((resource) => (
    resource !== comparableRoot && !resource.startsWith(`${comparableRoot}${sep}`)
  ));
  const outputFields = [record.outputFields, record.fields, record.select]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value) => typeof value === "string" && value !== "");
  return {
    resources: [...resources],
    outputFields,
    protectedPathDenied,
    workspaceEscapeDenied,
    toolName,
  };
}

function normalizeComparablePath(value) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function governanceSatisfiesToolPermissions(tool, policy) {
  const permissions = policy?.permissions ?? {};
  return (tool.requiredPermissions ?? []).every((permission) => {
    switch (permission) {
      case "file:read":
      case "git:read":
      case "lsp:read":
        return true;
      case "file:write":
      case "git:write":
        return permissions.canWrite === true;
      case "network:fetch":
      case "network:search":
        return permissions.canSendExternalMessage === true;
      case "git:remote":
        return permissions.canWrite === true && permissions.canSendExternalMessage === true;
      case "shell:exec":
      case "code:run":
        return permissions.canExecuteCode === true;
      default:
        return false;
    }
  });
}

function isSuccessfulToolResult(result) {
  return !(result && typeof result === "object" && (
    result.status === "error"
    || result.status === "denied"
    || result.success === false
    || result.error === true
    || typeof result.error === "string"
  ));
}

function redactGovernedString(value) {
  return redactSecretsInText(value)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/giu, "$1 ***REDACTED***")
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***");
}

/**
 * 脱敏参数（记录日志时不暴露敏感信息）
 */
export function sanitizeParams(params) {
  const sensitive = ["password", "token", "secret", "apiKey", "api_key", "authorization"];
  const omittedText = new Set(["body", "content"]);
  const seen = new WeakSet();
  const budget = { nodes: 0 };
  const visit = (value, key, depth) => {
    if (key === GOVERNED_GIT_ENVELOPE_KEY) return "[governance envelope omitted]";
    if (budget.nodes >= LOG_PARAMS_MAX_NODES) return LOG_PARAMS_BUDGET_OMITTED;
    budget.nodes += 1;
    if (depth > LOG_PARAMS_MAX_DEPTH) return LOG_PARAMS_DEPTH_OMITTED;
    if (sensitive.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))) {
      return "***REDACTED***";
    }
    if (typeof value === "string") {
      if (omittedText.has(key.toLowerCase())) return `[text omitted; ${Buffer.byteLength(value, "utf8")} bytes]`;
      const redacted = redactGovernedString(value);
      return redacted.length > 500 ? `${redacted.slice(0, 500)}...(truncated)` : redacted;
    }
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[circular omitted]";
    seen.add(value);
    if (Array.isArray(value)) {
      const output = [];
      for (const item of value.slice(0, 100)) {
        if (budget.nodes >= LOG_PARAMS_MAX_NODES) {
          output.push(LOG_PARAMS_BUDGET_OMITTED);
          break;
        }
        output.push(visit(item, "item", depth + 1));
      }
      return output;
    }
    const output = Object.create(null);
    let redactedKeyIndex = 0;
    for (const nestedKey of Object.keys(value)) {
      if (budget.nodes >= LOG_PARAMS_MAX_NODES) {
        defineSanitizedProperty(output, "__truncated__", LOG_PARAMS_BUDGET_OMITTED);
        break;
      }
      const property = Object.getOwnPropertyDescriptor(value, nestedKey);
      if (!property || !("value" in property) || !isSafePublicObjectKey(nestedKey)) {
        defineSanitizedProperty(output, `[redacted-key-${redactedKeyIndex}]`, "***REDACTED***");
        redactedKeyIndex += 1;
        budget.nodes += 1;
        continue;
      }
      defineSanitizedProperty(output, nestedKey, visit(property.value, nestedKey, depth + 1));
    }
    return output;
  };
  return visit(params, "params", 0);
}

/**
 * 生成结果摘要（用于事件发布，不传输完整结果）
 */
export function summarizeResult(result) {
  if (typeof result === "string") {
    return { type: "string", length: result.length };
  }
  if (result && typeof result === "object") {
    return {
      type: "object",
      status: result.status || "unknown",
      keys: Object.keys(result).slice(0, 10).map((key, index) => (
        isSafePublicObjectKey(key) ? key : `[redacted-key-${index}]`
      )),
    };
  }
  return { type: typeof result };
}

function defineSanitizedProperty(output, key, value) {
  Object.defineProperty(output, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
