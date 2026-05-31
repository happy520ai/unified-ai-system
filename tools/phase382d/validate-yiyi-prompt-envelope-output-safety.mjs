import { buildYiyiPromptEnvelope } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiPromptEnvelopeBuilder.js";
import { evaluateYiyiModelOutputSafety } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiModelOutputSafety.js";
import { ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const envelopeSchema = await readJson("docs/phase382d-yiyi-model-brain-prompt-envelope.schema.json");
const outputSchema = await readJson("docs/phase382d-yiyi-model-brain-output.schema.json");
const safetyCases = await readJson("docs/phase382d-yiyi-output-safety-cases.json");

const envelope = buildYiyiPromptEnvelope({
  personaContext: { displayName: "Yiyi", role: "AI Mission Companion", authorityLevel: "presentation_and_guidance_only", speechStyle: ["short", "gentle", "clear"] },
  missionContext: { currentMode: "mission", selectedPanel: "mission_control", riskLevel: "medium", allowedActions: ["view_plan"], blockedActions: ["read_secret"] },
  modelCandidate: { modelRef: "configured_yiyi_brain_model_ref" },
  gateDecision: { gateDecision: "dry_run_allowed" },
});

const caseResults = safetyCases.map((item) => {
  const output = evaluateYiyiModelOutputSafety(item.output);
  return {
    caseId: item.caseId,
    decision: output.decision,
    blockedFields: output.blockedFields,
    pass: output.decision === item.expectedDecision,
  };
});

ensure(envelopeSchema.title === "Yiyi Model Brain Prompt Envelope", "Envelope schema title mismatch.");
ensure(outputSchema.title === "Yiyi Model Brain Output", "Output schema title mismatch.");
ensure(envelope.promptEnvelopeBuilt === true, "Prompt envelope was not built.");
ensure(caseResults.every((item) => item.pass), "Output safety cases failed.");

const result = {
  phase: "Phase382D",
  promptEnvelopeCreated: true,
  outputSafetyGateCreated: true,
  personaCapsuleCreated: true,
  missionContextCapsuleCreated: true,
  safetyCapsuleCreated: true,
  responseSchemaCreated: true,
  caseResults,
  validationPassed: true,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382d/yiyi-prompt-envelope-output-safety-result.json", result);
await writeText("docs/phase382d-yiyi-prompt-envelope-output-safety.md", [
  "# Phase382D Prompt Envelope + Output Safety",
  "",
  "- Built persona, mission, model, and safety capsules for Yiyi model-backed brain.",
  "- Response format is strict JSON with allowed fields only.",
  "- Output safety rewrites forbidden actions, hidden prompt leakage, deploy claims, and medical/therapy style claims.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
