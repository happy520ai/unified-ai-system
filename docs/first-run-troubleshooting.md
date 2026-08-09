# First-Run Troubleshooting

Use this page when the provider-free quickstart does not behave as expected.
The default path does not require an API key or a real provider.

| Symptom | Check | Next step |
| --- | --- | --- |
| `docker` is not recognized | Docker is not installed or is not on `PATH`. | Install Docker Desktop, restart the terminal, and rerun the [60-second demo](../README.md#try-it-in-60-seconds). |
| Docker cannot connect to the daemon | Docker Desktop is installed but not running. | Start Docker Desktop and wait for it to report that the engine is running. |
| Port `3100` is already in use | Another local service owns the host port. | Publish a different host port, for example `--publish 3210:3100`, then use `http://127.0.0.1:3210`. |
| `pnpm` or `corepack` is not recognized | Node.js is missing or the shell has not loaded Corepack. | Install Node.js 20 or newer, run `corepack enable`, then `corepack prepare pnpm@9.15.4 --activate`. |
| PowerShell breaks a multi-line command | Bash continuation syntax was pasted into PowerShell. | Use the [Windows PowerShell example](getting-started.md#windows-powershell), or run the one-line container demo. |
| A command appears to require a provider key | A real-provider setting may be enabled, or the wrong command was used. | Start with `pnpm gateway demo`; keep `AI_GATEWAY_PROVIDER_MODE=fake` and `AI_GATEWAY_REAL_PROVIDER_ENABLED=false`. Never paste a key into an issue. |
| MCP tools do not appear in Codex | The client has not reloaded its MCP configuration. | Restart Codex or open a new task, then run `/mcp verbose`. From a checkout, run `pnpm verify:mcp`. |
| GHCR or Docker is unavailable | The published container cannot be pulled from the current network. | Use the browser [Prompt Lab](https://happy520ai.github.io/unified-ai-system/#enhance), or install dependencies and run the source verification path locally. |

## Copy-Paste Transcripts

The following short transcripts are sanitized expected paths. They contain no
credentials; timings and model text can vary. Keep the shell label beside each
command when reporting a failure.

### Windows PowerShell

```powershell
# Windows PowerShell
PS> docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.5 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[ready] real calls    disabled
[done] ... | no API key | process cleaned up
```

If PowerShell reports `docker : The term 'docker' is not recognized`, install
Docker Desktop or use the [Codespaces fallback](#codespaces-without-docker).

For a port override, keep the PowerShell continuation mark at the end of the
first line:

```powershell
# Windows PowerShell
PS> docker run --rm --publish 3210:3100 `
>> ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.5 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

### macOS/Linux Bash or Zsh

```bash
# macOS/Linux Bash or Zsh
$ docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.5 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[ready] real calls    disabled
[done] ... | no API key | process cleaned up
```

If the shell reports `docker: command not found`, use the browser [Prompt
Lab](https://happy520ai.github.io/unified-ai-system/#enhance) or the source
checkout path below.

The equivalent Bash or Zsh continuation uses a backslash instead:

```bash
# macOS/Linux Bash or Zsh
$ docker run --rm --publish 3210:3100 \
> ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.4.5 pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

### Codespaces Without Docker

```bash
# GitHub Codespaces terminal (Bash)
$ pnpm install --frozen-lockfile
$ pnpm verify:public-clone
{ "ok": true, "realProviderCallsMade": false, "managedGatewayCleanedUp": true }
$ pnpm gateway demo
[ready] provider      local-fake-provider
[ready] execution     fake
[done] ... | no API key | process cleaned up
```

The repository's devcontainer keeps the default provider-free path. If the
workspace has not finished bootstrapping, wait for the terminal to become
ready, then rerun the command without adding a provider key.

If the first verification starts before dependencies finish installing, wait
for the install task to complete and rerun the same command. Do not switch on a
real provider to repair a local bootstrap problem.

## Report A Reproducible Problem

Open an issue with:

1. Operating system and shell.
2. The exact command, with secrets removed.
3. The complete error and the first relevant output line.
4. Whether Docker was running and whether a provider key was configured.
5. The smallest successful path you already tried, such as `pnpm gateway demo`.

Do not include `.env` files, provider keys, raw webhooks, or private
authorization records. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the
repository safety boundaries.
