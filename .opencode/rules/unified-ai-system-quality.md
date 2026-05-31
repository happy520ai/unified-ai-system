# Unified AI System / OpenCode Quality Rules

## Hard boundaries
- Local/internal testing only. Do not present anything as public production-ready unless the user explicitly scopes it.
- Do not read, print, copy, summarize, or infer secrets from `.env`, `.env.*`, secret/token/key files, auth files, or process output containing credentials.
- Do not modify `legacy/`, `PROJECT_CONTEXT.md`, `.git/`, `node_modules/`, `dist/`, `build/`, or evidence files unless explicitly instructed.
- Do not commit, push, deploy, release, publish, reset, clean, or run destructive deletion commands.
- Do not add real non-NVIDIA paid API calls. For this project, NVIDIA is the only real external provider path.
- Do not expose hidden/experimental Workbench modules by default.
- Do not modify `/chat-gateway/execute` unless the user explicitly asks for that specific chain.

## One-pass correctness workflow
1. Read only the files needed for the requested change.
2. Check LSP diagnostics before editing.
3. Make the smallest safe patch.
4. Re-run syntax checks on changed JS/TS files with `node --check` when applicable.
5. Run narrow tests first, then the required project gates.
6. Any failure must be fixed at root cause; do not hide failures or claim unrun checks passed.

## Default validation commands
- `pnpm -r --if-present check`
- `pnpm run health:phase12a`
- `pnpm run doctor:phase13a`
- `pnpm run verify:phase107a-secret-safety`
- If `consolePage.js`, `httpServer.js`, routes, provider config, file-context, diagnostics, or Chat Gateway production behavior changed, consider the relevant phase verify command.
- If `/chat-gateway/execute` or real chat UI behavior changed, run `pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia` when a runtime NVIDIA key is available.

## NVIDIA request budget
- Hard cap: no more than 40 NVIDIA upstream requests per rolling minute.
- Plan work as <=35 NVIDIA requests per phase to leave safety margin for retries/title/summary/tool overhead.
- If a task would need more than 35-40 requests, split it into explicit phases and complete only the current phase.
- Use `tools/nvidia-rate-limit-proxy.mjs` for hard enforcement; do not rely only on prompts.

## Speed rules
- Prefer LSP/grep/glob over broad file reading.
- Prefer direct inspection of touched files over full-repo scans.
- Avoid unnecessary subagents; use reviewer/security/ui subagents only when the touched scope justifies it.
- Keep patches small and verifiable.
