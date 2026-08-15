# External Client Catalogs

Put JSON catalog files in this directory to extend the client registry without
changing gateway code. Every `*.json` file is loaded recursively and merged by
`id`; keep IDs unique.

Current groups:

- `global-ecosystem-bridges.json`: provider bridges and routing variants;
- `global-openai-bridges.json`: OpenAI-compatible host bridges;
- `global-agentic-clients.json`: MCP and A2A hosts;
- `global-openai-ecosystem.json`: applications and orchestration frameworks;
- `global-mcp-sdks.json`: MCP SDK families;
- `global-public-http.json`: HTTP and CLI profiles;
- `global-openai-frameworks-plus.json`: additional OpenAI-compatible frameworks.

## Run With A Catalog

```bash
pnpm exec node tools/verify-client-runtimes.mjs \
  --client-catalog-dir docs/client-runtime-catalog.d \
  --client global --runbook

pnpm exec node tools/verify-client-runtimes.mjs \
  --client-catalog docs/client-runtime-catalog.example.json \
  --client-catalog-url https://example.com/clients.json \
  --client global --runbook
```

PowerShell environment form:

```powershell
$env:CLIENT_RUNTIME_CATALOG_DIR = "docs/client-runtime-catalog.d"
pnpm exec node tools/verify-client-runtimes.mjs --client global --runbook
```

An entry can be keyed by ID or placed in a `clients` array:

```json
{
  "clients": [
    {
      "id": "openai-bedrock-openai-compatible",
      "name": "AWS Bedrock proxy in OpenAI-compatible mode",
      "protocol": "OpenAI-compatible",
      "transport": "HTTP /v1",
      "mode": "manual",
      "tags": ["openai-compatible", "language:python"],
      "command": "bedrock wrapper against local /v1",
      "evidenceNotes": "Attach model listing and chat output."
    }
  ]
}
```

Use `--client-catalog` for one file, `--client-catalog-dir` for a directory,
and `--client-catalog-url` for a remote JSON catalog. The equivalent
environment variables are `CLIENT_RUNTIME_CATALOG_PATH`,
`CLIENT_RUNTIME_CATALOG_DIR`, `CLIENT_RUNTIME_CATALOG_URL`, and
`CLIENT_RUNTIME_CATALOG_URLS`.

## Federated Sources

Source manifests describe catalog inputs for the global discovery tool. The
world profile is `docs/client-runtime-catalog-sources-worldwide.json`; extra
manifests belong in `docs/source-manifests.d/`.

```bash
pnpm exec node tools/run-global-client-discovery.mjs \
  --source-manifest docs/client-runtime-catalog-sources-worldwide.json \
  --source-manifest-dir docs/source-manifests.d \
  --execute --serial --max 10000
```

Supported source types are `catalog`, `catalog-dir`, `catalog-url`, and
`mcp-registry`. To refresh the official MCP Registry catalog:

```bash
pnpm exec node tools/sync-mcp-registry-client-catalog.mjs \
  --output .tmp/client-runtime-catalog.mcp-registry.json --max 0
```

Then generate a runbook or execute the serial verifier with the resulting
catalog. Registry entries are discovery records until a real client command
and evidence report are attached.
