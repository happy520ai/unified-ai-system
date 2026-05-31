import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { instructionSchema, instructionTemplate, instructionPath, instructionTemplatePath, phase363Dir, readJsonIfExists, validateInstruction, writeJson, writeText } from "../phase363-common.mjs";

const repoRoot = resolve(".");
await mkdir(resolve(repoRoot, phase363Dir), { recursive: true });

if (!(await readJsonIfExists(instructionPath))) {
  await writeJson(instructionTemplatePath, instructionTemplate());
}
await writeText("docs/approvals/phase363/README.md", [
  "# Phase363 Explicit Human Approval Instruction",
  "",
  "- Place a real human instruction at `docs/approvals/phase363/explicit-human-approval-instruction.json`.",
  "- The template file is not an instruction.",
  "- Codex may only transcribe a valid human instruction and is never the approver.",
].join("\n"));
await writeText("docs/approvals/phase363/explicit-human-approval-instruction.template.json", JSON.stringify(instructionTemplate(), null, 2));

const instructionFilePresent = await readJsonIfExists(instructionPath);
const validation = instructionFilePresent ? validateInstruction(instructionFilePresent) : { missingFields: [], validationErrors: ["EXPLICIT_HUMAN_INSTRUCTION_MISSING_OR_INVALID"], valid: false };
const blocked = !instructionFilePresent || !validation.valid;

const result = {
  phase: "Phase363A",
  instructionFilePresent: Boolean(instructionFilePresent),
  instructionValid: Boolean(instructionFilePresent && validation.valid),
  codexMayTranscribeApprovalFiles: Boolean(instructionFilePresent && validation.valid && instructionFilePresent.codexMayTranscribeApprovalFiles),
  codexIsApprover: false,
  decision: instructionFilePresent ? instructionFilePresent.decision : "pending",
  approvedApprovalTypes: instructionFilePresent && Array.isArray(instructionFilePresent.approvedApprovalTypes) ? instructionFilePresent.approvedApprovalTypes : [],
  missingFields: validation.missingFields || [],
  validationErrors: validation.validationErrors || [],
  blocked,
  blockReason: blocked ? "EXPLICIT_HUMAN_INSTRUCTION_MISSING_OR_INVALID" : null,
  safety: {
    secretValueExposed: false,
    apiKeyIncluded: false,
    approvalForged: false,
    deployExecuted: false,
    releaseExecuted: false,
  },
};

await writeJson("docs/phase363a-explicit-human-approval-instruction.schema.json", instructionSchema());
await writeText("docs/phase363a-codex-transcription-guard-policy.md", [
  "# Phase363A Codex Transcription Guard Policy",
  "",
  "- Codex is not approver.",
  "- Codex may only transcribe explicit human instruction.",
  "- Codex must not invent approval decisions.",
  "- Codex must not invent approver identity.",
  "- Codex must not approve deploy by itself.",
  "- Codex must not turn pending into approved.",
  "- Codex must preserve human conditions.",
  "- Codex must include approvalSource=explicit_human_instruction.",
  "- Codex must include codexIsApprover=false.",
  "- Codex must include humanInstructionRef.",
].join("\n"));
await writeText("docs/phase363a-human-instruction-intake-report.md", [
  "# Phase363A Human Instruction Intake Report",
  "",
  `- instructionFilePresent: ${result.instructionFilePresent}`,
  `- instructionValid: ${result.instructionValid}`,
  `- codexMayTranscribeApprovalFiles: ${result.codexMayTranscribeApprovalFiles}`,
  `- blocked: ${result.blocked}`,
  `- blockReason: ${result.blockReason}`,
].join("\n"));
await writeText("docs/phase363a-execution-report.md", [
  "# Phase363A Execution Report",
  "",
  "- instruction intake prepared",
  "- transcription guard prepared",
  `- blocked: ${result.blocked}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase363a/explicit-human-approval-instruction-intake-result.json", result);

console.log(JSON.stringify(result, null, 2));
