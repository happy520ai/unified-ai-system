import {
  buildMasterResult,
  buildRoundResult,
  isSealed,
  parseArgs,
  paths,
  readJson,
  renderMasterDoc,
  renderProviderApprovalPacket,
  renderRollbackRunbook,
  roundEvidencePath,
  roundsUntil,
  title,
  writeJson,
  writeText,
} from "./phase1476-1600-route-a-common.mjs";

const options = parseArgs();
const selectedRounds = roundsUntil(options.until);
const upstream = await readJson(paths.upstreamPhase1476Validation, null);
const upstreamPhase1476Ready = isSealed(upstream);

await writeText(paths.masterDoc, renderMasterDoc());
await writeText(paths.providerApprovalPacket, renderProviderApprovalPacket());
await writeText(paths.rollbackRunbook, renderRollbackRunbook());

const roundResults = [];
let previousRoundResult = null;
for (const round of selectedRounds) {
  const roundResult = buildRoundResult(round, previousRoundResult, upstreamPhase1476Ready);
  await writeJson(roundEvidencePath(round.id), roundResult);
  roundResults.push(roundResult);
  previousRoundResult = roundResult;
  if (!isSealed(roundResult)) break;
}

const masterResult = buildMasterResult(roundResults, upstreamPhase1476Ready);
await writeJson(paths.masterResult, masterResult);

console.log(JSON.stringify({
  phaseRange: masterResult.phaseRange,
  title,
  routeChoice: masterResult.routeChoice,
  completed: masterResult.completed,
  recommended_sealed: masterResult.recommended_sealed,
  blocker: masterResult.blocker,
  roundCount: masterResult.roundCount,
  providerCallsMade: masterResult.providerCallsMade,
  chatModified: masterResult.chatModified,
  chatGatewayExecuteModified: masterResult.chatGatewayExecuteModified,
}, null, 2));

if (!isSealed(masterResult)) process.exitCode = 1;
