import type { ClearRuntimeProviderCredentialResult } from "@unified-ai-system/shared-contracts";

type Application = {
  runtimeCredentialStore?: { has(providerId: string): boolean; clear(providerId: string): boolean };
  providerRegistry?: { get(providerId: string): unknown };
  enterpriseGovernanceService?: { recordAudit(event: Record<string, unknown>): unknown };
};

/** The HTTP boundary supplies its authenticated platform identity, never request JSON. */
export async function clearRuntimeProviderCredential(
  application: Application,
  body: unknown,
  identity: unknown,
): Promise<ClearRuntimeProviderCredentialResult> {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 1 || !("providerId" in body)
    || typeof body.providerId !== "string" || !/^[a-z][a-z0-9._-]{0,127}$/.test(body.providerId)) {
    throw clearError("provider_runtime_credential_clear_invalid_request", 400,
      "Provide exactly one canonical providerId; credential values are not accepted.");
  }
  const providerId = body.providerId;
  const store = application.runtimeCredentialStore;
  const audit = application.enterpriseGovernanceService;
  if (!store || typeof store.clear !== "function" || typeof store.has !== "function"
    || !audit || typeof audit.recordAudit !== "function") {
    throw clearError("provider_runtime_credential_clear_unavailable", 503,
      "Runtime credential clearing requires the credential store and audit service.");
  }
  // Stored credentials remain removable after their provider leaves the registry.
  let knownProvider = store.has(providerId);
  try { knownProvider ||= Boolean(application.providerRegistry?.get(providerId)); } catch { /* unknown */ }
  if (!knownProvider) {
    throw clearError("provider_runtime_credential_clear_provider_unavailable", 404,
      "The provider is not registered and has no stored runtime credential.");
  }
  const auditEvent = {
    method: "DELETE", path: "/providers/runtime-credential", permission: "provider:write", identity,
  };
  try {
    await audit.recordAudit({ ...auditEvent, outcome: "authorized",
      code: "provider_runtime_credential_clear_requested", details: { providerId } });
  } catch {
    throw clearError("provider_runtime_credential_clear_audit_unavailable", 503,
      "The audit record could not be committed; no credential was cleared.", { operationStarted: false });
  }

  let removed: boolean;
  try {
    removed = store.clear(providerId);
    if (typeof removed !== "boolean") throw new Error("Invalid clear receipt.");
  } catch {
    // Storage errors may contain private paths or credential material.
    throw clearError("provider_runtime_credential_clear_unconfirmed", 503,
      "Credential clearing could not be confirmed; reconcile the runtime store before retrying.",
      { providerId, operationStarted: true, reconciliationRequired: true });
  }
  const result: ClearRuntimeProviderCredentialResult = {
    providerId, removed, scope: "runtime-credential-store", appliesTo: "subsequent-credential-lookups",
    inFlightRequestsCancelled: false, providerKeyRevoked: false,
    otherCredentialSourcesModified: false, otherProcessesInvalidated: false,
  };
  try {
    await audit.recordAudit({ ...auditEvent, outcome: "allowed", statusCode: 200,
      code: "provider_runtime_credential_cleared", details: result });
  } catch {
    throw clearError("provider_runtime_credential_clear_result_audit_unconfirmed", 503,
      "The store operation completed but its result audit failed; reconcile before retrying.",
      { ...result, operationCommitted: true, reconciliationRequired: true });
  }
  return result;
}

function clearError(code: string, statusCode: number, message: string, details?: Record<string, unknown>) {
  return Object.assign(new Error(message), {
    code, statusCode, category: statusCode === 400 ? "validation" : "provider", retryable: false,
    ...(details ? { details } : {}),
  });
}
