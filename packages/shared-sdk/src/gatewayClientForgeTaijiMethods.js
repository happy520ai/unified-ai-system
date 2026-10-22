// Extracted verbatim from createGatewayClient's returned object so the
// forge and Taiji domain methods live beside the SDK entrypoint. The methods
// receive the shared request context and keep their exact bodies; behaviour
// unchanged.
import { snapshotForgeOrchestrateRequest, validateForgeMediaResponse } from "./forgeMediaResponse.js";

export function createGatewayForgeTaijiMethods(ctx) {
  const { baseUrl, headers, timeoutMs, providerDispatchKeyFactory, requestJson, operatorPost, prepareProviderRequest, forgeMediaClientError, createProviderKeyConfigurationError } = ctx;
  return {
    forgeStatus() { return requestJson({ path: "/forge/status", redirect: "error" }); },
    forgeRuns() { return requestJson({ path: "/forge/runs", redirect: "error" }); },
    forgePolish(request) { return operatorPost("/forge/polish", request, true); },
    forgeQuality(request) { return operatorPost("/forge/quality", request); },
    forgeRemember(request) { return operatorPost("/forge/memory", { ...request, action: "remember" }); },
    forgeRecall(request) { return requestJson({ path: "/forge/memory", method: "POST", body: { ...request, action: "recall" }, redirect: "error" }); },
    async forgeOrchestrate(request) {
      try {
        const snapshot = snapshotForgeOrchestrateRequest(request);
        if (!Object.hasOwn(snapshot.options ?? {}, "mediaTask")) return operatorPost("/forge/orchestrate", snapshot, true);
        const prepared = prepareProviderRequest(snapshot, headers, providerDispatchKeyFactory);
        const response = await requestJson({ path: "/forge/orchestrate", method: "POST", body: prepared.body,
          headers: prepared.headers, redirect: "error", mediaResponse: true });
        return await validateForgeMediaResponse(response, snapshot);
      } catch (error) { throw forgeMediaClientError(error); }
    },
    taijiCompile(request) { return operatorPost("/taiji/compile", request); },
    taijiCapabilities(agentId, options = {}) {
      if (typeof agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/.test(agentId)) throw createProviderKeyConfigurationError("A root Agent ID is required.");
      const query = new URLSearchParams({ agentId });
      for (const [name, min, max] of [["limit", 1, 100], ["offset", 0, 1000]]) {
        if (options[name] !== undefined) {
          if (!Number.isSafeInteger(options[name]) || options[name] < min || options[name] > max) throw createProviderKeyConfigurationError("Invalid capability pagination.");
          query.set(name, String(options[name]));
        }
      }
      return requestJson({ path: `/taiji/capabilities?${query}`, redirect: "error" });
    },
    taijiCapabilityRun(agentId, runId) {
      if (typeof agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/.test(agentId)
        || typeof runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(runId)) throw createProviderKeyConfigurationError("Bounded Agent and run IDs are required.");
      return requestJson({ path: `/taiji/capabilities/runs/${encodeURIComponent(runId)}?agentId=${encodeURIComponent(agentId)}`, redirect: "error" });
    },
    evaluateTaijiCapability(request) { return operatorPost("/taiji/capabilities/evaluate", request); },
    activateTaijiCapability(request) { return operatorPost("/taiji/capabilities/activate", request); },
    executeTaijiCapability(request) { return operatorPost("/taiji/capabilities/execute", request); },
    revokeTaijiCapability(request) { return operatorPost("/taiji/capabilities/revoke", request); },
    repairTaijiCapability(request) { return operatorPost("/taiji/capabilities/repair", request); },
    reweightTaijiCapability(request) { return operatorPost("/taiji/capabilities/reweight", request); },
    pruneTaijiCapability(request) { return operatorPost("/taiji/capabilities/prune", request); },
  };
}
