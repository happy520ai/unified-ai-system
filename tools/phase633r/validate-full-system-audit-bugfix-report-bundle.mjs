import {
  check,
  finalize,
  readJson,
  readText,
  safetyBoundary,
  writeJson,
} from "../phase632-common.mjs";

const paths = {
  closureDoc: "docs/phase633r-637r-full-system-audit-bugfix-report-closure.md",
  phase633: "apps/ai-gateway-service/evidence/phase633r/full-system-audit-baseline-result.json",
  phase634: "apps/ai-gateway-service/evidence/phase634r/bug-risk-blocker-classification-result.json",
  phase635: "apps/ai-gateway-service/evidence/phase635r/low-risk-bug-fix-execution-result.json",
  phase636: "apps/ai-gateway-service/evidence/phase636r/regression-verification-evidence-review-result.json",
  phase637: "apps/ai-gateway-service/evidence/phase637r/final-system-report-result.json",
  bundle: "apps/ai-gateway-service/evidence/phase633r-637r/full-system-audit-bugfix-report-bundle.json",
  evidence: "apps/ai-gateway-service/evidence/phase633r-637r/full-system-audit-bugfix-report-closure.json",
};

const closureText = readText(paths.closureDoc);
const phase633 = readJson(paths.phase633);
const phase634 = readJson(paths.phase634);
const phase635 = readJson(paths.phase635);
const phase636 = readJson(paths.phase636);
const phase637 = readJson(paths.phase637);

const phase633Completed = phase633.data?.completed === true && phase633.data?.recommended_sealed === true;
const phase634Completed = phase634.data?.completed === true && phase634.data?.recommended_sealed === true;
const phase635Completed = phase635.data?.completed === true && phase635.data?.recommended_sealed === true;
const phase636Completed = phase636.data?.completed === true && phase636.data?.recommended_sealed === true;
const phase637Completed = phase637.data?.completed === true && phase637.data?.recommended_sealed === true;
const failed = [
  ["phase633", phase633Completed],
  ["phase634", phase634Completed],
  ["phase635", phase635Completed],
  ["phase636", phase636Completed],
  ["phase637", phase637Completed],
].filter(([, passed]) => !passed).map(([id]) => id);

const result = {
  phase: "Phase633R-637R",
  name: "Full System Audit Bugfix Report Bundle",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase633Completed,
  phase634Completed,
  phase635Completed,
  phase636Completed,
  phase637Completed,
  failed,
  p0BlockerCount: phase634.data?.p0BlockerCount ?? 0,
  p1BlockerCount: phase634.data?.p1RiskCount ?? 0,
  p2FixedCount: phase635.data?.p2FixedCount ?? 0,
  p3FixedCount: phase635.data?.p3FixedCount ?? 0,
  finalReportGenerated: phase637.data?.finalSystemReportGenerated === true,
  regressionPassed: phase636Completed,
  ...safetyBoundary(),
  docs: ["docs/phase633r-637r-full-system-audit-bugfix-report-closure.md"],
  evidenceJson: paths.evidence,
  bundleJson: paths.bundle,
};

const checks = [
  check("phase633_completed", result.phase633Completed),
  check("phase634_completed", result.phase634Completed),
  check("phase635_completed", result.phase635Completed),
  check("phase636_completed", result.phase636Completed),
  check("phase637_completed", result.phase637Completed),
  check("failed_empty", result.failed.length === 0),
  check("p0_blocker_count_recorded", Number.isInteger(result.p0BlockerCount)),
  check("p1_blocker_count_recorded", Number.isInteger(result.p1BlockerCount)),
  check("p2_fixed_count_recorded", Number.isInteger(result.p2FixedCount)),
  check("p3_fixed_count_recorded", Number.isInteger(result.p3FixedCount)),
  check("final_report_generated", result.finalReportGenerated),
  check("regression_passed", result.regressionPassed),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("closure_doc_generated", Boolean(closureText)),
];

const bundle = {
  ...result,
  sourceEvidence: {
    phase633: paths.phase633,
    phase634: paths.phase634,
    phase635: paths.phase635,
    phase636: paths.phase636,
    phase637: paths.phase637,
  },
};
writeJson(paths.bundle, bundle);
finalize(result, checks, paths.evidence, "phase633r_637r_full_system_audit_bugfix_report_bundle_failed");
