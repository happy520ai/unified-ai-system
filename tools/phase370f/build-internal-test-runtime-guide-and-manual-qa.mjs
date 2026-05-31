import { writeJson, writeText } from "../phase370-common.mjs";

const checklist = {
  phase: "Phase370F",
  manualQaSteps: [
    "启动本机 runtime",
    "打开 Workbench",
    "验证普通模式入口",
    "验证 God Mode UI candidate 可见",
    "验证 God Mode conflict summary / supervisor transparency 文案",
    "验证 Tianshu Mode UI candidate 可见",
    "验证 Tianshu planner explanation / no-candidate fallback 文案",
    "验证 Model Library provider setup 提示",
    "验证 credentialRef-only / secret 不显示",
    "验证 quota / budget / provider 未配置提示",
    "验证错误态 fallback copy",
    "验证快速对话不被破坏",
    "验证 no-production-deploy banner / docs",
    "停止 runtime",
  ],
};

const result = {
  phase: "Phase370F",
  internalTestRuntimeGuideGenerated: true,
  manualQaScriptGenerated: true,
  manualQaChecklistGenerated: true,
  noProductionDeployBoundaryGenerated: true,
  localRuntimeActivationOnly: true,
  productionDeployClaimed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase370f-internal-test-runtime-guide.md",
  [
    "# Phase370F Internal Test Runtime Guide",
    "",
    "Runtime commands:",
    "- pnpm start:pme",
    "- pnpm dev:phase7b",
    "- pnpm status:phase10a",
    "- pnpm logs:phase16a",
    "- pnpm stop:phase9c",
    "- pnpm idle:phase15a",
    "- pnpm restart:phase11a",
    "",
    "This is internal test runtime only, not production deploy.",
  ].join("\n"),
);
await writeText(
  "docs/phase370f-manual-qa-script.md",
  [
    "# Phase370F Manual QA Script",
    "",
    "1. 启动本机 runtime。",
    "2. 打开 Workbench。",
    "3. 检查普通模式入口和快速对话。",
    "4. 检查 God Mode UI candidate。",
    "5. 检查 Tianshu Mode UI candidate。",
    "6. 检查 provider setup / credentialRef-only 提示。",
    "7. 检查 quota / budget / provider 未配置 / fallback copy。",
    "8. 检查 no-production-deploy 说明。",
    "9. 停止 runtime。",
  ].join("\n"),
);
await writeJson("docs/phase370f-manual-qa-checklist.json", checklist);
await writeText(
  "docs/phase370f-no-production-deploy-boundary.md",
  [
    "# Phase370F No Production Deploy Boundary",
    "",
    "- internal test runtime != production deploy",
    "- local runtime activation != release",
    "- no tag creation",
    "- no artifact upload",
    "- no production GA",
    "- no real billing",
    "- no public user exposure by default",
  ].join("\n"),
);
await writeText(
  "docs/phase370f-execution-report.md",
  [
    "# Phase370F Execution Report",
    "",
    "- manual QA guide generated",
    "- localRuntimeActivationOnly: true",
    "- productionDeployClaimed: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase370f/internal-test-runtime-guide-manual-qa-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
