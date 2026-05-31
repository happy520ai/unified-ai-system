# Phase1476-1600 Route A Rollback Runbook

Remove only the files introduced by this Route A master-control pack:

- tools/phase1476-1600-route-a/
- docs/phase1476-1600-local-self-use-route-a/
- apps/ai-gateway-service/evidence/phase1476-1600-local-self-use-route-a/

Then remove the package scripts containing phase1476-1600-local-self-use-route-a,
remove the sync wording from syncReadmeAgentsCurrentState.js, and run:

```powershell
cmd /c pnpm run sync:readme-agents-current-state
cmd /c pnpm run verify:phase306c-readme-agents-auto-sync-guard
```

Do not use git reset, git clean, deploy, release, tag, artifact upload, push,
or commit unless the owner explicitly authorizes that separate action.
