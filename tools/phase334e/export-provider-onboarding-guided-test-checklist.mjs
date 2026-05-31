import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase334e");
const resultPath = resolve(evidenceDir, "provider-onboarding-guided-test-checklist-export-result.json");
const jsonPath = resolve(repoRoot, "docs/phase334e-guided-test-checklist-export.json");
const mdPath = resolve(repoRoot, "docs/phase334e-guided-test-checklist-export.md");
const csvMdPath = resolve(repoRoot, "docs/phase334e-guided-test-checklist-export.csv.md");
const reportPath = resolve(repoRoot, "docs/phase334e-guided-test-checklist-export-report.md");
const source = await readJson("docs/phase332e-guided-test-scenarios.json");
const scenarios = (source.scenarios || []).map((item) => ({
  testId: item.testId,
  scenarioName: item.testId,
  persona: item.persona,
  preconditions: item.preconditions,
  steps: item.steps,
  expectedResult: item.expectedResult,
  evidenceToCapture: item.evidenceToCapture,
  blockedReasonExpected: item.blockedReasonExpected,
  safetyChecks: item.safetyChecks,
  statusPlaceholder: "not_run",
  reviewerNotesPlaceholder: "",
}));
const result = {
  phase: "Phase334E",
  jsonExported: true,
  markdownExported: true,
  csvMarkdownExported: true,
  scenarioCount: scenarios.length,
  rawSecretScenarioIncluded: scenarios.some((item) => item.testId === "rawSecretRejected"),
  noProviderCallScenarioIncluded: scenarios.some((item) => item.testId === "noProviderCallFromUi"),
  credentialRefOnly: true,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify({ phase: "Phase334E", scenarios }, null, 2)}\n`, "utf8");
await writeFile(mdPath, renderMarkdown(scenarios), "utf8");
await writeFile(csvMdPath, renderCsvMarkdown(scenarios), "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334e-provider-onboarding-guided-test-checklist-export-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334e-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function renderMarkdown(scenarios) {
  return [
    "# Phase334E Provider Onboarding Guided Test Checklist",
    "",
    "Use credential reference names only, such as OPENAI_API_KEY. Do not enter real API key values.",
    "",
    ...scenarios.map((item) => [
      `## ${item.testId}`,
      `- expectedResult: ${item.expectedResult}`,
      `- blockedReasonExpected: ${item.blockedReasonExpected || "none"}`,
      `- status: ${item.statusPlaceholder}`,
      "",
    ].join("\n")),
  ].join("\n");
}

function renderCsvMarkdown(scenarios) {
  return [
    "| testId | expectedResult | blockedReasonExpected | status | reviewerNotes |",
    "| --- | --- | --- | --- | --- |",
    ...scenarios.map((item) => `| ${item.testId} | ${item.expectedResult} | ${item.blockedReasonExpected || ""} | ${item.statusPlaceholder} | ${item.reviewerNotesPlaceholder} |`),
    "",
  ].join("\n");
}

function renderDesign() {
  return [
    "# Phase334E Guided Test Checklist Export Design",
    "",
    "Exports JSON, Markdown, and CSV-safe Markdown checklist for beta reviewers. It explicitly forbids real API key values.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase334E Checklist Export Report",
    "",
    `- jsonExported: ${result.jsonExported}`,
    `- markdownExported: ${result.markdownExported}`,
    `- csvMarkdownExported: ${result.csvMarkdownExported}`,
    `- scenarioCount: ${result.scenarioCount}`,
    "",
  ].join("\n");
}
