# Phase316A Actual UI Clickability Repair & Functional Chain Acceptance

Phase316A verifies that all buttons in the AI Gateway Workbench have real click handlers, produce visible feedback, and connect to the correct backend routes. It does not add new business functionality.

This phase is a clickability acceptance repair, not a new feature phase.

## Scope

This phase validates:

- Every `<button>` with `data-workbench-action`, `data-workbench-nav`, or `data-workbench-control` has a registered handler.
- All 10 workbench pages (chat, search, knowledge, models, local-agent, approvals, repair, help, settings, diagnostics) are switchable and non-empty.
- The Chat send chain works from input through `/chat-gateway/dry-run-task` to evidence generation.
- Unsafe secret/release/non-chat requests are blocked with `providerCalled=false`.
- The model dropdown contains only 2 selectable chat models from Phase313A.
- No API keys appear in plaintext in the UI or evidence.
- No dead buttons exist; disabled buttons have reason annotations.
- No empty pages exist.

## Methodology

In the absence of a real browser automation tool (Playwright/Puppeteer), this phase uses **programmatic click validation**:

1. The service is started in-memory.
2. `/ui` HTML is fetched and parsed.
3. All `<button>` elements are extracted.
4. Each button's `data-workbench-action`/`data-workbench-nav`/`data-workbench-control` is cross-referenced against the JavaScript handler registrations found in the `<script>` block.
5. Critical functional chains (chat send, unsafe secret block, model dropdown) are verified through HTTP route simulation.
6. Evidence records `realBrowserUsed=false`, `programmaticClickUsed=true`, `httpRouteSimulationUsed=true`.

## Button Handler Architecture

The actually-served UI uses the **Phase308B variant** (with Phase312A overlay). All buttons are served by one of:

1. **Global click delegation** (`document.addEventListener("click",...)` at line 802): Handles `data-workbench-action` (14 handlers), `data-workbench-nav` (10 pages), and 4 `data-workbench-control` values.
2. **Direct addEventListener** for `chat-form` submit, `language-select` change, `command-search-input` focus/click, `command-palette-query` input, `file-input` change, and `Ctrl+B` keydown.
3. **Phase312A wire controls** (`phase312aWireControls()`): Registers 6 click handlers (save/test/refresh/test-model/set-default/generate-plan), 2 change handlers (status/bucket filters), 1 model-select capture change, and 1 chat-form capture submit.

## Boundaries

- Does not modify `legacy/`
- Does not create `PROJECT_CONTEXT.md`
- Does not commit / push / deploy / release
- Does not claim clean workspace
- Does not change default /chat
- Does not call MiMo, OpenAI, Claude, OpenRouter, or paid API
- Does not do embedding batch training
- Does not expand the model library
- Does not delete buttons to pass tests
- Does not mark unresponsive buttons as passing
- Does not fabricate real browser click results

Workspace dirty is an existing local state and is not a phase failure, but this phase must record `workspaceCleanClaimed=false`.
workspace dirty remains informational and must not be claimed as clean.
