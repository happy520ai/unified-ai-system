import { classifyPersonaEntry, ensure, phase380Safety, writeArtifacts } from "../phase380-common.mjs";
import { readJson } from "../phase373-common.mjs";

const unsafeCases = await readJson("docs/phase380d-yiyi-unsafe-entry-cases.json");
const evaluated = unsafeCases.map((item) => ({
  ...item,
  dryRunDecision: classifyPersonaEntry({
    entryText: item.entryText,
    entryTypeHint: "unsafe",
    source: "phase380d_case",
  }),
}));

ensure(evaluated.every((item) => item.dryRunDecision.decision === "rejected"), "All unsafe entries must be rejected.");
ensure(evaluated.every((item) => item.dryRunDecision.secretValueExposed === false), "Unsafe guard must not expose secrets.");
ensure(evaluated.every((item) => item.dryRunDecision.providerCallsMade === false), "Unsafe guard must not call providers.");

const result = {
  phase: "Phase380D",
  canonValidatorCreated: true,
  unsafeEntriesRejected: true,
  unsafeCaseCount: evaluated.length,
  evaluated,
  ...phase380Safety,
  validationPassed: true,
};

await writeArtifacts({
  reportPath: "docs/phase380d-yiyi-canon-validator.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380d/yiyi-canon-safety-result.json",
  result,
  reportLines: [
    "# Phase380D Yiyi Canon Validator",
    "",
    "- Added unsafe entry guard for secret, provider, deploy/release, governance, medical/therapy, and hidden prompt leakage requests.",
    "- All unsafe cases are rejected in dry-run.",
    "- The validator never grants Yiyi execution authority.",
  ],
});

console.log(JSON.stringify(result, null, 2));
