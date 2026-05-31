export async function workbenchFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  return payload?.data ?? payload;
}

export function createWorkbenchApiClient(baseHeaders = { "content-type": "application/json" }) {
  return {
    // ── Phase323D Bridge: diagnostics (safe, read-only, no external API) ──
    async getDiagnosticsStatus() {
      return workbenchFetchJson("/workbench/diagnostics/status", {
        method: "GET",
      });
    },

    // ── Phase323D Bridge: providerConfig status/save/test ──
    async getProviderConfigStatus() {
      return workbenchFetchJson("/provider-config/status", {
        method: "GET",
      });
    },
    async saveProviderConfig(body) {
      return workbenchFetchJson("/provider-config/save", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(body),
      });
    },
    async testProviderConfig(body) {
      return workbenchFetchJson("/provider-config/test", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(body),
      });
    },

    // ── Phase323D Bridge: fileContext (registration/preview only, no file read) ──
    async selectFileContext(body) {
      return workbenchFetchJson("/file-context/select", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(body),
      });
    },

    // ── Intentionally NOT bridged yet ──
    // Chat send: intentionally not migrated -- /chat-gateway/execute is the real main chain
    // Approvals: intentionally not migrated -- apply-approved involves file write safety

    // ── Existing compatibility methods (read-only GET, not for Chat send) ──
    async listApprovals() {
      return workbenchFetchJson("/approvals", {
        method: "GET",
      });
    },
    async previewLocalAgentIntent(body) {
      const payload = {
        ...body,
        dryRun: true,
        mode: "intent-preview",
      };
      delete payload.applyApproved;
      delete payload.execute;
      delete payload.write;
      return workbenchFetchJson("/local-agent/intent-preview", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(payload),
      });
    },

    // ── General-purpose helpers (used by existing bridge callers) ──
    async postJson(url, body) {
      return workbenchFetchJson(url, {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(body),
      });
    },
    async getJson(url) {
      return workbenchFetchJson(url, {
        method: "GET",
      });
    },
  };
}
