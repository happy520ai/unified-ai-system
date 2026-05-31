import { buildRegressionMatrix, paths, writeJson } from "../phase1601_1620/phase1601-1620-global-stabilization-common.mjs";

const result = buildRegressionMatrix();
writeJson(paths.regressionMatrix, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;
