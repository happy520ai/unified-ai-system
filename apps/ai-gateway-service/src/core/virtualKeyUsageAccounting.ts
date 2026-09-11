import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import {
  getVirtualKeyRequestAccounting,
  type VirtualKeyRequestAccounting, type VirtualKeyInvocation, type VirtualKeySettlement,
} from "../enterprise/virtualKeyRequestAccounting.ts";

interface BillingSnapshot { readonly version: 1; readonly totalTokens: number; readonly source: "reported" | "estimated" }
interface Attempt {
  readonly scope?: VirtualKeyRequestAccounting;
  readonly invocation?: VirtualKeyInvocation;
  readonly estimatedInput: number;
  readonly tokenMetered: boolean;
  readonly tools: Map<number, { name: string; arguments: string }>;
  reasoning: string;
  streamVisible: string | null;
  outputIncomplete: boolean;
  settlement?: Promise<VirtualKeySettlement>;
}
const billing = new WeakMap<object, Readonly<BillingSnapshot>>();
const safeTokens = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Only execution-bound server authority counts as a virtual-key identity. */
export function beginVirtualKeyUsage(request: Record<string, any>, execution: unknown, tokenMetered = true): Attempt {
  const scope = getVirtualKeyRequestAccounting(execution);
  if (request.enterpriseIdentity?.apiKeyFingerprint && !scope) {
    throw Object.assign(new Error("Virtual key accounting context is unavailable."), {
      code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", category: "internal", statusCode: 503, retryable: false,
    });
  }
  const estimatedInput = tokenMetered ? estimateTokens(request).estimatedInputTokens : 0;
  return { scope, invocation: scope?.beginInvocation(estimatedInput, tokenMetered ? "tokens" : "unsupported"),
    estimatedInput, tokenMetered, tools: new Map(), reasoning: "", streamVisible: null, outputIncomplete: false };
}

export function observeVirtualKeyUsageChunk(attempt: Attempt, chunk: Record<string, any>): void {
  const visible = chunk.accountingTextDelta ?? chunk.textDelta;
  if (typeof visible === "string") attempt.streamVisible = (attempt.streamVisible ?? "") + visible;
  if (typeof chunk.reasoningDelta === "string") attempt.reasoning += chunk.reasoningDelta;
  const deltas = chunk.accountingToolCallsDelta ?? chunk.raw?.toolCallsDelta;
  if (!Array.isArray(deltas)) return;
  for (const delta of deltas) {
    if (!Number.isSafeInteger(delta?.index) || delta.index < 0 || (!attempt.tools.has(delta.index) && attempt.tools.size >= 128)) {
      attempt.outputIncomplete = true;
      continue;
    }
    const tool = attempt.tools.get(delta.index) ?? { name: "", arguments: "" };
    const fn = delta.function ?? delta;
    if (typeof fn.name === "string") tool.name += fn.name;
    if (typeof fn.arguments === "string") tool.arguments += fn.arguments;
    attempt.tools.set(delta.index, tool);
  }
}

export function getVirtualKeyBillingSnapshot(target: unknown): Readonly<BillingSnapshot> | undefined {
  return target !== null && typeof target === "object" ? billing.get(target) : undefined;
}

export function inheritVirtualKeyBilling(source: unknown, target: object): void {
  const snapshot = getVirtualKeyBillingSnapshot(source);
  if (snapshot) billing.set(target, snapshot);
}

function outputText(attempt: Attempt, result: Record<string, any> | undefined, streamedText: string) {
  if (!result) return { visible: [attempt.streamVisible ?? streamedText, attempt.tools.size ? JSON.stringify([...attempt.tools.values()]) : ""].filter(Boolean).join("\n"),
    reasoning: attempt.reasoning };
  const text = result.text ?? result.message?.content ?? result.outputText;
  const parts = result.raw?.outputTextPresent === false ? [] : [typeof text === "string" ? text : streamedText];
  const reasoning: string[] = [];
  const thinking = result.message?.reasoningContent ?? result.reasoningContent;
  if (typeof thinking === "string") reasoning.push(thinking);
  else if (Array.isArray(result.raw?.content)) {
    for (const block of result.raw.content) if (block?.type === "thinking" && typeof block.thinking === "string") reasoning.push(block.thinking);
  }
  const geminiParts = result.raw?.candidates?.[0]?.content?.parts;
  if (Array.isArray(geminiParts)) {
    parts.splice(0, parts.length, geminiParts.filter(part => part?.thought !== true).map(part => typeof part?.text === "string" ? part.text : "").join(""));
    reasoning.splice(0, reasoning.length, geminiParts.filter(part => part?.thought === true).map(part => typeof part?.text === "string" ? part.text : "").join(""));
  }
  const tools = result.message?.tool_calls ?? result.toolCalls
    ?? result.raw?.content?.filter?.((block: any) => block?.type === "tool_use").map((block: any) => ({ name: block.name, arguments: block.input }))
    ?? result.raw?.candidates?.[0]?.content?.parts?.filter?.((part: any) => part?.functionCall).map((part: any) => ({ name: part.functionCall.name, arguments: part.functionCall.args }));
  if (Array.isArray(tools) && tools.length) {
    try { parts.push(JSON.stringify(tools.map((tool) => {
      const fn = tool.function ?? tool;
      return { name: fn.name ?? "", arguments: typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {}) };
    }))); } catch { attempt.outputIncomplete = true; }
  }
  return { visible: parts.filter(Boolean).join("\n"), reasoning: reasoning.filter(Boolean).join("\n") };
}

function calculateUsage(attempt: Attempt, options: {
  result?: Record<string, any>; raw?: Record<string, any>; outputText?: string; completed: boolean; usageAttemptId?: string;
}): VirtualKeySettlement {
  if (!attempt.tokenMetered) return { tokens: null, source: "unknown", incomplete: true, usageAttemptId: options.usageAttemptId };
  const raw = options.result?.raw ?? options.raw;
  const observation = raw?.usageObservation;
  const usage = options.result?.usage ?? raw?.usage;
  const protocolComplete = options.completed && observation?.complete !== false;
  let tokens: number | null = null;
  let source: VirtualKeySettlement["source"] = "unknown";
  if (observation?.version === 1 && observation.invalid === false
    && (observation.source === "reported" || observation.source === "components") && safeTokens(observation.totalTokens)) {
    tokens = observation.totalTokens;
    source = protocolComplete ? "reported" : "partial";
  } else if (observation === undefined && safeTokens(usage?.totalTokens) && usage.totalTokens > 0) {
    // Legacy adapters cannot prove that a default zero was actually reported.
    tokens = usage.totalTokens;
    source = protocolComplete ? "reported" : "partial";
  } else {
    const known = observation?.version === 1 && safeTokens(observation.knownTokens) ? observation.knownTokens : null;
    const output = outputText(attempt, options.result, options.outputText ?? "");
    const text = [output.visible, output.reasoning].filter(Boolean).join("\n");
    if (attempt.tokenMetered && (protocolComplete || text.length > 0)) {
      const knownInput = observation?.version === 1 && safeTokens(observation.inputTokens) ? observation.inputTokens : null;
      const knownOutput = observation?.version === 1 && safeTokens(observation.outputTokens) ? observation.outputTokens : null;
      const inputEstimate = observation?.inputComplete === false
        ? Math.max(knownInput ?? 0, attempt.estimatedInput) : knownInput ?? attempt.estimatedInput;
      let outputEstimate = knownOutput ?? estimateTextTokens(text);
      if (observation?.outputComplete === false) {
        if (safeTokens(observation.visibleOutputTokens) || safeTokens(observation.reasoningTokens)) {
          outputEstimate = (safeTokens(observation.visibleOutputTokens) ? observation.visibleOutputTokens : estimateTextTokens(output.visible))
            + (safeTokens(observation.reasoningTokens) ? observation.reasoningTokens : estimateTextTokens(output.reasoning));
        } else outputEstimate = Math.max(knownOutput ?? 0, estimateTextTokens(text));
      }
      const estimate = inputEstimate + outputEstimate;
      if (safeTokens(estimate)) { tokens = Math.max(estimate, known ?? 0); source = "estimated"; }
    } else if (known !== null) { tokens = known; source = "partial"; }
  }
  return { tokens, source, incomplete: !protocolComplete || source === "partial" || source === "unknown"
    || observation?.invalid === true || (source === "estimated" && (attempt.outputIncomplete
      || (observation?.source === "partial" && (observation.inputComplete === false || observation.outputComplete === false)))),
    usageAttemptId: options.usageAttemptId };
}

/** One actual Gateway provider attempt; transport retry counts never invent usage. */
export function finishVirtualKeyUsage(attempt: Attempt, options: {
  result?: Record<string, any>; raw?: Record<string, any>; outputText?: string; completed: boolean; usageAttemptId?: string;
}): Promise<VirtualKeySettlement> {
  if (attempt.settlement) return attempt.settlement;
  let calculated: VirtualKeySettlement;
  try { calculated = calculateUsage(attempt, options); }
  catch { calculated = { tokens: null, source: "unknown", incomplete: true, usageAttemptId: options.usageAttemptId }; }
  const facts = Object.freeze(calculated);
  attempt.settlement = Promise.resolve().then(async () => {
    const receipt = attempt.scope && attempt.invocation ? await attempt.scope.settle(attempt.invocation, facts) : undefined;
    if (!facts.incomplete && facts.tokens !== null && (facts.source === "reported" || facts.source === "estimated")
      && (!receipt || (receipt.state === "recorded" && receipt.auditRecorded))) {
      const snapshot = Object.freeze({ version: 1 as const, totalTokens: facts.tokens, source: facts.source });
      billing.set(attempt, snapshot);
      if (options.result) billing.set(options.result, snapshot);
    }
    return facts;
  });
  return attempt.settlement;
}
