# Phase374A Minimal Split Plan

1. Extract user-visible three-mode copy into `src/ui/copy/` modules.
2. Extract three-mode panels into pure render helpers under `src/ui/components/`.
3. Extract provider / credentialRef guidance into a pure render helper.
4. Keep `consolePage.js` as page entry and retain existing runtime handlers and markers.
