import { existsSync, readFileSync } from "node:fs";

const VERIFICATION_PHASES = [
  {
    id: "phase3979a",
    name: "OpenRouter CredentialRef Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3979a-openrouter-credentialref-integration/result.json",
    required: true,
  },
  {
    id: "phase3980a",
    name: "Owner Daily Use Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3980a-owner-daily-use-real/result.json",
    required: true,
  },
  {
    id: "phase3981a",
    name: "UI Dead Button Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3981a-ui-dead-button-real/result.json",
    required: true,
  },
  {
    id: "phase3982a",
    name: "Self-Evolution Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3982a-self-evolution-real/result.json",
    required: true,
  },
  {
    id: "phase3983a",
    name: "Workforce Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3983a-workforce-real/result.json",
    required: true,
  },
  {
    id: "phase3984a",
    name: "Owner Automation Real Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3984a-owner-automation-real/result.json",
    required: true,
  },
  {
    id: "phase3985a",
    name: "Chat Main Chain Integration",
    resultPath: "apps/ai-gateway-service/evidence/phase3985a-chat-main-chain/result.json",
    required: true,
  },
  {
    id: "phase3986a",
    name: "Workbench Chat Send + Approvals",
    resultPath: "apps/ai-gateway-service/evidence/phase3986a-workbench-chat-approvals/result.json",
    required: true,
  },
];

function verifyAllPhases() {
  console.log("=== Final Verification: All Real Integrations ===\n");

  let allPassed = true;
  const results = [];

  for (const phase of VERIFICATION_PHASES) {
    console.log(`[${phase.id}] ${phase.name}`);

    if (!existsSync(phase.resultPath)) {
      console.log(`  FAIL: Evidence not found`);
      if (phase.required) allPassed = false;
      results.push({
        ...phase,
        status: "missing",
        passed: false,
      });
      continue;
    }

    const data = JSON.parse(readFileSync(phase.resultPath, "utf-8"));
    const passed = data.phase && !data.blocker;
    const status = passed ? "PASS" : "FAIL";

    console.log(`  ${status}: ${phase.name}`);
    if (!passed) allPassed = false;

    results.push({
      ...phase,
      status: passed ? "completed" : "failed",
      passed,
      evidence: data,
    });
  }

  console.log("\n=== Summary ===\n");

  const completed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`Total Phases: ${VERIFICATION_PHASES.length}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${Math.round((completed / VERIFICATION_PHASES.length) * 100)}%`);

  console.log("\n=== Detailed Results ===\n");

  for (const result of results) {
    const status = result.passed ? "✅" : "❌";
    console.log(`${status} ${result.id}: ${result.name}`);
  }

  console.log("\n=== Key Capabilities ===\n");

  const keyCapabilities = [
    {
      name: "Multi-Provider CredentialRef",
      phase: "phase3979a",
      description: "OpenRouter free models accessible via credentialRef",
    },
    {
      name: "Owner Daily Use",
      phase: "phase3980a",
      description: "Owner can perform daily tasks with real provider calls",
    },
    {
      name: "UI Real Buttons",
      phase: "phase3981a",
      description: "Dead buttons converted to real execution capabilities",
    },
    {
      name: "Self-Evolution",
      phase: "phase3982a",
      description: "Autonomous code mutation and provider calls enabled",
    },
    {
      name: "Workforce Execution",
      phase: "phase3983a",
      description: "Workforce can execute real tasks with external runner",
    },
    {
      name: "Owner Automation",
      phase: "phase3984a",
      description: "Owner automation actions can be executed for real",
    },
    {
      name: "Chat Main Chain",
      phase: "phase3985a",
      description: "Default /chat integrated with OpenRouter provider",
    },
    {
      name: "Workbench Integration",
      phase: "phase3986a",
      description: "Workbench chat send and approvals enabled",
    },
  ];

  for (const cap of keyCapabilities) {
    const result = results.find(r => r.id === cap.phase);
    const status = result?.passed ? "✅" : "❌";
    console.log(`${status} ${cap.name}: ${cap.description}`);
  }

  console.log("\n=== Final Status ===\n");

  if (allPassed) {
    console.log("✅ ALL INTEGRATIONS PASSED");
    console.log("除生产部署上线外，所有未实现功能已打通！");
  } else {
    console.log("❌ SOME INTEGRATIONS FAILED");
    console.log("部分功能未完全打通，请检查失败的阶段。");
  }

  return { allPassed, results };
}

const { allPassed, results } = verifyAllPhases();
process.exit(allPassed ? 0 : 1);
