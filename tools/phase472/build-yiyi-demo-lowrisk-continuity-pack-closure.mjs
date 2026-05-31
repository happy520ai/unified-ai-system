import {
  ensure,
  fileInfo,
  makeResult,
  phaseDeliverables,
  phaseName,
  phaseSafety,
  phaseTitle,
  writeJson,
  writeText
} from "../phase472-common.mjs";

const requiredFiles = [
  "docs/phase472a-yiyi-demo-lowrisk-continuity-pack.json",
  "docs/phase472a-yiyi-demo-lowrisk-continuity-pack.md",
  "apps/ai-gateway-service/evidence/phase472a/yiyi-demo-lowrisk-continuity-pack-result.json"
];

for (const path of requiredFiles) {
  const info = fileInfo(path);
  ensure(info.exists && info.sizeBytes > 20, `Missing ${phaseName} prerequisite: ${path}`);
}

const result = makeResult({
  packageCreated: true,
  checklistCreated: true,
  phase384StillRequiresHumanApproval: true,
  providerRuntimeModified: false,
  chatGatewayExecuteModified: false,
  chatSendMainChainModified: false,
  ...Object.fromEntries(phaseDeliverables.map((key) => [key, true])),
  ...phaseSafety
});

await writeText(
  "docs/phase472-yiyi-demo-lowrisk-continuity-pack-closure.md",
  [
    `# ${phaseName} ${phaseTitle} Closure`,
    "",
    "Completed:",
    ...phaseDeliverables.map((item) => `- ${item}`),
    "",
    "Boundary:",
    "- No provider call.",
    "- No secret access.",
    "- No deploy/release/tag/artifact upload.",
    "- No billing/invoice.",
    "- No production GA claim.",
    "- No provider runtime, /chat-gateway/execute route, or Chat send main-chain modification."
  ].join("\n")
);

await writeJson("apps/ai-gateway-service/evidence/phase472/yiyi-demo-lowrisk-continuity-pack-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
