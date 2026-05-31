import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const scenariosPath = path.join(repoRoot, "docs", "phase327c-provider-setup-dry-run-scenarios.json");
const resultPath = path.join(repoRoot, "docs", "phase327c-provider-setup-dry-run-result.json");
const reportPath = path.join(repoRoot, "docs", "phase327c-provider-setup-dry-run-report.md");
const executionPath = path.join(repoRoot, "docs", "phase327c-execution-report.md");
const credentialSchemaPath = path.join(repoRoot, "docs", "phase327b-encrypted-credential-reference.schema.json");
const providerSchemaPath = path.join(repoRoot, "docs", "phase327b-provider-credential-config.schema.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function parseMode() {
  const args = new Set(process.argv.slice(2));
  const preview = args.has("--preview");
  const run = args.has("--run");
  assert(preview !== run, "Use exactly one of --preview or --run.");
  return preview ? "preview" : "run";
}

function validateScenario(scenario) {
  assert(scenario.runtimeStatus === "dry_run_without_provider_call", `${scenario.scenarioId} runtimeStatus mismatch`);
  assert(scenario.providerCallsAllowed === false, `${scenario.scenarioId} providerCallsAllowed must be false`);
  assert(scenario.nonNvidiaProviderCallsAllowed === false, `${scenario.scenarioId} nonNvidiaProviderCallsAllowed must be false`);
  assert(scenario.secretValueAllowed === false, `${scenario.scenarioId} secretValueAllowed must be false`);
}

function processScenario(scenario) {
  let setupDecision = "dry_run_reference_ready";
  let credentialRefValidation = "valid_reference";
  let providerEnablementDecision = "shadow_config_only";
  let modelLibraryVisibilityDecision = "provider_visible_with_guarded_badge";
  let selectableActivationDecision = "blocked_not_real_validation_stage";
  let rejectionReason = "";

  if (!scenario.credentialRef) {
    setupDecision = "rejected";
    credentialRefValidation = "missing_credential_ref";
    providerEnablementDecision = "disabled";
    modelLibraryVisibilityDecision = "provider_hidden_until_reference_present";
    selectableActivationDecision = "blocked_missing_credential_ref";
    rejectionReason = "missing_credential_ref";
  } else if (scenario.secretValueProvided) {
    setupDecision = "rejected";
    credentialRefValidation = "secret_value_rejected";
    providerEnablementDecision = "disabled";
    modelLibraryVisibilityDecision = "provider_hidden_secret_rejected";
    selectableActivationDecision = "blocked_secret_value_not_allowed";
    rejectionReason = "secret_value_not_allowed";
  } else if (scenario.expectedDecision === "real_call_blocked") {
    setupDecision = "rejected";
    credentialRefValidation = "reference_present_but_real_call_blocked";
    providerEnablementDecision = "shadow_config_only";
    modelLibraryVisibilityDecision = "provider_visible_with_real_call_block_notice";
    selectableActivationDecision = "blocked_real_call_not_allowed_in_dry_run";
    rejectionReason = "real_call_not_allowed_in_dry_run";
  } else if (scenario.expectedDecision === "provider_disabled") {
    setupDecision = "rejected";
    credentialRefValidation = "reference_present";
    providerEnablementDecision = "disabled";
    modelLibraryVisibilityDecision = "provider_disabled";
    selectableActivationDecision = "blocked_provider_disabled";
    rejectionReason = "provider_disabled";
  } else if (scenario.expectedDecision === "credential_revoked") {
    setupDecision = "rejected";
    credentialRefValidation = "credential_ref_revoked";
    providerEnablementDecision = "disabled";
    modelLibraryVisibilityDecision = "provider_hidden_revoked_reference";
    selectableActivationDecision = "blocked_revoked_credential_ref";
    rejectionReason = "credential_ref_revoked";
  }

  return {
    scenarioId: scenario.scenarioId,
    providerId: scenario.providerId,
    setupDecision,
    credentialRefValidation,
    providerEnablementDecision,
    modelLibraryVisibilityDecision,
    selectableActivationDecision,
    rejectionReason,
    auditTrace: {
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
      runtimeStage: "dry_run_without_provider_call",
      credentialRefOnly: true,
    },
  };
}

function renderReport(summary) {
  return [
    "# Phase327C Model Library Provider Setup Dry-run Report",
    "",
    "## Setup Flow",
    "",
    "1. Read provider setup dry-run scenarios.",
    "2. Validate credentialRef-only contract and shadow_config policy.",
    "3. Simulate provider setup and model library visibility decisions.",
    "4. Keep selectable activation blocked because this is not a real validation stage.",
    "",
    "## Provider Enablement Gate",
    "",
    "- provider runtime remains disabled",
    "- real provider calls remain blocked",
    "- user-owned provider entries may only appear as shadow_config candidates",
    "",
    "## CredentialRef Validation",
    "",
    "- reference required",
    "- secret values rejected",
    "- revoked references rejected",
    "",
    "## Why Selectable Activation Stays Blocked",
    "",
    "- Phase327C is dry_run_without_provider_call",
    "- guarded real call test has not been authorized",
    "- provider runtime is not enabled",
    "",
    "## Next-stage Preconditions",
    "",
    "- explicit guarded real call authorization",
    "- redacted secret storage implementation",
    "- provider validation runtime phase",
    "- audit and rollback flow",
    "",
    "## Rollback",
    "",
    "- Remove Phase327C docs and tool files only.",
    "- No runtime state rollback is required because no provider was called and no secret was stored.",
    "",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    `- providerCallsMade: ${summary.providerCallsMade}`,
    "",
  ].join("\n");
}

async function main() {
  const mode = parseMode();
  await readJson(credentialSchemaPath);
  await readJson(providerSchemaPath);
  const scenarioFile = await readJson(scenariosPath);
  const scenarios = scenarioFile.scenarios ?? [];
  for (const scenario of scenarios) validateScenario(scenario);
  if (mode === "preview") {
    console.log(JSON.stringify({
      phase: "Phase327C",
      mode: "preview",
      plannedScenarios: scenarios.map((scenario) => scenario.scenarioId),
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    }, null, 2));
    return;
  }
  const summary = {
    phase: "Phase327C",
    runtimeStatus: "dry_run_without_provider_call",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    scenariosProcessed: scenarios.length,
    results: scenarios.map(processScenario),
  };
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${renderReport(summary)}\n`, "utf8");
  await writeFile(executionPath, [
    "# Phase327C Execution Report",
    "",
    "- previewSupported: true",
    "- runExecuted: true",
    "- providerCallsMade: false",
    "- nonNvidiaProviderCallsMade: false",
    "- secretValueExposed: false",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    "",
  ].join("\n"), "utf8");
  console.log(JSON.stringify({
    phase: summary.phase,
    scenariosProcessed: summary.scenariosProcessed,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
