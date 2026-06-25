import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DISABLED_ACTIONS,
  READ_ONLY_TOOL_NAMES,
  createReadOnlyLocalAgentRunner,
} from "../agent-runner/readOnlyLocalAgentRunner.js";
import {
  ALLOWED_TASK_ACTIONS,
  BLOCKED_TASK_ACTIONS,
  READ_ONLY_LOCAL_AGENT_TASK_SCHEMA,
} from "../agent-runner/localAgentTaskSchema.js";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");

const scriptName = "verify:phase296a-read-only-local-agent-runner";
const docsPath = resolve(repoRoot, "docs/READ_ONLY_LOCAL_AGENT_RUNNER.md");
const runnerPath = resolve(serviceRoot, "src/agent-runner/readOnlyLocalAgentRunner.js");
const schemaPath = resolve(serviceRoot, "src/agent-runner/localAgentTaskSchema.js");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-296a-read-only-local-agent-runner.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-296a-read-only-local-agent-runner.md");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");

const requiredMarkers = [
  "## A. Phase296A 目标和边界",
  "## B. 上游 Phase294A / Phase295A 依赖",
  "## C. 只读 Runner 允许工具",
  "## D. 明确禁止的能力",
  "## E. 路径与 secrets 边界",
  "## F. Permission Mode Gate 继承规则",
  "## G. Task Schema 约束",
  "## H. HTTP / UI Preview 边界",
  "## I. Verifier 检查项",
  "## J. 不可声称能力",
  "## K. 验证命令",
  "## L. Phase297A 前置条件说明",
];

const requiredEvidenceContract = {
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  writePerformed: false,
  applyPatchPerformed: false,
  deletePerformed: false,
  dangerousCommandExecuted: false,
  realCodexExecCalled: false,
  workflowRunnerCalled: false,
  worktreeCreated: false,
  legacyModified: false,
  projectContextCreated: false,
  envReadAttempted: false,
  defaultNvidiaChatChanged: false,
  routeAdded: false,
  uiPreviewAdded: false,
};

function fail(message) {
  console.error("[Phase296A verifier] FAIL: " + message);
  process.exit(1);
}


for (const requiredPath of [
  docsPath,
  runnerPath,
  schemaPath,
  evidenceJsonPath,
  evidenceMdPath,
  rootPackagePath,
  servicePackagePath,
]) {
  if (!existsSync(requiredPath)) {
    fail("Missing required file: " + requiredPath);
  }
}

const docsText = readFileSync(docsPath, "utf8");
for (const marker of requiredMarkers) {
  if (!docsText.includes(marker)) {
    fail("Document missing marker: " + marker);
  }
}

const runnerSource = readFileSync(runnerPath, "utf8");
if (!runnerSource.includes('./permissionModePolicy.js')) {
  fail("readOnlyLocalAgentRunner.js must reference permissionModePolicy.js");
}

const runner = createReadOnlyLocalAgentRunner({ mode: "manual" });

for (const toolName of READ_ONLY_TOOL_NAMES) {
  if (typeof runner[toolName] !== "function") {
    fail("Runner missing allowed tool: " + toolName);
  }
}

for (const blockedMethod of ["writeFile", "applyPatch", "deleteFile", "runCommand"]) {
  if (runner[blockedMethod] !== undefined && runner.disabledActions?.[blockedMethod] !== false) {
    fail("Blocked method must be absent or explicitly disabled: " + blockedMethod);
  }
  if (DISABLED_ACTIONS[blockedMethod] !== false) {
    fail("Disabled action flag must be false: " + blockedMethod);
  }
}

if (!READ_ONLY_LOCAL_AGENT_TASK_SCHEMA || READ_ONLY_LOCAL_AGENT_TASK_SCHEMA.writeEnabled !== false) {
  fail("Task schema must keep writeEnabled=false.");
}

if (READ_ONLY_LOCAL_AGENT_TASK_SCHEMA.patchApplyEnabled !== false) {
  fail("Task schema must keep patchApplyEnabled=false.");
}

if (READ_ONLY_LOCAL_AGENT_TASK_SCHEMA.dangerousCommandExecutionEnabled !== false) {
  fail("Task schema must keep dangerousCommandExecutionEnabled=false.");
}

for (const action of [
  "list_dir",
  "read_text_file",
  "search_text",
  "read_package_scripts",
  "git_status_readonly",
  "build_context_summary",
  "propose_plan",
]) {
  if (!ALLOWED_TASK_ACTIONS.includes(action)) {
    fail("Schema missing allowed action: " + action);
  }
}

for (const action of ["write_file", "apply_patch", "delete_file", "run_command"]) {
  if (!BLOCKED_TASK_ACTIONS.includes(action)) {
    fail("Schema missing blocked action: " + action);
  }
}

const rootPackageJson = readJson(rootPackagePath);
const servicePackageJson = readJson(servicePackagePath);

if (!rootPackageJson?.scripts?.[scriptName]) {
  fail("Root package.json missing script: " + scriptName);
}

if (!servicePackageJson?.scripts?.[scriptName]) {
  fail("Service package.json missing script: " + scriptName);
}

const evidence = readJson(evidenceJsonPath);

if (evidence.phase !== "296A") {
  fail("Evidence phase must be 296A.");
}

if (evidence.name !== "Read-only Local Agent Runner") {
  fail("Evidence name mismatch.");
}

if (evidence.status !== "pass") {
  fail("Evidence status must be pass.");
}

for (const [key, value] of Object.entries(requiredEvidenceContract)) {
  if (evidence[key] !== value) {
    fail("Evidence field must match contract: " + key);
  }
}

console.log("[Phase296A verifier] PASS");
console.log(JSON.stringify({
  phase: "296A",
  status: "pass",
  scriptName,
  toolCount: READ_ONLY_TOOL_NAMES.length,
  blockedActionCount: Object.keys(DISABLED_ACTIONS).length,
  supportedModes: READ_ONLY_LOCAL_AGENT_TASK_SCHEMA.supportedModes,
  routeAdded: evidence.routeAdded,
  uiPreviewAdded: evidence.uiPreviewAdded,
}, null, 2));
