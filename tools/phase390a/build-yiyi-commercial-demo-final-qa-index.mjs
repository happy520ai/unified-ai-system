import {
  ensure,
  fileInfo,
  makePhase390Result,
  phase390IndexSources,
  phase390Safety,
  writeJson,
  writeText,
} from "../phase390-common.mjs";

const sourceInfos = phase390IndexSources.map((path) => fileInfo(path));
for (const info of sourceInfos) {
  ensure(info.exists && info.sizeBytes > 20, `Missing Phase390 source: ${info.path}`);
}

const qaIndex = {
  phase: "Phase390A",
  title: "Yiyi Commercial Demo Final QA Index",
  packageType: "final_demo_qa_index",
  sources: sourceInfos,
  demoChain: ["Phase386", "Phase387", "Phase388", "Phase389"],
  finalHandoffReadyForManualReview: true,
  finalHandoffReadyForProductionClaim: false,
  realProviderTestExecuted: false,
  productionDeployExecuted: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretValueExposed: false,
  rawSecretAccessed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  workspaceCleanClaimed: false,
  phase384Status: {
    riskLevel: "high",
    requiresHumanApproval: true,
    autoExecutionAllowed: false,
    requiredBeforeRealProviderTest: [
      "explicit allowProviderCall=true",
      "allowedProviderRefs",
      "allowedCredentialRefs",
      "allowedModelRefs",
      "maxRequests",
      "maxEstimatedCostUsd",
    ],
  },
};

await writeJson("docs/phase390a-yiyi-commercial-demo-final-qa-index.json", qaIndex);
await writeText(
  "docs/phase390a-yiyi-sales-handoff-pack.md",
  [
    "# Phase390A Yiyi Sales Handoff Pack",
    "",
    "This pack indexes the local Yiyi commercial demo materials for manual sales review.",
    "",
    "Use-ready materials:",
    "- Guided Showcase narrative, scenarios, scripts, evidence, smoke screenshots, and closure from Phase386.",
    "- Visual polish and cross-browser QA preparation from Phase387.",
    "- Recording asset pack and manual browser review checklist from Phase388.",
    "- Mobile demo review targets and presenter notes from Phase389.",
    "",
    "Must say:",
    "- Yiyi is a Mission Companion for an Agent-managed AI Mission Control demo.",
    "- Normal, God, and Tianshu modes are demonstrated as guided dry-run previews.",
    "- Security Shield, Red Team block, Evidence Replay, and Yiyi Brain status are visible demo surfaces.",
    "- The model brain is disabled by default.",
    "- Real provider testing requires Phase384-specific authorization.",
    "",
    "Must not say:",
    "- Do not claim production GA.",
    "- Do not claim real provider execution.",
    "- Do not claim deployment, release, billing, invoice generation, or external artifact upload.",
    "- Do not claim workspace clean.",
  ].join("\n"),
);

const result = makePhase390Result({
  phase: "Phase390A",
  finalQaIndexCreated: true,
  salesHandoffPackCreated: true,
  sourceCount: sourceInfos.length,
  phase384StillRequiresHumanApproval: true,
  ...phase390Safety,
});

await writeJson("apps/ai-gateway-service/evidence/phase390a/yiyi-commercial-demo-final-qa-index-result.json", result);
console.log(JSON.stringify(result, null, 2));
