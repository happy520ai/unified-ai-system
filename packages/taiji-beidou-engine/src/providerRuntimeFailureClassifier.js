export function classifyProviderRuntimeResponse(input = {}) {
  if (input.blockedReason) return `blocked_by_${input.blockedReason}`;
  if (input.providerCallFailed === true) return "provider_call_failed";
  if (input.responseReceived !== true) return "blocked_by_missing_approval";
  const text = String(input.responseText || "");
  if (text.includes("TAIJI_BEIDOUREAL_PROVIDER_RUNTIME_OK")) return "pass";
  return "provider_response_received_but_marker_missing";
}
