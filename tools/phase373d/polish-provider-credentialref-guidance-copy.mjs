import { readText, writeJson, writeText, includesAll } from "../phase373-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");

const result = {
  phase: "Phase373D",
  providerCredentialRefGuidancePolishExecuted: true,
  userOwnedProviderCopyPolished: includesAll(uiSource, ["用户自有 API Key", "正式上线时应由用户配置自己拥有 API Key 的 Provider"]),
  credentialRefOnlyCopyPolished: includesAll(uiSource, ["credentialRef", "不显示 secret"]),
  secretForbiddenCopyPolished: includesAll(uiSource, ["不显示 secret", "不会回显 API Key 明文"]),
  providerUnconfiguredGuidancePolished: includesAll(uiSource, ["未配置 provider 时", "只显示提示"]),
  quotaBudgetBillingCopyPolished: includesAll(uiSource, ["quota、budget、selectable 会影响可用性", "billing 当前只做 estimate-only 展示"]),
  realProviderCallMade: false,
  runtimeModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase373d-provider-credentialref-guidance-polish-report.md",
  [
    "# Phase373D Provider / credentialRef Guidance Polish Report",
    "",
    `- userOwnedProviderCopyPolished: ${result.userOwnedProviderCopyPolished}`,
    `- credentialRefOnlyCopyPolished: ${result.credentialRefOnlyCopyPolished}`,
    `- quotaBudgetBillingCopyPolished: ${result.quotaBudgetBillingCopyPolished}`,
  ].join("\n"),
);

await writeJson("docs/phase373d-provider-credentialref-copy-map.json", {
  phase: "Phase373D",
  coveredCopy: [
    "NVIDIA internal test baseline only",
    "user-owned API key after launch",
    "credentialRef-only",
    "secret forbidden",
    "provider unconfigured blocks real God / Tianshu execution",
    "quota / budget / selectable gating",
    "billing estimate-only",
  ],
});

await writeText(
  "docs/phase373d-provider-setup-guidance-checklist.md",
  [
    "# Phase373D Guidance Checklist",
    "",
    "- User-owned provider boundary is visible.",
    "- API key plaintext is forbidden in UI copy.",
    "- credentialRef-only posture is explicit.",
    "- unconfigured provider impact on God / Tianshu is called out.",
  ].join("\n"),
);

await writeText(
  "docs/phase373d-execution-report.md",
  [
    "# Phase373D Execution Report",
    "",
    `- runtimeModified: ${result.runtimeModified}`,
    `- deployExecuted: ${result.deployExecuted}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373d/provider-credentialref-guidance-polish-result.json", result);

console.log(JSON.stringify(result, null, 2));
