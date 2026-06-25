import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOpenCodeToolingReadinessMarkdown,
  buildOpenCodeToolingReadinessReport,
  evidencePaths,
} from "./opencodeToolingReadinessCore.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

async function main() {
  const paths = evidencePaths(repoRoot);
  const report = await buildOpenCodeToolingReadinessReport({ repoRoot });
  const markdown = buildOpenCodeToolingReadinessMarkdown(report);

  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.json, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(paths.md, markdown, "utf8");

  console.log(JSON.stringify({
    status: report.status,
    blocker: report.blocker,
    evidenceJson: paths.json,
    evidenceMarkdown: paths.md,
    providerCalled: report.summary.providerCalled,
    paidApiCalled: report.summary.paidApiCalled,
  }, null, 2));

  if (report.status !== "passed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
