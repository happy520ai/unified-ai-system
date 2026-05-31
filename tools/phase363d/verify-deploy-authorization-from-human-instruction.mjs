import { readJsonIfExists, validateInstruction, writeJson, writeText } from "../phase363-common.mjs";

const record = await readJsonIfExists("docs/approvals/phase361/deploy-authorization-record.json");
const instruction = await readJsonIfExists("docs/approvals/phase363/explicit-human-approval-instruction.json");
const instructionValidation = instruction ? validateInstruction(instruction) : { valid: false };
const through = Boolean(
  record &&
  record.approvalType === "deploy_authorization" &&
  (record.approvalDecision === "approved" || record.approvalDecision === "approved_with_conditions") &&
  record.auditTrace?.approvalSource === "explicit_human_instruction" &&
  record.auditTrace?.codexIsApprover === false &&
  record.auditTrace?.humanInstructionRef &&
  instruction &&
  instructionValidation.valid &&
  record.approvedScope?.includes("deploy_authorization") &&
  !record.draftOnly &&
  !record.notAnApproval &&
  !containsSecretLikeText(record),
);

const state = {
  phase: "Phase363D",
  deployAuthorized: false,
  deployAuthorizationSource: null,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  conditions: [],
  blockers: through ? [] : ["deploy_authorization_not_verified"],
  safety: {
    codexIsApprover: false,
    approvalForged: false,
    secretValueExposed: false,
  },
};

if (through) {
  state.deployAuthorized = true;
  state.deployAuthorizationSource = "explicit_human_instruction";
  state.conditions = Array.isArray(record.conditions) ? record.conditions : [];
}

const result = {
  phase: "Phase363D",
  deployAuthorizationVerified: through,
  deployAuthorized: state.deployAuthorized,
  deployAuthorizationSource: state.deployAuthorizationSource,
  conditions: state.conditions,
  blockers: state.blockers,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  workspaceCleanClaimed: false,
};

await writeText("docs/phase363d-deploy-authorization-human-instruction-verification-report.md", [
  "# Phase363D Deploy Authorization Human Instruction Verification Report",
  "",
  `- deployAuthorizationVerified: ${through}`,
  `- deployAuthorized: ${state.deployAuthorized}`,
  `- blockers: ${state.blockers.join(", ") || "none"}`,
].join("\n"));
await writeJson("docs/phase363d-deploy-authorization-state-rerun.json", state);
await writeText("docs/phase363d-execution-report.md", [
  "# Phase363D Execution Report",
  "",
  `- deployAuthorizationVerified: ${through}`,
  `- deployAuthorized: ${state.deployAuthorized}`,
  "- deployExecuted: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363d/deploy-authorization-human-instruction-verification-result.json", result);

console.log(JSON.stringify(result, null, 2));

function containsSecretLikeText(value) {
  const texts = collectStringValues(value);
  return texts.some((text) =>
    [
      /api[_-]?key\s*[:=]/i,
      /\.env\s*[:=]/i,
      /sk-[A-Za-z0-9]{12,}/i,
      /secret\s*[:=]/i,
      /token\s*[:=]/i,
    ].some((pattern) => pattern.test(text)),
  );
}

function collectStringValues(value, acc = []) {
  if (typeof value === "string") {
    acc.push(value);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringValues(item, acc);
  }
  return acc;
}
