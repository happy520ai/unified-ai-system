export const CONTEXT_CODEC_VERSION = "phase641r-aio-native-notation-v1";

export const CONTEXT_CODEC_FORMATS = Object.freeze({
  YAML_STATE: "yaml_state",
  JSONL_FACTS: "jsonl_facts",
  COMPACT_TRACE: "compact_trace",
});

export const DEFAULT_FORMAT_PRIORITY = Object.freeze([
  CONTEXT_CODEC_FORMATS.YAML_STATE,
  CONTEXT_CODEC_FORMATS.JSONL_FACTS,
  CONTEXT_CODEC_FORMATS.COMPACT_TRACE,
]);

export const EXPERIMENTAL_FORMATS = Object.freeze(["experimental_alnum_code"]);

export const DEFAULT_CONTEXT_CODEC_POLICY = Object.freeze({
  codecVersion: CONTEXT_CODEC_VERSION,
  defaultFormat: CONTEXT_CODEC_FORMATS.YAML_STATE,
  formatPriority: DEFAULT_FORMAT_PRIORITY,
  experimentalFormats: EXPERIMENTAL_FORMATS,
  experimentalAlnumDefaultSelected: false,
  providerCallsAllowed: false,
  secretReadAllowed: false,
  codexConfigWriteAllowed: false,
  codexBaseUrlWriteAllowed: false,
  chatBehaviorChangeAllowed: false,
  chatGatewayExecuteBehaviorChangeAllowed: false,
  deployAllowed: false,
  releaseAllowed: false,
  tagAllowed: false,
  artifactUploadAllowed: false,
  minTokenSavingPercent: 30,
  minFactRecoveryAccuracy: 0.95,
  minPointerCoverage: 0.9,
});

export function normalizeCodecFormat(format, policy = DEFAULT_CONTEXT_CODEC_POLICY) {
  if (policy.formatPriority.includes(format)) {
    return format;
  }
  return policy.defaultFormat;
}
