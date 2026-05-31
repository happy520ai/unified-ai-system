import { writeDocsAndEvidence } from "./phase1601-1620-global-stabilization-common.mjs";

const result = writeDocsAndEvidence();

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
  localSelfUseStableCandidate: result.localSelfUseStableCandidate,
}, null, 2));

if (!result.completed) process.exitCode = 1;
