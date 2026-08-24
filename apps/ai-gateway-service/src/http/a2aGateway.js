import { randomUUID } from "node:crypto";
import {
  A2A_PROTOCOL_VERSION,
  AgentCard,
  Role,
  TaskState,
} from "@a2a-js/sdk";
import { ContentTypeNotSupportedError } from "@a2a-js/sdk/errors";
import {
  AgentEvent,
  DefaultRequestHandler,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
} from "@a2a-js/sdk/server";
import { applyPromptEnhancement } from "./utils/chatUtils.js";

export const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";
export const A2A_JSONRPC_PATH = "/a2a/jsonrpc";

function textPart(text) {
  return {
    content: { $case: "text", value: text },
    mediaType: "text/plain",
    filename: "",
    metadata: {},
  };
}

function agentMessage({ contextId, taskId, text }) {
  return {
    messageId: randomUUID(),
    contextId,
    taskId,
    role: Role.ROLE_AGENT,
    parts: [textPart(text)],
    metadata: {},
    extensions: [],
    referenceTaskIds: [],
  };
}

function status(state, message) {
  return {
    state,
    message,
    timestamp: new Date().toISOString(),
  };
}

function readTextMessage(message) {
  if (!message?.parts?.length) {
    throw new ContentTypeNotSupportedError("A2A message must contain a text part.");
  }
  const text = message.parts.map((part) => {
    if (part?.content?.$case !== "text" || typeof part.content.value !== "string") {
      throw new ContentTypeNotSupportedError(
        "This A2A profile supports text/plain message parts only.",
      );
    }
    return part.content.value;
  }).join("\n");
  if (!text.trim()) {
    throw new ContentTypeNotSupportedError("A2A text input cannot be empty.");
  }
  return text;
}

class GatewayAgentExecutor {
  /**
   * @param {object} gatewayService
   * @param {{execute: Function}|null} [workforceExecutor]
   */
  constructor(gatewayService, workforceExecutor = null) {
    this.gatewayService = gatewayService;
    this.workforceExecutor = workforceExecutor;
    this.cancelledTaskIds = new Set();
    this.taskContexts = new Map();
  }

  async execute(requestContext, eventBus) {
    const { contextId, taskId, userMessage } = requestContext;
    this.taskContexts.set(taskId, contextId);
    try {
      eventBus.publish(AgentEvent.task({
        id: taskId,
        contextId,
        status: status(TaskState.TASK_STATE_SUBMITTED, undefined),
        artifacts: [],
        history: [userMessage],
        metadata: {
          protocol: "A2A",
          protocolVersion: A2A_PROTOCOL_VERSION,
          realProviderCallsAllowed: false,
        },
      }));
      eventBus.publish(AgentEvent.statusUpdate({
        taskId,
        contextId,
        status: status(TaskState.TASK_STATE_WORKING, undefined),
        metadata: {},
      }));

      const input = readTextMessage(userMessage);
      const unifiedAiMeta = requestContext.request.metadata?.unifiedAi ?? {};
      const enhancement = unifiedAiMeta.promptEnhancement;
      const executionMode = unifiedAiMeta.executionMode ?? "fake-provider";

      // Workforce mode: route to workforce agent execution instead of gateway chat
      if (executionMode === "workforce") {
        if (!hasServerPermission(requestContext, "workflow:run")) {
          const error = new Error("A2A workforce execution requires workflow:run permission.");
          error.code = "a2a_workforce_permission_required";
          throw error;
        }
        if (!this.workforceExecutor) {
          throw new Error("Controlled workforce execution is unavailable.");
        }
        const workforceResult = await this.workforceExecutor.execute({
          goal: input,
          autonomyMode: "dry-run",
          context: { source: "a2a-v1", taskId, contextId },
        });

        if (this.cancelledTaskIds.has(taskId)) return;

        const workforceText = formatWorkforceResult(workforceResult);
        const completionMessage = agentMessage({ contextId, taskId, text: workforceText });

        eventBus.publish(AgentEvent.artifactUpdate({
          taskId,
          contextId,
          artifact: {
            artifactId: randomUUID(),
            name: "workforce-analysis",
            description: "Workforce role-based analysis from Unified AI System.",
            parts: [textPart(workforceText)],
            metadata: {
              executionMode: "workforce",
              llmDriven: workforceResult.llmDriven ?? false,
              roleCount: Object.keys(workforceResult.roleOutputs ?? {}).length,
            },
            extensions: [],
          },
          append: false,
          lastChunk: true,
          metadata: {},
        }));
        eventBus.publish(AgentEvent.statusUpdate({
          taskId,
          contextId,
          status: status(TaskState.TASK_STATE_COMPLETED, completionMessage),
          metadata: {},
        }));
        return;
      }

      // Default: fake-provider chat path (unchanged for backward compatibility)
      let gatewayInput = {
        taskType: "chat",
        messages: [{ role: "user", content: input }],
        providerId: "local-fake-provider",
        model: "local-fake-model",
        metadata: {
          source: "a2a-v1",
          realProviderAuthorized: false,
        },
      };
      if (enhancement === true || enhancement?.enabled === true) {
        gatewayInput = applyPromptEnhancement(gatewayInput, {
          enabled: true,
          ...(typeof enhancement === "object" ? enhancement : {}),
        });
      }

      const result = await this.gatewayService.execute(gatewayInput);
      if (this.cancelledTaskIds.has(taskId)) return;
      if (!result.success) {
        throw new Error(result.error?.message ?? result.message ?? "A2A gateway execution failed.");
      }
      if (
        result.data?.executionMode !== "fake"
        || result.data?.selectedProvider !== "local-fake-provider"
      ) {
        throw new Error("A2A execution stopped because fake-provider proof was missing.");
      }

      const output = result.data?.message?.content
        ?? result.data?.outputText
        ?? result.data?.text
        ?? "";
      const completionMessage = agentMessage({ contextId, taskId, text: output });
      eventBus.publish(AgentEvent.artifactUpdate({
        taskId,
        contextId,
        artifact: {
          artifactId: randomUUID(),
          name: "gateway-response",
          description: "Fake-provider output from Unified AI System.",
          parts: [textPart(output)],
          metadata: {
            selectedProvider: result.data.selectedProvider,
            selectedModel: result.data.selectedModel,
            executionMode: result.data.executionMode,
          },
          extensions: [],
        },
        append: false,
        lastChunk: true,
        metadata: {},
      }));
      eventBus.publish(AgentEvent.statusUpdate({
        taskId,
        contextId,
        status: status(TaskState.TASK_STATE_COMPLETED, completionMessage),
        metadata: {},
      }));
    } finally {
      this.taskContexts.delete(taskId);
      this.cancelledTaskIds.delete(taskId);
    }
  }

  async cancelTask(taskId, eventBus) {
    this.cancelledTaskIds.add(taskId);
    const contextId = this.taskContexts.get(taskId);
    if (!contextId) return;
    eventBus.publish(AgentEvent.statusUpdate({
      taskId,
      contextId,
      status: status(
        TaskState.TASK_STATE_CANCELED,
        agentMessage({
          contextId,
          taskId,
          text: "Task cancellation requested by the A2A client.",
        }),
      ),
      metadata: {},
    }));
    this.taskContexts.delete(taskId);
  }
}

function normalizePublicBaseUrl(env) {
  const configured = env.A2A_PUBLIC_BASE_URL;
  const fallbackHost = env.AI_GATEWAY_SERVICE_HOST ?? "127.0.0.1";
  const host = new Set(["0.0.0.0", "::", "[::]"]).has(fallbackHost)
    ? "127.0.0.1"
    : fallbackHost;
  const bracketedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  const value = configured ?? `http://${bracketedHost}:${env.AI_GATEWAY_SERVICE_PORT ?? "3100"}`;
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password) {
    throw new Error("A2A_PUBLIC_BASE_URL must be an HTTP(S) URL without credentials.");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function createA2AGateway({ gatewayService, workforceExecutor = null, env = process.env }) {
  const publicBaseUrl = normalizePublicBaseUrl(env);
  const enterpriseAuthEnabled = env.PME_ENTERPRISE_AUTH_ENABLED === "true";
  const securitySchemes = enterpriseAuthEnabled
    ? {
        bearerAuth: {
          scheme: {
            $case: "httpAuthSecurityScheme",
            value: {
              description: "Unified AI System enterprise access token.",
              scheme: "Bearer",
              bearerFormat: "token",
            },
          },
        },
      }
    : {};
  const securityRequirements = enterpriseAuthEnabled
    ? [{ schemes: { bearerAuth: { list: [] } } }]
    : [];
  const agentCard = {
    name: "Unified AI System Gateway Agent",
    description:
      "A governed A2A v1.0 gateway agent for credential-free fake-provider tasks, optional local prompt enhancement, and workforce role-based analysis.",
    supportedInterfaces: [
      {
        url: `${publicBaseUrl}${A2A_JSONRPC_PATH}`,
        protocolBinding: "JSONRPC",
        protocolVersion: A2A_PROTOCOL_VERSION,
        tenant: "",
      },
    ],
    provider: {
      organization: "Unified AI System",
      url: "https://github.com/happy520ai/unified-ai-system",
    },
    version: "0.4.9",
    documentationUrl:
      "https://github.com/happy520ai/unified-ai-system/blob/master/docs/a2a-protocol.md",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
      extensions: [],
    },
    securitySchemes,
    securityRequirements,
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "gateway-task",
        name: "Governed gateway task",
        description:
          "Execute one text task through the local fake provider with explicit execution evidence.",
        tags: ["gateway", "text", "fake-provider", "safe-preview"],
        examples: ["Plan a small API migration", "Summarize this technical request"],
        inputModes: ["text/plain"],
        outputModes: ["text/plain"],
        securityRequirements,
      },
      {
        id: "prompt-enhancement",
        name: "Natural-language prompt enhancement",
        description:
          "Structure a plain-language task before fake-provider execution when explicitly requested in message metadata.",
        tags: ["prompt", "natural-language", "planning"],
        examples: ["Turn this rough request into an actionable coding task"],
        inputModes: ["text/plain"],
        outputModes: ["text/plain"],
        securityRequirements,
      },
      {
        id: "workforce-analysis",
        name: "Workforce role-based analysis",
        description:
          "Execute a goal through 7 specialized workforce roles when executionMode=workforce is set and the authenticated identity has workflow:run permission.",
        tags: ["workforce", "analysis", "multi-role", "planning"],
        examples: ["Analyze this project goal from multiple role perspectives"],
        inputModes: ["text/plain"],
        outputModes: ["text/plain"],
        securityRequirements,
      },
    ],
    signatures: [],
  };
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    new GatewayAgentExecutor(gatewayService, workforceExecutor),
  );
  return {
    agentCard,
    agentCardJson: AgentCard.toJSON(agentCard),
    publicBaseUrl,
    requestHandler,
    transportHandler: new JsonRpcTransportHandler(requestHandler),
  };
}

function hasServerPermission(requestContext, permission) {
  const permissions = requestContext?.context?.user?.permissions;
  return Array.isArray(permissions)
    && (permissions.includes("*") || permissions.includes(permission));
}

function formatWorkforceResult(result) {
  const lines = [
    `# Workforce Analysis${result.llmDriven ? " (LLM-Enhanced)" : " (Template)"}`,
    "",
    `Goal: ${result.goal ?? "N/A"}`,
    `Status: ${result.status ?? "completed"}`,
    "",
  ];

  const roleOutputs = result.roleOutputs ?? {};
  for (const [roleId, output] of Object.entries(roleOutputs)) {
    lines.push(`## ${roleId}`);
    if (output?.roleMeta?.goal) {
      lines.push(`Goal: ${output.roleMeta.goal}`);
    }
    const summary = output?.summary ?? output?.roleMeta?.goal ?? "Analysis completed";
    lines.push(summary);
    lines.push("");
  }

  if (result.crossRoleDependencies?.length) {
    lines.push("## Cross-Role Dependencies");
    for (const dep of result.crossRoleDependencies) {
      lines.push(`- ${dep.from} → ${dep.to}: ${dep.dependency}`);
    }
    lines.push("");
  }

  if (result.llmStats) {
    lines.push("## LLM Statistics");
    lines.push(`- Total calls: ${result.llmStats.totalCalls ?? 0}`);
    lines.push(`- Successful: ${result.llmStats.successfulCalls ?? 0}`);
    lines.push(`- Fallbacks: ${result.llmStats.fallbackCalls ?? 0}`);
  }

  return lines.join("\n");
}

export const a2aGatewayInternals = {
  GatewayAgentExecutor,
  agentMessage,
  hasServerPermission,
  normalizePublicBaseUrl,
  readTextMessage,
  status,
  textPart,
};
