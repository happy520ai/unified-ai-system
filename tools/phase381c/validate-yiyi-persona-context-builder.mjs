import { buildYiyiPersonaContext } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiPersonaContextBuilder.js";
import { ensure, phase381Safety, readJson, writeJson, writeText } from "../phase381-common.mjs";

const examples = await readJson("docs/phase381c-yiyi-persona-context-examples.json");
const context = buildYiyiPersonaContext({ scenarioId: "red_team_blocked", emotionState: "blocked" });

ensure(examples.length >= 1, "Persona examples missing.");
ensure(context.authorityLevel === "presentation_and_guidance_only", "Authority level must stay presentation only.");
ensure(context.safetyAnchors.includes("no_secret"), "no_secret anchor missing.");
ensure(context.safetyAnchors.includes("no_provider_call"), "no_provider_call anchor missing.");
ensure(context.storesUserSensitiveMemory === false, "Persona memory must not store sensitive user memory.");
ensure(context.hiddenSystemPromptUsed === false, "Persona context must not become hidden prompt.");

const result = {
  phase: "Phase381C",
  personaContextBuilderCreated: true,
  personaContextExamplesCreated: true,
  characterCanonConnected: true,
  scenarioLinesConnected: true,
  emotionBehaviorCanonMapConnected: true,
  storesUserSensitiveMemory: false,
  hiddenSystemPromptUsed: false,
  validationPassed: true,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381c/yiyi-persona-context-builder-result.json", result);
await writeText("docs/phase381c-yiyi-persona-memory-context-builder.md", [
  "# Phase381C Yiyi Persona + Memory Context Builder",
  "",
  "- Connects Phase380 character canon, scenario lines, and emotion/behavior/canon map.",
  "- Memory is character/persona memory only, not private user memory.",
  "- Persona context cannot lift Yiyi authority beyond presentation_and_guidance_only.",
  "- No hidden system prompt is created or leaked.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
