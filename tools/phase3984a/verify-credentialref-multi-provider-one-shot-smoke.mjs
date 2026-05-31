import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3984A-CredentialRef-Multi-Provider-One-Shot-Smoke";
const evidencePath = "apps/ai-gateway-service/evidence/phase-3984a-credentialref-multi-provider-one-shot-smoke/result.json";

async function main() {
  console.log(`[${phaseId}] verifier`);
  const evidence = JSON.parse(await readRequired(evidencePath));
  const doc = await readRequired("docs/provider-smoke/PHASE3984A_CREDENTIALREF_MULTI_PROVIDER_ONE_SHOT.md");
  const contract = await readRequired("apps/ai-gateway-service/src/providers/safeProviderCallImplementation.contract.js");

  const checks = [
    ["phase id", evidence.phaseId === phaseId],
    ["completed true", evidence.completed === true],
    ["credentialRefOnly true", evidence.credentialRefOnly === true],
    ["max one request per provider", evidence.maxRequestsPerProvider === 1],
    ["attempts present", Array.isArray(evidence.attempts) && evidence.attempts.length >= 3],
    ["attempt counts bounded", evidence.attempts.every((item) => Number(item.requestAttemptCount) <= 1)],
    ["providerCallsMade consistent", evidence.providerCallsMade === evidence.attempts.some((item) => item.providerCallsMade === true)],
    ["success count consistent", evidence.successCount === evidence.attempts.filter((item) => item.ok === true).length],
    ["sealed only if success", evidence.recommended_sealed === (evidence.successCount > 0)],
    ["no secrets read", evidence.secretsRead === false],
    ["no raw secret printed", evidence.rawSecretPrinted === false],
    ["no auth header printed", evidence.authorizationHeaderPrinted === false],
    ["no deploy", evidence.deployExecuted === false],
    ["no legacy", evidence.legacyModified === false],
    ["no project context", evidence.projectContextModified === false],
    ["no chat route", evidence.chatRouteModified === false],
    ["no chat gateway execute", evidence.chatGatewayExecuteModified === false],
    ["no selectable state mutation", evidence.selectableModelStateModified === false],
    ["no stability claim", evidence.providerStabilityClaimed === false],
    ["no production claim", evidence.productionReadyClaimed === false],
    ["mimo allowed in safe contract", contract.includes("\"mimo\"")],
    ["phase purpose allowed", contract.includes("phase3984a_credentialref_multi_provider_one_shot")],
    ["doc mentions no raw secret", doc.includes("未打印 raw secret")],
  ];

  for (const attempt of evidence.attempts) {
    checks.push([`${attempt.providerId} credentialRef only`, String(attempt.credentialRef).startsWith("credentialRef:")]);
    checks.push([`${attempt.providerId} no secret exposure`, attempt.rawSecretRead === false && attempt.secretValueExposed === false && attempt.authHeaderLogged === false]);
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
