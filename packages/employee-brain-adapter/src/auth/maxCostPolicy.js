export function validateMaxCostPolicy(authorization = {}) {
  const maxEstimatedCostUsd = Number(authorization.maxEstimatedCostUsd);
  return {
    valid: Number.isFinite(maxEstimatedCostUsd) && maxEstimatedCostUsd >= 0 && maxEstimatedCostUsd <= 10,
    maxEstimatedCostUsd,
  };
}

