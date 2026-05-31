import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3981A-Restricted-Capability-Graduation-Gate";

const requiredFiles = [
  "docs/restricted-capability-graduation/GRADUATION_LEDGER.md",
  "docs/restricted-capability-graduation/ACCEPTANCE_MATRIX.md",
  "docs/restricted-capability-graduation/ROLLBACK_RUNBOOK.md",
  "docs/restricted-capability-graduation/SAFETY_BOUNDARY.md",
  "docs/restricted-capability-graduation/OWNER_APPROVAL_PACKET.example.json",
  "apps/ai-gateway-service/evidence/phase-3981a-restricted-capability-graduation/result.json",
];

const capabilityIds = [
  "workforce.multi_agent.execution",
  "gvc.automatic_repair_cycle",
  "provider.multi_provider.real_call",
  "mode.normal_god_tianshu.runtime",
  "nightly.scheduler.real_registration",
];

async function main() {
  console.log(`[${phaseId}] verifier`);

  const files = {};
  for (const file of requiredFiles) {
    files[file] = await readRequired(file);
  }

  const ledger = files["docs/restricted-capability-graduation/GRADUATION_LEDGER.md"];
  const acceptance = files["docs/restricted-capability-graduation/ACCEPTANCE_MATRIX.md"];
  const rollback = files["docs/restricted-capability-graduation/ROLLBACK_RUNBOOK.md"];
  const safety = files["docs/restricted-capability-graduation/SAFETY_BOUNDARY.md"];
  const packet = JSON.parse(files["docs/restricted-capability-graduation/OWNER_APPROVAL_PACKET.example.json"]);
  const evidence = JSON.parse(files["apps/ai-gateway-service/evidence/phase-3981a-restricted-capability-graduation/result.json"]);

  const checks = [
    ["phase id", evidence.phaseId === phaseId],
    ["completed=true", evidence.completed === true],
    ["recommended_sealed=true", evidence.recommended_sealed === true],
    ["providerCallsMade=false", evidence.providerCallsMade === false],
    ["secretsRead=false", evidence.secretsRead === false],
    ["rawSecretPrinted=false", evidence.rawSecretPrinted === false],
    ["deployExecuted=false", evidence.deployExecuted === false],
    ["legacyModified=false", evidence.legacyModified === false],
    ["projectContextModified=false", evidence.projectContextModified === false],
    ["chatRouteModified=false", evidence.chatRouteModified === false],
    ["chatGatewayExecuteModified=false", evidence.chatGatewayExecuteModified === false],
    ["defaultChatBehaviorChanged=false", evidence.defaultChatBehaviorChanged === false],
    ["scheduler not registered by this phase", evidence.windowsTaskSchedulerRegisteredByThisPhase === false],
    ["opencode unlimited mode not enabled", evidence.opencodeAutopilotRealUnlimitedModeEnabled === false],
    ["approval packet provider allowed", packet.providerCallAllowed === true],
    ["approval packet credentialRefOnly", packet.credentialRefOnly === true],
    ["approval packet raw secret blocked", packet.rawSecretReadAllowed === false && packet.rawSecretPrintAllowed === false],
    ["approval packet chat routes blocked", packet.chatRouteChangeAllowed === false && packet.chatGatewayExecuteChangeAllowed === false],
    ["approval packet deploy/git blocked", packet.deployAllowed === false && packet.commitAllowed === false && packet.pushAllowed === false],
    ["first provider limit <= 1", packet.firstRunLimits.maxProviderRequestsPerProvider <= 1],
    ["first workforce limit <= 3", packet.firstRunLimits.maxWorkers <= 3],
    ["first GVC file limit <= 1", packet.firstRunLimits.maxGvcFilesChanged <= 1],
    ["safety mentions no secret", includesAll(safety, [".env", "auth.json", "raw secret", "raw API key"])],
    ["safety mentions no provider by this phase", safety.includes("本阶段没有执行真实 Provider 调用")],
    ["safety mentions no deploy", includesAll(safety, ["deploy", "release", "commit", "push"])],
    ["safety mentions route boundary", includesAll(safety, ["/chat", "/chat-gateway/execute"])],
    ["ledger contains ready state", ledger.includes("ready_for_owner_authorized_real_use")],
    ["acceptance includes evidence", acceptance.includes("evidence") || acceptance.includes("result.json")],
    ["rollback includes global rollback", rollback.includes("Global Rollback")],
  ];

  for (const id of capabilityIds) {
    checks.push([`ledger contains ${id}`, ledger.includes(id)]);
    checks.push([`acceptance contains ${id}`, acceptance.includes(id)]);
    checks.push([`rollback contains ${id}`, rollback.includes(id)]);
    checks.push([`approval packet contains ${id}`, packet.capabilities.includes(id)]);
  }

  let failed = false;
  for (const [label, ok] of checks) {
    if (!ok) failed = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  }

  if (failed) {
    console.error(`[${phaseId}] FAIL`);
    process.exit(1);
  }

  console.log(`[${phaseId}] PASS`);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

async function readRequired(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`missing required file ${relativePath}: ${error.message}`);
  }
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
