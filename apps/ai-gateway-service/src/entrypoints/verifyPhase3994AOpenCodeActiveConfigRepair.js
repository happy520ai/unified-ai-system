import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  activeConfigPaths,
  buildOpenCodeActiveConfigReadinessReport,
  PHASE3994A_ID,
  writeOpenCodeActiveConfigEvidence,
} from "./opencodeActiveConfigReadinessCore.js";
import { readJson } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));


function check(condition, id, detail = null) {
  return { id, pass: Boolean(condition), detail };
}

async function main() {
  const paths = activeConfigPaths({ repoRoot });
  const report = await buildOpenCodeActiveConfigReadinessReport({ repoRoot });
  const evidencePaths = writeOpenCodeActiveConfigEvidence(report, repoRoot);
  const rootPackage = readJson(resolve(repoRoot, "package.json"));
  const servicePackage = readJson(resolve(repoRoot, "apps/ai-gateway-service/package.json"));
  const phaseDoc = existsSync(paths.docs) ? readFileSync(paths.docs, "utf8") : "";

  const requiredScripts = [
    "run:phase3994a-opencode-active-config-repair",
    "verify:phase3994a-opencode-active-config-repair",
  ];

  const verifierChecks = [
    check(report.status === "passed", "fresh_active_config_report_passed", report.blocker),
    check(existsSync(paths.projectJson), "project_active_json_exists", paths.projectJson),
    check(existsSync(paths.projectJsonc), "project_active_jsonc_exists", paths.projectJsonc),
    check(existsSync(paths.globalJson), "global_active_json_exists", paths.globalJson),
    check(existsSync(paths.globalJsonc), "global_active_jsonc_exists", paths.globalJsonc),
    check(existsSync(evidencePaths.evidenceJson), "evidence_json_written", evidencePaths.evidenceJson),
    check(existsSync(evidencePaths.evidenceMarkdown), "evidence_markdown_written", evidencePaths.evidenceMarkdown),
    check(existsSync(paths.docs), "phase_doc_exists", paths.docs),
    check(requiredScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)), "root_scripts_present"),
    check(requiredScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)), "service_scripts_present"),
    check(phaseDoc.includes(PHASE3994A_ID), "doc_mentions_phase"),
    check(phaseDoc.includes("global and project .opencode"), "doc_mentions_active_scope"),
    check(phaseDoc.includes("providerCalled=false"), "doc_mentions_no_provider_call"),
    check(phaseDoc.includes("restart"), "doc_mentions_restart_boundary"),
    check(phaseDoc.includes("OPENCODE_CONFIG"), "doc_mentions_explicit_config_launch"),
  ];

  const passed = verifierChecks.every((item) => item.pass);
  const output = {
    status: passed ? "passed" : "failed",
    phaseId: PHASE3994A_ID,
    readinessStatus: report.status,
    verifierChecks,
    evidenceJson: evidencePaths.evidenceJson,
    evidenceMarkdown: evidencePaths.evidenceMarkdown,
    providerCalled: report.summary.providerCalled,
    paidApiCalled: report.summary.paidApiCalled,
    defaultChatChanged: report.summary.defaultChatChanged,
    legacyModified: report.summary.legacyModified,
    projectContextCreated: report.summary.projectContextCreated,
    commitPushDeployRelease: report.summary.commitPushDeployRelease,
    workspaceCleanClaimed: report.summary.workspaceCleanClaimed,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
