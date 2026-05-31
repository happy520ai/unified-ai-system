import { printJson } from "./opencodeLoopShared.js";
import { reviewLatestOpenCodeResult } from "./opencodeReviewCore.js";

async function main() {
  const review = await reviewLatestOpenCodeResult();
  printJson({
    status: "reviewed",
    goNoGo: review.goNoGo,
    goalDirection: review.goalDirection,
    completionVerified: review.completionVerified,
    boundaryViolationCount: review.boundaryViolationCount,
    verificationGapCount: review.verificationGapCount,
    evidenceGapCount: review.evidenceGapCount,
    requiresHumanReview: review.requiresHumanReview,
    recommendedNextAction: review.recommendedNextAction,
    outputPaths: review.outputPaths,
    providerCalledByThisProcess: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
  });
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
