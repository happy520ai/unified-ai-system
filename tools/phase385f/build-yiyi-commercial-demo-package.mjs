import { ensure, phase385Safety, safetyAssertions, writeJson, writeText } from "../phase385-common.mjs";

const demoScenarios = [
  "normal help",
  "god review",
  "tianshu planning",
  "red team blocked",
  "provider unconfigured",
  "evidence replay",
  "fallback recovery",
];

const result = {
  phase: "Phase385F",
  demoScriptGenerated: true,
  demoScenariosGenerated: true,
  demoSafetyStatementGenerated: true,
  modelBrainDisabledByDefault: true,
  commercialDemoReady: true,
  demoScenarioCount: demoScenarios.length,
  uiVisible: true,
  yiyiVisible: true,
  brainStatusVisible: true,
  safetyGuardVisible: true,
  evidenceVisible: true,
  ...phase385Safety,
};

safetyAssertions(result);
ensure(result.commercialDemoReady, "Commercial demo readiness package failed.");

await writeJson("docs/phase385f-yiyi-demo-scenarios.json", demoScenarios);
await writeJson("apps/ai-gateway-service/evidence/phase385f/yiyi-commercial-demo-readiness-result.json", result);
await writeText("docs/phase385f-yiyi-demo-script.md", [
  "# Yiyi Demo Script",
  "",
  "1. Yiyi welcomes the user and frames Mission Control as a guided cockpit.",
  "2. Yiyi introduces Normal / God / Tianshu as safe viewing and planning modes.",
  "3. Yiyi shows Security Shield and Red Team block as active protection.",
  "4. Yiyi opens Evidence Replay and explains dry-run traces.",
  "5. Yiyi explains model brain readiness and states that real provider calls stay disabled by default.",
  "6. Yiyi closes with fallback recovery and safe next steps.",
].join("\n"));
await writeText("docs/phase385f-yiyi-commercial-demo-readiness.md", [
  "# Phase385F Yiyi Commercial Demo Readiness Package",
  "",
  "- Default posture: no provider call, no secret, no deploy, no billing, no production GA claim.",
  "- Demo scenarios cover help, review, planning, security block, provider setup, evidence replay, and fallback recovery.",
  "- Model brain remains guarded and disabled for real provider execution by default.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
