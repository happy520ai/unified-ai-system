import { existsSync } from "node:fs";
import {
  extractPhaseNumber,
  fileMtimeMs,
  isClosureCandidate,
  listFiles,
  normalizePhaseResult,
  phase383Safety,
  relativePath,
  resultPriority,
  resultWarnings,
  readJson,
  writeJson,
  writeText,
} from "../phase383-common.mjs";

const evidenceRoot = "apps/ai-gateway-service/evidence";
const generatedAt = new Date().toISOString();

function isPhase383Path(file) {
  return /apps[\\/]+ai-gateway-service[\\/]+evidence[\\/]+phase383/i.test(file);
}

function phaseFromPath(file) {
  const phaseNumber = extractPhaseNumber(file);
  return phaseNumber ? `Phase${phaseNumber}` : null;
}

async function buildCandidate(file) {
  const raw = await readJson(file);
  const normalized = normalizePhaseResult({
    ...raw,
    phase: raw.phase || phaseFromPath(file),
  });
  const phaseNumber = extractPhaseNumber(normalized.phase || file);
  return {
    file,
    relativePath: relativePath(file),
    phaseNumber,
    priority: resultPriority(file),
    mtimeMs: fileMtimeMs(file),
    normalized,
    warnings: resultWarnings(normalized),
  };
}

const resultFiles = existsSync(evidenceRoot)
  ? listFiles(evidenceRoot).filter((file) => isClosureCandidate(file) && !isPhase383Path(file))
  : [];

const candidates = [];
const parseErrors = [];
for (const file of resultFiles) {
  try {
    candidates.push(await buildCandidate(file));
  } catch (error) {
    parseErrors.push({ path: relativePath(file), error: error.message });
  }
}

const closureCandidates = candidates.filter((candidate) => /closure-result\.json$/i.test(candidate.file));
const completedClosures = closureCandidates.filter((candidate) => candidate.normalized.completed === true);
const pool = completedClosures.length > 0 ? completedClosures : closureCandidates;
pool.sort((a, b) => {
  if (b.phaseNumber !== a.phaseNumber) return b.phaseNumber - a.phaseNumber;
  if (b.priority !== a.priority) return b.priority - a.priority;
  return b.mtimeMs - a.mtimeMs;
});

const selected = pool[0];
const state = selected
  ? {
      latestPhase: selected.normalized.phase || `Phase${selected.phaseNumber}`,
      latestResultPath: selected.relativePath,
      completed: selected.normalized.completed,
      recommended_sealed: selected.normalized.recommended_sealed,
      blocker: selected.normalized.blocker,
      validationsPassed: selected.normalized.validationsPassed,
      safety: selected.normalized.safety,
      nextRecommendedPhases: selected.normalized.nextRecommendedPhases,
      remainingRisks: selected.normalized.remainingRisks,
      stateReadAt: generatedAt,
      workspaceCleanClaimed: false,
      warnings: selected.warnings,
      compatibleLegacyFieldsUsed: selected.warnings.includes("used_legacy_recommendedSealed") || selected.warnings.includes("used_root_safety_fields"),
      phase381ClosureRequired: false,
      phase382ClosureRequired: false,
    }
  : {
      latestPhase: null,
      latestResultPath: null,
      completed: false,
      recommended_sealed: false,
      blocker: "no_phase_closure_result_found",
      validationsPassed: false,
      safety: { ...phase383Safety },
      nextRecommendedPhases: [],
      remainingRisks: [],
      stateReadAt: generatedAt,
      workspaceCleanClaimed: false,
      warnings: ["no_phase_closure_result_found"],
      compatibleLegacyFieldsUsed: false,
      phase381ClosureRequired: false,
      phase382ClosureRequired: false,
    };

const evidence = {
  phase: "Phase383C",
  latestPhaseStateReaderCreated: true,
  latestPhaseRead: Boolean(selected),
  latestPhase: state.latestPhase,
  latestResultPath: state.latestResultPath,
  candidateClosureCount: closureCandidates.length,
  completedClosureCount: completedClosures.length,
  parseErrors,
  blocker: selected ? null : "no_phase_closure_result_found",
  validationPassed: Boolean(selected),
  ...phase383Safety,
};

await writeJson("docs/phase-orchestrator/current-phase-state.json", state);
await writeJson("apps/ai-gateway-service/evidence/phase383c/read-latest-phase-state-result.json", evidence);
await writeText(
  "docs/phase383c-read-latest-phase-state.md",
  [
    "# Phase383C Read Latest Phase State",
    "",
    `- Latest completed phase: ${state.latestPhase || "not found"}.`,
    `- Latest result path: ${state.latestResultPath || "not found"}.`,
    "- Phase383 intermediate evidence is excluded while selecting the previous completed baseline.",
    "- Missing Phase381 / Phase382 closures are future-phase state and are not blockers.",
    "- Old evidence is read-only and is not rewritten.",
  ].join("\n"),
);

console.log(JSON.stringify(evidence, null, 2));
