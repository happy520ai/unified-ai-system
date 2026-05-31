import { parentPort, workerData } from "node:worker_threads";

const ALLOWED_TASK_TYPE = "mock-hard-timeout";

if (workerData?.taskType !== ALLOWED_TASK_TYPE || workerData?.mode !== "fixed-mock-task") {
  throw new TypeError("Only the fixed mock-hard-timeout worker task is allowed.");
}

parentPort?.postMessage({
  event: "mock-worker-started",
  taskType: workerData.taskType,
});

parentPort?.postMessage({
  event: "mock-worker-holding",
  taskType: workerData.taskType,
});

setInterval(() => {}, 1000);
