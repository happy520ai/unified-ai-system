import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOpenCodeActiveConfigReadinessReport,
  repairOpenCodeActiveConfig,
  writeOpenCodeActiveConfigEvidence,
} from "./opencodeActiveConfigReadinessCore.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

async function main() {
  const repair = repairOpenCodeActiveConfig({ repoRoot });
  const report = await buildOpenCodeActiveConfigReadinessReport({ repoRoot });
  const paths = writeOpenCodeActiveConfigEvidence(report, repoRoot);

  console.log(JSON.stringify({
    status: report.status,
    blocker: report.blocker,
    backupsCreated: repair.backups.length,
    backupPaths: repair.backups.map((item) => item.backup),
    evidenceJson: paths.evidenceJson,
    evidenceMarkdown: paths.evidenceMarkdown,
    providerCalled: report.summary.providerCalled,
    paidApiCalled: report.summary.paidApiCalled,
    guiRestartRequired: report.summary.guiRestartRequired,
  }, null, 2));

  if (report.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
