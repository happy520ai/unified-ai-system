import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3979a-openrouter-credentialref-integration/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] OpenRouter CredentialRef integration evidence not found.");
    console.error("Run `pnpm run:phase3979a-openrouter-credentialref` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3979A-OpenRouter-CredentialRef-Real-Integration"],
    ["openrouter_connected", data.openrouterConnection.status === "pass"],
    ["matrix_updated", data.matrixUpdate.updated === true],
    ["contract_updated", data.contractUpdate.updated === true || data.contractUpdate.reason === "openrouter_already_registered"],
    ["credentialref_registered", data.credentialRefIntegration.openrouterCredentialRefRegistered === true || data.contractUpdate.reason === "openrouter_already_registered"],
    ["provider_configured", data.credentialRefIntegration.openrouterProviderConfigured === true],
    ["selectable_allowed", data.credentialRefIntegration.openrouterSelectableAllowed === true],
    ["no_raw_secret", data.safety.rawSecretRead === false],
    ["no_secret_exposed", data.safety.secretValueExposed === false],
    ["no_deploy", data.safety.deployExecuted === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  OpenRouter: ${data.openrouterConnection.status}`);
  console.log(`  CredentialRef: ${data.credentialRefIntegration.openrouterCredentialRefRegistered ? "Registered" : "Not registered"}`);
  console.log(`  Provider Status:`);
  for (const [provider, status] of Object.entries(data.providerStatus)) {
    console.log(`    ${provider}: ${status}`);
  }

  process.exit(allPassed ? 0 : 1);
}

verify();
