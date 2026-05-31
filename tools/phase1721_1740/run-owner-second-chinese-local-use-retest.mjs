import { runOwnerSecondChineseLocalUseRetest } from "./owner-second-retest-common.mjs";

const result = await runOwnerSecondChineseLocalUseRetest();
console.log(JSON.stringify({
  phase: "Phase1740",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  secondChineseBossViewRetestReady: result.secondChineseBossViewRetestReady,
  secondDailyUseRecordDraftGenerated: result.secondDailyUseRecordDraftGenerated,
  secondOwnerReadableReportGenerated: result.secondOwnerReadableReportGenerated,
  beforeAfterComparisonGenerated: result.beforeAfterComparisonGenerated,
  ownerSubjectiveFieldsLeftBlank: result.ownerSubjectiveFieldsLeftBlank,
  providerCallsMade: result.providerCallsMade,
  chatModified: result.chatModified,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified,
  deployExecuted: result.deployExecuted,
  productionReadyClaimed: result.productionReadyClaimed,
}, null, 2));

if (result.blocker) process.exitCode = 1;
