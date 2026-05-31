# A. Button QA Scope

Phase308A checks user-visible navigation, action, control, safety, and help affordances in the desktop-grade Workbench UI. The goal is zero dead buttons.

# B. Navigation Button List

- Chat
- Search
- Knowledge / RAG
- Models / Providers / Plugins
- Local Agent
- Approvals / Runs
- Repair Center
- Help / Runbook
- Settings
- Diagnostics
- Chat to Local Agent
- Chat to Repair Center
- Repair Center to Local Agent

# C. Action Button List

- New chat
- Upload file
- Send
- Preview Intent
- Generate Patch Proposal
- Approve Apply
- Run Auto Review
- Stop / Reset Current Operation
- Copy to operation loop
- Start controlled repair

# D. Dropdown And Modal List

- Language switcher
- Model selector
- Permission mode selector
- Command Search
- Command palette query
- Inspector toggle
- Plugin menu notice

# E. Safety Disabled Item List

- Full-open disabled
- No commit / push / deploy / release
- .env / secrets blocked
- legacy/ blocked
- workspace dirty is not clean

# F. Help Button List

Help content is implemented with native `details` sections. They are either expandable controls or static explanatory content, not fake buttons.

# G. Expected Behavior By Category

Navigation controls switch pages, update active state, and update the URL hash. Action buttons either call existing UI handlers or show a clear blocked reason. Controls open, close, select, or show explanatory notice. Safety items are badges, not executable buttons.

# H. No Fake Or Dead Buttons

Buttons must have `type="button"` or submit intentionally through the Chat form. Key controls use `data-workbench-nav`, `data-workbench-action`, `data-workbench-control`, or `data-testid`. There must be no `href="#"` fake links.

# I. Desktop Shortcut

The shortcut name is `AI Gateway Workbench.lnk` and should target:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "<repo>\\tools\\windows\\start-ai-gateway-workbench.ps1"
```

# J. Launcher Script

`tools/windows/start-ai-gateway-workbench.ps1` checks the local service, starts `cmd /c pnpm run dev:phase7b` only when needed, waits for readiness, and opens `http://127.0.0.1:3100/ui`. It does not read `.env`, kill unknown processes, clean workspaces, commit, push, deploy, or release.

# K. README / AGENTS Sync Acceptance

After launcher and UI verification, run `cmd /c pnpm run sync:readme-agents-current-state` and `cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard`.

# L. Acceptance Checklist

- Navigation buttons verified.
- Action buttons verified.
- Controls verified.
- Safety badges are non-executable.
- Help sections are expandable or explicitly static.
- Launcher scripts exist.
- Desktop shortcut creation attempted and recorded.
- README / AGENTS sync ran.
- Workspace dirty was not claimed clean.
