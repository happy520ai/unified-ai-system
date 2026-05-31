import { writeJson } from "../phase373-common.mjs";

const matrix = {
  chat_normal: "view",
  run_god_mode_dry_run: "dry_run",
  run_tianshu_planner_dry_run: "dry_run",
  inspect_evidence: "view",
  replay_trace: "view",
  red_team_test_dry_run: "dry_run",
  configure_provider_reference: "approval_required",
  view_credential_ref_status: "view",
  request_approval: "approval_required",
  generate_command_ref_draft: "approval_required",
  deploy: "blocked",
  release: "blocked",
  create_tag: "blocked",
  upload_artifact: "blocked",
  read_secret: "blocked",
  call_unconfigured_provider: "blocked",
  generate_real_invoice: "blocked",
};

const mustBlock = ["deploy", "release", "create_tag", "upload_artifact", "read_secret", "call_unconfigured_provider", "generate_real_invoice"];
const validationErrors = mustBlock.filter((action) => matrix[action] !== "blocked").map((action) => `${action} must be blocked`);

const result = {
  phase: "Phase375B",
  actionPermissionMatrixValidationExecuted: true,
  validationPassed: validationErrors.length === 0,
  validationErrors,
  blockedActions: mustBlock,
  directExecutionEntryCreated: false,
};

await writeJson("docs/phase375b-action-permission-matrix.json", matrix);
await writeJson("apps/ai-gateway-service/evidence/phase375b/action-permission-matrix-validation-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
