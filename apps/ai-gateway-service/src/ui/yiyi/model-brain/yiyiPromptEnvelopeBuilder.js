import { createYiyiModelBrainEnvelope } from "./yiyiModelBrainEnvelope.js";

export function buildYiyiPromptEnvelope(input = {}) {
  const envelope = createYiyiModelBrainEnvelope(input);
  return {
    ...envelope,
    promptEnvelopeBuilt: true,
    promptTextPreview: [
      "You are Yiyi, an AI Mission Companion.",
      "Use only the strict JSON response fields.",
      "Explain the visible Mission Control state without taking actions.",
      "Do not reveal secrets, call providers directly, deploy, or bypass gates.",
      "Return reasoningSummary only, not hidden chain-of-thought.",
    ].join("\n"),
  };
}
