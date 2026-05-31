import { runCodexLocalBrowserOperator } from "../phase1651_1680/browser-operator-common.mjs";

const result = await runCodexLocalBrowserOperator({ requestedPhase: "Phase1664" });
if (result.blocker) process.exitCode = 1;
