import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalSelfUseConsoleModel } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildLocalSelfUseConsoleModel({ mode: "tianshu" });
writeJson(paths.tianshuConsole, result);
writeDoc("docs/phase971-1000/phase983-tianshu-mode-local-self-use-console.md", {
  title: "Phase983 Tianshu Mode Local Self-use Console",
  goal: "Describe Tianshu local self-use planner/executor boundaries.",
  facts: [result.description],
  boundaries: ["Guarded by default.", "More evidence required before runtime tuning."],
  outputs: [paths.tianshuConsole],
});
logResult(result);
