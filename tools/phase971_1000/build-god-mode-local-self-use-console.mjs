import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalSelfUseConsoleModel } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildLocalSelfUseConsoleModel({ mode: "god" });
writeJson(paths.godConsole, result);
writeDoc("docs/phase971-1000/phase982-god-mode-local-self-use-console.md", {
  title: "Phase982 God Mode Local Self-use Console",
  goal: "Describe God Mode local self-use boundaries and marker rerun status.",
  facts: [result.description, "Phase966-970 marker rerun passed; this remains Codex surrogate review, not human review."],
  boundaries: ["No human review claim.", "No runtime policy application."],
  outputs: [paths.godConsole],
});
logResult(result);
