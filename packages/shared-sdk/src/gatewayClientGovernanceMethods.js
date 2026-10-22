// Extracted verbatim from createGatewayClient's returned object so the
// agent-governance domain methods live beside the SDK entrypoint. The
// governance-specific path/body guards move with the domain; the methods
// receive the shared request context and keep their exact bodies.
export function createGatewayGovernanceMethods(ctx) {
  const { baseUrl, headers, timeoutMs, providerDispatchKeyFactory, requestJson, operatorPost, prepareProviderRequest, createGatewayProtocolError } = ctx;
  return {
    agentGovernanceStats() {
      return requestJson({
        baseUrl,
        path: "/v1/governance/stats",
        headers,
        timeoutMs,
      });
    },
    generateGovernedAgent(request) {
      return requestJson({
        baseUrl,
        path: "/v1/agents/generate",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    governedAgents() {
      return requestJson({ baseUrl, path: "/v1/agents", headers, timeoutMs });
    },
    governedAgent(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}`,
        headers,
        timeoutMs,
      });
    },
    governedAgentPolicy(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/effective-policy`,
        headers,
        timeoutMs,
      });
    },
    governedAgentAudit(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/audit`,
        headers,
        timeoutMs,
      });
    },
    runGovernedAgent(agentId, request) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/run`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    prepareGovernedAgentTask(agentId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId), method: "POST",
        body: governedTaskBody(request, "prepare"), headers, timeoutMs, redirect: "error" });
    },
    governedAgentTask(agentId, taskId) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId), headers, timeoutMs, redirect: "error" });
    },
    planGovernedAgentTask(agentId, taskId, request) {
      const prepared = prepareProviderRequest(governedTaskBody(request, "plan"), headers, providerDispatchKeyFactory);
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/plan", method: "POST",
        body: prepared.body, headers: prepared.headers, timeoutMs, redirect: "error" });
    },
    confirmGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/confirm", method: "POST",
        body: governedTaskBody(request, "confirm"), headers, timeoutMs, redirect: "error" });
    },
    runGovernedAgentTask(agentId, taskId, request) {
      const prepared = prepareProviderRequest(governedTaskBody(request, "run"), headers, providerDispatchKeyFactory);
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/run", method: "POST",
        body: prepared.body, headers: prepared.headers, timeoutMs, redirect: "error" });
    },
    pauseGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/pause", method: "POST",
        body: governedTaskBody(request, "pause"), headers, timeoutMs, redirect: "error" });
    },
    reconcileGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/reconcile", method: "POST",
        body: governedTaskBody(request, "reconcile"), headers, timeoutMs, redirect: "error" });
    },
    scheduleGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/schedule", method: "POST",
        body: governedTaskBody(request, "schedule"), headers, timeoutMs, redirect: "error" });
    },
    cancelGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/cancel", method: "POST",
        body: governedTaskBody(request, "cancel"), headers, timeoutMs, redirect: "error" });
    },
    revokeGovernedAgent(agentId, request = {}) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/revoke`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    governedApprovals(agentId) {
      const query = agentId === undefined
        ? ""
        : `?agentId=${encodeURIComponent(normalizeGovernanceId(agentId, "Agent"))}`;
      return requestJson({ baseUrl, path: `/v1/approvals${query}`, headers, timeoutMs });
    },
    decideGovernedApproval(approvalId, decision) {
      if (decision !== "approve" && decision !== "reject") {
        throw createGatewayProtocolError("Governed approval decision must be approve or reject.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/approvals/${encodeGovernancePathId(approvalId, "Approval")}/${decision}`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },
    governancePolicies() {
      return requestJson({ baseUrl, path: "/v1/policies", headers, timeoutMs });
    },
    createGovernancePolicy(request) {
      return requestJson({
        baseUrl,
        path: "/v1/policies",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    activateGovernancePolicy(policyKey, version) {
      if (!Number.isSafeInteger(version) || version < 1) {
        throw createGatewayProtocolError("Governance policy version must be a positive integer.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/policies/${encodeGovernancePathId(policyKey, "Policy")}/${version}/activate`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },
    governedAgents() {
      return requestJson({ baseUrl, path: "/v1/agents", headers, timeoutMs });
    },
    governedAgent(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}`,
        headers,
        timeoutMs,
      });
    },
    governedAgentPolicy(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/effective-policy`,
        headers,
        timeoutMs,
      });
    },
    governedAgentAudit(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/audit`,
        headers,
        timeoutMs,
      });
    },
    runGovernedAgent(agentId, request) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/run`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    prepareGovernedAgentTask(agentId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId), method: "POST",
        body: governedTaskBody(request, "prepare"), headers, timeoutMs, redirect: "error" });
    },
    governedAgentTask(agentId, taskId) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId), headers, timeoutMs, redirect: "error" });
    },
    planGovernedAgentTask(agentId, taskId, request) {
      const prepared = prepareProviderRequest(governedTaskBody(request, "plan"), headers, providerDispatchKeyFactory);
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/plan", method: "POST",
        body: prepared.body, headers: prepared.headers, timeoutMs, redirect: "error" });
    },
    confirmGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/confirm", method: "POST",
        body: governedTaskBody(request, "confirm"), headers, timeoutMs, redirect: "error" });
    },
    runGovernedAgentTask(agentId, taskId, request) {
      const prepared = prepareProviderRequest(governedTaskBody(request, "run"), headers, providerDispatchKeyFactory);
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/run", method: "POST",
        body: prepared.body, headers: prepared.headers, timeoutMs, redirect: "error" });
    },
    pauseGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/pause", method: "POST",
        body: governedTaskBody(request, "pause"), headers, timeoutMs, redirect: "error" });
    },
    reconcileGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/reconcile", method: "POST",
        body: governedTaskBody(request, "reconcile"), headers, timeoutMs, redirect: "error" });
    },
    scheduleGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/schedule", method: "POST",
        body: governedTaskBody(request, "schedule"), headers, timeoutMs, redirect: "error" });
    },
    cancelGovernedAgentTask(agentId, taskId, request) {
      return requestJson({ baseUrl, path: governedTaskPath(agentId, taskId) + "/cancel", method: "POST",
        body: governedTaskBody(request, "cancel"), headers, timeoutMs, redirect: "error" });
    },
    revokeGovernedAgent(agentId, request = {}) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/revoke`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    governedApprovals(agentId) {
      const query = agentId === undefined
        ? ""
        : `?agentId=${encodeURIComponent(normalizeGovernanceId(agentId, "Agent"))}`;
      return requestJson({ baseUrl, path: `/v1/approvals${query}`, headers, timeoutMs });
    },
    decideGovernedApproval(approvalId, decision) {
      if (decision !== "approve" && decision !== "reject") {
        throw createGatewayProtocolError("Governed approval decision must be approve or reject.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/approvals/${encodeGovernancePathId(approvalId, "Approval")}/${decision}`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },
    governancePolicies() {
      return requestJson({ baseUrl, path: "/v1/policies", headers, timeoutMs });
    },
    createGovernancePolicy(request) {
      return requestJson({
        baseUrl,
        path: "/v1/policies",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    activateGovernancePolicy(policyKey, version) {
      if (!Number.isSafeInteger(version) || version < 1) {
        throw createGatewayProtocolError("Governance policy version must be a positive integer.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/policies/${encodeGovernancePathId(policyKey, "Policy")}/${version}/activate`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },

  };
}
function governedTaskBody(value, operation) {
  const required = operation === "prepare" ? ["goal", "prompt"] : operation === "confirm"
    ? ["revision", "reviewHash", "planHash", "approvalId"] : ["revision"];
  const optional = operation === "run" ? ["maxIterations", "providerDispatchKey", "idempotencyKey"]
    : operation === "plan" ? ["providerDispatchKey", "idempotencyKey"] : operation === "prepare" ? ["projectId"] : [];
  const invalid = () => { throw createGatewayProtocolError("Agent task request is incomplete or contains unapproved settings."); };
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const body = {};
  for (const key of Reflect.ownKeys(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || ![...required, ...optional].includes(key) || !property?.enumerable || !("value" in property)) invalid();
    body[key] = property.value;
  }
  if (required.some(key => !Object.hasOwn(body, key))) invalid();
  if (operation === "prepare") {
    if (typeof body.goal !== "string" || !body.goal.trim() || body.goal.length > 4000
      || typeof body.prompt !== "string" || !body.prompt.trim() || new TextEncoder().encode(body.prompt).length > 524288) invalid();
  } else if (!Number.isSafeInteger(body.revision) || body.revision < 0) invalid();
  if (operation === "confirm" && (![body.reviewHash, body.planHash].every(value => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value))
    || typeof body.approvalId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/u.test(body.approvalId))) invalid();
  if (body.maxIterations !== undefined && (!Number.isSafeInteger(body.maxIterations) || body.maxIterations < 1 || body.maxIterations > 10)) invalid();
  if (body.projectId !== undefined && (typeof body.projectId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(body.projectId))) invalid();
  for (const key of ["providerDispatchKey", "idempotencyKey"]) if (body[key] !== undefined
    && (typeof body[key] !== "string" || !/^[\x21-\x7e]{1,255}$/u.test(body[key]))) invalid();
  return body;
}

function governedTaskPath(agentId, taskId) {
  if (typeof agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)
    || arguments.length > 1 && (typeof taskId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(taskId))) {
    throw createGatewayProtocolError("Agent tasks require the original server-issued Agent and task identifiers.");
  }
  return `/v1/agents/${agentId}/tasks${taskId === undefined ? "" : `/${taskId}`}`;
}

function encodeGovernancePathId(value, label) {
  return encodeURIComponent(normalizeGovernanceId(value, label));
}

function normalizeGovernanceId(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || /[\/\\\u0000-\u001f\u007f]/u.test(normalized)) {
    throw createGatewayProtocolError(`${label} identifier is invalid.`);
  }
  return normalized;
}
