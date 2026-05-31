# Phase573R Visible UI Surface Regression Triage

## Status

User screenshot evidence showed that the actually opened Workbench / Mission Control page still exposed character UI elements.

## Regression Evidence

The pre-fix visible surface included:

- Yiyi / 依依 wording
- Mission Companion wording
- real 3D placeholder status
- guided showcase entry
- floating avatar stage
- concept board / placeholder content

## Root Cause

The live `/ui` service was an older `node ./src/index.js` process on port 3100. It was still serving a Workbench surface with character modules and guided demo markup. In addition, the Yiyi UI component files could still return visible character HTML if referenced by any entrypoint.

## Fix

The Yiyi visible component renderers were isolated to disabled output, and the Workbench page output now strips legacy character blocks from the product surface before returning HTML.

## Verification

Phase573R uses a real headless Chromium browser against `/ui`, captures screenshots, saves a rendered DOM snapshot with scripts/styles removed, and checks visible text plus live DOM selectors.

## Boundary

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- workspaceCleanClaimed=false
