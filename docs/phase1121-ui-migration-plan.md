# Phase1121 UI Migration Plan

Migration steps:
- Create future-minimal-os/ as the independent UI architecture root.
- Keep FutureMinimalOsPanel.js as a compatibility wrapper.
- Extract Shell, SystemTopBar, MainWorkspace, ResponsiveFrame, ProgressiveDetailsDrawer.
- Extract TaskComposer, PrimaryActionButton, ModeRecommendationCard, SecurityBoundarySummary, ModuleCard, StatusPill, EmptyState, ErrorState.
- Register modules through futureMinimalModuleRegistry.
- Move human-readable copy into future-minimal-os/copy.
- Move preview state helpers into future-minimal-os/state.
- Inject tokenized CSS from future-minimal-os/styles without changing the build system.

Rollback:
- Delete apps/ai-gateway-service/src/ui/future-minimal-os/
- Delete apps/ai-gateway-service/src/ui/styles/futureMinimal*.css
- Restore apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js and apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js from the pre-phase version
- Delete tools/phase1121_1130/
- Delete docs/phase1121-1130-* and phase1121/phase1130 docs
- Delete apps/ai-gateway-service/evidence/phase1121_1130/
- Do not use git reset --hard or git clean
