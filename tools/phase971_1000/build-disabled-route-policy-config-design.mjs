import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildDisabledRoutePolicyConfigDesign } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildDisabledRoutePolicyConfigDesign();
writeJson(paths.disabledPolicy, result);
writeDoc("docs/phase971-1000/phase976-disabled-by-default-route-policy-config-design.md", {
  title: "Phase976 Disabled-by-default Route Policy Config Design",
  goal: "Document disabled route policy config preview without applying runtime changes.",
  facts: [`defaultEnabled=${result.defaultEnabled}`, `routePolicyAppliedToRuntime=${result.routePolicyAppliedToRuntime}`],
  boundaries: ["Design only.", "Future approval required."],
  outputs: [paths.disabledPolicy],
});
logResult(result);
