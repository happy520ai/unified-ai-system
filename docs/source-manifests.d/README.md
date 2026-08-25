# Source Manifests

This directory contains source manifests for discovery pipelines, not client entries.

Each `.json` file follows the same shape as `docs/client-runtime-catalog-sources.json`,
including a `sources` array and optional `version`.

Supported source types:

- `catalog` - local client catalog JSON file
- `catalog-dir` - local directory that contains catalog JSON files
- `catalog-url` - remote catalog endpoint URL
- `mcp-registry` - MCP registry source

Common fields:

- `id`: source ID
- `type`: one of the types above
- `enabled`: false to skip this source
- `path`/`dir`/`url`/`registryUrl`: location target for this source type
- `output`: output file for MCP registry sync (optional)

Example file:

- `docs/source-manifests.d/official-mcp-registry.json`

Use:

- `pnpm exec node tools/run-global-client-discovery.mjs --source-manifest docs/client-runtime-catalog-sources-worldwide.json`
- `pnpm exec node tools/run-global-client-discovery.mjs --source-manifest-dir docs/source-manifests.d --execute --serial --max 10000`

Notes:

- Client definitions still belong to `docs/client-runtime-catalog.d`.
- `tools/run-global-client-discovery.mjs` auto-loads this directory when it exists;
  you can also add explicit extra manifest directories with `--source-manifest-dir`.

For the widest MCP sweep, use the dedicated global source manifest at
`docs/client-runtime-catalog-sources-worldwide.json`:

- `pnpm exec node tools/run-global-client-discovery.mjs --source-manifest docs/client-runtime-catalog-sources-worldwide.json --execute --serial --max 0`
- Add `--require-manual-evidence --manual-evidence docs/client-runtime-evidence.example.json` for strict mode.
