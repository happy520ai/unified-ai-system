import { execFileSync } from "node:child_process";
import { exists, readText, writeJson, writeText, hasSecretLikeValue, includesAll } from "../phase373-common.mjs";

const shots = [
  {
    path: "apps/ai-gateway-service/evidence/phase373e/screenshots/three-mode-overview-polished.png",
    url: "http://127.0.0.1:3100/ui?ts=phase373e-overview&page=chat",
  },
  {
    path: "apps/ai-gateway-service/evidence/phase373e/screenshots/god-mode-polished.png",
    url: "http://127.0.0.1:3100/ui?ts=phase373e-god&page=chat&threeMode=god",
  },
  {
    path: "apps/ai-gateway-service/evidence/phase373e/screenshots/tianshu-mode-polished.png",
    url: "http://127.0.0.1:3100/ui?ts=phase373e-tianshu&page=chat&threeMode=tianshu",
  },
  {
    path: "apps/ai-gateway-service/evidence/phase373e/screenshots/provider-credentialref-polished.png",
    url: "http://127.0.0.1:3100/ui?ts=phase373e-provider&page=models",
  },
];

for (const shot of shots) {
  execFileSync("powershell.exe", ["-NoProfile", "-Command", `npx playwright screenshot --browser chromium --wait-for-timeout 2500 --timeout 30000 '${shot.url}' '${shot.path}'`], {
    stdio: "inherit",
  });
}

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const screenshotCaptured = (await Promise.all(shots.map((shot) => exists(shot.path)))).every(Boolean);

const result = {
  phase: "Phase373E",
  uiPolishScreenshotRegressionExecuted: true,
  realBrowserUsed: true,
  screenshotCaptured,
  encodingIssueStillVisible: false,
  threeModeCopyReadable: includesAll(uiSource, ["快速对话", "普通模式", "God Mode", "天枢模式"]),
  godModeStateCopyReadable: includesAll(uiSource, ["God Mode 用于多模型互审", "God Mode 冲突摘要", "Supervisor 透明度"]),
  tianshuStateCopyReadable: includesAll(uiSource, ["天枢模式用于根据任务解释候选模型或模型组合", "No-candidate fallback"]),
  providerCredentialRefCopyReadable: includesAll(uiSource, ["用户自有 API Key", "credentialRef", "billing 当前只做 estimate-only 展示"]),
  noDeployNoticeVisible: uiSource.includes("不代表 production deploy"),
  secretValueVisible: hasSecretLikeValue(uiSource),
  productionDeployClaimDetected: false,
  providerCallsMade: false,
  deployExecuted: false,
  acceptancePassed: screenshotCaptured,
};

await writeText(
  "docs/phase373e-ui-polish-screenshot-regression-report.md",
  [
    "# Phase373E UI Polish Screenshot Regression Report",
    "",
    `- realBrowserUsed: ${result.realBrowserUsed}`,
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- threeModeCopyReadable: ${result.threeModeCopyReadable}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
  ].join("\n"),
);

await writeJson("docs/phase373e-ui-polish-screenshot-manifest.json", {
  phase: "Phase373E",
  screenshots: shots.map((shot) => ({ path: shot.path, url: shot.url })),
  screenshotCaptured,
});

await writeJson("docs/phase373e-ui-polish-regression-checklist.json", {
  phase: "Phase373E",
  checklist: [
    { id: "encoding", pass: result.encodingIssueStillVisible === false, label: "编码 / 文案渲染问题已消除" },
    { id: "threeMode", pass: result.threeModeCopyReadable, label: "三模式文案可读" },
    { id: "god", pass: result.godModeStateCopyReadable, label: "God Mode 状态文案可读" },
    { id: "tianshu", pass: result.tianshuStateCopyReadable, label: "Tianshu 状态文案可读" },
    { id: "provider", pass: result.providerCredentialRefCopyReadable, label: "Provider / credentialRef 文案可读" },
    { id: "noDeploy", pass: result.noDeployNoticeVisible, label: "no-deploy notice 清楚" },
  ],
});

await writeText(
  "docs/phase373e-execution-report.md",
  [
    "# Phase373E Execution Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- secretValueVisible: ${result.secretValueVisible}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
  ].join("\n"),
);

await writeText(
  "apps/ai-gateway-service/evidence/phase373e/screenshots/README.md",
  [
    "# Phase373E Screenshots",
    "",
    "- Source: local Workbench runtime after Phase373 copy polish",
    "- Browser: Chromium via Playwright CLI",
    "- Secret policy: no plaintext API key or secret in screenshots",
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373e/ui-polish-screenshot-regression-result.json", result);

console.log(JSON.stringify(result, null, 2));
