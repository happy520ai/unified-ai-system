import { runSecondBrowserWalkthroughEvidence } from "../phase1721_1740/owner-second-retest-common.mjs";

const result = await runSecondBrowserWalkthroughEvidence();
console.log(JSON.stringify({
  phase: "Phase1737",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  success: result.success,
  localServiceDetected: result.localServiceDetected,
  browserLaunched: result.browserLaunched,
  missionControlOpened: result.missionControlOpened,
  chineseBossViewEntryVisible: result.chineseBossViewEntryVisible,
  buttonFeedbackRetested: result.buttonFeedbackRetested,
  screenshotPath: result.screenshotPath,
  domSnapshotPath: result.domSnapshotPath,
  providerCallsMade: result.providerCallsMade,
}, null, 2));

if (result.blocker) process.exitCode = 1;
