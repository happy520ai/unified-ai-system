import { inferCapabilityTagsFromModelId } from "./modelCapabilityTags.js";

export function enrichModelCapabilities(records = []) {
  return {
    phase: "Phase794",
    enrichedModelCount: records.length,
    enriched: records.map((record) => ({
      ...record,
      capabilities: {
        ...inferCapabilityTagsFromModelId(record.modelId),
        ...(record.capabilities ?? {}),
      },
    })),
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
  };
}
