# Phase1956P Alternative Provider Candidate Matrix

## OpenRouter-compatible route

- routeId: openrouter_compatible
- status: available_after_owner_approval
- riskLevel: medium
- requiresCredentialRef: true
- requiresOwnerApproval: true
- realProviderCallAllowedInThisPhase: false
- nextPhase: Phase1957P-AlternativeProvider-OneShot
- target: Prepare a guarded one-shot through an OpenAI-compatible OpenRouter endpoint after owner supplies provider, model, credentialRef, and budget.
- claimBoundary: Cannot claim stability from packet generation; one-shot evidence requires a separate approved execution phase.

## OpenAI-compatible route

- routeId: openai_compatible
- status: available_after_owner_approval
- riskLevel: medium
- requiresCredentialRef: true
- requiresOwnerApproval: true
- realProviderCallAllowedInThisPhase: false
- nextPhase: Phase1957P-AlternativeProvider-OneShot
- target: Prepare a guarded one-shot through an OpenAI-compatible endpoint after owner supplies model, credentialRef, and budget.
- claimBoundary: OpenAI-compatible authorization remains packet-only until a future owner-approved execution phase.

## Claude-compatible route

- routeId: claude_compatible
- status: available_after_owner_approval
- riskLevel: medium
- requiresCredentialRef: true
- requiresOwnerApproval: true
- realProviderCallAllowedInThisPhase: false
- nextPhase: Phase1957P-AlternativeProvider-OneShot
- target: Prepare a guarded Claude-compatible one-shot after owner supplies provider route, model, credentialRef, and budget.
- claimBoundary: Claude-compatible route requires a separately approved call and does not inherit NVIDIA evidence.

## Volcengine / MiMo route

- routeId: volcengine_mimo
- status: higher_risk_requires_separate_owner_approval
- riskLevel: high
- requiresCredentialRef: true
- requiresOwnerApproval: true
- realProviderCallAllowedInThisPhase: false
- nextPhase: Phase1957P-AlternativeProvider-OneShot
- target: Prepare a separate high-risk approval packet only if owner explicitly chooses Volcengine or MiMo and supplies budget and credentialRef.
- claimBoundary: MiMo and Volcengine remain blocked without explicit separate owner approval.

## Local synthetic provider fallback

- routeId: local_synthetic_provider_fallback
- status: safe_dry_run_only
- riskLevel: low
- requiresCredentialRef: true
- requiresOwnerApproval: false
- realProviderCallAllowedInThisPhase: false
- nextPhase: Phase1956P-LocalSyntheticProviderFallback
- target: Keep three-mode, Tianshu, and Boss Mode demonstrations usable without real Provider evidence.
- claimBoundary: Synthetic fallback cannot be used to claim real Provider capability or Provider stability.
