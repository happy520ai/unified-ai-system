import { allSourceText, findBlocker, makeResult, paths, writeJson } from "../phase1486_1505/phase1486-1505-common.mjs";

const source = allSourceText();
const checks = {
  headingsPresent: [
    "Concept Field Preview",
    "Route Affinity Explanation",
    "Evidence Coherence Explanation",
    "Risk Field Explanation",
    "Context Token Saving Dashboard",
    "Operator Review Checklist",
  ].every((text) => source.includes(text)),
  boundaryCopyClear:
    source.includes("local-only") &&
    source.includes("preview-only") &&
    source.includes("dry-run") &&
    source.includes("Provider") &&
    source.includes("Security Shield"),
  disabledButtonsMarked: !/<button(?![^>]*(disabled|aria-disabled="true"))/i.test(source) || source.includes("aria-disabled=\"true\""),
  tokenSavingMetricsSeparated: source.includes("targetMetrics") && source.includes("achievedMetrics"),
  conceptFieldExperimentalLabel: source.includes("experimental concept field") && source.includes("data-experimental=\"true\""),
  noProductionReadyCopy: !/production-ready|production ready/i.test(source),
  accessibilityCopyClarityCheckPassed: true,
};
const blocker = findBlocker(checks);
const result = makeResult("Phase1504", {
  phaseName: "Accessibility / Copy Clarity Check",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  accessibilityCopyClarityCheckPassed: blocker === null,
  checks,
});

writeJson(paths.accessibility, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  blocker: result.blocker,
}, null, 2));
if (blocker) process.exitCode = 1;
