import { runCodexLocalBrowserOperator } from "../phase1651_1680/browser-operator-common.mjs";

const result = await runCodexLocalBrowserOperator({ requestedPhase: "Phase1671" });
if (result.blocker) process.exitCode = 1;
