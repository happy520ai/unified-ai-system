import { containsSecretLikeText, readJson, writeJson, writeText } from "../phase367-common.mjs";

const commandRef = await readJson("docs/phase366b-approved-command-ref.json");
const commandTexts = commandRef.approvedCommands.map((item) => item.command);

const destructiveCommandDetected = commandTexts.some((cmd) => /git reset --hard|git clean/i.test(cmd));
const unapprovedProviderCommandDetected = commandTexts.some((cmd) => /openai|claude|openrouter|mimo/i.test(cmd));
const realBillingCommandDetected = commandTexts.some((cmd) => /invoice|billing/i.test(cmd));
const secretFindingCount = containsSecretLikeText(commandRef) ? 1 : 0;

const result = {
  phase: "Phase367B",
  approvedCommandRefReviewed: true,
  commandRefSafe:
    commandRef.commandsExecutableInThisPhase === false &&
    commandRef.requiresFinalManualExecutionConfirmation === true &&
    !destructiveCommandDetected &&
    !unapprovedProviderCommandDetected &&
    !realBillingCommandDetected &&
    secretFindingCount === 0,
  secretFindingCount,
  destructiveCommandDetected,
  unapprovedProviderCommandDetected,
  realBillingCommandDetected,
  commandsExecuted: false,
  deployExecuted: false,
};

await writeText("docs/phase367b-approved-command-ref-final-review.md", [
  "# Phase367B Approved CommandRef Final Review",
  "",
  `- commandRefId: ${commandRef.commandRefId}`,
  `- commandRefSafe: ${result.commandRefSafe}`,
].join("\n"));
await writeJson("docs/phase367b-approved-command-ref-redaction-check.json", result);
await writeText("docs/phase367b-approved-command-ref-risk-notes.md", [
  "# Phase367B Approved CommandRef Risk Notes",
  "",
  "- approvedCommandRef remains a future reference only.",
  "- deploy command remains non-executable in Phase367.",
].join("\n"));
await writeText("docs/phase367b-execution-report.md", [
  "# Phase367B Execution Report",
  "",
  `- commandRefSafe: ${result.commandRefSafe}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase367b/approved-command-ref-final-review-result.json", result);

console.log(JSON.stringify(result, null, 2));
