import { Worker } from "node:worker_threads";
import { contentAddress } from "./contentAddress.js";

const DEFAULT_TIMEOUT_MS = 50;
const ALLOWED_TASK_TYPES = new Set(["mock-hard-timeout"]);

export async function runWorkerIsolationDryRun(options = {}) {
  const taskType = requireAllowedTaskType(options.taskType ?? "mock-hard-timeout");
  const timeoutMs = requirePositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs");
  const transcript = [];
  let sequence = 0;
  let timeoutReached = false;
  let terminateRequested = false;
  let workerTerminated = false;
  let workerExitCode = null;

  const record = (event, details = {}) => {
    transcript.push(Object.freeze({
      sequence: sequence += 1,
      event,
      ...details,
    }));
  };

  record("main-thread-started", { taskType, timeoutMs });

  const worker = new Worker(new URL("./mockWorkerTask.js", import.meta.url), {
    workerData: {
      taskType,
      mode: "fixed-mock-task",
    },
  });

  worker.on("message", (message) => {
    if (message?.event === "mock-worker-started") {
      record("worker-started", { workerTaskType: message.taskType });
    }
    if (message?.event === "mock-worker-holding") {
      record("worker-holding", { workerTaskType: message.taskType });
    }
  });

  worker.on("error", (error) => {
    record("worker-error", { name: error.name });
  });

  const exitPromise = new Promise((resolve) => {
    worker.once("exit", (code) => {
      workerExitCode = code;
      workerTerminated = true;
      record("worker-terminated", { exitCode: code });
      resolve(code);
    });
  });

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  await timeoutPromise;
  timeoutReached = true;
  record("hard-timeout-reached");

  terminateRequested = true;
  record("terminate-requested");
  await worker.terminate();
  await exitPromise;

  await new Promise((resolve) => {
    setImmediate(resolve);
  });
  record("main-thread-survived");

  const frozenTranscript = Object.freeze(transcript.map((entry) => Object.freeze({ ...entry })));

  return Object.freeze({
    phase: "Phase1312A",
    status: timeoutReached && terminateRequested && workerTerminated ? "dry-run-pass" : "dry-run-blocked",
    taskType,
    timeoutMs,
    workerTimeoutTerminates: timeoutReached && terminateRequested && workerTerminated,
    mainThreadSurvives: true,
    executionTranscriptWritten: frozenTranscript.length > 0,
    executionTranscript: frozenTranscript,
    transcriptAddress: contentAddress(frozenTranscript),
    workerExitCode,
    mockWorkerOnly: true,
    userCodeExecuted: false,
    realModelExecuted: false,
    trainingExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    networkUsed: false,
    mainChainIntegrated: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  });
}

function requireAllowedTaskType(taskType) {
  if (!ALLOWED_TASK_TYPES.has(taskType)) {
    throw new TypeError("taskType must be the fixed mock-hard-timeout task.");
  }
  return taskType;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer.`);
  }
  return value;
}
