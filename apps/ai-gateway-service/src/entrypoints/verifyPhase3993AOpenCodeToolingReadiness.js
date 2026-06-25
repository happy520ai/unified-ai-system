import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOpenCodeToolingReadinessMarkdown,
  buildOpenCodeToolingReadinessReport,
  evidencePaths,
  PHASE3993A_ID,
} from "./opencodeToolingReadinessCore.js";
import { readJson, readText } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));



function check(condition, id, detail = null) {
  return { id, pass: Boolean(condition), detail };
}

async function main() {
  const paths = evidencePaths(repoRoot);
  const report = await buildOpenCodeToolingReadinessReport({ repoRoot });
  const markdown = buildOpenCodeToolingReadinessMarkdown(report);

  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(paths.md, markdown, "utf8");

  const rootPackage = readJson(resolve(repoRoot, "package.json"));
  const servicePackage = readJson(resolve(repoRoot, "apps/ai-gateway-service/package.json"));
  const httpServer = readText(resolve(repoRoot, "apps/ai-gateway-service/src/http/httpServer.js"));
  const consolePage = readText(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"));
  const phaseDoc = existsSync(paths.docs) ? readText(paths.docs) : "";

  const requiredRootScripts = [
    "smoke:phase3993a-opencode-mcp-lsp-plugin-readiness",
    "verify:phase3993a-opencode-mcp-lsp-plugin-readiness",
  ];
  const requiredServiceScripts = [...requiredRootScripts];

  const verifierChecks = [
    check(report.status === "passed", "fresh_readiness_report_passed", report.blocker),
    check(existsSync(paths.json), "evidence_json_written", paths.json),
    check(existsSync(paths.md), "evidence_markdown_written", paths.md),
    check(existsSync(paths.docs), "phase_doc_exists", paths.docs),
    check(existsSync(paths.launcher), "lsp_launcher_exists", paths.launcher),
    check(requiredRootScripts.every((script) => Object.hasOwn(rootPackage.scripts || {}, script)), "root_scripts_present"),
    check(
      requiredServiceScripts.every((script) => Object.hasOwn(servicePackage.scripts || {}, script)),
      "service_scripts_present",
    ),
    check(httpServer.includes('url.pathname === "/opencode/tooling-readiness"'), "http_route_wired"),
    check(httpServer.includes('pathname === "/opencode/tooling-readiness"'), "public_route_wired"),
    check(consolePage.includes("/opencode/tooling-readiness"), "ui_route_marker_present"),
    check(phaseDoc.includes(PHASE3993A_ID), "doc_mentions_phase"),
    check(phaseDoc.includes("OPENCODE_EXPERIMENTAL_LSP_TOOL"), "doc_mentions_lsp_env"),
    check(phaseDoc.includes("providerCalled=false"), "doc_mentions_no_provider"),
    check(phaseDoc.includes("default /chat"), "doc_mentions_default_chat_boundary"),
  ];

  const passed = verifierChecks.every((item) => item.pass);
  const output = {
    status: passed ? "passed" : "failed",
    phaseId: PHASE3993A_ID,
    readinessStatus: report.status,
    verifierChecks,
    evidenceJson: paths.json,
    evidenceMarkdown: paths.md,
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
