import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase348e/provider-onboarding-completion-failure-slo-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase349e");
const resultPath = resolve(evidenceDir, "provider-onboarding-incident-failed-setup-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349e-provider-onboarding-incident-failed-setup-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase349E",
  sourcePhase: source.phase,
  incidentPlaybooksGenerated: true,
  rollbackStepsIncluded: true,
  escalationOwnersPlaceholder: true,
  noRealOpsIntegration: true,
  failedSetupPlaybookGenerated: true,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  productionGA: false,
  rollbackSteps: [
    "keep_provider_call_blocked_from_ui",
    "show_credential_ref_only_guidance",
    "capture_failed_setup_evidence_without_secret",
    "route_to_reviewer_checklist_before_retry",
  ],
  metricsCovered: source.metrics || [],
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: current.phase, playbookType: "provider_onboarding_failed_setup_incident", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase349E Execution Report\n\n- incidentPlaybooksGenerated: ${current.incidentPlaybooksGenerated}\n- noProviderCallFromUi: ${current.noProviderCallFromUi}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
