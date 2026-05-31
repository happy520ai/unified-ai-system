import { createYiyiModelBrainReadiness } from "./yiyiModelBrainContract.js";

export const yiyiModelBrainReadiness = createYiyiModelBrainReadiness();

export function getYiyiModelBrainReadiness() {
  return { ...yiyiModelBrainReadiness };
}
