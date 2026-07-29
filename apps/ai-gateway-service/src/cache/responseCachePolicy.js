export function createResponseCachePolicy(overrides = {}) {
  const policy = {
    enabled: overrides.enabled ?? true,
    mode: "local-preview-hardening",
    ttlMs: Number(overrides.ttlMs ?? 604_800_000),
    maxEntries: Number(overrides.maxEntries ?? 500),
    maxRecordBytes: Number(overrides.maxRecordBytes ?? 200_000),
    allowProviders: overrides.allowProviders ?? ["mimo", "nvidia", "local"],
    deniedRequestMarkers: ["secret", "api-key", "credential", "auth-header"],
    cacheVersion: "phase275a-v1",
    cachePolicyVersion: "phase275a-v1",
    semanticModelEnabled: false,
    semanticJudgeAvailable: false,
    semanticDecisionUsedAsFinalAuthority: false,
    allowIntentSoftHit: true,
    allowMultilingualIntentSoftHit: true,
    allowSemanticHardHit: false,
  };

  return {
    ...policy,
    cacheable: Boolean(policy.enabled && !hasDeniedMarker(overrides)),
  };
}

function hasDeniedMarker(input = {}) {
  const text = [
    input.requestType,
    input.type,
    input.query,
    input.prompt,
    input.reason,
  ].filter(Boolean).join(" ").toLowerCase();
  return ["secret", "api-key", "credential", "authorization", "auth-header"].some((marker) => text.includes(marker));
}
