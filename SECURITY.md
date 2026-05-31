# Security Policy

## Scope

This repository is a local-first, dry-run-first AI Gateway Workbench. Default clone/read workflows must not require real Provider calls, deployed infrastructure access, or secret material.

## Reporting A Vulnerability

- For non-sensitive issues, open a GitHub issue: <https://github.com/happy520ai/unified-ai-system/issues>
- Do not paste API keys, tokens, `.env` contents, raw endpoint values, credential values, or private logs into public reports.
- Redact machine-specific paths, screenshots, and runtime captures before sharing.
- If an issue is sensitive, open a minimal public issue without exploit details and request a private follow-up path.

## Supported Contribution Boundary

- Do not modify `legacy/`.
- Do not change `/chat` or `/chat-gateway/execute` as part of public-readiness work.
- Do not run OpenAI, Claude, OpenRouter, MiMo, NVIDIA, or any other real Provider by default.
- Do not treat this repository as a deployed production service.

## Response Posture

This repository does not currently promise a production incident-response SLA. Reports are reviewed on a best-effort basis within the project's existing maintenance capacity.
