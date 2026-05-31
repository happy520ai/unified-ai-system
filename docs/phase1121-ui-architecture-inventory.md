# Phase1121 UI Architecture Inventory

- currentTarget: Future Minimal OS Product UI
- sourcePanel: apps/ai-gateway-service/src/ui/components/FutureMinimalOsPanel.js
- previousCopy: apps/ai-gateway-service/src/ui/copy/futureMinimalOsCopy.js
- mountPath: MissionControlPanel -> renderFutureMinimalOsPanel
- consoleRuntime: apps/ai-gateway-service/src/ui/consolePage.js keeps event delegation for preview and details toggles
- styleMode: inline style injection from future-minimal-os/styles; no build-system change

Findings:
- The previous panel mixed Shell, task composer, mode cards, safety copy, preview card, sample bridge, and details drawer in one file.
- Copy is now centralized under future-minimal-os/copy and the legacy copy file re-exports it for compatibility.
- State is preview-only and limited to taskText, previewGenerated, recommendedMode, detailsOpen, activeDetailModule, errorState, loadingState.
- Registry descriptors are metadata-only and cannot trigger Provider calls or secret access.
