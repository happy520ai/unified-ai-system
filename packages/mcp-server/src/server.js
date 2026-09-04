import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";
import * as z from "zod/v4";

export const MCP_SERVER_NAME = "unified-ai-system";
export const MCP_SERVER_VERSION = "0.7.0";
export const MCP_MODERN_PROTOCOL_VERSION = "2026-07-28";
export const MCP_LEGACY_PROTOCOL_VERSION = "2025-11-25";
export const MCP_COMPAT_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  MCP_MODERN_PROTOCOL_VERSION,
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_COMPAT_PROTOCOL_VERSION,
]);
export const MCP_TOOL_NAMES = Object.freeze([
  "gateway_health",
  "gateway_readiness",
  "agent_governance_status",
  "agent_governance_list",
  "agent_governance_describe",
  "gateway_prompt_enhance",
  "gateway_prompt_enhance_llm",
  "gateway_chat",
  "knowledge_readiness",
  "knowledge_retrieve",
  "workflow_health",
  "workflow_actions",
  "workflow_run",
  "workforce_health",
  "workforce_agents",
]);

const SERVER_INSTRUCTIONS = [
  "Use this server to inspect and exercise a local Unified AI System gateway.",
  "The preview is fake-provider only: never represent its responses as real provider output.",
  "Use gateway_prompt_enhance to structure a natural-language request without calling a model.",
  "Prefer gateway_health and gateway_readiness before gateway_chat.",
  "Use agent_governance_status, agent_governance_list, and agent_governance_describe for read-only inspection of the authenticated tenant's governed Agents.",
  "Agent creation, execution, revocation, approval decisions, and policy activation remain human REST/SDK/CLI operations and are not exposed to the model tool surface.",
  "Use knowledge_retrieve to search the local knowledge base by keyword.",
  "Use workflow_run to execute the 3-step local workflow (retrieve, compose, write artifact).",
  "The workforce tools remain read-only inspection surfaces.",
  "No tool enables providers or executes workforce plans.",
].join(" ");

const READ_ONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

function resultData(envelope) {
  return envelope?.data ?? envelope;
}

function createToolResult(toolName, runtime, result) {
  const payload = {
    ok: true,
    tool: toolName,
    gateway: {
      baseUrl: runtime.baseUrl,
      managed: runtime.managed,
      realProviderCallsAllowed: false,
      authenticated: runtime.gatewayAuth?.enabled === true,
      authVerified: runtime.gatewayAuth?.verified === true,
      authTokenExposed: false,
    },
    result,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function createToolError(toolName, error) {
  const payload = {
    ok: false,
    tool: toolName,
    error: {
      code: "GATEWAY_MCP_TOOL_FAILED",
      message: error instanceof Error ? error.message : String(error),
      ...(Number.isInteger(error?.statusCode)
        ? { statusCode: error.statusCode }
        : {}),
    },
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}

function registerReadTool(server, runtime, definition) {
  server.registerTool(
    definition.name,
    {
      title: definition.title,
      description: definition.description,
      ...(definition.inputSchema ? { inputSchema: definition.inputSchema } : {}),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      try {
        return createToolResult(
          definition.name,
          runtime,
          await definition.execute(),
        );
      } catch (error) {
        return createToolError(definition.name, error);
      }
    },
  );
}

function assertChatStayedFake(response) {
  const chat = resultData(response);
  if (chat?.executionMode !== "fake") {
    throw new Error(
      "MCP chat stopped because the gateway did not prove fake execution.",
    );
  }
}

export function createUnifiedAiMcpServer(runtime, options = {}) {
  if (!runtime?.baseUrl) {
    throw new Error("MCP server requires a gateway runtime.");
  }

  const client = options.client ?? createGatewayClient({
    baseUrl: runtime.baseUrl,
    headers: runtime.privateRequestHeaders ?? {},
    timeoutMs: options.timeoutMs ?? 20_000,
  });
  const server = new McpServer(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  const readTools = [
    {
      name: "gateway_health",
      title: "Gateway health",
      description:
        "Inspect gateway health, provider mode, and the real-provider safety flag.",
      execute: () => client.health(),
    },
    {
      name: "gateway_readiness",
      title: "Gateway readiness",
      description:
        "Inspect first-run readiness for chat and the local gateway runtime.",
      execute: () => client.setupReadiness(),
    },
    {
      name: "agent_governance_status",
      title: "Agent Governance status",
      description:
        "Inspect Agent Governance status through the authenticated Gateway identity. The tool accepts no tenant override and fails closed when that identity is not authorized for platform status.",
      inputSchema: z.object({}).strict(),
      execute: () => client.agentGovernanceStats(),
    },
    {
      name: "agent_governance_list",
      title: "List governed Agents",
      description:
        "List only the governed Agents visible to the Gateway-authenticated tenant. The tool accepts no tenant or owner override.",
      inputSchema: z.object({}).strict(),
      execute: () => client.governedAgents(),
    },
    {
      name: "knowledge_readiness",
      title: "Knowledge readiness",
      description:
        "Inspect the gateway knowledge infrastructure without loading or changing data.",
      execute: () => client.knowledgeInfraReadiness(),
    },
    {
      name: "workflow_health",
      title: "Workflow health",
      description:
        "Inspect the governed workflow subsystem without starting a workflow.",
      execute: () => client.workflowHealth(),
    },
    {
      name: "workflow_actions",
      title: "Workflow actions",
      description:
        "List workflow action definitions without invoking any action.",
      execute: () => client.workflowActions(),
    },
    {
      name: "workforce_health",
      title: "Workforce health",
      description:
        "Inspect the workforce subsystem without planning or executing work.",
      execute: () => client.workforceHealth(),
    },
    {
      name: "workforce_agents",
      title: "Workforce agents",
      description:
        "List configured workforce agent descriptors without dispatching them.",
      execute: () => client.workforceAgents(),
    },
  ];

  for (const definition of readTools) {
    registerReadTool(server, runtime, definition);
  }

  server.registerTool(
    "agent_governance_describe",
    {
      title: "Describe a governed Agent",
      description:
        "Describe one governed Agent only when it is visible to the Gateway-authenticated tenant. Cross-tenant and missing identifiers remain indistinguishable.",
      inputSchema: z.object({
        agentId: z
          .string()
          .trim()
          .regex(/^agt_[A-Za-z0-9_-]{1,128}$/u)
          .describe("Server-issued governed Agent identifier"),
      }).strict(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ agentId }) => {
      try {
        const response = await client.governedAgent(agentId);
        return createToolResult("agent_governance_describe", runtime, response);
      } catch (error) {
        return createToolError("agent_governance_describe", error);
      }
    },
  );

  server.registerTool(
    "gateway_prompt_enhance",
    {
      title: "Natural-language prompt enhancement",
      description:
        "Turn a plain-language request into a structured prompt locally without provider credentials or provider calls.",
      inputSchema: z.object({
        input: z
          .string()
          .trim()
          .min(1)
          .max(20_000)
          .describe("The natural-language request to preserve and structure"),
        profile: z
          .enum(["auto", "general", "coding", "analysis", "writing", "research", "planning"])
          .optional()
          .describe("Optional task profile; auto detects a profile from the request"),
        language: z
          .enum(["auto", "zh-CN", "en"])
          .optional()
          .describe("Output language; auto follows the input language"),
        target: z
          .enum(["model", "agent"])
          .optional()
          .describe("Execution target; agent adds a plan-verify-report execution protocol"),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ input, profile, language, target }) => {
      try {
        const response = await client.enhancePrompt({
          input,
          profile: profile ?? "auto",
          language: language ?? "auto",
          ...(target ? { target } : {}),
        });
        return createToolResult("gateway_prompt_enhance", runtime, response);
      } catch (error) {
        return createToolError("gateway_prompt_enhance", error);
      }
    },
  );

  server.registerTool(
    "gateway_prompt_enhance_llm",
    {
      title: "LLM-enhanced prompt enhancement",
      description:
        "Enhance a prompt using LLM semantic rewriting when a provider is available. Falls back to the deterministic local engine when no provider is configured.",
      inputSchema: z.object({
        input: z
          .string()
          .trim()
          .min(1)
          .max(20_000)
          .describe("The natural-language request to enhance"),
        profile: z
          .enum(["auto", "general", "coding", "analysis", "writing", "research", "planning"])
          .optional()
          .describe("Optional task profile hint"),
        language: z
          .enum(["auto", "zh-CN", "en"])
          .optional()
          .describe("Output language"),
        target: z
          .enum(["model", "agent"])
          .optional()
          .describe("Execution target; agent adds a plan-verify-report execution protocol"),
        providerId: z
          .string()
          .optional()
          .describe("Optional provider ID for LLM enhancement"),
        modelId: z
          .string()
          .optional()
          .describe("Optional model ID for LLM enhancement"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ input, profile, language, target, providerId, modelId }) => {
      try {
        const response = await client.enhancePromptLlm({
          input,
          profile: profile ?? "auto",
          language: language ?? "auto",
          ...(target ? { target } : {}),
          ...(providerId ? { providerId } : {}),
          ...(modelId ? { modelId } : {}),
        });
        return createToolResult("gateway_prompt_enhance_llm", runtime, response);
      } catch (error) {
        return createToolError("gateway_prompt_enhance_llm", error);
      }
    },
  );

  server.registerTool(
    "gateway_chat",
    {
      title: "Fake-provider chat",
      description:
        "Send one chat request only when the gateway proves that real providers are disabled.",
      inputSchema: z.object({
        prompt: z
          .string()
          .trim()
          .min(1)
          .max(20_000)
          .describe("Prompt for the deterministic local fake provider"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ prompt }) => {
      try {
        const health = resultData(await client.health());
        if (
          health?.realProviderEnabled !== false
          || health?.providerMode === "real"
        ) {
          throw new Error(
            "MCP chat refused a gateway that may call a real provider.",
          );
        }

        const requestId = randomUUID();
        const response = await client.chat(
          createGatewayChatRequest({
            prompt,
            context: {
              requestId,
              traceId: `mcp-${requestId}`,
            },
            metadata: {
              caller: "unified-ai-system-mcp",
              realProviderAuthorized: false,
            },
          }),
        );
        assertChatStayedFake(response);
        return createToolResult("gateway_chat", runtime, response);
      } catch (error) {
        return createToolError("gateway_chat", error);
      }
    },
  );

  server.registerTool(
    "knowledge_retrieve",
    {
      title: "Knowledge retrieve",
      description:
        "Search the local knowledge base by keyword. Returns ranked chunks with citations. Does not call any provider.",
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(2_000)
          .describe("Search query for keyword-based retrieval"),
        topK: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Number of results to return (1-5, default 3)"),
        sourceIds: z
          .array(z.string())
          .optional()
          .describe("Optional filter to specific knowledge source IDs"),
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ query, topK, sourceIds }) => {
      try {
        const response = await client.knowledgeRetrieve({
          query,
          ...(topK ? { topK } : {}),
          ...(sourceIds ? { sourceIds } : {}),
        });
        return createToolResult("knowledge_retrieve", runtime, response);
      } catch (error) {
        return createToolError("knowledge_retrieve", error);
      }
    },
  );

  server.registerTool(
    "workflow_run",
    {
      title: "Workflow run",
      description:
        "Execute the 3-step local workflow: retrieve knowledge, compose a Markdown report, and write a controlled artifact. Does not call any provider.",
      inputSchema: z.object({
        agentId: z
          .string()
          .trim()
          .regex(/^agt_[A-Za-z0-9_-]{1,128}$/u)
          .optional()
          .describe("Required when the Gateway has Agent Governance enabled"),
        goal: z
          .string()
          .trim()
          .min(1)
          .max(2_000)
          .describe("The workflow goal or objective"),
        query: z
          .string()
          .trim()
          .max(2_000)
          .optional()
          .describe("Optional retrieval query; defaults to the goal"),
        topK: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("Number of knowledge chunks to retrieve (1-5, default 3)"),
        artifactName: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe("Optional filename for the output artifact (without path)"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ agentId, goal, query, topK, artifactName }) => {
      try {
        const effectiveAgentId = agentId ?? runtime.managedWorkflowAgentId;
        const response = await client.workflowRun({
          ...(effectiveAgentId ? { agentId: effectiveAgentId } : {}),
          goal,
          ...(query ? { query } : {}),
          ...(topK ? { topK } : {}),
          ...(artifactName ? { artifactName } : {}),
        });
        return createToolResult("workflow_run", runtime, response);
      } catch (error) {
        return createToolError("workflow_run", error);
      }
    },
  );

  return server;
}

export const mcpServerInternals = {
  assertChatStayedFake,
  createToolError,
  createToolResult,
  resultData,
};
