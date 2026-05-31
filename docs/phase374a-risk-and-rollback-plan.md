# Phase374A Risk And Rollback Plan

- risk: marker drift can break Phase308A smoke
- risk: visible wording drift can re-trigger Phase321A source_no_dangerous_buttons
- rollback: restore `consolePage.js` render block and remove extracted pure view modules
