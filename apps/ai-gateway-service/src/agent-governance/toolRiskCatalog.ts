/**
 * Tool risk catalog — governance descriptors for agent-callable tools.
 *
 * Tool-declared risk labels are authoritative: agent self-classification
 * can never lower them (the policy engine backfills implied traits from
 * these descriptors). Unknown tools resolve to deny at compile time.
 */

import type { ToolGovernanceDescriptor } from "@unified-ai-system/shared-contracts";

function descriptor(input: {
  name: string;
  actionType: "read" | "write";
  riskTraits: ToolGovernanceDescriptor["riskTraits"];
  riskLevel: ToolGovernanceDescriptor["riskLevel"];
  defaultDecision: ToolGovernanceDescriptor["defaultDecision"];
  description?: string;
}): ToolGovernanceDescriptor {
  return {
    name: input.name,
    description: input.description,
    actionType: input.actionType,
    riskTraits: input.riskTraits,
    riskLevel: input.riskLevel,
    defaultDecision: input.defaultDecision,
    credentialMode: "server_side",
  };
}

const BUILT_IN_TOOL_DESCRIPTORS: ToolGovernanceDescriptor[] = [
  descriptor({ name: "file_read", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "glob", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "grep", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "file_write", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "file_edit", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "file_insert", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "shell_exec", actionType: "write", riskTraits: ["code_execution", "destructive_operation"], riskLevel: "critical", defaultDecision: "deny" }),
  descriptor({ name: "code_run", actionType: "write", riskTraits: ["code_execution"], riskLevel: "critical", defaultDecision: "deny" }),
  descriptor({ name: "web_fetch", actionType: "read", riskTraits: ["external_communication"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "web_search", actionType: "read", riskTraits: ["external_communication"], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "image_analyze", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "image_read", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "semantic_search", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "ast_edit", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "code_format", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "generate_test", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "type_check", actionType: "write", riskTraits: ["code_execution"], riskLevel: "critical", defaultDecision: "deny" }),
  descriptor({ name: "git_status", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "git_diff", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "git_log", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "git_branch", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "git_commit", actionType: "write", riskTraits: ["write_capable"], riskLevel: "medium", defaultDecision: "allow" }),
  descriptor({ name: "git_push", actionType: "write", riskTraits: ["external_communication", "write_capable"], riskLevel: "high", defaultDecision: "require_approval" }),
  descriptor({ name: "git_create_pr", actionType: "write", riskTraits: ["external_communication", "write_capable"], riskLevel: "high", defaultDecision: "require_approval" }),
  descriptor({ name: "lsp_definition", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "lsp_references", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "lsp_hover", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "lsp_symbols", actionType: "read", riskTraits: [], riskLevel: "low", defaultDecision: "allow" }),
  descriptor({ name: "subagent_dispatch", actionType: "write", riskTraits: ["subagent_creator"], riskLevel: "high", defaultDecision: "require_approval" }),
  descriptor({
    name: "workforce_execute",
    actionType: "write",
    riskTraits: ["subagent_creator", "write_capable"],
    riskLevel: "high",
    defaultDecision: "allow",
    description: "Execute a bounded Workforce plan under the existing plan-digest approval gate.",
  }),
  descriptor({
    name: "forge_orchestrate",
    actionType: "write",
    riskTraits: ["subagent_creator", "write_capable"],
    riskLevel: "high",
    defaultDecision: "allow",
    description: "Run Forge under server-bound Agent identity and per-action Tool Proxy enforcement.",
  }),
  // MCP bridge tools registered dynamically at runtime carry an
  // operator-declared upstream ACL; governance treats them as sensitive
  // external calls by default.
  descriptor({ name: "mcp", actionType: "write", riskTraits: ["external_communication"], riskLevel: "high", defaultDecision: "require_approval" }),
];

export interface ToolRiskCatalog {
  lookup(toolName: string): ToolGovernanceDescriptor | null;
  register(input: ToolGovernanceDescriptor): void;
  asMap(): Map<string, ToolGovernanceDescriptor>;
  list(): ToolGovernanceDescriptor[];
}

export function createToolRiskCatalog(options: { extra?: ToolGovernanceDescriptor[] } = {}): ToolRiskCatalog {
  const byName = new Map<string, ToolGovernanceDescriptor>();
  for (const item of [...BUILT_IN_TOOL_DESCRIPTORS, ...(options.extra ?? [])]) {
    byName.set(item.name, item);
  }
  return {
    lookup(toolName: string) {
      const direct = byName.get(toolName);
      if (direct) return direct;
      // Namespaced tools (mcp:<server>:<tool> and similar) inherit the
      // namespace's descriptor when registered, otherwise fall back to a
      // conservative external-call profile.
      const namespace = toolName.split(":")[0];
      const namespaceDescriptor = byName.get(namespace);
      if (namespaceDescriptor) {
        return { ...namespaceDescriptor, name: toolName };
      }
      return null;
    },
    register(input: ToolGovernanceDescriptor) {
      byName.set(input.name, input);
    },
    asMap() {
      return new Map(byName);
    },
    list() {
      return Array.from(byName.values());
    },
  };
}
