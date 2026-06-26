# Repository Guidance

## Boundaries

- Do not modify or develop directly in `legacy/`.
- Use `legacy/claudcodesrc-ponponon-master` and `legacy/ai-gateway-workspace`
  only as read-only references.
- Put application entrypoints under `apps/`.
- Put reusable contracts, SDK code, config, and utilities under `packages/`.
- Keep changes small, verifiable, and reversible.

## Ownership

- `apps/agent-console` owns upper-level interaction.
- `apps/ai-gateway-service` owns AI Gateway service behavior.
- `packages/shared-contracts` owns public protocol types.
- `packages/shared-sdk` owns shared client and adapter surfaces.
- `packages/shared-config` owns shared configuration contracts/defaults.
- `packages/shared-utils` owns implementation-neutral helpers.

## Migration Rule

Do not bulk-copy old repositories into the new system. Migrate only focused,
high-confidence files after an explicit mapping step.

## Secrets and Evidence

- Do not print or commit provider API keys.
- Provider smoke evidence may record key presence, selected provider, status,
  and success fields, but not secret values.
- Only refresh provider smoke evidence after the matching real smoke succeeds.

## Local Agent Operation Rules

- permissionMode is required.
- `approvalRecord` is required before apply.
- `allowedFiles` is required before apply.
- `forbiddenPaths` must block `legacy/`, `PROJECT_CONTEXT.md`, `.env`, `.git`, and `node_modules`.
- `dryRun` defaults on.
- `autoCommit=false`.
- `autoPush=false`.
- release and deploy are blocked.

## UI Rules

- User-facing Local Agent panels must be first-screen visible or clearly reachable.
- Chat output area must remain large enough for long responses.
- Compact controls are preferred.

## Verification Rules

- `node --check` modified JS files.
- `pnpm -r --if-present check`
- `pnpm --filter @unified-ai-system/ai-gateway-service test`
- `pnpm --filter @unified-ai-system/forge-core test`

## Anti-Entropy Meta-Law (逆熵元法则)

The system's first principle is building local, temporary, self-sustaining **low-entropy order**. Every decision must be tested against: "Is this injecting negative entropy or accelerating entropy increase?"

**Seven Iron Laws:**

1. **Origin Law (原点律):** Purpose is the gravity source. The minimum purpose is "AI Gateway Workbench — local actions executable, model calls controlled." Any feature that cannot answer which part of this purpose it serves must not be created.

2. **Boundary Law (边界律):** Interfaces are entropy barriers. HTTP error responses must use `{ status, error: { code, message }, meta }` format. No deep imports into packages/ internals. WebSocket and SSE errors must reuse the same envelope structure.

3. **Layering Law (分层律):** Decoupling is encapsulation. Five-layer architecture: UI → HTTP Server → Business Logic → Adapters → Infrastructure. Single file must not exceed 500 lines. No god modules (single file with 3+ responsibilities). No circular dependencies.

4. **Feedback Law (闭环律):** Feedback is repair. Every error output must have corresponding monitoring. No empty `catch {}` blocks. Three feedback rings established: Health Check / Chat Error / Model Config Detection / Audit Log.

5. **Razor Law (剃刀律):** Minimalism is purification. Same function must not be defined in 2+ files. Extract to shared module. Dead code must be cleaned immediately. `entrypoints/` scripts must import from `entrypointUtils.js` — never redefine `sleep`, `fetchJson`, `readJson`, `writeEvidence`.

6. **Emergence Law (涌现律):** Self-organization is evolution. Provider adapters follow standard interfaces. Knowledge storage is pluggable via config. No hardcoded role lists or central over-scheduling.

7. **Dissipation Law (耗散律):** Openness is immortality. System must continuously intake negative entropy and expel high-entropy waste. `legacy/` is read-only reference only. Temp files, old evidence, and stale cache entries must have cleanup policies.

**Execution constraints (self-check before every change):**
- Purpose check: Is this injecting negative entropy?
- Layer check: Which of the five layers does this belong to?
- Boundary check: Does this route implement standard error format?
- Size check: Is the new file under 500 lines?
- Duplication check: Am I reusing a shared function or copying again?
- Feedback check: Does every catch block log or report errors?
- Metabolism check: Is there old code that needs cleaning?

Run `node tools/anti-entropy-audit.js` periodically to scan for violations.

## Evidence Rules

- Do not claim pass if the verifier chain is blocked.
- Do not claim clean workspace.
- If a verifier refreshes unrelated evidence, report it as a verifier side effect.

## Production Rules

- Auth must be enabled in production (`PME_ENTERPRISE_AUTH_ENABLED=true`).
- CORS must not use wildcard `*` in production.
- Redis must require password authentication.
- All error responses must use `createErrorEnvelope` from `@unified-ai-system/shared-utils`.
- All logging must use pino structured logger (not console.log).
- All user input must be escaped with `escapeHtml()` before innerHTML insertion.

## Architecture

```
UI Layer          → HTML/CSS/JS (static files, no build system)
HTTP Server       → httpServer.js, route modules
Business Logic    → gatewayService, workforceService, forgeGatewayService
Adapters          → Provider adapters (OpenAI, NVIDIA, MiMo, Gemini, Groq)
Infrastructure    → SQLite, Redis, pino logger, Prometheus
```

## Packages (Active)

| Package | Purpose |
|---------|---------|
| `forge-core` | Goal-driven autonomous coding engine |
| `shared-utils` | Error envelopes, timeouts, helpers |
| `shared-contracts` | Public protocol types |
| `shared-config` | Shared configuration |
| `shared-sdk` | Shared client and adapter surfaces |
| `codex-context-gateway` | Codex context sub-gateway |
| `context-codec-core` | Context codec adapter |
| `taiji-beidou-engine` | Capability neuron engine |
| `im-connector-feishu` | Feishu IM connector |
| `im-connector-wecom` | WeCom IM connector |
| `workforce-scheduler` | Workforce task scheduling |
| `workforce-contracts` | Workforce protocol types |
| `employee-brain-adapter` | Employee brain adapter |
| `web-agent` | Browser automation (used by forge-core) |
