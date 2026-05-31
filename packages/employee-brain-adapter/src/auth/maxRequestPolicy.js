export function validateMaxRequestPolicy(authorization = {}) {
  const maxRequests = Number(authorization.maxRequests);
  return {
    valid: Number.isInteger(maxRequests) && maxRequests > 0 && maxRequests <= 5,
    maxRequests,
  };
}

