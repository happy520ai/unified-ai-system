import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpencodePhaseCandidates } from "./build-opencode-phase-candidates.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function hasScript(packageJson, name) {
  return Boolean(packageJson.scripts && packageJson.scripts[name]);
}

function hasCommand(opencodeText, name) {
  return opencodeText.includes(`"${name}"`);
}

async function main() {
  const packageJson = readJson("package.json");
  const opencodeText = readFileSync(path.join(repoRoot, "opencode.jsonc"), "utf8");

  assert(hasScript(packageJson, "run:phase3980a-opencode-phase-candidate-bridge"), "missing run:phase3980a-opencode-phase-candidate-bridge");
  assert(hasScript(packageJson, "verify:phase3980a-opencode-phase-candidate-bridge"), "missing verify:phase3980a-opencode-phase-candidate-bridge");
  assert(hasCommand(opencodeText, "phase-autopilot-refresh-real-candidates"), "missing phase-autopilot-refresh-real-candidates command");

  const result = buildOpencodePhaseCandidates();
  assert(result.phaseId === "Phase3980A-OpenCode-Phase-Candidate-Bridge", "phase id mismatch");
  assert(result.latestPhase, "latestPhase must exist");
  assert(result.selectedNextPhase, "selectedNextPhase must exist");
  assert(Array.isArray(result.candidates) && result.candidates.length >= 3, "candidates must contain at least 3 items");

  const candidateFile = path.join(repoRoot, "docs/project-brain/opencode-autopilot-phase-candidates.json");
  assert(existsSync(candidateFile), "candidate output file missing");

  const stateRefresh = result.candidates.find((item) => item.taskId === "phase3980a-phase-state-refresh");
  assert(stateRefresh, "missing state refresh candidate");

  const phaseSpecific = result.candidates.find((item) => item.taskId.includes(String(result.selectedNextPhase).toLowerCase()));
  assert(phaseSpecific, "missing selected phase candidate");

  if (result.humanApprovalRequired === true) {
    assert(phaseSpecific.status === "blocked", "high-risk candidate must remain blocked");
    assert(phaseSpecific.blocker === "human_approval_required_phase_candidate", "high-risk blocker mismatch");
  } else {
    assert(phaseSpecific.status === "pending", "low-risk candidate should remain pending");
  }

  console.log("Phase3980A opencode phase candidate bridge verifier passed");
}

main().catch((error) => {
  console.error(`Phase3980A verifier failed: ${error.message}`);
  process.exit(1);
});
