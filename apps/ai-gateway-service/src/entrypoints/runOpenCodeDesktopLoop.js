import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { printJson } from "./opencodeLoopShared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const statusPath = resolve(__dirname, "opencodeDesktopStatus.js");
const sendPath = resolve(__dirname, "sendOpenCodeDesktopTask.js");
const ingestPath = resolve(__dirname, "ingestOpenCodeDesktopResult.js");
const reviewPath = resolve(__dirname, "reviewOpenCodeDesktopResult.js");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const statusBefore = await runNodeJson(statusPath, []);

  if (options.mode === "dry-run") {
    const sendDryRun = await runNodeJson(sendPath, ["--dry-run"]);
    printJson({
      status: "loop-dry-run",
      mode: "controlled-opencode-loop-dry-run",
      statusBefore,
      sendDryRun,
      ingested: false,
      reviewed: false,
      providerCalledByThisProcess: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
    });
    return;
  }

  if (!options.send || !options.confirmSend) {
    throw new Error("Full OpenCode controlled loop requires both --send and --confirm-send.");
  }

  const sendResult = await runNodeJson(sendPath, ["--send", "--confirm-send"]);
  const ingestResult = await runNodeJson(ingestPath, ["--from-db-latest"]);
  const reviewResult = await runNodeJson(reviewPath, []);
  const statusAfter = await runNodeJson(statusPath, []);

  printJson({
    status: "sent-ingested-reviewed",
    mode: "controlled-opencode-loop",
    statusBefore,
    sendResult,
    ingestResult,
    reviewResult,
    statusAfter,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

function parseArgs(args) {
  const options = {
    mode: "dry-run",
    send: false,
    confirmSend: false,
  };
  for (const arg of args) {
    if (arg === "--dry-run") options.mode = "dry-run";
    else if (arg === "--send") {
      options.mode = "send";
      options.send = true;
    } else if (arg === "--confirm-send") {
      options.confirmSend = true;
    } else if (arg !== "--") {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function runNodeJson(scriptPath, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr || `Node exited with code ${code}`));
        return;
      }
      const jsonStart = stdout.indexOf("{");
      resolvePromise(JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout));
    });
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
