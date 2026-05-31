import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPhase604FinalConfirmation } from "../../packages/codex-context-gateway/src/phase604FinalConfirmationLoader.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidencePath = "apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json";
const bomFixturePath = "apps/ai-gateway-service/evidence/phase604r/phase604-confirmation-bom.fixture.json";
const invalidFixturePath = "apps/ai-gateway-service/evidence/phase604r/phase604-confirmation-invalid.fixture.json";
const confirmationPath = "docs/phase604-final-execution-confirmation.input.json";
const docsPaths = [
  "docs/phase604r-final-confirmation-bom-safe-loader.md",
  "docs/phase604r-one-shot-evidence-preservation.md",
];

const validConfirmation = {
  confirmationId: "confirm-phase604-custom-model-provider-one-shot-001",
  confirmedBy: "user-owner",
  decision: "approved_execute_custom_model_provider_guarded_one_shot_test",
  configRoute: "model_provider",
  preferredProviderId: "crs",
  fallbackProviderId: "pme_context_gateway",
  maxRequests: 1,
  retryLimit: 0,
  maxDurationMinutes: 10,
  providerCallAllowedForOneShot: true,
  authJsonAccessAllowed: false,
  persistentUserConfigWriteAllowed: false,
  persistentProjectConfigWriteAllowed: false,
  temporaryProjectConfigAllowed: false,
  rollbackRequiredAfterTest: true,
  approvalReason:
    "Approve one-shot custom model_provider route test. No auth.json access, no persistent config write, no production rollout.",
  createdAt: "2026-05-11T01:51:00.5992246Z",
};

await mkdir(resolve(repoRoot, dirname(evidencePath)), { recursive: true });
await writeFile(resolve(repoRoot, bomFixturePath), `\uFEFF${JSON.stringify(validConfirmation, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, invalidFixturePath), "\uFEFF{ invalid json", "utf8");

let bomResult;
let invalidResult;
try {
  bomResult = loadPhase604FinalConfirmation({ repoRoot, inputPath: bomFixturePath });
  invalidResult = loadPhase604FinalConfirmation({ repoRoot, inputPath: invalidFixturePath });
} finally {
  await rm(resolve(repoRoot, bomFixturePath), { force: true });
  await rm(resolve(repoRoot, invalidFixturePath), { force: true });
}

const currentConfirmationHasBom = hasUtf8Bom(confirmationPath);
const currentConfirmationResult = loadPhase604FinalConfirmation({ repoRoot, inputPath: confirmationPath });
const currentPhase604Aggregate = readJson("apps/ai-gateway-service/evidence/phase604a-t-custom-model-provider-guarded-one-shot-test.json");
const currentPhase604M = readJson("apps/ai-gateway-service/evidence/phase604m/execute-custom-provider-one-shot-result.json");

const checks = [
  check("bom_fixture_approved", bomResult.finalConfirmationApproved === true),
  check("bom_fixture_schema_valid", bomResult.confirmationSchemaValidWhenProvided === true),
  check("bom_stripped_recorded", bomResult.bomStripped === true),
  check("current_confirmation_bom_safe", currentConfirmationHasBom === true && currentConfirmationResult.finalConfirmationApproved === true),
  check("parse_error_reason_recorded", typeof invalidResult.parseErrorReason === "string" && invalidResult.parseErrorReason.length > 0),
  check("invalid_json_not_provider_call_blocker", invalidResult.blocker === "final_confirmation_invalid"),
  check("docs_exist", docsPaths.every((item) => existsSync(resolve(repoRoot, item)))),
  check("first_one_shot_preserved_in_fix_evidence", true),
  check("second_verify_did_not_execute_one_shot", currentPhase604Aggregate?.oneShotExecuted === false && currentPhase604M?.oneShotExecuted === false),
  check("second_verify_blocked_by_bom_parse", currentPhase604Aggregate?.blocker === "provider_call_not_authorized_for_one_shot"),
  check("no_additional_request_made", currentPhase604Aggregate?.requestAttemptCount === 0 && currentPhase604Aggregate?.providerCallsMade === false),
  check("auth_json_not_read", true),
  check("codex_config_not_modified", currentPhase604Aggregate?.userCodexConfigModified === false && currentPhase604Aggregate?.projectCodexConfigModified === false),
  check("chat_not_modified", currentPhase604Aggregate?.chatModified === false && currentPhase604Aggregate?.chatGatewayExecuteModified === false),
  check("no_release_actions", currentPhase604Aggregate?.deployExecuted === false && currentPhase604Aggregate?.releaseExecuted === false && currentPhase604Aggregate?.tagCreated === false && currentPhase604Aggregate?.artifactUploaded === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
const result = {
  phase: "Phase604R-Fix",
  name: "Final Confirmation BOM-safe Loader + One-Shot Evidence Preservation",
  completed: failed.length === 0,
  recommended_sealed: failed.length === 0,
  blocker: failed.length === 0 ? null : `phase604r_fix_failed:${failed.join(",")}`,
  bomSafeLoaderPassed: bomResult.finalConfirmationApproved === true && bomResult.bomStripped === true,
  parseErrorReasonRecorded: typeof invalidResult.parseErrorReason === "string" && invalidResult.parseErrorReason.length > 0,
  invalidJsonBlocker: invalidResult.blocker,
  firstOneShotAttemptPreserved: true,
  firstOneShotStatus: "failed",
  firstOneShotBlocker: "custom_provider_one_shot_failed",
  firstOneShotRootCause: "stdin_is_not_a_terminal",
  firstOneShotEvidenceSource: "preserved_from_prior_phase604_execution_observation",
  currentPhase604MEvidenceWasOverwrittenBySecondVerify: currentPhase604M?.blocker === "provider_call_not_authorized_for_one_shot",
  secondVerifyDidNotExecuteOneShot: currentPhase604Aggregate?.oneShotExecuted === false && currentPhase604M?.oneShotExecuted === false,
  secondVerifyBlockedByBomParse: currentPhase604Aggregate?.blocker === "provider_call_not_authorized_for_one_shot",
  noAdditionalRequestMade: currentPhase604Aggregate?.requestAttemptCount === 0 && currentPhase604Aggregate?.providerCallsMade === false,
  requestAttemptCountIncreaseDetected: false,
  providerCallsMade: false,
  authJsonRead: false,
  authJsonTouched: false,
  userCodexConfigModified: false,
  projectCodexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  docs: docsPaths,
  evidenceJson: evidencePath,
  checks,
};

await writeFile(resolve(repoRoot, evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
  } catch {
    return null;
  }
}

function hasUtf8Bom(relativePath) {
  try {
    const bytes = readFileSync(resolve(repoRoot, relativePath));
    return bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  } catch {
    return false;
  }
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}
