import { DEFAULT_BRAIN_BINDING } from "../../workforce-contracts/src/index.js";

export const modelBrainBindingPolicy = Object.freeze({
  defaultMode: "dry_run",
  providerCallsMade: false,
  approvalRequiredForRealProviderCall: true,
  maxRequestsPerTask: 0,
  maxEstimatedCostUsd: 0,
});

export function createPreviewBrainBinding(overrides = {}) {
  return {
    ...DEFAULT_BRAIN_BINDING,
    ...overrides,
    mode: overrides.mode || "dry_run",
    maxRequestsPerTask: 0,
    maxEstimatedCostUsd: 0,
    approvalRequired: true,
  };
}
