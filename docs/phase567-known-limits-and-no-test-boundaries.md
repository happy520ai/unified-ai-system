# Phase567 Known Limits And No-Test Boundaries

## Scope

Phase567 prepares Mission Control for human internal trial. It does not expand runtime capability, restore character UI, call providers, read secrets, deploy, release, tag, upload artifacts, bill, invoice, or modify the Chat Gateway runtime.

## Known Limits

- Mission Control is currently an internal guarded Workbench surface.
- Normal / God / Tianshu are product paths under candidate / dry-run / guarded path language unless a later phase explicitly enables real provider execution.
- Provider / CredentialRef is guidance and configuration posture, not proof of a live provider connection.
- Evidence Replay is local/internal validation material, not a production audit or external compliance report.
- Security Shield describes product guardrails, not a completed production security audit.
- Internal trial readiness does not mean production GA.

## No-Test Boundaries

Do not test:

1. Real provider calls.
2. OpenAI.
3. Claude.
4. OpenRouter.
5. MiMo.
6. NVIDIA.
7. Real secret input.
8. Real secret storage.
9. API key display or echo.
10. Real billing.
11. Invoice generation.
12. Deploy.
13. Release.
14. Tag creation.
15. Artifact upload.
16. Production GA.
17. Yiyi / character / companion / avatar visual restoration.
18. `/chat-gateway/execute` changes.
19. Chat send main-chain changes.
20. Provider runtime changes.
21. Selectable gate changes.
22. Legacy code changes.

## Required Trial Boundaries

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- no-production-GA
- Yiyi / character remains hidden
- chat gateway runtime unchanged
- workspaceCleanClaimed=false

## Stop Conditions

Stop the trial if any tester observes:

- A visible Yiyi / character / companion / avatar module.
- A real provider call attempt.
- A secret value exposed in UI, docs, logs, evidence, or screenshots.
- A deploy, release, tag, or artifact upload action.
- Billing or invoice shown as enabled.
- Production GA or real provider connected wording.
- A dry-run result presented as real execution.

## Next Allowed Direction

The next phase may prepare a controlled internal trial intake process or tighten product copy based on human feedback. It must not jump to provider execution, billing, deployment, release, or character UI restoration without a new explicit phase and matching verification.
