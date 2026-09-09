// Provider facts only. This is not an accounting capability or a price model.
// Canonical input includes cache input; output includes reasoning. Breakdown
// fields are subsets and must never be added to a reported total again.
type Protocol = "openai" | "anthropic" | "gemini";
type Counts = Record<string, number>;

export function observeProviderUsage(protocol: Protocol, value: unknown, complete: boolean) {
  let invalid = value != null && (typeof value !== "object" || Array.isArray(value));
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const read = (object: object, key: string): number | null => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor) return null;
    if (!("value" in descriptor) || typeof descriptor.value !== "number"
      || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0) {
      invalid = true;
      return null;
    }
    return descriptor.value;
  };
  const nested = (key: string): object => {
    const descriptor = Object.getOwnPropertyDescriptor(raw, key);
    if (!descriptor) return {};
    if (!("value" in descriptor) || !descriptor.value || typeof descriptor.value !== "object"
      || Array.isArray(descriptor.value)) { invalid = true; return {}; }
    return descriptor.value;
  };
  const sum = (...values: (number | null)[]): number | null => {
    const total = values.reduce<number>((result, count) => result + (count ?? 0), 0);
    if (!Number.isSafeInteger(total)) { invalid = true; return null; }
    return total;
  };

  let input: number | null;
  let output: number | null;
  let reportedTotal: number | null = null;
  let known: number | null;
  let componentsComplete = false;
  const breakdown: Counts = {};
  if (protocol === "openai") {
    input = read(raw, "prompt_tokens");
    output = read(raw, "completion_tokens");
    reportedTotal = read(raw, "total_tokens");
    const reasoning = read(nested("completion_tokens_details"), "reasoning_tokens");
    const cached = read(nested("prompt_tokens_details"), "cached_tokens");
    if (reasoning !== null && output !== null && reasoning > output) invalid = true;
    if (cached !== null && input !== null && cached > input) invalid = true;
    breakdown.reasoningTokens = reasoning ?? 0;
    if (cached !== null) breakdown.cacheReadInputTokens = cached;
    known = sum(input, output);
    componentsComplete = input !== null && output !== null;
  } else if (protocol === "anthropic") {
    const uncached = read(raw, "input_tokens");
    const cached = read(raw, "cache_read_input_tokens");
    const creation = read(raw, "cache_creation_input_tokens");
    output = read(raw, "output_tokens");
    input = uncached === null && cached === null && creation === null ? null : sum(uncached, cached, creation);
    breakdown.cacheReadInputTokens = cached ?? 0;
    breakdown.cacheCreationInputTokens = creation ?? 0;
    known = sum(input, output);
    componentsComplete = uncached !== null && output !== null;
  } else {
    input = read(raw, "promptTokenCount");
    const visible = read(raw, "candidatesTokenCount");
    const thoughts = read(raw, "thoughtsTokenCount");
    const cached = read(raw, "cachedContentTokenCount");
    reportedTotal = read(raw, "totalTokenCount");
    output = visible === null && thoughts === null ? null : sum(visible, thoughts);
    if (thoughts !== null) breakdown.reasoningTokens = thoughts;
    if (cached !== null) breakdown.cacheReadInputTokens = cached;
    if (cached !== null && input !== null && cached > input) invalid = true;
    known = sum(input, output);
    // Missing thoughts must not prove a complete zero-reasoning total.
    componentsComplete = input !== null && visible !== null && thoughts !== null;
  }
  if (reportedTotal !== null && known !== null && reportedTotal < known) invalid = true;
  const hasKnown = input !== null || output !== null;
  const source = !invalid && reportedTotal !== null ? "reported"
    : !invalid && componentsComplete ? "components" : hasKnown ? "partial" : "unknown";
  const totalTokens = source === "reported" ? reportedTotal : source === "components" ? known : null;
  return {
    usage: { inputTokens: input ?? 0, outputTokens: output ?? 0,
      totalTokens: (!invalid ? reportedTotal : null) ?? known ?? 0, ...breakdown },
    usageObservation: { version: 1 as const, source, totalTokens, inputTokens: input, outputTokens: output,
      knownTokens: hasKnown ? known : null, invalid, complete },
  };
}
