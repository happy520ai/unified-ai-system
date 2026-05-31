import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";

export async function executeNormalMode({ request, application, gate, auditTrace }) {
  const input = String(request?.input?.content ?? request?.input ?? "").trim();
  const selectedModelId = String(request?.modelSelection?.selectedModelId ?? request?.selectedModelId ?? "").trim();
  if (!input) throw new Error("Normal Mode input.content is required.");
  const selectedRecord = gate.getSelectableRecord(selectedModelId);
  gate.assertProviderAllowed(selectedRecord, request);

  const nvidiaClient = createNvidiaUnifiedClient({
    env: application.runtimeEnv ?? process.env,
    runtimeCredentialStore: application.runtimeCredentialStore,
    modelLibraryStore: application.modelLibraryStore,
    timeoutMs: Number(request?.executionPolicy?.timeoutMs ?? 60_000),
  });
  const call = await nvidiaClient.chatCompletion({
    modelId: selectedRecord.modelId,
    messages: [{ role: "user", content: input }],
    maxTokens: Number(request?.executionPolicy?.maxTokens ?? 256),
    temperature: 0,
  });
  const finalAnswer = String(call?.data?.outputText ?? call?.data?.text ?? "").trim();
  return {
    finalAnswer,
    selectedModel: selectedRecord,
    participantModels: [],
    plannerDecision: null,
    supervisorDecision: null,
    confidenceSummary: { status: call.success ? "high" : "failed" },
    uncertainty: { notes: call.success ? [] : [call.message] },
    auditTrace: {
      ...auditTrace,
      providerCallsMade: call.meta?.providerCalled === true,
      nonNvidiaProviderCallsMade: false,
      participantCallCount: call.meta?.providerCalled === true ? 1 : 0,
      httpStatus: call.meta?.httpStatus ?? call.data?.httpStatus ?? null,
      selectedModelId: selectedRecord.modelId,
      providerResultCode: call.code,
    },
    providerResult: call,
    success: call.success === true && finalAnswer.length > 0,
  };
}
