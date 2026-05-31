import {
  containsSecretLikeValue,
  globalBoundary,
  isSealed,
  parseArgs,
  paths,
  phaseRange,
  providerGate,
  readJson,
  readText,
  roundDefinitions,
  roundEvidencePath,
  routeChoice,
  writeJson,
} from "./phase1476-1600-route-a-common.mjs";

const options = parseArgs();
const targetRound = options.round ?? null;
const master = await readJson(paths.masterResult, null);
const upstream = await readJson(paths.upstreamPhase1476Validation, null);
const packageJson = await readJson(paths.packageJson, null);
const readme = await readText(paths.readme, "");
const agents = await readText(paths.agents, "");
const syncSource = await readText(paths.syncSource, "");
const masterDoc = await readText(paths.masterDoc, "");
const approvalPacket = await readText(paths.providerApprovalPacket, "");
const rollbackRunbook = await readText(paths.rollbackRunbook, "");
const commonSource = await readText("tools/phase1476-1600-route-a/phase1476-1600-route-a-common.mjs", "");
const runnerSource = await readText("tools/phase1476-1600-route-a/run-route-a-master-control.mjs", "");

const roundResults = [];
for (const round of roundDefinitions) {
  const result = await readJson(roundEvidencePath(round.id), null);
  if (result) roundResults.push(result);
}

const selectedRound = targetRound ? roundResults.find((round) => round.phaseRange === targetRound) : null;
const validationScope = targetRound ?? phaseRange;
const checks = {
  upstreamPhase1476Sealed: isSealed(upstream),
  masterResultExists: Boolean(master),
  masterPhaseRange: master?.phaseRange === phaseRange,
  masterRouteChoice: master?.routeChoice === routeChoice,
  masterCompleted: targetRound ? Boolean(master) : isSealed(master),
  masterRoundCount: targetRound ? roundResults.length >= 1 : master?.roundCount === roundDefinitions.length,
  targetRoundExists: targetRound ? Boolean(selectedRound) : true,
  targetRoundSealed: targetRound ? isSealed(selectedRound) : true,
  allExpectedRoundsPresent: targetRound ? true : roundResults.length === roundDefinitions.length,
  allRoundsSealed: targetRound ? true : roundResults.every(isSealed),
  continuationGateHeld: roundResults.every((round, index) => {
    if (index === 0) return round.continuationGate?.previousRoundReady === true;
    return roundResults[index - 1]?.completed === true && round.continuationGate?.previousRoundReady === true;
  }),
  allPhaseStatusesSealed: roundResults.every((round) =>
    Array.isArray(round.phaseStatuses) &&
    round.phaseStatuses.length === round.phaseCount &&
    round.phaseStatuses.every(isSealed),
  ),
  routeChoiceLocalSelfUseOnly: [master, ...roundResults].filter(Boolean).every((item) => item.routeChoice === routeChoice),
  providerGateNoRealCall:
    master?.providerGate?.realProviderTestAllowed === false &&
    master?.providerGate?.gateSatisfiedForRealCall === false &&
    JSON.stringify(master?.providerGate) === JSON.stringify(providerGate),
  globalBoundaryHeld: [master, ...roundResults].filter(Boolean).every((item) =>
    Object.entries(globalBoundary).every(([key, expected]) => item[key] === expected),
  ),
  docsPresent:
    masterDoc.includes("Phase1476-1600 Local Self-Use Route A Master Control") &&
    approvalPacket.includes("Provider Approval Packet Template") &&
    rollbackRunbook.includes("Rollback Runbook"),
  packageScriptsPresent:
    packageJson?.scripts?.["smoke:phase1476-1600-local-self-use-route-a"] ===
      "pnpm run smoke:phase1476-concept-field-kernel && node tools/phase1476-1600-route-a/run-route-a-master-control.mjs && node tools/phase1476-1600-route-a/validate-route-a-master-control.mjs" &&
    packageJson?.scripts?.["verify:phase1476-1600-local-self-use-route-a"] ===
      "node tools/phase1476-1600-route-a/validate-route-a-master-control.mjs",
  roundScriptsPresent: roundDefinitions.every((round) => {
    const scriptId = round.id.toLowerCase().replace("aio", "a-local-self-use-route-a");
    return (
      packageJson?.scripts?.[`smoke:${scriptId}`] ===
        `pnpm run smoke:phase1476-concept-field-kernel && node tools/phase1476-1600-route-a/run-route-a-master-control.mjs --until=${round.id} && node tools/phase1476-1600-route-a/validate-route-a-master-control.mjs --round=${round.id}` &&
      packageJson?.scripts?.[`verify:${scriptId}`] ===
        `node tools/phase1476-1600-route-a/validate-route-a-master-control.mjs --round=${round.id}`
    );
  }),
  readmeAgentsSyncSourceUpdated:
    syncSource.includes("Phase1476-1600 Local Self-Use Route A Master Control") &&
    syncSource.includes("local_self_use_only"),
  readmeAgentsUpdated:
    readme.includes("Phase1476-1600 Local Self-Use Route A Master Control") &&
    agents.includes("Phase1476-1600 Local Self-Use Route A Master Control"),
  noNetworkCode:
    !/(?:^|\s)(?:fetch|axios|undici|got)\s*\(|node:https|node:http|\bhttps?\./i.test(
      `${commonSource}\n${runnerSource}`,
    ),
  noSecretLikeText: !containsSecretLikeValue(
    `${masterDoc}\n${approvalPacket}\n${rollbackRunbook}\n${JSON.stringify(master ?? {})}\n${JSON.stringify(roundResults)}`,
  ),
  noProductionOrAgiClaim:
    [master, ...roundResults].filter(Boolean).every((item) =>
      item.productionReadyClaimed === false &&
      item.agiClaimed === false &&
      item.llmReplacementClaimed === false &&
      item.trillionModelSurpassClaimed === false,
    ),
};

const blocker = Object.entries(checks).find(([, value]) => value !== true)?.[0] ?? null;
const validation = {
  phaseRange: validationScope,
  routeChoice,
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  targetRound,
  checkedRoundCount: roundResults.length,
  checks,
  providerCallsMade: false,
  manualHumanTestClaimed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  workspaceCleanClaimed: false,
};

await writeJson(paths.validation, validation);

console.log(JSON.stringify({
  phaseRange: validation.phaseRange,
  routeChoice: validation.routeChoice,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  checkedRoundCount: validation.checkedRoundCount,
}, null, 2));

if (blocker) process.exitCode = 1;
