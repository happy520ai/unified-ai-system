# Phase610R-Fix Codex Exec Result Classification

## Classification Rules

- `pass`: exit code is `0` and sanitized stdout contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`.
- `failed_tty`: sanitized stderr contains `stdin is not a terminal`.
- `timeout`: the one-shot runner times out.
- `failed_provider_route`: exit code is non-zero and the failure is not the known TTY condition.
- `invalid_response`: exit code is `0`, but the required acknowledgement is absent.

## Safety Rules

- Do not read `~/.codex/auth.json`.
- Do not write `~/.codex/config.toml`.
- Do not write project `.codex/config.toml`.
- Do not expose raw base_url, secret, webhook, or token values.
- Do not modify `/chat` or `/chat-gateway/execute`.
- Do not deploy, release, tag, push, commit, or upload artifacts.
