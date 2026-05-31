import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  loadPhase631Evidence,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  doc: "docs/phase632f-output-budget-mandatory-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632f/output-budget-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();

const result = {
  phase: "Phase632F",
  name: "Output Budget Mandatory Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  outputBudgetMandatoryGateGenerated: Boolean(docText),
  outputBudgetRequired: has(docText, "outputBudgetRequired=true"),
  conciseOutputRequired: has(docText, "conciseOutputRequired=true"),
  longLogsForbidden: has(docText, "longLogsForbidden=true"),
  finalResponseBoundaryRequired: has(docText, "finalResponseBoundaryRequired=true"),
  mustReportModifiedFiles: has(docText, "mustReportModifiedFiles=true"),
  mustReportValidationCommands: has(docText, "mustReportValidationCommands=true"),
  mustReportBoundaryConfirmation: has(docText, "mustReportBoundaryConfirmation=true"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("output_budget_mandatory_gate_generated", result.outputBudgetMandatoryGateGenerated),
  check("output_budget_required", result.outputBudgetRequired),
  check("concise_output_required", result.conciseOutputRequired),
  check("long_logs_forbidden", result.longLogsForbidden),
  check("final_response_boundary_required", result.finalResponseBoundaryRequired),
  check("must_report_modified_files", result.mustReportModifiedFiles),
  check("must_report_validation_commands", result.mustReportValidationCommands),
  check("must_report_boundary_confirmation", result.mustReportBoundaryConfirmation),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632f_output_budget_mandatory_gate_failed");
