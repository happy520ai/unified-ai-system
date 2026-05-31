import { buildValidationResult, paths, writeJson } from "../phase1601_1620/phase1601-1620-global-stabilization-common.mjs";

const result = buildValidationResult();
writeJson(paths.validation, result);

console.log(JSON.stringify({
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  bugTotal: result.bugTotal,
  p0BugCount: result.p0BugCount,
  p1BugCount: result.p1BugCount,
  p2BugCount: result.p2BugCount,
  p3BugCount: result.p3BugCount,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
  regressionPassed: result.regressionPassed,
  browserWalkthroughPassed: result.browserWalkthroughPassed,
  secretSafetyPassed: result.secretSafetyPassed,
  productRecoveryPassed: result.productRecoveryPassed,
  localSelfUseStableCandidate: result.localSelfUseStableCandidate,
}, null, 2));

if (result.blocker) process.exitCode = 1;
