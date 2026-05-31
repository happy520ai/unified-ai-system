# Phase318A Chat Main Area Normalization & Preview Feature Realization

## Goal

Phase318A fixes the Chat work area so Chat is again the primary surface, then converts low-risk features from vague preview labels into concrete UI behavior with either real route wiring, approval-required workflow, or explicit blocked-by-policy feedback.

## Scope

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `apps/ai-gateway-service/src/http/httpServer.js`
- `apps/ai-gateway-service/src/entrypoints/smokePhase318AChatAndFeatureRealization.js`
- `apps/ai-gateway-service/src/entrypoints/verifyPhase318AChatAndFeatureRealization.js`
- `package.json`
- `apps/ai-gateway-service/package.json`
- managed block sync in `README.md` / `AGENTS.md`

## UI closure

- Chat history area is restored as the dominant main-area surface.
- Chat page is a full-height grid: one compact status strip plus one full-height Chat shell.
- Chat shell owns the `minmax(520px, 1fr)` history area and the bottom composer, so any spare vertical space belongs to the scrollable history area.
- Chat history has a hard `min-height: 520px` and `height: auto` inside the Chat shell so the browser cannot collapse it into a small strip above the composer.
- Composer stays at the Chat shell bottom with `composerBottomGapPx <= 16` and keeps a usable input height in the 64-96px range.
- Chat history now contains one centered conversation column in the `860px - 1080px` band on desktop, with user messages right-aligned inside that column and assistant/system messages left-aligned inside the same column.
- Default welcome content stays compact and conversational; it is no longer a loose, wide placeholder block.
- Dry-run acceptance copy must say that no Provider call was made; only real Provider calls may render a Provider failure message.
- The current desktop target is a `960px` conversation column, with assistant/system bubbles around `74%` max width and user bubbles around `48%` max width.
- Message bubbles share one unified style baseline for padding, radius, and line-height so the flow reads like one conversation rather than scattered cards.
- The top Gateway status strip is capped to one compact row.
- The right sidebar is reduced to compact summaries only and capped at `320px`.
- The left navigation is reduced to `184px`, and the central Chat column uses `minmax(900px, 1fr)` on desktop.
- Full Gateway Evidence stays in a right drawer and does not expand into the main Chat surface.
- The default conversation shows multiple system messages, avoiding a large blank panel above the composer in the first browser view.

## Feature status model

- `real_enabled`
  - New chat
  - Model configuration
  - Verified model dropdown
  - Chat send through Chat Gateway dry-run acceptance route
  - Gateway Evidence drawer
  - Quick search
  - Help page
  - Diagnostics center
  - Local UI settings
  - Provider config save/test UI wiring

- `approval_required`
  - Local agent preview
  - Safe repair preview
  - Approval queue state
  - Add file entry
  - Plugin execution entry

- `blocked_by_policy`
  - full-open
  - `.env` read
  - API key printing
  - commit / push / deploy / release
  - no-approval local command execution
  - paid provider auto-call
  - embedding batch training

## Diagnostics boundary

Phase318A adds a read-only diagnostics summary route for the Workbench UI. It reports health, doctor command boundary, model library summary, Chat Gateway route posture, and provider key status. It does not execute doctor and does not trigger dangerous commands.

## Evidence boundary

Phase318A evidence records:

- chat area sizing verdict
- `chatHistoryMinHeightPx >= 520`
- `chatComposerAtBottom=true`
- `chatInputTopRatio >= 0.72`
- `chatHistoryAreaAboveComposer=true`
- `largeBlankPanelBetweenStatusAndComposer=false`
- `composerBottomGapPx <= 16`
- `largeBlankPanelBelowComposer=false`
- `chatHistoryOccupiesRemainingSpace=true`
- `composerNotBottomAligned=false`
- `conversationColumnVisible=true`
- `conversationColumnWidthPx=960`
- `assistantMessageMaxWidthRatio` between `0.72` and `0.78`
- `userMessageMaxWidthRatio` between `0.38` and `0.52`
- `messageBubbleStyleUnified=true`
- `defaultWelcomeLooksLikeConversation=true`
- `composerBottomAligned=true`
- `userMessageInsideConversationColumn=true`
- `assistantMessageInsideConversationColumn=true`
- `userMessageNotPinnedToViewportRight=true`
- `dryRunNotShownAsProviderFailure=true`
- `providerFailureOnlyWhenProviderCalled=true`
- `chatLooksLikeConversation=true`
- `screenshotLikeNormalChat=true`
- `rightSidebarWidthPx <= 320`
- `mainChatWidthPx >= 900` or `responsivePass=true`
- `chatViewportRatio >= 0.55`
- `noLargeBlankPanelAboveComposer=true`
- feature status counts
- button feedback coverage
- blocked action posture
- provider call boundary
- `/chat` unchanged
- no secret exposure
- no paid API calls
- no workspace clean claim

## Validation chain

- `node --check apps/ai-gateway-service/src/ui/consolePage.js`
- `node --check apps/ai-gateway-service/src/http/httpServer.js`
- `node --check apps/ai-gateway-service/src/entrypoints/smokePhase318AChatAndFeatureRealization.js`
- `node --check apps/ai-gateway-service/src/entrypoints/verifyPhase318AChatAndFeatureRealization.js`
- `cmd /c pnpm smoke:phase318a-chat-feature-realization`
- `cmd /c pnpm verify:phase318a-chat-feature-realization`
- inherited regressions from Phase317A, Phase316A, Phase315A, Phase314A, Phase313A, and Phase312A

## Delivery posture

Phase318A is a UI/main-area hardening and feature-status clarification step, not a production SaaS claim and not browser-confirmed sealed until the user verifies the real browser layout.

Current delivery wording must keep the explicit boundary: workspace dirty is normal here, and Phase318A does not convert that into a workspace clean claim.
