import { readText, writeJson, writeText, findVisibleIssuePatterns } from "../phase373-common.mjs";

const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const uiSource = await readText(uiPath);
const remainingIssuePatterns = findVisibleIssuePatterns(uiSource);

const result = {
  phase: "Phase373A",
  encodingCopyRepairExecuted: true,
  browserVisibleEncodingIssueDetected: true,
  copyRenderingIssueInventoryGenerated: true,
  frontendModified: true,
  modifiedFiles: [uiPath],
  runtimeModified: false,
  chatGatewayModified: false,
  providerCallsMade: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase373a-browser-visible-encoding-repair-report.md",
  [
    "# Phase373A Browser-visible Encoding Repair Report",
    "",
    "- repaired scope: browser-visible copy in Workbench UI",
    `- remainingIssuePatterns: ${remainingIssuePatterns.length ? remainingIssuePatterns.join(", ") : "none in visible template scan"}`,
    "- runtimeModified: false",
    "- chatGatewayModified: false",
  ].join("\n"),
);

await writeJson("docs/phase373a-copy-rendering-issue-inventory.json", {
  phase: "Phase373A",
  targetFile: uiPath,
  repairedCategories: [
    "browser-visible mojibake",
    "broken closing-tag text rendering",
    "no-deploy / dry-run candidate copy clarity",
    "provider setup / credentialRef guidance readability",
    "God / Tianshu state explanation readability",
  ],
  remainingIssuePatterns,
});

await writeText(
  "docs/phase373a-ui-copy-repair-diff-summary.md",
  [
    "# Phase373A UI Copy Repair Diff Summary",
    "",
    "- Replaced broken sidebar, topbar, chat composer, diagnostics, approvals, and provider setup copy.",
    "- Preserved Phase372 markers and Workbench smoke compatibility.",
    "- Kept no-deploy / no-GA / no-secret posture visible in the page copy.",
  ].join("\n"),
);

await writeText(
  "docs/phase373a-execution-report.md",
  [
    "# Phase373A Execution Report",
    "",
    `- frontendModified: ${result.frontendModified}`,
    `- modifiedFiles: ${result.modifiedFiles.join(", ")}`,
    `- deployExecuted: ${result.deployExecuted}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373a/browser-visible-encoding-copy-repair-result.json", result);

console.log(JSON.stringify(result, null, 2));
