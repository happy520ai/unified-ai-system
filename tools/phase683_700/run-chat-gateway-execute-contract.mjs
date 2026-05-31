import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const passed = baseline.phase675682Passed;
const contract = {
  route: "/chat-gateway/execute",
  requestField: "taijiBeidouPreview|taijiBeidouShadow",
  responseField: "taijiBeidouPreview",
  previewFlag: "taijiBeidouPreview=true",
  shadowFlag: "taijiBeidouShadow=true",
  rollbackFlag: "taijiBeidouRollback=true",
  killSwitch: "TAIJI_BEIDOU_MAIN_CHAIN_ENABLED=false",
  providerRuntimeGate: "Phase675-682 credentialRef-only gate",
  evidencePath: "apps/ai-gateway-service/evidence/phase692/",
  noDefaultBehaviorChange: true,
};
const evidence = boundary({
  phase: "Phase691",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker,
  productionReady: false,
  chatGatewayExecuteContractAvailable: true,
  chatGatewayExecuteDefaultEnabled: false,
  contract,
});

await writeJson(phaseEvidencePath(691, "chat-gateway-execute-contract-result.json"), evidence);
await writePhaseDoc(691, "Chat Gateway Execute Integration Contract", evidence, [
  "## Contract",
  "",
  "```json",
  JSON.stringify(contract, null, 2),
  "```",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
