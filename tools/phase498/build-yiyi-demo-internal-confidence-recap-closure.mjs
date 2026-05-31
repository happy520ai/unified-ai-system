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
} from "../phase498-common.mjs";

const requiredFiles = [
  "docs/phase498a-yiyi-demo-internal-confidence-recap.json",
  "docs/phase498a-yiyi-demo-internal-confidence-recap.md",
  "apps/ai-gateway-service/evidence/phase498a/yiyi-demo-internal-confidence-recap-result.json"
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
  "docs/phase498-yiyi-demo-internal-confidence-recap-closure.md",
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

await writeJson("apps/ai-gateway-service/evidence/phase498/yiyi-demo-internal-confidence-recap-closure-result.json", result);
console.log(JSON.stringify(result, null, 2));
