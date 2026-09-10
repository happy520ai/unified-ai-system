import { isLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { createWorkforceWorkflowHandoff } from "./workforceWorkflowHandoffRuntime.ts";

/** Saved planning data never carries runtime authority. */
export function normalizeWorkflowHandoffPreviewState(state = {}) {
  const reason = "This plan is a preview; workflow handoff requires the governed /workforce/execute path, an explicit workflowHandoff selector and current approvals.";
  const hud = state.hud && typeof state.hud === "object" ? state.hud : null;
  return { ...state, ...(hud ? { hud: { ...hud, blockers: (Array.isArray(hud.blockers) ? hud.blockers : []).map(message =>
    typeof message === "string" && /workflow run handoff/i.test(message) ? reason : message) } } : {}),
    workflowRunHandoff: { status: "preview-only", lifecycleStatus: "handoff-disabled", implemented: true,
      runtimeConnected: false, enabled: false, enabledByDefault: false, executionRoute: "/workforce/execute", reason } };
}

/** One concrete implementation. Legacy standalone claim strings cannot authorize real workflow effects. */
export function createWorkflowRunHandoff({ workflowService } = {}) {
  if (isLocalWorkflowService(workflowService)) return createWorkforceWorkflowHandoff(workflowService);
  return Object.freeze({ implemented: true, enabledByDefault: false,
    getStatus: () => ({ implemented: true, runtimeConnected: false, workflowServiceAvailable: Boolean(workflowService) }),
    async handoff() {
      return { handedOff: false, status: "refused", code: workflowService ? "HANDOFF_GOVERNED_CONTEXT_REQUIRED" : "HANDOFF_NO_WORKFLOW_SERVICE",
        reason: "A concrete local workflow, authenticated Agent and live DAG task capability are required." };
    } });
}
