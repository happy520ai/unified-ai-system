import { runAllPhase1131_1180 } from "./phase1131-1180-common.mjs";

const result = await runAllPhase1131_1180();
console.log(JSON.stringify(result, null, 2));
if (result.phase1131_1140Sealed !== true || result.phase1161_1180Sealed !== true) {
  process.exitCode = 1;
}
