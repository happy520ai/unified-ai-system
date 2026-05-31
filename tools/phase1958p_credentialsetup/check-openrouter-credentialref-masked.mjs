import { DEFAULT_RUNTIME_CONFIG } from "../../packages/shared-config/src/index.js";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createRuntimeCredentialStore } from "../../apps/ai-gateway-service/src/providers/runtimeCredentialStore.js";

const phase = "Phase1958P-CredentialSetup";
const providerId = "openrouter";
const modelId = "openai/gpt-4o-mini";
const credentialRef = "credentialRef:openrouter:default";
const previousSealPath = "apps/ai-gateway-service/evidence/phase1958p_fix/phase1958p-fix-seal-result.json";
const ownerGuidePath = "docs/phase1958p-credentialsetup-openrouter-owner-guide.md";
const contractDocPath = "docs/phase1958p-credentialsetup-credentialref-contract.md";
const nextTemplatePath = "docs/phase1958p-credentialsetup-next-authorization-template.json";
const maskedCheckPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/openrouter-credentialref-masked-check-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-seal-result.json";

const previousRead = readJson(previousSealPath);
const previous = previousRead.data ?? {};
const previousImported = previousRead.exists === true && previous.completed === true && previous.recommended_sealed === true;
const previousDeclared = previous.openRouterCredentialRefDeclared === true;
const runtimeCredentialStore = createRuntimeCredentialStore({ env: process.env });
const credentialRefMapping = buildCredentialRefMappingStatus(runtimeCredentialStore, credentialRef);
const openRouterRuntimeCredential = credentialRefMapping.aggregateStatus;
const openRouterCredentialRefDeclared =
  previousDeclared
  || credentialRefMapping.declared === true
  || openRouterRuntimeCredential.apiKeyPresent === true
  || openRouterRuntimeCredential.endpointConfigured === true;
const openRouterCredentialRefResolvable =
  openRouterCredentialRefDeclared
  && credentialRefMapping.resolvable === true;
const blocker = openRouterCredentialRefResolvable ? null : "openrouter_credentialref_still_missing";

const safety = {
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  externalNetworkRequestMade: false,
  rawSecretRead: false,
  authJsonRawRead: false,
  authJsonRead: false,
  dotEnvRawRead: false,
  dotEnvRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  oneShotProviderCallPassed: false,
  providerStabilityVerified: false,
  productionReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const nextTemplate = buildNextAuthorizationTemplate();
const maskedResult = {
  phase,
  name: "OpenRouter CredentialRef Masked Readiness Check Result",
  completed: true,
  recommended_sealed: true,
  blocker,
  ownerCredentialSetupGuideGenerated: true,
  credentialRefContractGenerated: true,
  maskedReadinessCheckerGenerated: true,
  nextFreshAuthorizationTemplateGenerated: true,
  previousFixSealImported: previousImported,
  previousOpenRouterCredentialRefDeclared: previousDeclared,
  previousOpenRouterCredentialRefResolvable: previous.openRouterCredentialRefResolvable === true,
  credentialRef,
  providerId,
  modelId,
  openRouterCredentialRefDeclared,
  openRouterCredentialRefResolvable,
  openRouterRuntimeCredentialStatus: toMaskedCredentialStatus(openRouterRuntimeCredential, providerId),
  credentialRefMapping,
  maskedReadinessStatus: openRouterCredentialRefResolvable ? "resolvable" : "still_missing",
  maskedCredentialPreview: openRouterCredentialRefResolvable ? "credentialRef:openrouter:default:present" : "credentialRef:openrouter:default:missing",
  credentialValueReturned: false,
  keyRequestedFromOwner: false,
  freshApprovalRequired: true,
  oldApprovalReusable: false,
  ...safety,
};

const seal = {
  ...maskedResult,
  name: "Phase1958P-CredentialSetup OpenRouter CredentialRef Setup Packet Seal Result",
};

writeText(ownerGuidePath, buildOwnerGuide(maskedResult));
writeText(contractDocPath, buildContractDoc(maskedResult));
writeJson(nextTemplatePath, nextTemplate);
writeJson(maskedCheckPath, maskedResult);
writeJson(sealPath, seal);

console.log(JSON.stringify(seal, null, 2));

function parseCredentialRef(value) {
  const text = String(value ?? "").trim();
  const match = /^credentialRef:([^:]+):([^:]+)$/u.exec(text);
  if (!match) {
    return {
      credentialRef: text,
      providerId: "",
      slotId: "",
      valid: false,
    };
  }

  return {
    credentialRef: text,
    providerId: match[1],
    slotId: match[2],
    valid: true,
  };
}

function buildCredentialRefAliases(parsed) {
  const aliases = [
    parsed.providerId,
    `${parsed.providerId}/${parsed.slotId}`,
    `${parsed.providerId}:${parsed.slotId}`,
    `${parsed.providerId}::${parsed.slotId}`,
    parsed.credentialRef,
  ];

  return Array.from(new Set(aliases.filter(Boolean)));
}

function buildCredentialRefMappingStatus(store, ref) {
  const parsed = parseCredentialRef(ref);
  const aliasesChecked = buildCredentialRefAliases(parsed);
  const defaultEndpointConfigured = hasDefaultEndpoint(parsed.providerId);
  const aliasStatuses = aliasesChecked.map((alias) => {
    const described = store.describe?.(alias) ?? null;
    const present = store.has?.(alias) === true;
    return {
      alias,
      present,
      providerId: described?.providerId ?? alias,
      apiKeyPresent: described?.apiKeyPresent === true,
      endpointConfigured: described?.endpointConfigured === true,
      persisted: described?.persisted === true,
      source: described?.source ?? null,
      secretStorage: described?.secretStorage ?? null,
      runtimeModelCount: Number(described?.runtimeModelCount ?? 0),
    };
  });
  const apiKeyHit = aliasStatuses.find((status) => status.apiKeyPresent === true);
  const endpointHit = aliasStatuses.find((status) => status.endpointConfigured === true);
  const presentHit = aliasStatuses.find((status) => status.present === true);
  const apiKeyPresent = Boolean(apiKeyHit);
  const endpointConfigured = Boolean(endpointHit) || defaultEndpointConfigured;
  const matchedAlias = apiKeyHit?.alias ?? endpointHit?.alias ?? presentHit?.alias ?? null;
  const aggregateStatus = {
    providerId: parsed.providerId || providerId,
    apiKeyPresent,
    endpointConfigured,
    endpointFromDefaultConfig: defaultEndpointConfigured && !endpointHit,
    secretStorage: apiKeyHit?.secretStorage ?? presentHit?.secretStorage ?? null,
    persisted: aliasStatuses.some((status) => status.persisted === true),
    source: apiKeyHit?.source ?? presentHit?.source ?? null,
    runtimeModelCount: Math.max(0, ...aliasStatuses.map((status) => status.runtimeModelCount)),
    matchedAlias,
  };

  return {
    credentialRef: ref,
    providerId: parsed.providerId || providerId,
    slotId: parsed.slotId || "default",
    validCredentialRef: parsed.valid,
    aliasesChecked,
    aliasStatuses,
    declared: aliasStatuses.some((status) => status.present || status.apiKeyPresent || status.endpointConfigured) || defaultEndpointConfigured,
    apiKeyPresent,
    endpointConfigured,
    endpointFromDefaultConfig: aggregateStatus.endpointFromDefaultConfig,
    matchedAlias,
    resolvable: apiKeyPresent && endpointConfigured,
    aggregateStatus,
  };
}

function hasDefaultEndpoint(targetProviderId) {
  return DEFAULT_RUNTIME_CONFIG.aiGatewayService.providerModels.some((provider) =>
    provider.providerId === targetProviderId && typeof provider.endpoint === "string" && provider.endpoint.trim().length > 0
  );
}

function toMaskedCredentialStatus(status, fallbackProviderId) {
  return {
    providerId: status?.providerId ?? fallbackProviderId,
    apiKeyPresent: status?.apiKeyPresent === true,
    endpointConfigured: status?.endpointConfigured === true,
    endpointFromDefaultConfig: status?.endpointFromDefaultConfig === true,
    secretStorage: status?.secretStorage ?? null,
    persisted: status?.persisted === true,
    source: status?.source ?? null,
    runtimeModelCount: Number(status?.runtimeModelCount ?? 0),
    matchedAlias: status?.matchedAlias ?? null,
  };
}

function buildNextAuthorizationTemplate() {
  const approvalStatement = [
    "I approve a fresh guarded OpenRouter-compatible one-shot execution after I configured credentialRef:openrouter:default on this machine.",
    "",
    "Provider: openrouter",
    "Model: openai/gpt-4o-mini",
    "CredentialRef: credentialRef:openrouter:default",
    "Limits: allowProviderCall=true, maxRequests=1, timeoutMs=60000, stream=false",
    "",
    "Hard boundaries:",
    "- no raw secret read",
    "- no auth json raw read",
    "- no dot env raw read",
    "- no env dump",
    "- no default chat route change",
    "- no chat-gateway execute route change",
    "- no deploy, release, tag, artifact, commit, push, stability, production, or commercial claim",
  ].join("\n");

  return {
    phase: "Phase1958P-CredentialSetup-NextOneShot",
    targetPhase: "Phase1960F",
    decision: "approved_execute_guarded_openrouter_fast_one_shot_after_owner_credential_setup",
    ownerApprovalTextSourceOfTruth: true,
    approvalStatement,
    providerId,
    modelId,
    credentialRef,
    allowProviderCall: true,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowEnvDump: false,
    allowChatGatewayExecuteModification: false,
    allowDeploy: false,
    maxRequests: 1,
    retryAttemptCount: 0,
    maxEstimatedCostUsd: 0.01,
    timeoutMs: 60000,
    stream: false,
    prompt: "Reply only: OK",
    expectedResponseContains: "OK",
    recordNetworkAttempt: true,
    recordProviderResponseMetadata: true,
    recordRawSecret: false,
    recordAuthorizationHeader: false,
    createdBy: "owner",
    notes: "Fresh guarded OpenRouter-compatible one-shot after owner credential setup only. No stability, production, or commercial claim.",
  };
}

function buildOwnerGuide(record) {
  return `# Phase1958P-CredentialSetup OpenRouter Owner Guide

## Goal

Owner 在本机安全位置配置 OpenRouter API Key，使其映射为：

\`\`\`text
${record.credentialRef}
\`\`\`

Codex 不接收、不读取、不打印 API Key。验证器只判断 credentialRef 是否可解析为“存在/可用状态”，不得输出 secret value。

## Owner Boundary

- 不要把 OpenRouter API Key 发给 Codex。
- 不要把 API Key 写进 docs、evidence、chat、终端日志或 approval JSON。
- 不要让 Codex 输出任何 authorization header。
- 配置完成后，需要重新生成 fresh text-first owner approval；旧 Phase1957P approval 不可复用。

## Current Masked Status

- providerId: ${record.providerId}
- modelId: ${record.modelId}
- credentialRef: ${record.credentialRef}
- openRouterCredentialRefResolvable: ${record.openRouterCredentialRefResolvable}
- blocker: ${record.blocker ?? "null"}
- aliasesChecked: ${record.credentialRefMapping.aliasesChecked.join(", ")}
- matchedAlias: ${record.credentialRefMapping.matchedAlias ?? "null"}

This packet does not call OpenRouter and does not read secret material.
`;
}

function buildContractDoc(record) {
  return `# Phase1958P-CredentialSetup CredentialRef Contract

## Target Contract

- providerId: ${record.providerId}
- modelId: ${record.modelId}
- credentialRef: ${record.credentialRef}
- ownerApprovalTextSourceOfTruth: true
- jsonRole: machine_validation_carrier_only

## Masked Readiness Contract

- masked check may report only: declared, present/resolvable, missing/unresolvable, providerId, modelId, credentialRef
- masked check may check aliases: ${record.credentialRefMapping.aliasesChecked.join(", ")}
- masked check must not return raw API key
- masked check must not return authorization header
- masked check must not read auth json raw content
- masked check must not read dot env raw content
- masked check must not dump env

## Current Status

- maskedReadinessStatus: ${record.maskedReadinessStatus}
- openRouterCredentialRefResolvable: ${record.openRouterCredentialRefResolvable}
- providerCallsMade: ${record.providerCallsMade}
- externalNetworkRequestMade: ${record.externalNetworkRequestMade}
`;
}
