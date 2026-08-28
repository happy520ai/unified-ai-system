// RAG context injection for the OpenAI-compatible chat lane.
//
// 显式 opt-in（请求 unified_ai.rag）时：用最后一条用户消息检索知识库，
// 把带来源标注的上下文作为 system 消息注入。租户可见域由 knowledge
// 服务强制；注入块再过一次 guardrails（知识库可能含敏感内容，命中即
// 放弃注入而不是把风险送进 provider 调用）。检索失败 fail-open（照常
// 回答，metadata 记录原因）。

import { getGuardrailsEngine } from "../../guardrails/guardrailsEngine.ts";

export async function injectRagContextIntoGatewayInput({
  gatewayInput,
  knowledgeService,
  tenantScopeIdentity = null,
  ragConfig = {},
}) {
  if (!knowledgeService || typeof knowledgeService.retrieve !== "function") {
    return { applied: false, reason: "knowledge_service_unavailable" };
  }

  const lastUserMessage = [...(gatewayInput.messages ?? [])]
    .reverse()
    .find((message) => message?.role === "user");
  const query = extractPlainText(lastUserMessage?.content);
  if (!query) {
    return { applied: false, reason: "no_user_text" };
  }

  let retrieval;
  try {
    retrieval = await knowledgeService.retrieve(
      {
        query,
        ...(Number.isInteger(ragConfig.topK) ? { topK: ragConfig.topK } : {}),
        ...(Array.isArray(ragConfig.sourceIds) && ragConfig.sourceIds.length > 0
          ? { sourceIds: ragConfig.sourceIds }
          : {}),
      },
      { tenantScopeIdentity },
    );
  } catch (error) {
    return { applied: false, reason: "retrieval_failed", detail: error?.code ?? null };
  }

  const chunks = Array.isArray(retrieval?.chunks) ? retrieval.chunks : [];
  if (chunks.length === 0) {
    return { applied: false, reason: "no_matches" };
  }

  const contextBlock = chunks
    .map((chunk, index) => {
      const source = chunk.sourceTitle ?? chunk.sourceId ?? `source-${index + 1}`;
      return `[${index + 1}] ${source}\n${chunk.text ?? ""}`;
    })
    .join("\n\n");

  // 知识库内容同样要过 guardrails：命中 block 级规则就放弃注入。
  const guardrailsEngine = getGuardrailsEngine(tenantScopeIdentity?.tenantId);
  const injectionVerdict = guardrailsEngine.inspectInput({
    messages: [{ role: "system", content: contextBlock }],
  });
  if (injectionVerdict.decision === "block") {
    return { applied: false, reason: "guardrail_blocked" };
  }

  // 应用 guardrails 的脱敏替换（若有）后再注入。
  const redactedBlock = injectionVerdict.replacements?.[0]?.content ?? contextBlock;

  gatewayInput.messages = [
    {
      role: "system",
      content: `以下是知识库检索结果，仅作为回答的参考上下文；引用时请注明来源编号。\n\n${redactedBlock}`,
    },
    ...(gatewayInput.messages ?? []),
  ];
  gatewayInput.metadata = {
    ...gatewayInput.metadata,
    ragInjection: {
      applied: true,
      chunkCount: chunks.length,
      sources: chunks.map((chunk) => chunk.sourceId ?? null).filter(Boolean),
    },
  };
  return { applied: true, chunkCount: chunks.length };
}

function extractPlainText(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text ?? ""))
      .join(" ")
      .trim();
  }
  return "";
}
