export function buildSourceRef({ sourceId, sourceVersion, sourceUrl, retrievedAt }) {
  const safeSourceId = String(sourceId || "unknown").toLowerCase();
  return {
    sourceRef: `${safeSourceId}:${sourceVersion || "unversioned"}:${retrievedAt || "not-retrieved"}`,
    sourceId: safeSourceId,
    sourceVersion: sourceVersion || null,
    sourceUrl: sourceUrl || null,
    retrievedAt: retrievedAt || null,
    rawSecretAccessed: false,
    providerCallsMade: false,
  };
}

