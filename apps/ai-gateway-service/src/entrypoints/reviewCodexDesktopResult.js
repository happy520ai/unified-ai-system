import { reviewLatestCodexDesktopResult } from "./codexDesktopReviewCore.js";

async function main() {
  const review = await reviewLatestCodexDesktopResult();
  console.log(JSON.stringify({
    status: "reviewed",
    goNoGo: review.goNoGo,
    boundaryViolationCount: review.boundaryViolationCount,
    verificationGapCount: review.verificationGapCount,
    evidenceGapCount: review.evidenceGapCount,
    requiresHumanReview: review.requiresHumanReview,
    recommendedNextAction: review.recommendedNextAction,
    outputPaths: review.outputPaths,
    codexCliInvoked: false,
    codexExecInvoked: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
