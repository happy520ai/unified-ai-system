import { buildRegressionResult, buildSealResult, paths, readJson, runPostRepairBrowserWalkthrough } from "../phase1701_1720/owner-p1-ui-repair-common.mjs";

const existingWalkthrough = await readJson(paths.browserWalkthrough, {});
if (existingWalkthrough?.postRepairBrowserWalkthroughPassed !== true) {
  await runPostRepairBrowserWalkthrough();
}

const existingRegression = await readJson(paths.regression, {});
if (existingRegression?.regressionRecheckPassed !== true) {
  await buildRegressionResult();
}

const result = await buildSealResult();
console.log(JSON.stringify({
  phase: "Phase1720",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  ownerP1UiRepairCompleted: result.ownerP1UiRepairCompleted,
  postRepairBrowserWalkthroughPassed: result.postRepairBrowserWalkthroughPassed,
  ownerReadableSummaryGenerated: result.ownerReadableSummaryGenerated,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
  providerCallsMade: result.providerCallsMade,
  rawSecretRead: result.rawSecretRead,
  authJsonRead: result.authJsonRead,
  rawCredentialRefRead: result.rawCredentialRefRead,
  chatModified: result.chatModified,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified,
  deployExecuted: result.deployExecuted,
  productionReadyClaimed: result.productionReadyClaimed,
}, null, 2));

if (result.blocker) process.exitCode = 1;
