import { classifyThreeModeTask, selectModelsForTask } from "./capabilityRouter.js";
import { executeGodMode } from "./godModeExecutor.js";
import { executeNormalMode } from "./normalModeExecutor.js";
import { THREE_MODE_ERROR_CODES, ThreeModeRuntimeError } from "./threeModeErrors.js";

export async function executeTianshuMode({ request, application, gate, auditTrace }) {
  const input = String(request?.input?.content ?? request?.input ?? "").trim();
  if (!input) throw new Error("Tianshu Mode input.content is required.");
  const taskClassification = classifyThreeModeTask(input);
  const route = selectModelsForTask({
    taskType: taskClassification,
    gate,
    allowGodEscalation: request?.executionPolicy?.allowGodEscalation !== false,
  });
  if (!route.selectedModels.length) {
    throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.TIANSHU_NO_ELIGIBLE_MODEL, "Tianshu found no eligible model.");
  }
  const plannerDecision = {
    taskClassification,
    capabilityRequirements: [taskClassification],
    candidateModels: route.candidateModels,
    selectedModels: route.selectedModels,
    executionMode: route.executionMode,
    selectionReason: route.selectionReason,
    fallbackPlan: route.fallbackPlan,
  };
  if (route.executionMode === "escalate_to_god_mode") {
    const godResult = await executeGodMode({
      request: {
        ...request,
        mode: "god",
        modelSelection: {
          participantModelIds: route.selectedModels,
          allowSystemModelSelection: true,
        },
      },
      application,
      gate,
      auditTrace,
    });
    return {
      ...godResult,
      plannerDecision,
      auditTrace: {
        ...godResult.auditTrace,
        godModeEscalationDecision: {
          escalated: true,
          reason: "planner_selected_god_mode_review",
        },
      },
    };
  }
  const normalResult = await executeNormalMode({
    request: {
      ...request,
      mode: "normal",
      modelSelection: { selectedModelId: route.selectedModels[0] },
    },
    application,
    gate,
    auditTrace,
  });
  return {
    ...normalResult,
    plannerDecision,
    auditTrace: {
      ...normalResult.auditTrace,
      taskClassification,
      selectedModels: route.selectedModels,
    },
  };
}
