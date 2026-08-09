# Troubleshooting

## Port 3100 Is Busy

Stop the existing process or set `AI_GATEWAY_SERVICE_PORT` to another local
port.

## Native Dependency Installation Fails

Use Node.js 22 first. The install hook tries `pnpm dlx node-gyp rebuild` and
then falls back to `npx`. To retry it explicitly from the repository root:

```bash
pnpm --filter @unified-ai-system/forge-core run rebuild:native
```

On Windows, install Python and Visual Studio Build Tools when
`better-sqlite3` must compile locally. Keep the package manager (`pnpm` or
`npm`) available on `PATH` so the fallback can be selected.

## The UI Opens But No Real Model Is Available

This is expected in the credential-free default mode. Configure and explicitly
enable a provider, then restart the service.

## A Provider Request Fails

Check:

- the selected provider and model;
- credential presence without printing the value;
- the provider base URL;
- account quota and provider status;
- gateway diagnostics and health output.

## Verify A Fresh Installation

```bash
pnpm verify:public-clone
```

The command exits non-zero and prints a bounded service-output tail when a
startup or endpoint check fails.

For a Windows Docker smoke test with cleanup, use the
[PowerShell quickstart](getting-started.md#windows-powershell).
