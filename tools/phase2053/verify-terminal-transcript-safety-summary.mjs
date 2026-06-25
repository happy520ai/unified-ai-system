import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { summarizeTerminalTranscript } from "../../packages/gvc-permission-engine/src/index.js";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const summary = summarizeTerminalTranscript({
  command: "Get-Content .env",
  exitCode: 1,
  stdout: "OPENAI_API_KEY=sk-should-not-be-saved\nAuthorization: Bearer should-not-be-saved\n",
  stderr: "blocked by policy",
});

const serialized = JSON.stringify(summary);
check("command_category_recorded", summary.commandCategory === "secret_risk", summary.commandCategory);
check("exit_code_recorded", summary.exitCode === 1);
check("risk_flags_recorded", summary.riskFlags.includes("secret_risk"));
check("stdout_not_saved", !serialized.includes("OPENAI_API_KEY"));
check("authorization_not_saved", !serialized.includes("Authorization: Bearer"));
check("raw_secret_not_saved", !serialized.includes("should-not-be-saved"));
check("secret_read_false", summary.secretRead === false);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2053-Terminal-Transcript-Safety-Summary",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  summary,
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  rawSecretStored: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidenceFile("apps/ai-gateway-service/evidence/phase2053-terminal-transcript-safety-summary/result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

