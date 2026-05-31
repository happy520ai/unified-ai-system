import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

const stateFile = path.join(repoRoot, "docs/project-brain/opencode-autopilot-state.json");
const latestRunFile = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase3979a-opencode-autopilot-governor/latest-run.json");

const state = existsSync(stateFile) ? readJson(stateFile) : null;
const latestRun = existsSync(latestRunFile) ? readJson(latestRunFile) : null;

console.log(
  JSON.stringify(
    {
      phaseId: "Phase3979A-OpenCode-Autopilot-Governor",
      stateFound: state !== null,
      latestRunFound: latestRun !== null,
      status: state?.status || "missing",
      roundsCompleted: state?.roundsCompleted || 0,
      currentTaskId: state?.currentTaskId || null,
      nextTaskId: state?.nextTaskId || null,
      lastBlocker: state?.lastBlocker || null,
      resumeReady: state?.resumeReady === true,
      lastReportPath: state?.lastReportPath || null,
      latestRunStatus: latestRun?.status || null,
      latestRunBlocker: latestRun?.blocker || null,
      workspaceCleanClaimed: false
    },
    null,
    2
  )
);
