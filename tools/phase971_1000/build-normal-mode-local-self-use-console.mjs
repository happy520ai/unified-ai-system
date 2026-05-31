import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalSelfUseConsoleModel } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildLocalSelfUseConsoleModel({ mode: "normal" });
writeJson(paths.normalConsole, result);
writeDoc("docs/phase971-1000/phase981-normal-mode-local-self-use-console.md", {
  title: "Phase981 Normal Mode Local Self-use Console",
  goal: "Describe Normal Mode local self-use boundaries.",
  facts: [result.description],
  boundaries: ["No default route mutation."],
  outputs: [paths.normalConsole],
});
logResult(result);
