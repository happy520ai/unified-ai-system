import { randomUUID } from "node:crypto";
import {
  A2A_PROTOCOL_VERSION,
  Role,
  TaskState,
} from "@a2a-js/sdk";
import {
  ClientFactory,
  DefaultAgentCardResolver,
} from "@a2a-js/sdk/client";

const baseUrl = (
  process.env.AI_GATEWAY_SERVICE_URL
  ?? process.env.AI_GATEWAY_BASE_URL
  ?? "http://127.0.0.1:3100"
).replace(/\/$/, "");

const resolver = new DefaultAgentCardResolver();
const agentCard = await resolver.resolve(baseUrl);
const client = await new ClientFactory().createFromAgentCard(agentCard);
const sent = await client.sendMessage({
  tenant: "",
  message: {
    messageId: randomUUID(),
    contextId: "",
    taskId: "",
    role: Role.ROLE_USER,
    parts: [
      {
        content: {
          $case: "text",
          value: "Official A2A SDK compatibility test",
        },
        mediaType: "text/plain",
        filename: "",
        metadata: {},
      },
    ],
    metadata: {},
    extensions: [],
    referenceTaskIds: [],
  },
  configuration: {
    acceptedOutputModes: ["text/plain"],
    taskPushNotificationConfig: undefined,
    returnImmediately: false,
  },
  metadata: {},
});

if (!("id" in sent)) throw new Error("A2A gateway did not return a Task.");
const task = await client.getTask({ tenant: "", id: sent.id });
const listed = await client.listTasks({
  tenant: "",
  contextId: task.contextId,
  status: TaskState.TASK_STATE_COMPLETED,
  pageSize: 10,
  pageToken: "",
  statusTimestampAfter: undefined,
  includeArtifacts: true,
});
const output = task.artifacts
  .flatMap((artifact) => artifact.parts)
  .filter((part) => part.content?.$case === "text")
  .map((part) => part.content.value)
  .join("");
const jsonRpcInterface = agentCard.supportedInterfaces.find(
  (item) => item.protocolBinding === "JSONRPC",
);
const checks = {
  discovery:
    agentCard.name === "Unified AI System Gateway Agent"
    && jsonRpcInterface?.protocolVersion === A2A_PROTOCOL_VERSION,
  taskCompleted:
    task.status?.state === TaskState.TASK_STATE_COMPLETED
    && task.id === sent.id,
  taskRetrieved:
    listed.tasks.some((candidate) => candidate.id === task.id),
  fakeProvider:
    task.artifacts[0]?.metadata?.selectedProvider === "local-fake-provider"
    && task.artifacts[0]?.metadata?.executionMode === "fake",
  output: output.includes("Official A2A SDK compatibility test"),
};
const result = {
  ok: Object.values(checks).every(Boolean),
  client: "@a2a-js/sdk",
  sdkVersion: "1.0.1",
  protocolVersion: jsonRpcInterface?.protocolVersion ?? null,
  transport: jsonRpcInterface?.protocolBinding ?? null,
  taskId: task.id,
  contextId: task.contextId,
  taskState: task.status?.state ?? null,
  checks,
  realProviderCallsMade: false,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 1;
