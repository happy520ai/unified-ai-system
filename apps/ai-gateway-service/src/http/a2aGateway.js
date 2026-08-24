import { randomUUID } from "node:crypto";
import {
  A2A_PROTOCOL_VERSION,
  AgentCard,
  Role,
  TaskState,
} from "@a2a-js/sdk";
import {
  ContentTypeNotSupportedError,
  TaskNotCancelableError,
  TaskNotFoundError,
} from "@a2a-js/sdk/errors";
import {
  AgentEvent,
  DefaultRequestHandler,
  JsonRpcTransportHandler,
} from "@a2a-js/sdk/server";
import {
  A2A_JWKS_PATH,
  createA2AAgentCardSigningConfiguration,
} from "./a2aAgentCardSigning.ts";
import { createA2ATaskStore } from "./a2aTaskStore.ts";
import { createA2AExecutionLeaseManager } from "./a2aExecutionLease.ts";
import { applyPromptEnhancement } from "./utils/chatUtils.js";

export const A2A_AGENT_CARD_PATH = "/.well-known/agent-card.json";
export const A2A_JSONRPC_PATH = "/a2a/jsonrpc";
export { A2A_JWKS_PATH };

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

class ContextAwareA2ARequestHandler extends DefaultRequestHandler {
  constructor(agentCard, taskStore, agentExecutor, ...rest) {
    super(agentCard, taskStore, agentExecutor, ...rest);
    this.contextAwareExecutor = agentExecutor;
  }

  async cancelTask(params, context) {
    if (
      typeof params?.id === "string"
      && params.id.trim()
      && this.contextAwareExecutor.supportsAtomicCancellation()
    ) {
      try {
        const eventBus = this.eventBusManager?.getByTaskId?.(params?.id);
        return await this.contextAwareExecutor.cancelTaskAtomically(
          params?.id,
          context,
          eventBus,
        );
      } catch (error) {
        if (error?.code === "A2A_TASK_STORE_NOT_FOUND") {
          throw new TaskNotFoundError(`Task not found: ${params?.id}`);
        }
        if (error?.code === "A2A_TASK_STORE_TERMINAL_IMMUTABLE") {
          throw new TaskNotCancelableError(`Task not cancelable: ${params?.id}`);
        }
        throw error;
      }
    }
    this.contextAwareExecutor.prepareCancellationContext(params?.id, context);
    try {
      return await super.cancelTask(params, context);
    } finally {
      this.contextAwareExecutor.clearCancellationContext(params?.id);
    }
  }
}

class GatewayAgentExecutor {
  /**
   * @param {object} gatewayService
   * @param {{execute: Function}|null} [workforceExecutor]
   * @param {object|null} [executionLeaseManager]
   * @param {object|null} [taskStoreControl]
   */
  constructor(
    gatewayService,
    workforceExecutor = null,
    executionLeaseManager = null,
    taskStoreControl = null,
  ) {
    this.gatewayService = gatewayService;
    this.workforceExecutor = workforceExecutor;
    this.executionLeaseManager = executionLeaseManager;
    this.taskStoreControl = taskStoreControl?.store ? taskStoreControl : null;
    this.taskStore = taskStoreControl?.store ?? taskStoreControl;
    this.cancelledTaskIds = new Set();
    this.taskContexts = new Map();
    this.activeLeases = new Map();
    this.cancellationContexts = new Map();
  }

  async execute(requestContext, eventBus) {
    const { contextId, taskId, userMessage } = requestContext;
    const executionScope = readExecutionScope(requestContext.context);
    let executionLease = null;
    let leaseHeartbeat = null;
    let terminalFenceBound = false;
    if (this.executionLeaseManager?.status?.enabled === true) {
      if (this.taskStoreControl?.status?.atomicTerminalFence === true) {
        const taskStoreHealth = await this.taskStoreControl.checkHealth();
        if (
          taskStoreHealth.available !== true
          || this.executionLeaseManager.status.atomicTerminalFence !== true
        ) {
          throw a2aExecutionLeaseError(
            "A2A_ATOMIC_TERMINAL_FENCE_UNAVAILABLE",
            "The atomic A2A terminal-fence boundary is unavailable.",
          );
        }
      }
      const acquired = await this.executionLeaseManager.acquire({
        taskId,
        scope: executionScope,
      });
      if (!acquired.success) {
        throw a2aExecutionLeaseError(acquired.code, acquired.reason);
      }
      executionLease = acquired.lease;
      this.activeLeases.set(taskId, { lease: executionLease, scope: executionScope });
      leaseHeartbeat = startExecutionLeaseHeartbeat(
        this.executionLeaseManager,
        executionLease,
      );
      if (this.taskStoreControl?.status?.atomicTerminalFence === true) {
        try {
          this.taskStoreControl.bindExecutionLease({
            taskId,
            scope: executionScope,
            lease: executionLease,
            finalize: async (committed) => {
              await leaseHeartbeat?.stop();
              if (!committed) {
                await this.executionLeaseManager.release(executionLease).catch(() => undefined);
              }
              this.activeLeases.delete(taskId);
              this.taskContexts.delete(taskId);
              this.cancelledTaskIds.delete(taskId);
            },
          });
          terminalFenceBound = true;
        } catch (error) {
          await leaseHeartbeat.stop();
          await this.executionLeaseManager.release(executionLease).catch(() => undefined);
          this.activeLeases.delete(taskId);
          throw error;
        }
      }
    }
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
          executionLease: this.executionLeaseManager?.status?.enabled === true
            ? "postgres-fenced"
            : "disabled",
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
        await leaseHeartbeat?.assertActive();
        const workforceResult = await this.workforceExecutor.execute({
          goal: input,
          autonomyMode: "dry-run",
          context: {
            source: "a2a-v1",
            taskId,
            contextId,
            ...(executionLease
              ? {
                  executionLease: {
                    mode: executionLease.mode,
                    fencingToken: executionLease.fencingToken,
                  },
                }
              : {}),
          },
        });

        if (this.cancelledTaskIds.has(taskId)) return;
        await leaseHeartbeat?.assertActive();

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

      await leaseHeartbeat?.assertActive();
      const result = await this.gatewayService.execute(gatewayInput);
      if (this.cancelledTaskIds.has(taskId)) return;
      await leaseHeartbeat?.assertActive();
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
      if (executionLease && terminalFenceBound) {
        this.taskStoreControl.markExecutionFinished(taskId, executionScope);
      } else {
        await leaseHeartbeat?.stop();
        if (executionLease) {
          await this.executionLeaseManager.release(executionLease).catch(() => undefined);
        }
        this.activeLeases.delete(taskId);
        this.taskContexts.delete(taskId);
        this.cancelledTaskIds.delete(taskId);
      }
    }
  }

  supportsAtomicCancellation() {
    return this.taskStoreControl?.status?.atomicTerminalFence === true;
  }

  async cancelTaskAtomically(taskId, context, eventBus) {
    if (!this.supportsAtomicCancellation()) {
      throw new Error("Atomic A2A cancellation is unavailable.");
    }
    const persistedTask = await this.taskStore.load(taskId, context);
    if (!persistedTask) {
      const error = new Error("The scoped A2A task was not found.");
      error.code = "A2A_TASK_STORE_NOT_FOUND";
      throw error;
    }
    const cancellationMessage = agentMessage({
      contextId: persistedTask.contextId,
      taskId,
      text: "Task cancellation requested by the A2A client.",
    });
    const cancellationStatus = status(
      TaskState.TASK_STATE_CANCELED,
      cancellationMessage,
    );
    this.cancelledTaskIds.add(taskId);
    const cancelledTask = await this.taskStoreControl.cancelTaskAtomically(
      taskId,
      context,
      cancellationStatus,
    );
    if (!cancelledTask) {
      const error = new Error("The scoped A2A task was not found.");
      error.code = "A2A_TASK_STORE_NOT_FOUND";
      throw error;
    }
    if (eventBus) {
      eventBus.publish(AgentEvent.statusUpdate({
        taskId,
        contextId: cancelledTask.contextId,
        status: cancelledTask.status,
        metadata: {},
      }));
      eventBus.finished?.();
    }
    this.taskContexts.delete(taskId);
    this.cancelledTaskIds.delete(taskId);
    return cancelledTask;
  }

  prepareCancellationContext(taskId, context) {
    if (typeof taskId === "string" && taskId) {
      this.cancellationContexts.set(taskId, context);
    }
  }

  clearCancellationContext(taskId) {
    if (typeof taskId === "string" && taskId) {
      this.cancellationContexts.delete(taskId);
    }
  }

  async cancelTask(taskId, eventBus) {
    this.cancelledTaskIds.add(taskId);
    const callContext = this.cancellationContexts.get(taskId);
    const localLease = this.activeLeases.get(taskId);
    const scope = localLease?.scope ?? (callContext ? readExecutionScope(callContext) : null);
    if (this.executionLeaseManager?.status?.enabled === true && scope) {
      const revoked = await this.executionLeaseManager.revokeForTask({
        taskId,
        scope,
        reason: "A2A client cancellation",
      });
      if (!revoked.success) {
        throw a2aExecutionLeaseError(
          "A2A_EXECUTION_LEASE_UNAVAILABLE",
          "The A2A execution lease could not be revoked safely.",
        );
      }
    }
    let contextId = this.taskContexts.get(taskId);
    if (!contextId && callContext && this.taskStore?.load) {
      const persistedTask = await this.taskStore.load(taskId, callContext);
      contextId = persistedTask?.contextId;
    }
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
  const agentCardSigning = createA2AAgentCardSigningConfiguration({ env, publicBaseUrl });
  const taskStoreHandle = createA2ATaskStore({
    env,
    integratedExecutionBoundary: true,
  });
  let executionLeaseManager;
  try {
    executionLeaseManager = createA2AExecutionLeaseManager({
      env,
      issueGuard: taskStoreHandle.issueGuard,
    });
  } catch (error) {
    void taskStoreHandle.close();
    throw error;
  }
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
    version: "0.5.0",
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
  const agentExecutor = new GatewayAgentExecutor(
    gatewayService,
    workforceExecutor,
    executionLeaseManager,
    taskStoreHandle,
  );
  const requestHandler = new ContextAwareA2ARequestHandler(
    agentCard,
    taskStoreHandle.store,
    agentExecutor,
    undefined,
    undefined,
    undefined,
    undefined,
    agentCardSigning.signer ?? undefined,
  );
  const unsignedAgentCardJson = AgentCard.toJSON(agentCard);
  let signedAgentCardJsonPromise;
  return {
    agentCard,
    // Retain the synchronous unsigned shape for source compatibility. HTTP
    // discovery and the SDK request handler use getAgentCardJson()/the signer.
    agentCardJson: unsignedAgentCardJson,
    agentCardJwks: agentCardSigning.jwks,
    agentCardSigning: Object.freeze({
      configured: agentCardSigning.configured,
      required: agentCardSigning.required,
      keyId: agentCardSigning.keyId,
      jwksUrl: agentCardSigning.jwksUrl,
    }),
    taskStore: taskStoreHandle.store,
    taskStoreStatus: taskStoreHandle.status,
    getTaskStoreHealth() {
      const taskStoreHealth = taskStoreHandle.getHealth();
      const executionLease = executionLeaseManager.getHealth();
      return combineA2AHealth(taskStoreHealth, executionLease);
    },
    async checkTaskStoreHealth() {
      const [taskStoreHealth, executionLease] = await Promise.all([
        taskStoreHandle.checkHealth(),
        executionLeaseManager.checkHealth(),
      ]);
      return combineA2AHealth(taskStoreHealth, executionLease);
    },
    async getAgentCardJson() {
      if (!agentCardSigning.signer) return unsignedAgentCardJson;
      signedAgentCardJsonPromise ??= agentCardSigning.signer(agentCard)
        .then((signedCard) => AgentCard.toJSON(signedCard));
      return signedAgentCardJsonPromise;
    },
    publicBaseUrl,
    requestHandler,
    transportHandler: new JsonRpcTransportHandler(requestHandler),
    async close() {
      await Promise.allSettled([
        taskStoreHandle.close(),
        executionLeaseManager.close(),
      ]);
    },
  };
}

function hasServerPermission(requestContext, permission) {
  const permissions = requestContext?.context?.user?.permissions;
  return Array.isArray(permissions)
    && (permissions.includes("*") || permissions.includes(permission));
}

function combineA2AHealth(taskStoreHealth, executionLease) {
  const leaseUnavailable = executionLease.required && executionLease.available !== true;
  const atomicTerminalFenceUnavailable = taskStoreHealth.distributed === true
    && (
      taskStoreHealth.atomicTerminalFence !== true
      || executionLease.atomicTerminalFence !== true
    );
  return {
    ...taskStoreHealth,
    available: taskStoreHealth.available === true
      && !leaseUnavailable
      && !atomicTerminalFenceUnavailable,
    reason: leaseUnavailable
      ? "execution_lease_unavailable"
      : atomicTerminalFenceUnavailable
        ? "atomic_terminal_fence_unavailable"
        : taskStoreHealth.reason,
    executionLease,
  };
}

function readExecutionScope(context) {
  return {
    tenant: String(context?.tenant || "default"),
    owner: String(context?.user?.userName || "unknown"),
  };
}

function a2aExecutionLeaseError(code, message) {
  const normalizedCode = String(code || "A2A_EXECUTION_LEASE_UNAVAILABLE");
  return Object.assign(new Error(message), {
    code: normalizedCode,
    category: "concurrency",
    retryable: normalizedCode !== "A2A_EXECUTION_TASK_TERMINAL",
  });
}

function startExecutionLeaseHeartbeat(manager, lease) {
  let stopped = false;
  let lost = false;
  let pending = Promise.resolve();
  const renew = () => {
    pending = pending.then(async () => {
      if (stopped || lost) return;
      try {
        const result = await manager.renew(lease);
        if (!result.success) lost = true;
      } catch {
        lost = true;
      }
    });
  };
  const timer = setInterval(renew, manager.status.heartbeatMs);
  timer.unref?.();
  return {
    async assertActive() {
      await pending;
      if (lost) throw lostExecutionLease();
      const result = await manager.validate(lease);
      if (!result.success) {
        lost = true;
        throw lostExecutionLease();
      }
    },
    async stop() {
      stopped = true;
      clearInterval(timer);
      await pending;
    },
  };
}

function lostExecutionLease() {
  return a2aExecutionLeaseError(
    "A2A_EXECUTION_LEASE_LOST",
    "The A2A execution lease was lost before the result could be committed.",
  );
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
  ContextAwareA2ARequestHandler,
  GatewayAgentExecutor,
  a2aExecutionLeaseError,
  agentMessage,
  hasServerPermission,
  normalizePublicBaseUrl,
  readExecutionScope,
  readTextMessage,
  status,
  startExecutionLeaseHeartbeat,
  textPart,
};
