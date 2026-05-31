import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCodexDesktopStatus } from "./codexDesktopStatus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const senderPath = resolve(__dirname, "sendCodexDesktopTask.js");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const status = await readCodexDesktopStatus();

  if (options.mode === "dry-run") {
    const sendDryRun = await runNodeJson(senderPath, ["--dry-run"]);
    printJson({
      status: "loop-dry-run",
      mode: "controlled-desktop-loop-dry-run",
      desktopStatus: status,
      sendDryRun,
      copiedToClipboard: false,
      pastedToDesktop: false,
      sent: false,
      codexCliInvoked: false,
      codexExecInvoked: false,
      workflowRunnerEnabled: false,
      worktreeCreated: false,
      autoCommit: false,
      autoPush: false,
      recommendedNextAction: status.recommendedNextAction,
      note: "Dry-run only: status + send dry-run. It does not copy, paste, send, wait for Codex, ingest, review, commit, or push.",
    });
    return;
  }

  if (!options.send || !options.confirmSend) {
    throw new Error("Full controlled loop send mode requires both --send and --confirm-send.");
  }

  const sendResult = await runNodeJson(senderPath, ["--send", "--confirm-send"]);
  printJson({
    status: "loop-send-with-approval",
    mode: "controlled-desktop-loop-send-with-approval",
    desktopStatus: status,
    sendResult,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "Send-with-approval only sends the outbox task to Codex Desktop UI. It does not wait for output, ingest results, review automatically, commit, or push.",
  });
}

function parseArgs(args) {
  const options = {
    mode: "dry-run",
    send: false,
    confirmSend: false,
  };

  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--dry-run") {
      options.mode = "dry-run";
      continue;
    }
    if (arg === "--send") {
      options.mode = "send";
      options.send = true;
      continue;
    }
    if (arg === "--confirm-send") {
      options.confirmSend = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.confirmSend && !options.send) {
    throw new Error("--confirm-send is only valid with --send.");
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
      try {
        const jsonStart = stdout.indexOf("{");
        resolvePromise(JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout));
      } catch (error) {
        rejectPromise(new Error(`Could not parse child JSON output: ${error.message}\n${stdout}`));
      }
    });
  });
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
