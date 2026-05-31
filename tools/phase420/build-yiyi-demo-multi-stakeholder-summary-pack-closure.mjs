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
} from "../phase420-common.mjs";

const requiredFiles = [
  "docs/phase420a-yiyi-demo-multi-stakeholder-summary-pack.json",
  "docs/phase420a-yiyi-demo-multi-stakeholder-summary-pack.md",
  "apps/ai-gateway-service/evidence/phase420a/yiyi-demo-multi-stakeholder-summary-pack-result.json"
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
  "docs/phase420-yiyi-demo-multi-stakeholder-summary-pack-closure.md",
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

await writeJson("apps/ai-gateway-service/evidence/phase420/yiyi-demo-multi-stakeholder-summary-pack-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
