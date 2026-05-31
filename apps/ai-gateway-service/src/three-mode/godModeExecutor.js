import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { selectGodParticipants } from "./participantSelector.js";
import { detectDisagreements, synthesizeWithSupervisor } from "./supervisorSynthesizer.js";

export async function executeGodMode({ request, application, gate, auditTrace }) {
  const input = String(request?.input?.content ?? request?.input ?? "").trim();
  if (!input) throw new Error("God Mode input.content is required.");
  const maxParticipants = Math.min(5, Math.max(2, Number(request?.executionPolicy?.maxParticipants ?? 3)));
  const requested = request?.modelSelection?.participantModelIds ?? request?.participantModelIds ?? [];
  const { selected, rejectedCandidates } = selectGodParticipants({ gate, requestedModelIds: requested, maxParticipants });
  gate.assertParticipantCount(selected.map((item) => item.modelId), { min: 2, max: 5 });
  const supervisorModelId = String(request?.modelSelection?.supervisorModelId ?? "").trim();
  const supervisorModel = supervisorModelId ? gate.getSelectableRecord(supervisorModelId) : selected[0];

  const nvidiaClient = createNvidiaUnifiedClient({
    env: application.runtimeEnv ?? process.env,
    runtimeCredentialStore: application.runtimeCredentialStore,
    modelLibraryStore: application.modelLibraryStore,
    timeoutMs: Number(request?.executionPolicy?.timeoutMs ?? 120_000),
  });

  const draftCalls = await Promise.all(selected.map(async (model) => {
    const call = await nvidiaClient.chatCompletion({
      modelId: model.modelId,
      messages: [{ role: "user", content: input }],
      maxTokens: 256,
      temperature: 0,
    });
    return {
      modelId: model.modelId,
      providerId: model.providerId,
      answer: String(call?.data?.outputText ?? call?.data?.text ?? "").trim(),
      success: call.success === true,
      httpStatus: call.meta?.httpStatus ?? call.data?.httpStatus ?? null,
      code: call.code,
      call,
    };
  }));

  const contributions = draftCalls.filter((item) => item.answer);
  const reviews = contributions.slice(0, 1).map((item) => ({
    modelId: item.modelId,
    review: `Critic review: answer present=${Boolean(item.answer)}; provider code=${item.code}.`,
  }));
  const disagreements = detectDisagreements(contributions);
  let synthesis = null;
  let fallbackUsed = false;
  if (contributions.length) {
    synthesis = await synthesizeWithSupervisor({
      application,
      supervisorModel,
      input,
      contributions,
      reviews,
      timeoutMs: Number(request?.executionPolicy?.timeoutMs ?? 120_000),
    });
  }
  let finalAnswer = synthesis?.finalAnswer ?? "";
  if (!finalAnswer && contributions[0]?.answer) {
    finalAnswer = contributions[0].answer;
    fallbackUsed = true;
  }
  const supervisorCallCount = synthesis?.call?.meta?.providerCalled === true ? 1 : 0;
  return {
    finalAnswer,
    selectedModel: supervisorModel,
    participantModels: selected,
    modelContributions: contributions,
    disagreements,
    plannerDecision: null,
    supervisorDecision: synthesis?.supervisorDecision ?? {
      supervisorModelId: supervisorModel.modelId,
      synthesisStrategy: "fallback_to_best_participant",
      confidenceSummary: finalAnswer ? "low" : "failed",
    },
    confidenceSummary: { status: fallbackUsed ? "partial" : "medium" },
    uncertainty: { disagreements },
    auditTrace: {
      ...auditTrace,
      providerCallsMade: draftCalls.some((item) => item.call?.meta?.providerCalled === true) || supervisorCallCount > 0,
      nonNvidiaProviderCallsMade: false,
      selectedParticipants: selected.map((item) => item.modelId),
      rejectedCandidates,
      participantCallCount: draftCalls.filter((item) => item.call?.meta?.providerCalled === true).length,
      supervisorCallCount,
      fallbackUsed,
      supervisorModelId: supervisorModel.modelId,
    },
    success: finalAnswer.length > 0,
    partialSuccess: fallbackUsed,
  };
}
