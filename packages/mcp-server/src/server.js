import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/server";
import {
  createGatewayChatRequest,
  createGatewayClient,
} from "@unified-ai-system/shared-sdk";
import * as z from "zod/v4";

export const MCP_SERVER_NAME = "unified-ai-system";
export const MCP_SERVER_VERSION = "0.3.3";
export const MCP_TOOL_NAMES = Object.freeze([
  "gateway_health",
  "gateway_readiness",
  "gateway_prompt_enhance",
  "gateway_chat",
  "knowledge_readiness",
  "workflow_health",
  "workflow_actions",
  "workforce_health",
  "workforce_agents",
]);

const SERVER_INSTRUCTIONS = [
  "Use this server to inspect and exercise a local Unified AI System gateway.",
  "The preview is fake-provider only: never represent its responses as real provider output.",
  "Use gateway_prompt_enhance to structure a natural-language request without calling a model.",
  "Prefer gateway_health and gateway_readiness before gateway_chat.",
  "The workflow and workforce tools are read-only inspection surfaces.",
  "No tool enables providers, executes workforce plans, or writes knowledge.",
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
      }),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ input, profile, language }) => {
      try {
        const response = await client.enhancePrompt({
          input,
          profile: profile ?? "auto",
          language: language ?? "auto",
        });
        return createToolResult("gateway_prompt_enhance", runtime, response);
      } catch (error) {
        return createToolError("gateway_prompt_enhance", error);
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

  return server;
}

export const mcpServerInternals = {
  assertChatStayedFake,
  createToolError,
  createToolResult,
  resultData,
};
