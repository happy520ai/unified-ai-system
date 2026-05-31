import { buildYiyiMissionContext } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiMissionContextBuilder.js";
import { ensure, phase381Safety, readJson, writeJson, writeText } from "../phase381-common.mjs";

const examples = await readJson("docs/phase381b-yiyi-mission-context-examples.json");
const security = buildYiyiMissionContext({ currentMode: "security" });
const tianshu = buildYiyiMissionContext({ currentMode: "tianshu", providerState: "unconfigured" });

ensure(examples.length >= 2, "Mission context examples missing.");
ensure(security.dryRunOnly === true, "Mission context must be dry-run only.");
ensure(security.providerCallsAllowed === false, "Provider calls must not be allowed.");
ensure(security.deployAllowed === false, "Deploy must not be allowed.");
ensure(security.blockedActions.includes("read_secret"), "read_secret must be blocked.");
ensure(tianshu.recommendedPanel === "tianshu_flight_path", "Tianshu panel mismatch.");

const result = {
  phase: "Phase381B",
  missionContextBuilderCreated: true,
  missionContextExamplesCreated: true,
  dryRunOnly: true,
  providerCallsAllowed: false,
  deployAllowed: false,
  credentialRefRequired: true,
  evidenceAvailable: true,
  validationPassed: true,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381b/yiyi-mission-context-builder-result.json", result);
await writeText("docs/phase381b-yiyi-mission-context-builder.md", [
  "# Phase381B Yiyi Mission Context Builder",
  "",
  "- Converts Mission Control UI state into local Yiyi Brain context.",
  "- Includes mode, selected panel, risk level, Security Shield state, Evidence Timeline availability, provider state, allowed actions, and blocked actions.",
  "- Does not read secrets, call providers, access vault runtime, modify evidence, or trigger actions.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
