/**
 * toolAgentManager.js — Agent definition registry mixin.
 *
 * Split from toolRegistryEngine.js for 分层律 compliance.
 * Manages Agent definitions and their tool filtering.
 */

/**
 * Create agent management methods.
 * Returns an object whose methods should be mixed into the registry.
 *
 * @param {Map} agents - agent storage map
 * @param {Map} tools - tool storage map
 * @param {Function} filterToolsForAgent - tool filter function
 */
export function createAgentManager(agents, tools, filterToolsForAgent) {
  return {
    /**
     * 注册一个 Agent 定义
     * 借鉴 Claude Code 的 AgentDefinition 注册模式:
     * - agentType 唯一标识
     * - whenToUse 描述使用场景
     * - tools 定义允许使用的工具列表
     * - disallowedTools 定义禁止使用的工具列表
     */
    registerAgent(agentDef) {
      if (!agentDef.agentType) {
        return { status: "error", error: "Agent 必须有 agentType" };
      }
      agents.set(agentDef.agentType, {
        agentType: agentDef.agentType,
        whenToUse: agentDef.whenToUse || "",
        tools: agentDef.tools || null,           // allowlist
        disallowedTools: agentDef.disallowedTools || null,  // denylist
        permissionMode: agentDef.permissionMode || "default",
        model: agentDef.model || "default",
        source: agentDef.source || "custom",
        maxTurns: agentDef.maxTurns || 50,
        metadata: agentDef.metadata || {},
      });
      return { status: "success", agentType: agentDef.agentType };
    },

    /**
     * 获取 Agent 可用的工具列表
     * 借鉴 Claude Code 的 filterToolsForAgent + getActiveAgentsFromList
     */
    getAgentTools(agentType) {
      const agent = agents.get(agentType);
      if (!agent) {
        return { status: "error", error: `Agent ${agentType} 未注册` };
      }
      const filtered = filterToolsForAgent({
        allowlist: agent.tools,
        denylist: agent.disallowedTools,
        permissionMode: agent.permissionMode,
      });
      return {
        status: "success",
        agentType,
        tools: filtered.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    },

    /**
     * 列出所有已注册的 Agent
     */
    listAgents() {
      return [...agents.values()].map((a) => ({
        agentType: a.agentType,
        whenToUse: a.whenToUse,
        toolCount: filterToolsForAgent({
          allowlist: a.tools,
          denylist: a.disallowedTools,
          permissionMode: a.permissionMode,
        }).length,
        permissionMode: a.permissionMode,
        model: a.model,
        source: a.source,
      }));
    },
  };
}
