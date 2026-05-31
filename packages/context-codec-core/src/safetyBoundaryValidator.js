import {
  guardSecretLikeValues,
  hasExposedSecretLikeValue,
  maskSecretLikeText,
} from "./secretLikeGuard.js";

export { guardSecretLikeValues, maskSecretLikeText };

export function sanitizeCodecInput(value) {
  return guardSecretLikeValues(value).value;
}

export function validateSafetyBoundary({ compactContext, safetyBoundary = {} }) {
  const secretValueExposed = hasExposedSecretLikeValue(compactContext);
  const providerCallsAllowed = safetyBoundary.providerCallsAllowed === true;
  const secretReadAllowed =
    safetyBoundary.secretReadAllowed === true || safetyBoundary.secretAccessAllowed === true;
  return {
    safetyBoundaryPreserved: !secretValueExposed && !providerCallsAllowed && !secretReadAllowed,
    secretValueExposed,
    providerCallsAllowed,
    secretReadAllowed,
  };
}
