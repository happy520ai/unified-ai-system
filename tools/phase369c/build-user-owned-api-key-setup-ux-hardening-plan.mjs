import { writeJson, writeText } from "../phase369-common.mjs";

const providerJourney = {
  phase: "Phase369C",
  steps: [
    "用户添加 provider",
    "用户选择 provider type",
    "用户输入 API Key，但 UI / evidence / logs 不显示明文",
    "API Key 转 credentialRef",
    "credentialRef 状态显示",
    "provider 测试连接",
    "provider 失败提示",
    "selectable model refresh",
    "quota / budget / policy gate",
    "未配置 provider 时 God/Tianshu 提示",
    "用户删除 / revoke credentialRef",
    "用户切换默认模型",
  ],
};

const result = {
  phase: "Phase369C",
  providerSetupJourneyGenerated: true,
  credentialRefUxGuidelinesGenerated: true,
  providerSetupErrorChecklistGenerated: true,
  secretValueAllowed: false,
  credentialRefOnly: true,
  realProviderCallMade: false,
  runtimeModified: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await writeText(
  "docs/phase369c-user-owned-api-key-setup-ux-hardening-plan.md",
  [
    "# Phase369C User-owned API Key Setup UX Hardening Plan",
    "",
    "- NVIDIA remains the internal test baseline.",
    "- Production usage should rely on user-owned API keys.",
    "- Platform must not call an unapproved provider by default.",
    "- Secret values remain forbidden in UI, docs, logs, and evidence.",
  ].join("\n"),
);
await writeJson("docs/phase369c-model-library-provider-setup-journey.json", providerJourney);
await writeText(
  "docs/phase369c-credential-ref-ux-copy-guidelines.md",
  [
    "# Phase369C CredentialRef UX Copy Guidelines",
    "",
    "- Never show plaintext API key.",
    "- Always explain that saved state is credentialRef-only.",
    "- When provider is unconfigured, show next action instead of silent failure.",
    "- When provider is blocked by policy/quota/budget, say so directly.",
  ].join("\n"),
);
await writeText(
  "docs/phase369c-provider-setup-error-handling-checklist.md",
  [
    "# Phase369C Provider Setup Error Handling Checklist",
    "",
    "- provider_type_missing",
    "- credential_ref_missing",
    "- credential_invalid",
    "- provider_unreachable",
    "- selectable_refresh_blocked",
    "- quota_blocked",
    "- budget_blocked",
    "- user_policy_blocked",
  ].join("\n"),
);
await writeText(
  "docs/phase369c-execution-report.md",
  [
    "# Phase369C Execution Report",
    "",
    "- provider setup journey generated",
    "- realProviderCallMade: false",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase369c/user-owned-api-key-setup-ux-hardening-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
