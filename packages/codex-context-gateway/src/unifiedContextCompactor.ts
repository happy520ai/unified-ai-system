// Unified context compaction engine.
//
// One engine owns every context-compaction behavior in the workspace:
// - `compactMessageHistory` — message-history compaction with two summary
//   styles ("iteration" for the agentic loop, "turns" for chat histories)
// - `compactStructuredContext` — structured project-state compression
//   (moved from longContextCompressor.js, same output contract)
//
// Facades delegate here instead of re-implementing heuristics.

export interface ChatMessageLike {
  role: string;
  content?: unknown;
  tool_calls?: unknown;
  [key: string]: unknown;
}

export interface ConversationTurn {
  messages: ChatMessageLike[];
  hasToolCalls: boolean;
}

export type SummaryStyle = "iteration" | "turns";

export interface CompactionPolicy {
  /** Recent turns kept verbatim. */
  keepRecentTurns: number;
  /** Token budget that arms compaction; null disables the token trigger. */
  maxContextTokens: number | null;
  /** Fraction of the budget below which history is left untouched. */
  tokenTriggerRatio: number;
  /** Pin every system message at the head of the result. */
  preserveSystemMessages: boolean;
  /** Extra leading user messages pinned verbatim (agentic-loop convention). */
  preserveLeadingUserMessages: number;
  /** Summary rendering style: agentic iteration marker or per-turn digest. */
  summaryStyle: SummaryStyle;
  /** Heading prepended to the summary message in "turns" style. */
  turnSummaryPrefix: string;
  /** Extract tool errors from the summarized span into the summary. */
  collectToolErrorFindings: boolean;
  maxKeyFindings: number;
}

export interface CompactionReport {
  compacted: boolean;
  originalCount: number;
  resultCount: number;
  originalTokens: number;
  resultTokens: number;
  summarizedTurns: number;
  summaryText: string;
  retainedSignals: string[];
  droppedSignals: string[];
}

export interface CompactionResult {
  messages: ChatMessageLike[];
  report: CompactionReport;
}

export const DEFAULT_COMPACTION_POLICY: CompactionPolicy = {
  keepRecentTurns: 5,
  maxContextTokens: null,
  tokenTriggerRatio: 0.7,
  preserveSystemMessages: true,
  preserveLeadingUserMessages: 0,
  summaryStyle: "iteration",
  turnSummaryPrefix: "[Previous conversation summary]",
  collectToolErrorFindings: true,
  maxKeyFindings: 5,
};

export function defineCompactionPolicy(overrides: Partial<CompactionPolicy> = {}): CompactionPolicy {
  return { ...DEFAULT_COMPACTION_POLICY, ...overrides };
}

/**
 * Estimate tokens: CJK ≈ 1.5 chars/token, ASCII ≈ 4 chars/token.
 * Deterministic and provider-neutral; used only for trigger decisions.
 */
export function estimateContextTokens(text: string): number {
  if (!text) return 0;
  let cjkChars = 0;
  let asciiChars = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (
      (code >= 0x4e00 && code <= 0x9fff)
      || (code >= 0x3040 && code <= 0x309f)
      || (code >= 0x30a0 && code <= 0x30ff)
    ) {
      cjkChars += 1;
    } else {
      asciiChars += 1;
    }
  }
  return Math.ceil(cjkChars / 1.5 + asciiChars / 4);
}

function messageText(message: ChatMessageLike): string {
  return typeof message?.content === "string" ? message.content : "";
}

function estimateMessagesTokens(messages: ChatMessageLike[]): number {
  return estimateContextTokens(messages.map(messageText).join("\n"));
}

/** Group messages into user-anchored turns; system messages are skipped. */
export function extractConversationTurns(messages: ChatMessageLike[]): ConversationTurn[] {
  const turns: ConversationTurn[] = [];
  let current: ConversationTurn | null = null;
  for (const message of messages) {
    if (message.role === "system") continue;
    if (message.role === "user") {
      if (current) turns.push(current);
      current = { messages: [message], hasToolCalls: false };
    } else if (current) {
      current.messages.push(message);
      if (message.role === "tool" || message.tool_calls) {
        current.hasToolCalls = true;
      }
    }
  }
  if (current) turns.push(current);
  return turns;
}

function truncateText(value: string, maxLength: number): string {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

/** Per-turn digest, e.g. `Turn 2: User asked "...", 3 tool(s) were called. Assistant responded: "..."`. */
export function summarizeConversationTurns(turns: ConversationTurn[]): string {
  const summaries: string[] = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const userMessage = turn.messages.find((message) => message.role === "user");
    const assistantMessages = turn.messages.filter((message) => message.role === "assistant");
    const toolMessages = turn.messages.filter((message) => message.role === "tool");

    const userContent = userMessage ? messageText(userMessage) || "[no user message]" : "[no user message]";
    const assistantContent = assistantMessages.map(messageText).filter(Boolean).join(" ");
    const toolCount = toolMessages.length;

    let summary = `Turn ${index + 1}: User asked "${truncateText(userContent, 100)}"`;
    if (toolCount > 0) summary += `, ${toolCount} tool(s) were called`;
    if (assistantContent) summary += `. Assistant responded: "${truncateText(assistantContent, 200)}"`;
    summaries.push(summary);
  }
  return summaries.join("\n");
}

function collectToolErrorFindings(messages: ChatMessageLike[], maxFindings: number): string[] {
  const findings: string[] = [];
  for (const message of messages) {
    if (message.role !== "tool" || !message.content) continue;
    try {
      const parsed = typeof message.content === "string"
        ? (JSON.parse(message.content) as Record<string, unknown>)
        : (message.content as Record<string, unknown>);
      if (parsed?.status === "error") {
        const toolName = (message._meta as Record<string, unknown> | undefined)?.toolName;
        findings.push(
          `Error in ${typeof toolName === "string" ? toolName : "tool"}: ${parsed.error ?? parsed.message ?? "unknown"}`,
        );
      }
    } catch {
      // Non-JSON tool payloads carry no structured findings.
    }
  }
  return findings.slice(0, maxFindings);
}

function buildIterationSummary(
  summarizedMessages: ChatMessageLike[],
  keepRecentTurns: number,
  policy: CompactionPolicy,
): string {
  const toolResultCount = summarizedMessages.filter((message) => message.role === "tool").length;
  const iterationCount = summarizedMessages.filter((message) => message.role === "assistant").length;
  const keyFindings = policy.collectToolErrorFindings
    ? collectToolErrorFindings(summarizedMessages, policy.maxKeyFindings)
    : [];
  return (
    `[Context compacted: ${iterationCount} earlier iterations summarized. ` +
    `${toolResultCount} tool results processed.` +
    (keyFindings.length > 0 ? ` Key issues found: ${keyFindings.join("; ")}` : "") +
    ` Continuing with full detail for the last ${keepRecentTurns} iterations.]`
  );
}

function buildReport(
  original: ChatMessageLike[],
  result: ChatMessageLike[],
  summarizedTurns: number,
  summaryText: string,
  compacted: boolean,
): CompactionReport {
  return {
    compacted,
    originalCount: original.length,
    resultCount: result.length,
    originalTokens: estimateMessagesTokens(original),
    resultTokens: estimateMessagesTokens(result),
    summarizedTurns,
    summaryText,
    retainedSignals: [
      "system instructions",
      ...(compacted ? ["recent turns verbatim", "compaction summary"] : ["full history"]),
    ],
    droppedSignals: compacted
      ? ["verbatim older turns", "raw historical tool payloads"]
      : [],
  };
}

/**
 * Compact a message history. Under the configured trigger the older span is
 * replaced by one system summary message; system instructions and the recent
 * turns always stay verbatim. Never throws on odd shapes — returns the input
 * unchanged when compaction does not apply.
 */
export function compactMessageHistory(
  messages: ChatMessageLike[],
  policy: CompactionPolicy = DEFAULT_COMPACTION_POLICY,
): CompactionResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      messages: messages ?? [],
      report: buildReport(messages ?? [], messages ?? [], 0, "", false),
    };
  }

  const pinned: ChatMessageLike[] = [];
  if (policy.summaryStyle === "iteration") {
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      if (
        (message.role === "system" && policy.preserveSystemMessages)
        || (message.role === "user" && index < Math.max(0, policy.preserveLeadingUserMessages))
      ) {
        pinned.push(message);
      }
    }
  } else if (policy.preserveSystemMessages) {
    const firstSystem = messages.find((message) => message.role === "system");
    if (firstSystem) pinned.push(firstSystem);
  }

  if (policy.maxContextTokens !== null && policy.maxContextTokens > 0) {
    const totalTokens = estimateMessagesTokens(messages);
    if (totalTokens < policy.maxContextTokens * policy.tokenTriggerRatio) {
      return { messages, report: buildReport(messages, messages, 0, "", false) };
    }
  }

  if (policy.summaryStyle === "iteration") {
    const assistantIndices = messages
      .map((message, index) => (message.role === "assistant" ? index : -1))
      .filter((index) => index >= 0);
    if (assistantIndices.length <= policy.keepRecentTurns) {
      return { messages, report: buildReport(messages, messages, 0, "", false) };
    }
    const cutoffIndex = assistantIndices[assistantIndices.length - policy.keepRecentTurns];
    const summarized = messages.slice(pinned.length, cutoffIndex);
    const recent = messages.slice(cutoffIndex);
    const summaryText = buildIterationSummary(summarized, policy.keepRecentTurns, policy);
    const summarizedTurns = extractConversationTurns(summarized).length;
    const result = [...pinned, { role: "system", content: summaryText }, ...recent];
    return { messages: result, report: buildReport(messages, result, summarizedTurns, summaryText, true) };
  }

  const turns = extractConversationTurns(messages);
  if (messages.length <= 2 || turns.length <= policy.keepRecentTurns) {
    return { messages, report: buildReport(messages, messages, 0, "", false) };
  }
  const oldTurns = turns.slice(0, turns.length - policy.keepRecentTurns);
  const recentTurns = turns.slice(turns.length - policy.keepRecentTurns);
  const summaryText = summarizeConversationTurns(oldTurns);
  const result: ChatMessageLike[] = [...pinned];
  if (summaryText) {
    result.push({
      role: "system",
      content: `${policy.turnSummaryPrefix}\n${summaryText}`,
    });
  }
  for (const turn of recentTurns) {
    result.push(...turn.messages);
  }
  return {
    messages: result,
    report: buildReport(messages, result, oldTurns.length, summaryText, true),
  };
}

export interface StructuredContextInput {
  projectState: {
    packageName?: string;
    files?: Array<{ path: string; firstHeadings?: string[] }>;
    phaseDocs?: unknown[];
  };
  phaseEvidence: {
    latestRefs: Array<{
      phaseId: string;
      path: string;
      completed?: boolean;
      recommended_sealed?: boolean;
      blocker?: boolean;
    }>;
    indexedCount?: number;
  };
  gitDiff: { changedFileCount: number };
}

/**
 * Structured project-state compression (moved verbatim from
 * longContextCompressor.js; shares this engine's retention vocabulary).
 */
export function compactStructuredContext(input: StructuredContextInput) {
  const { projectState, phaseEvidence, gitDiff } = input;
  const readmeSummary = projectState.files?.find((item) => item.path === "README.md");
  const agentsSummary = projectState.files?.find((item) => item.path === "AGENTS.md");
  const latestEvidence = (phaseEvidence.latestRefs ?? []).slice(-18).map((item) => ({
    phaseId: item.phaseId,
    path: item.path,
    completed: item.completed,
    recommended_sealed: item.recommended_sealed,
    blocker: item.blocker,
  }));

  return {
    completed: true,
    compressionMode: "phase-history-boundary-blocker-next-action",
    retainedSignals: [
      "current system position",
      "phase summary",
      "safety boundary",
      "blocker",
      "relevant evidence refs",
      "dirty-file metadata",
      "next verification action",
    ],
    droppedSignals: ["full historical logs", "raw provider outputs", "raw secret files", "full git diff content"],
    summary: {
      packageName: projectState.packageName,
      readmeHeadings: readmeSummary?.firstHeadings || [],
      agentsHeadings: agentsSummary?.firstHeadings || [],
      phaseDocCount: projectState.phaseDocs?.length ?? 0,
      evidenceRefCount: phaseEvidence.indexedCount ?? 0,
      dirtyFileCount: gitDiff.changedFileCount,
      currentBlocker: "none recorded in managed state; workspace dirty is not clean",
      nextAction: "Use generated Codex prompt pack with fresh context hash before executing any Codex task.",
    },
    latestEvidence,
  };
}
