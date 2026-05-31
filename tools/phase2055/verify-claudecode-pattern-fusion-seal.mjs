import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildPatternFusionSeal } from "../../packages/gvc-permission-engine/src/index.js";

const repoRoot = process.cwd();
const checks = [];

const phaseEvidence = [
  "apps/ai-gateway-service/evidence/phase2047-pme-permission-rule-dsl/result.json",
  "apps/ai-gateway-service/evidence/phase2048-shell-command-classifier-dryrun/result.json",
  "apps/ai-gateway-service/evidence/phase2049-tool-registry-result-ledger/result.json",
  "apps/ai-gateway-service/evidence/phase2050-session-ledger-context-unification/result.json",
  "apps/ai-gateway-service/evidence/phase2051-project-memory-relevance-age-scoring/result.json",
  "apps/ai-gateway-service/evidence/phase2052-structured-diff-patch-review/result.json",
  "apps/ai-gateway-service/evidence/phase2053-terminal-transcript-safety-summary/result.json",
  "apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/result.json",
];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const evidenceInputs = phaseEvidence.map((relativePath) => readJson(relativePath)).filter(Boolean);
const seal = buildPatternFusionSeal({ evidenceInputs });

for (const relativePath of phaseEvidence) {
  check(`evidence_exists_${path.basename(path.dirname(relativePath))}`, existsSync(path.join(repoRoot, relativePath)), relativePath);
}
check("all_phase_inputs_passed", evidenceInputs.length === phaseEvidence.length && evidenceInputs.every((entry) => entry.status === "passed"));
check("fusion_modes_recorded", seal.fusedClaudeCodePatterns.length >= 8);
check("pme_owned_implementation_recorded", seal.pmeOwnedImplementations.length >= 8);
check("copied_source_false", seal.copiedClaudeCodeSource === false);
check("secret_read_false", seal.secretRead === false);
check("provider_calls_false", seal.providerCallsMade === false);
check("deploy_false", seal.deployExecuted === false);
check("chat_route_false", seal.chatGatewayExecuteModified === false && seal.chatModified === false);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2055-ClaudeCode-Pattern-Fusion-Seal",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  ...seal,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidence("apps/ai-gateway-service/evidence/phase2055-claudecode-pattern-fusion-seal/result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, fusedPatternCount: seal.fusedClaudeCodePatterns.length }, null, 2));
if (failed.length > 0) process.exit(1);

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
