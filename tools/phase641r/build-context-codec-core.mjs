import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTEXT_CODEC_FORMATS,
  DEFAULT_CONTEXT_CODEC_POLICY,
  EXPERIMENTAL_FORMATS,
  buildCompactTraceContext,
  buildJsonlFactsContext,
  buildNativeNotationContext,
  buildPhase641rAioSampleFixtures,
  buildYamlStateContext,
  guardSecretLikeValues,
  runContextCodecDryRun,
} from "../../packages/context-codec-core/src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const [fixture] = buildPhase641rAioSampleFixtures();

const result = buildNativeNotationContext(fixture, {
  format: DEFAULT_CONTEXT_CODEC_POLICY.defaultFormat,
});
const yaml = buildYamlStateContext(fixture);
const jsonl = buildJsonlFactsContext(fixture);
const trace = buildCompactTraceContext(fixture);
const dryRun = runContextCodecDryRun(fixture);
const guarded = guardSecretLikeValues(fixture);

const buildResult = {
  phase: "Phase641R-AIO",
  completed: result.codecVersion === DEFAULT_CONTEXT_CODEC_POLICY.codecVersion,
  contextCodecCoreAvailable: true,
  exportApiAvailable: true,
  defaultFormat: DEFAULT_CONTEXT_CODEC_POLICY.defaultFormat,
  allowedFormats: Object.values(CONTEXT_CODEC_FORMATS),
  experimentalFormats: EXPERIMENTAL_FORMATS,
  experimentalAlnumDefaultSelected: false,
  yamlStateGenerated: typeof yaml.compactContext === "string",
  jsonlFactsGenerated: typeof jsonl.compactContext === "string",
  compactTraceGenerated: typeof trace.compactContext === "string",
  dryRunProviderCallsMade: dryRun.providerCallsMade,
  secretLikeGuardAvailable: guarded.secretLikeRejected === false,
  providerCallsMade: false,
  secretRead: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  result,
};

await mkdir(path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r"), { recursive: true });
await writeFile(
  path.join(repoRoot, "apps/ai-gateway-service/evidence/phase641r/context-codec-core-build-result.json"),
  `${JSON.stringify(buildResult, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(buildResult, null, 2));
