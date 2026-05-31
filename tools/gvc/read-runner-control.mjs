import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, "../..");

export const defaultRunnerControl = {
  paused: false,
  stopRequested: false,
  maxTasksPerLoop: 1,
  dryRunOnly: true,
  noProvider: true,
  noSecret: true,
  noDeploy: true,
};

export function runnerControlPath(repoRoot = defaultRepoRoot) {
  return path.join(repoRoot, "docs/project-brain/runner-control.json");
}

function assertBoolean(control, field, reasons) {
  if (typeof control[field] !== "boolean") {
    reasons.push(`${field}_must_be_boolean`);
  }
}

export function readRunnerControl(options = {}) {
  const repoRoot = options.repoRoot || defaultRepoRoot;
  const filePath = options.filePath || runnerControlPath(repoRoot);
  const reasons = [];
  let control = { ...defaultRunnerControl };
  let source = "default";

  if (existsSync(filePath)) {
    source = "file";
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      control = { ...defaultRunnerControl, ...parsed };
    } catch {
      reasons.push("runner_control_json_parse_failed");
    }
  } else {
    reasons.push("runner_control_missing_default_applied");
  }

  for (const field of ["paused", "stopRequested", "dryRunOnly", "noProvider", "noSecret", "noDeploy"]) {
    assertBoolean(control, field, reasons);
  }

  if (!Number.isInteger(control.maxTasksPerLoop) || control.maxTasksPerLoop < 0 || control.maxTasksPerLoop > 1) {
    reasons.push("maxTasksPerLoop_must_be_integer_between_0_and_1");
  }

  if (control.dryRunOnly !== true) reasons.push("dryRunOnly_must_remain_true");
  if (control.noProvider !== true) reasons.push("noProvider_must_remain_true");
  if (control.noSecret !== true) reasons.push("noSecret_must_remain_true");
  if (control.noDeploy !== true) reasons.push("noDeploy_must_remain_true");

  return {
    control,
    filePath,
    source,
    valid: reasons.length === 0,
    reasons,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const result = readRunnerControl({ repoRoot: defaultRepoRoot });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exit(1);
}
