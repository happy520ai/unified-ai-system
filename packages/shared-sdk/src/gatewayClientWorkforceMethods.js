// Extracted verbatim from createGatewayClient's returned object so the
// workforce and workflow domain methods live beside the SDK entrypoint. The
// workforce/workflow-specific request guards move with the domain; the
// methods receive the shared request context and keep their exact bodies.
export function createGatewayWorkforceMethods(ctx) {
  const { baseUrl, headers, timeoutMs, requestJson, operatorPost, prepareProviderRequest, createGatewayProtocolError } = ctx;
  return {
    workforcePreview(request) { return operatorPost("/workforce/preview", request); },
    workflowHealth() {
      return requestJson({
        baseUrl,
        path: "/workflow/health",
        headers,
        timeoutMs,
      });
    },
    workflowActions() {
      return requestJson({
        baseUrl,
        path: "/workflow/actions",
        headers,
        timeoutMs,
      });
    },
    workflowPlan(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workflowRun(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/run",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
        redirect: "error",
      });
    },
    workflowRuns(options = {}) {
      if (!options || typeof options !== "object" || Array.isArray(options)
        || Object.keys(options).some(key => key !== "limit")
        || options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100)) {
        throw createGatewayProtocolError("Workflow list accepts only a limit between 1 and 100.");
      }
      return requestJson({ path: `/workflow/runs?limit=${options.limit ?? 50}`, redirect: "error" });
    },
    workflowRunStatus(workflowId) {
      return requestJson({ path: `/workflow/runs/${encodeURIComponent(requireWorkflowRunId(workflowId))}`, redirect: "error" });
    },
    recoverWorkflowRun(workflowId) {
      return requestJson({
        path: `/workflow/runs/${encodeURIComponent(requireWorkflowRunId(workflowId))}/recover`,
        method: "POST", body: {}, redirect: "error",
      });
    },
    workforceExecutionStatus(executionId) {
      return operatorPost("/workforce/execute/status", { executionId: requireWorkforceRecordId(executionId) });
    },
    recoverWorkforceWorkflow(request) {
      return operatorPost("/workforce/execute/handoff/recover", workforceRecoveryRequest(request));
    },
    workforceExecutionReview(request) {
      return operatorPost("/workforce/execute/review", workforceExecutionRequest(request));
    },
    workforceExecute(request) {
      return operatorPost("/workforce/execute", workforceExecutionRequest(request));
    },
    recoverWorkforceExternalRunner(request) {
      const body = workforceRecoveryRequest(request, ["executionId", "operationId", "agentId"]);
      if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(body.agentId) || body.executionId.length > 256 || body.operationId.length > 256) {
        throw createGatewayProtocolError("Native recovery requires the exact original execution, operation and owning Agent IDs.");
      }
      return operatorPost("/workforce/execute/external-runner/recover", body);
    },
    workforceHealth() {
      return requestJson({
        baseUrl,
        path: "/workforce/health",
        headers,
        timeoutMs,
      });
    },
    workforceAgents() {
      return requestJson({
        baseUrl,
        path: "/workforce/agents",
        headers,
        timeoutMs,
      });
    },
    workforcePlan(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanSave(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plans/save",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlans() {
      return requestJson({
        baseUrl,
        path: "/workforce/plans",
        headers,
        timeoutMs,
      });
    },
    workforcePlanGet(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanDelete(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        method: "DELETE",
        headers,
        timeoutMs,
      });
    },
    workforcePlanExport(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/export`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanClarifications(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/clarifications`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanLifecycle(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/lifecycle`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanReviewPackage(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/review-package`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanApprovalGate(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/approval-gate`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    generate(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/gateway/route",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },

  };

  function requireWorkflowRunId(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(value)) {
      throw createGatewayProtocolError("Workflow ID must be a bounded portable identifier.");
    }
    return value;
  }

  function requireWorkforceRecordId(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(value)) {
      throw createGatewayProtocolError("Workforce record ID must be a bounded portable identifier.");
    }
    return value;
  }

  function workforceRecoveryRequest(value, keys = ["executionId", "taskId", "workflowId"]) {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== keys.length) throw createGatewayProtocolError("Recovery requires only the three original record IDs.");
    return Object.fromEntries(keys.map(key => {
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (!field || !("value" in field) || !field.enumerable) throw createGatewayProtocolError("Recovery IDs must be plain data.");
      return [key, requireWorkforceRecordId(field.value)];
    }));
  }

  function workforceExecutionRequest(value) {
    const allowed = ["goal", "agentId", "planId", "autonomyMode", "selectedRoles", "selectedTemplate", "templateId", "clarificationAnswers",
      "context", "metadata", "operationId", "operationType", "externalRunner", "codeDelivery", "workflowHandoff", "consensusReview"];
    const invalid = () => { throw createGatewayProtocolError("Workforce execution accepts reviewed intent and profile selectors, not native settings or model overrides."); };
    let nodes = 0, chars = 0;
    const seen = new WeakSet();
    const inspect = (item, depth = 0) => {
      if (++nodes > 20000 || depth > 16) invalid();
      if (typeof item === "string") { chars += item.length; if (chars > 1048576) invalid(); return; }
      if (item === null || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) return;
      if (!item || typeof item !== "object" || seen.has(item)) invalid();
      seen.add(item);
      const array = Array.isArray(item), keys = Reflect.ownKeys(item);
      if (array ? Object.getPrototypeOf(item) !== Array.prototype || keys.length !== item.length + 1
        : ![Object.prototype, null].includes(Object.getPrototypeOf(item))) invalid();
      for (const key of keys) {
        if (array && key === "length") continue;
        const field = Object.getOwnPropertyDescriptor(item, key);
        if (typeof key !== "string" || array && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= item.length)
          || ["__proto__", "prototype", "constructor"].includes(key) || !field?.enumerable || !("value" in field)) invalid();
        inspect(field.value, depth + 1);
      }
      seen.delete(item);
    };
    inspect(value);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))
      || typeof value.goal !== "string" || !value.goal.trim() || value.goal.length > 4000
      || value.agentId !== undefined && (typeof value.agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(value.agentId))
      || value.planId !== undefined && (typeof value.planId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(value.planId))
      || value.autonomyMode !== undefined && !["dry-run", "controlled-execution", "sandbox-merge", "sandbox-merge-auto"].includes(value.autonomyMode)) invalid();
    if (Object.hasOwn(value, "externalRunner")) {
      const selector = value.externalRunner;
      if (!selector || typeof selector !== "object" || Array.isArray(selector) || Object.keys(selector).join() !== "profileId"
        || typeof selector.profileId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(selector.profileId)
        || !value.agentId || ["codeDelivery", "workflowHandoff", "consensusReview"].some(key => Object.hasOwn(value, key))
        || value.autonomyMode !== undefined && !["dry-run", "controlled-execution"].includes(value.autonomyMode)) invalid();
    }
    return JSON.parse(JSON.stringify(value));
  }


}
