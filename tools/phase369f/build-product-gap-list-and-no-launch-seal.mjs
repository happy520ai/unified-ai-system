import { readJson, writeJson, writeText } from "../phase369-common.mjs";

const phase369a = await readJson("apps/ai-gateway-service/evidence/phase369a/no-deploy-product-hardening-decision-result.json");
const phase369b = await readJson("apps/agent-console/evidence/phase369b/three-mode-workbench-ux-hardening-result.json");
const phase369c = await readJson("apps/ai-gateway-service/evidence/phase369c/user-owned-api-key-setup-ux-hardening-result.json");
const phase369d = await readJson("apps/ai-gateway-service/evidence/phase369d/god-tianshu-quality-fallback-hardening-result.json");
const phase369e = await readJson("apps/ai-gateway-service/evidence/phase369e/local-long-running-internal-test-guide-result.json");

const gaps = {
  phase: "Phase369F",
  gaps: [
    "三模式 UI 引导是否足够",
    "Model Library provider setup 是否足够清楚",
    "用户自有 API Key / credentialRef 流程是否闭环",
    "God Mode participant selection 是否可解释",
    "God Mode conflict resolution 是否可视化",
    "Tianshu planner decision 是否可解释",
    "fallback / failure copy 是否用户可理解",
    "quota / budget / billing warning 是否清楚",
    "local runtime / internal test 手册是否足够",
    "deployment target 未选择",
    "production deploy commandRef 未生成",
    "production GA 未授权",
  ],
};

const result = {
  phase: "Phase369F",
  productGapListGenerated: true,
  noLaunchSealGenerated: true,
  nextRoadmapGenerated: true,
  launchRecommended: false,
  deployRecommended: false,
  productionGaAuthorized: false,
  deploymentMainlinePaused: phase369a.deployMainlinePaused === true,
  productHardeningRecommended: phase369b.threeModeUxHardeningPlanGenerated === true &&
    phase369c.providerSetupJourneyGenerated === true &&
    phase369d.failureTaxonomyGenerated === true &&
    phase369e.localLongRunningGuideGenerated === true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeText(
  "docs/phase369f-product-gap-list.md",
  [
    "# Phase369F Product Gap List",
    "",
    ...gaps.gaps.map((item) => `- ${item}`),
  ].join("\n"),
);
await writeJson("docs/phase369f-product-gap-list.json", gaps);
await writeText(
  "docs/phase369f-no-launch-seal.md",
  [
    "# Phase369F No-launch Seal",
    "",
    "- 本轮不建议上线。",
    "- 本轮不建议 deploy。",
    "- 本轮建议继续产品完善 / 内测稳定。",
    "- deploy 主线保持暂停。",
    "- Phase365D 不应重跑。",
    "- 只有产品缺口进一步收敛后，才重新评估 deployment target selection。",
  ].join("\n"),
);
await writeText(
  "docs/phase369f-next-product-hardening-roadmap.md",
  [
    "# Phase369F Next Product Hardening Roadmap",
    "",
    "- 优先补强三模式真实用户体验与解释性。",
    "- 优先补强 provider setup / credentialRef / error handling 体验。",
    "- 优先补强 God/Tianshu fallback taxonomy 与用户文案。",
    "- 在产品体验与内测稳定收敛后，再重新评估 deploy 主线。",
  ].join("\n"),
);
await writeText(
  "docs/phase369f-execution-report.md",
  [
    "# Phase369F Execution Report",
    "",
    `- productHardeningRecommended: ${result.productHardeningRecommended}`,
    "- noLaunchSealGenerated: true",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase369f/product-gap-list-no-launch-seal-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
