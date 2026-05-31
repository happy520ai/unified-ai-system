import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  loadPhase631Evidence,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  doc: "docs/phase632g-token-saving-mandatory-gate-chain-closure.md",
  report: "docs/phase632a-g-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase632g/token-saving-mandatory-gate-chain-closure-result.json",
  phase632a: "apps/ai-gateway-service/evidence/phase632a/context-pack-mandatory-gate-result.json",
  phase632b: "apps/ai-gateway-service/evidence/phase632b/relevant-files-mandatory-gate-result.json",
  phase632c: "apps/ai-gateway-service/evidence/phase632c/token-budget-mandatory-gate-result.json",
  phase632d: "apps/ai-gateway-service/evidence/phase632d/stale-gate-mandatory-gate-result.json",
  phase632e: "apps/ai-gateway-service/evidence/phase632e/forbidden-full-repo-scan-gate-result.json",
  phase632f: "apps/ai-gateway-service/evidence/phase632f/output-budget-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const reportText = readText(paths.report);
const docsText = `${docText}\n${reportText}`;
const phase631 = loadPhase631Evidence();
const phase632a = readJson(paths.phase632a);
const phase632b = readJson(paths.phase632b);
const phase632c = readJson(paths.phase632c);
const phase632d = readJson(paths.phase632d);
const phase632e = readJson(paths.phase632e);
const phase632f = readJson(paths.phase632f);

const subphaseEvidence = [phase632a, phase632b, phase632c, phase632d, phase632e, phase632f];
const subphasePass = subphaseEvidence.every(
  (item) =>
    item.exists === true &&
    !item.parseErrorReason &&
    item.data?.completed === true &&
    item.data?.recommended_sealed === true &&
    item.data?.blocker === null,
);

const result = {
  phase: "Phase632A-G",
  name: "Codex Token Saving Mandatory Gate Chain",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  phase632aCompleted: phase632a.data?.completed === true,
  phase632bCompleted: phase632b.data?.completed === true,
  phase632cCompleted: phase632c.data?.completed === true,
  phase632dCompleted: phase632d.data?.completed === true,
  phase632eCompleted: phase632e.data?.completed === true,
  phase632fCompleted: phase632f.data?.completed === true,
  aggregateClosureGenerated: Boolean(docText),
  executionReportGenerated: Boolean(reportText),
  allMandatoryGatesSealed: subphasePass,
  mandatoryGateChainSealed: has(docText, "mandatoryGateChainSealed=true"),
  contextPackGateRequired: has(docText, "contextPackGateRequired=true"),
  relevantFilesGateRequired: has(docText, "relevantFilesGateRequired=true"),
  tokenBudgetGateRequired: has(docText, "tokenBudgetGateRequired=true"),
  staleGateRequired: has(docText, "staleGateRequired=true"),
  forbiddenFullRepoScanGateRequired: has(docText, "forbiddenFullRepoScanGateRequired=true"),
  outputBudgetGateRequired: has(docText, "outputBudgetGateRequired=true"),
  noCodexExecByThisPhase: has(docText, "codexExecExecutedByThisPhase=false"),
  noProviderCallsByThisPhase: has(docText, "providerCallsMadeByThisPhase=false"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  docs: [
    "docs/phase632a-context-pack-mandatory-gate.md",
    "docs/phase632b-relevant-files-mandatory-gate.md",
    "docs/phase632c-token-budget-mandatory-gate.md",
    "docs/phase632d-stale-gate-mandatory-gate.md",
    "docs/phase632e-forbidden-full-repo-scan-gate.md",
    "docs/phase632f-output-budget-mandatory-gate.md",
    paths.doc,
    paths.report,
  ],
  evidence: {
    phase632a: paths.phase632a,
    phase632b: paths.phase632b,
    phase632c: paths.phase632c,
    phase632d: paths.phase632d,
    phase632e: paths.phase632e,
    phase632f: paths.phase632f,
    aggregate: paths.evidence,
  },
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("phase632a_completed", result.phase632aCompleted),
  check("phase632b_completed", result.phase632bCompleted),
  check("phase632c_completed", result.phase632cCompleted),
  check("phase632d_completed", result.phase632dCompleted),
  check("phase632e_completed", result.phase632eCompleted),
  check("phase632f_completed", result.phase632fCompleted),
  check("aggregate_closure_generated", result.aggregateClosureGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("all_mandatory_gates_sealed", result.allMandatoryGatesSealed),
  check("mandatory_gate_chain_sealed", result.mandatoryGateChainSealed),
  check("context_pack_gate_required", result.contextPackGateRequired),
  check("relevant_files_gate_required", result.relevantFilesGateRequired),
  check("token_budget_gate_required", result.tokenBudgetGateRequired),
  check("stale_gate_required", result.staleGateRequired),
  check("forbidden_full_repo_scan_gate_required", result.forbiddenFullRepoScanGateRequired),
  check("output_budget_gate_required", result.outputBudgetGateRequired),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632g_token_saving_mandatory_gate_chain_closure_failed");
