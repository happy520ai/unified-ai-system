import { spawnSync } from "node:child_process";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1938p/continuous-safety-regression-gate-result.json";
const commands = [
  ["cmd", "/c", "pnpm verify:phase107a-secret-safety"],
  ["cmd", "/c", "pnpm verify:phase321a-workbench-product-recovery"],
  ["cmd", "/c", "pnpm smoke:phase308a-desktop-workbench-ui"],
  ["cmd", "/c", "pnpm -r --if-present check"],
];

const commandResults = commands.map((command) => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return {
    command: command.join(" "),
    exitCode: result.status,
    passed: result.status === 0,
    startedAt,
    completedAt: new Date().toISOString(),
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  };
});

const passed = commandResults.every((item) => item.passed);
const evidence = {
  phase: "Phase1938P",
  name: "Continuous Safety Regression Gate",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "continuous_safety_regression_failed",
  regressionsPassed: passed,
  commandResults,
  providerCallsMadeThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
};

writeJson(resultPath, evidence);
console.log(JSON.stringify(evidence, null, 2));

if (!passed) {
  process.exitCode = 1;
}

function tail(value) {
  const lines = String(value ?? "").split(/\r?\n/u).filter(Boolean);
  return lines.slice(-20).join("\n");
}
