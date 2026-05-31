import { BRAIN_BINDING_MODES, DEFAULT_BRAIN_BINDING, validateBrainBinding } from "../../workforce-contracts/src/index.js";

export const brainBindingSchema = Object.freeze({
  fields: [
    "mode",
    "providerRef",
    "modelRef",
    "credentialRef",
    "allowedModes",
    "maxRequestsPerTask",
    "maxEstimatedCostUsd",
    "timeoutMs",
    "fallbackPolicy",
    "approvalRequired",
  ],
  modes: BRAIN_BINDING_MODES,
  defaultBinding: DEFAULT_BRAIN_BINDING,
});

export function validateBrainBindingSchema(binding = DEFAULT_BRAIN_BINDING) {
  const missing = brainBindingSchema.fields.filter((field) => !(field in binding));
  const base = validateBrainBinding(binding);
  return {
    valid: missing.length === 0 && base.valid,
    missing,
    ...base,
  };
}
