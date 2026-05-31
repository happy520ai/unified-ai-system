# Phase1315A Owner OS Neural Skill Preview

## Goal

Owner OS shows a read-only Neural Skill Preview so the owner can see the current Neural Fabric skill boundary without mistaking it for a real training or main-chain feature.

## Owner Visible Copy

- 当前没有真实训练
- 当前没有接主链
- 当前仅 dry-run / inference-only preview

## Scope

- Owner OS UI preview only.
- Read-only status card only.
- Uses mock skill registry wording from Phase1314A.
- No runtime inference is added.
- No real model loading is added.

## Forbidden Boundaries

- 不加真实训练按钮.
- 不加真实运行按钮.
- 不接 Provider.
- 不改 `/chat`.
- 不改 `/chat-gateway/execute`.
- 不读取 secret.
- 不读取 `.env`.
- 不注册真实外部模型.
- 不把 dry-run / inference-only preview 写成真实生成器.

## UI Contract

The Owner OS panel must remain owner-facing and compact. It may display the preview as a status card after the daily report area, but it must not turn Owner Home into an engineering dashboard or a button wall.

The preview must expose:

- readOnlyPanel=true
- realTrainingEnabled=false
- mainChainIntegrated=false
- dryRunInferenceOnlyPreview=true
- providerCallsMade=false
- secretRead=false

## Evidence Contract

Evidence is written to:

`apps/ai-gateway-service/evidence/phase1315a/owner-os-neural-skill-preview-result.json`

The evidence must record:

- Owner OS preview is present.
- Preview is read-only.
- Real training is disabled.
- Main-chain integration is disabled.
- Provider calls were not made.
- Secrets were not read.
- `/chat` and `/chat-gateway/execute` were not changed by this phase.

## Validation

Run:

```powershell
node --check tools/phase1315a/verify-owner-os-neural-skill-preview.mjs
node --check apps/ai-gateway-service/src/ui/components/OwnerNeuralSkillPreviewPanel.js
node --check apps/ai-gateway-service/src/ui/components/OwnerOSShell.js
node --check apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js
pnpm run verify:phase1315a-owner-os-neural-skill-preview
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```
