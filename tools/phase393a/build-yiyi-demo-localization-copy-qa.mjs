import {
  ensure,
  fileInfo,
  makePhase393Result,
  phase393Safety,
  phase393Terminology,
  writeJson,
  writeText,
} from "../phase393-common.mjs";

const phase392Closure = fileInfo("apps/ai-gateway-service/evidence/phase392/yiyi-demo-faq-objection-pack-closure-result.json");
ensure(phase392Closure.exists && phase392Closure.sizeBytes > 20, "Phase392 closure is required before Phase393.");

const forbiddenClaims = [
  "production GA",
  "real provider execution",
  "API key display",
  "deployment completed",
  "billing executed",
  "workspace clean",
];

const terminologyLock = {
  phase: "Phase393A",
  title: "Yiyi Demo Localization Copy QA + Terminology Lock",
  terminology: phase393Terminology,
  forbiddenClaims,
  safeCopyRules: [
    "Say guided demo or dry-run preview when describing the current showcase.",
    "Say real provider testing requires Phase384 authorization.",
    "Say no secret values are displayed.",
    "Say no deployment, release, billing, invoice, or production GA was performed.",
  ],
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase393a-yiyi-demo-terminology-lock.json", terminologyLock);
await writeText(
  "docs/phase393a-yiyi-demo-localization-copy-qa.md",
  [
    "# Phase393A Yiyi Demo Localization Copy QA",
    "",
    "This phase locks the key commercial demo terms and safe language for Yiyi Guided Showcase.",
    "",
    "Terminology:",
    ...phase393Terminology.map((item) => `- ${item.term} / ${item.zh}: ${item.usage}`),
    "",
    "Forbidden claims:",
    ...forbiddenClaims.map((item) => `- ${item}`),
    "",
    "Safe posture:",
    "- Keep the demo described as guided, local, dry-run, and evidence-backed.",
    "- Keep Phase384 as the only path toward guarded real provider testing.",
  ].join("\n"),
);

const result = makePhase393Result({
  phase: "Phase393A",
  localizationCopyQaCreated: true,
  terminologyLockCreated: true,
  forbiddenClaimCount: forbiddenClaims.length,
  terminologyCount: phase393Terminology.length,
  phase384StillRequiresHumanApproval: true,
  ...phase393Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase393a/yiyi-demo-localization-copy-qa-result.json", result);
console.log(JSON.stringify(result, null, 2));
