import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  exists,
  finalize,
  loadPreflightEvidence,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase644r-external-tool/open-source-dry-run-tool-pack-result.json";
const preflight = loadPreflightEvidence();
const packDoc = readText("docs/phase644r-external-tool-open-source-dry-run-tool-pack.md");
const quickstart = readText("docs/phase644r-external-tool-quickstart.md");
const knownLimits = readText("docs/phase644r-external-tool-known-limits.md");
const safety = readText("docs/phase644r-external-tool-safety-boundary.md");
const contributor = readText("docs/phase644r-external-tool-contributor-guide.md");
const report = readText("docs/phase644r-external-tool-execution-report.md");
const docsText = [packDoc, quickstart, knownLimits, safety, contributor, report].join("\n");

const result = {
  phase: "Phase644R-ExternalTool",
  name: "Open Source Dry-Run Tool Pack",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflight.data?.preflightPassed === true,
  openSourceDryRunToolPackGenerated: exists("docs/phase644r-external-tool-open-source-dry-run-tool-pack.md"),
  quickstartGenerated:
    quickstart.includes("cmd /c pnpm install") &&
    quickstart.includes("cmd /c pnpm run preflight:phase632-token-saving") &&
    quickstart.includes("cmd /c pnpm run codex:external-tool:preflight"),
  knownLimitsGenerated: knownLimits.includes("not a production traffic path"),
  safetyBoundaryGenerated: safety.includes("Phase632 preflight"),
  contributorGuideGenerated: contributor.includes("Do not commit API keys"),
  ...safetyBoundary(),
  docs: [
    "docs/phase644r-external-tool-open-source-dry-run-tool-pack.md",
    "docs/phase644r-external-tool-quickstart.md",
    "docs/phase644r-external-tool-known-limits.md",
    "docs/phase644r-external-tool-safety-boundary.md",
    "docs/phase644r-external-tool-contributor-guide.md",
    "docs/phase644r-external-tool-execution-report.md",
  ],
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("open_source_dry_run_tool_pack_generated", result.openSourceDryRunToolPackGenerated),
  check("quickstart_generated", result.quickstartGenerated),
  check("known_limits_generated", result.knownLimitsGenerated),
  check("safety_boundary_generated", result.safetyBoundaryGenerated),
  check("contributor_guide_generated", result.contributorGuideGenerated),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, evidencePath, "phase644r_external_tool_open_source_pack_failed");
