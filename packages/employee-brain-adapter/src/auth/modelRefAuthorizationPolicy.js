export function authorizeModelRef(modelRef, authorization = {}) {
  return {
    allowed: Array.isArray(authorization.allowedModelRefs) && authorization.allowedModelRefs.includes(modelRef),
    modelRef,
  };
}

