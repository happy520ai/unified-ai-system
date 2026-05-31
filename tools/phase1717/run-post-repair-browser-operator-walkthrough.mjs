import { runPostRepairBrowserWalkthrough } from "../phase1701_1720/owner-p1-ui-repair-common.mjs";

const result = await runPostRepairBrowserWalkthrough();
console.log(JSON.stringify({
  phase: "Phase1717",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  postRepairBrowserWalkthroughPassed: result.postRepairBrowserWalkthroughPassed,
  screenshotPath: result.screenshotPath,
  domSnapshotPath: result.domSnapshotPath,
  providerCallsMade: result.providerCallsMade,
  pluginAppsUsed: result.pluginAppsUsed,
  toolType: result.toolType,
}, null, 2));

if (result.blocker) process.exitCode = 1;
