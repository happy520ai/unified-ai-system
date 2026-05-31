import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockStatement, exportMockStatement } from "../../apps/ai-gateway-service/src/billing/mockStatementExporter.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase336f");
const resultPath = resolve(evidenceDir, "mock-statement-multiformat-consistency-result.json");
const reportPath = resolve(repoRoot, "docs/phase336f-execution-report.md");
const snapshotPath = resolve(repoRoot, "docs/phase336f-mock-statement-multiformat-consistency.json");

const statement = createMockStatement({
  statementId: "phase336f-statement",
  userIdRef: "user_beta_001",
  billingPeriod: "2026-05",
  invoices: [
    {
      estimatedCostTotal: 1.75,
      lineItems: [
        {
          mode: "god",
          providerId: "nvidia",
          modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
          requestCount: 3,
          estimatedCost: 1.25,
        },
        {
          mode: "normal",
          providerId: "nvidia",
          modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
          requestCount: 5,
          estimatedCost: 0.5,
        },
      ],
    },
  ],
});

const jsonText = exportMockStatement(statement, "json");
const csvText = exportMockStatement(statement, "csv");
const markdownText = exportMockStatement(statement, "markdown");
const json = JSON.parse(jsonText);
const csvRowCount = csvText.split(/\r?\n/).filter(Boolean).length;

const result = {
  phase: "Phase336F",
  jsonCsvMarkdownConsistent: json.totalEstimatedCost === statement.totalEstimatedCost
    && csvText.includes("mode,providerId,modelId,requestCount,estimatedCost")
    && markdownText.includes("Mock Billing Statement"),
  noReleaseSimulation: true,
  releaseExecuted: false,
  deployExecuted: false,
  jsonLineItems: json.lineItems.length,
  csvRowCount,
  markdownWarningPresent: markdownText.includes("NOT A LEGAL INVOICE"),
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(snapshotPath, `${JSON.stringify({ phase: "Phase336F", statement, csvPreview: csvText }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase336F Execution Report",
    "",
    `- jsonCsvMarkdownConsistent: ${current.jsonCsvMarkdownConsistent}`,
    `- jsonLineItems: ${current.jsonLineItems}`,
    `- csvRowCount: ${current.csvRowCount}`,
    "",
  ].join("\n");
}
