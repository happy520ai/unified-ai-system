# Phase317A Real UI Button Runtime Repair And Evidence Drawer

Phase317A repairs real UI clickability and moves Chat Gateway evidence out of the main Chat area. This phase is about 真实浏览器 user behavior and a compact 证据抽屉 layout.

## Scope

- Keep default `/chat` unchanged.
- Keep Chat Gateway on its explicit gateway route.
- Do not call MiMo, OpenAI, Claude, OpenRouter, paid APIs, or embedding batch training.
- Do not expose API keys or `.env` contents.
- Do not modify `legacy/`.
- Do not claim a clean workspace; workspace dirty is an existing state and is not a pass/fail signal by itself.

## UI Repair

The Workbench now has a unified click entrypoint named `handleWorkbenchClick(event)`.
It handles:

- `data-workbench-action`
- `data-workbench-nav`
- `data-workbench-control`
- `data-workbench-drawer`
- `data-workbench-toggle`
- known button ID fallbacks

Disabled controls must have a reason. Temporary UI-only controls must show toast or state feedback instead of failing silently.

Phase317 runtime repair also verifies that the inline browser script parses.
The real failure mode was not a missing DOM marker: when the browser script is
invalid or binds before late drawer elements exist, real user clicks appear to
do nothing even when programmatic checks pass.

The runtime now binds a document-level delegated handler after DOM readiness or
immediately when the document is already loaded. This covers late elements such
as the evidence icon, evidence close button, and future `data-workbench-*`
controls without relying on source-order-specific direct listeners.

## Evidence Drawer

The large Chat Gateway evidence grid is no longer shown by default in the main Chat area.

The Chat area now keeps only a lightweight status row:

- model
- provider
- completion verification
- evidence ID
- evidence button

Clicking the evidence button opens the right-side evidence drawer. The drawer shows the full accountability chain:

- intent
- selected model
- provider call status
- verification status
- completion status
- fallback status
- route decision
- safety decision
- evidence ID
- verification reason
- user-visible summary
- duration
- timeout state
- latency risk
- completion confidence
- retry recommendation
- fallback eligibility
- latency summary

The drawer has a close button and is hidden by default.

## Compact Layout

The Chat composer and Gateway status strip are intentionally compact:

- the model/provider/verification/evidence state is a single tight row
- detailed evidence stays in the right drawer
- the input box keeps a smaller default height while remaining resizable by content
- the right capability sidebar uses reduced padding, line height, and card spacing
- buttons stay visible and clickable instead of being hidden to satisfy tests
- dead buttons remain a hard failure: controls must perform an action, open a panel, update state, or show clear feedback

## Browser Verification Status

This phase is designed for real browser click verification. In the current execution context the Browser Use runtime could not start because the bundled Node runtime was too old for `node_repl`.

Therefore the automated smoke records:

- `realBrowserUsed=false`
- `programmaticClickUsed=true`
- `manualRealBrowserVerificationRequired=true`
- blocker includes `manualRealBrowserVerificationRequired`

This is intentional and prevents the report from misrepresenting fallback checks as real browser proof.

## Manual Real Browser Checklist

Open:

```text
http://127.0.0.1:3100/ui?ts=phase317a
```

Verify:

- top buttons respond or show clear feedback
- sidebar navigation switches pages
- Chat input stays visible
- Send triggers Chat Gateway evidence
- unsafe secret request is blocked with `providerCalled=false`
- model dropdown only shows the two smoke-passed Chat models
- evidence icon opens the drawer
- drawer close button closes it
- API key plaintext is not visible

## Workspace State

Workspace dirty is not a Phase317A failure, but this phase must not claim the workspace is clean.

## Phase317B Compatibility Note

Phase317B reconciles the older Phase312A Chat UI runtime smoke with the current
Workbench architecture. The smoke no longer requires the legacy
`data-workbench-page` SPA markers when the current Chat shell, provider/model
selector, Gateway evidence drawer, route bindings, and button handlers are
present.

The compatibility smoke must still fail on real runtime risks:

- inline browser scripts that do not parse
- buttons with no current handler, route binding, prompt binding, or disabled reason
- missing Chat shell or send form
- missing Gateway evidence drawer
- API-key-looking plaintext in rendered HTML
- provider calls during dry-run

This is a smoke scope update only. It does not move Chat into a drawer, does
not change default `/chat`, and does not call a real provider.

## Phase317C Workbench Main Route Note

Phase317C fixes the `/ui` default return path. The HTTP route still calls
`createConsolePage()`, but `createConsolePage()` now returns the current
AI Gateway Workbench template first and marks it with
`data-phase="phase317c-workbench-main"`.

The older "PME mobile earth" template remains in source as a historical
fallback body, but it is no longer the default `/ui` response. Live `/ui` must
show `AI Gateway Workbench` and must not serve the "PME mobile earth" title.
