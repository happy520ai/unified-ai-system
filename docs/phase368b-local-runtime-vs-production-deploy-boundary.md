# Phase368B Local Runtime vs Production Deploy Boundary

- `pnpm start:pme` is local runtime activation, not production deploy.
- `pnpm dev:phase7b` is local runtime activation, not production deploy.
- `pnpm run build` is build only, not deploy.
- `pnpm run verify:*` and `pnpm run smoke:*` are verification only, not deploy.
- Production deploy requires an explicit deployment target and explicit deploy adapter/commandRef.
