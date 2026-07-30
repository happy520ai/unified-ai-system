# Static Showcase

This directory preserves the standalone HTML/CSS/JavaScript showcase that
previously occupied the repository root.

## Status

- Reference prototype only.
- Not the `apps/ai-gateway-service` runtime.
- Not used by package scripts, Docker, or GitHub Actions workflows.
- Preserved for design review and selective migration.

The prototype currently references three assets that are not present in the
repository: `components/nav.js`, `i18n.js`, and `provider-wizard.html`. Treat it
as historical design material until those dependencies are deliberately
restored or the relevant pages are migrated into an owned application.

## Main Runtime

Use the actual local Workbench instead:

```powershell
pnpm start:ai-gateway-service
```

Then open `http://127.0.0.1:3100/ui`.
