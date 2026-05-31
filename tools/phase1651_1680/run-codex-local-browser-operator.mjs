import { runCodexLocalBrowserOperator } from "./browser-operator-common.mjs";

const result = await runCodexLocalBrowserOperator({ requestedPhase: "Phase1651-1680AIO" });
if (result.blocker) process.exitCode = 1;
