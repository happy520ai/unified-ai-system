import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";

export async function synthesizeWithSupervisor({ application, supervisorModel, input, contributions, reviews = [], timeoutMs = 120_000 }) {
  const nvidiaClient = createNvidiaUnifiedClient({
    env: application.runtimeEnv ?? process.env,
    runtimeCredentialStore: application.runtimeCredentialStore,
    modelLibraryStore: application.modelLibraryStore,
    timeoutMs,
  });
  const prompt = [
    "You are the supervisor for a multi-model review.",
    "Synthesize a concise final answer. Preserve uncertainty when participants disagree.",
    `User task: ${input}`,
    "Participant drafts:",
    ...contributions.map((item, index) => `${index + 1}. ${item.modelId}: ${item.answer}`),
    "Review notes:",
    ...reviews.map((item, index) => `${index + 1}. ${item.modelId}: ${item.review}`),
  ].join("\n\n");
  const call = await nvidiaClient.chatCompletion({
    modelId: supervisorModel.modelId,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 384,
    temperature: 0,
  });
  const finalAnswer = String(call?.data?.outputText ?? call?.data?.text ?? "").trim();
  return {
    finalAnswer,
    call,
    supervisorDecision: {
      supervisorModelId: supervisorModel.modelId,
      synthesisStrategy: "supervisor_synthesis_with_conflict_awareness",
      resolvedConflicts: detectResolvedConflicts(contributions),
      unresolvedQuestions: finalAnswer ? [] : ["supervisor_call_returned_empty_answer"],
      confidenceSummary: finalAnswer ? "medium" : "failed",
      uncertainty: {
        hasDisagreement: detectDisagreements(contributions).length > 0,
      },
      safetyNotes: ["NVIDIA selectable models only in Phase328A MVP"],
    },
  };
}

export function detectDisagreements(contributions = []) {
  if (contributions.length < 2) return [];
  const lengths = contributions.map((item) => String(item.answer ?? "").length);
  const max = Math.max(...lengths);
  const min = Math.min(...lengths);
  return max - min > 200 ? [{ type: "answer_length_variance", severity: "low" }] : [];
}

function detectResolvedConflicts(contributions = []) {
  return detectDisagreements(contributions).map((item) => ({
    ...item,
    resolution: "supervisor asked to preserve uncertainty and synthesize supported claims",
  }));
}
