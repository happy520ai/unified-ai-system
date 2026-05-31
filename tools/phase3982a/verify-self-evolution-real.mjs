import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3982a-self-evolution-real/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Self-evolution real integration evidence not found.");
    console.error("Run `pnpm run:phase3982a-self-evolution` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3982A-Self-Evolution-Real-Integration"],
    ["policy_updated", data.updates.policy.updated === true],
    ["autonomous_code_mutation_allowed", data.selfEvolutionPolicy.autonomousCodeMutationAllowed === true],
    ["autonomous_provider_call_allowed", data.selfEvolutionPolicy.autonomousProviderCallAllowed === true],
    ["real_execution_enabled", data.summary.realExecutionEnabled === true],
    ["no_raw_secret", data.secretRead === false],
    ["no_deploy", data.deployExecuted === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  Autonomous Code Mutation: ${data.selfEvolutionPolicy.autonomousCodeMutationAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Autonomous Provider Call: ${data.selfEvolutionPolicy.autonomousProviderCallAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Real Execution: ${data.summary.realExecutionEnabled ? "Enabled" : "Disabled"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
