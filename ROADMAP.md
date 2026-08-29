# Roadmap

Unified AI System is a **governed AI client & agent gateway**: one
self-hosted surface that issues virtual keys and budgets, governs local AI
clients (Claude Code, Cursor, Codex, Cline), aggregates MCP tool traffic,
and keeps provider calls explicit and audited.

This roadmap describes direction, not a promise of dates. Items move forward
when implementation, tests, documentation, and relevant independent evidence
support them.

## Now: v0.7.0 — Focus, Console, External Evidence

v0.7.0 is a deliberately narrow release. It accepts no new capability
surface; it closes what v0.6.0 already promises and removes friction for
evaluators:

1. **Read-only operator console** at `GET /console`, opt-in via
   `AI_GATEWAY_CONSOLE_ENABLED` (default off preserves the terminal-first
   public-clone invariant) — overview, virtual keys, local clients, and
   cache audit in one authenticated browser page with no client build step
   and no mutation surface.
2. **Close the v0.6.0 self-declared release gates** for the local client
   intelligence gateway: real-client atomic receipt certification and the
   PostgreSQL mode for route-plan/claim/feedback/outbox state.
3. **Honest naming**: the opt-in cache similarity layer and the embedding
   provider are described as lexical/approximate, not semantic, unless a
   real semantic model is attached via the HTTP embedding hook.
4. **Independent verification on-ramps**: an external audit kit, CI
   dependency vulnerability scanning, published SBOM artifacts, and private
   vulnerability reporting.

Anything not on this list waits. New top-level capability directories are
frozen until v0.7.0 ships.

## Repository Focus Boundaries

The public product is the gateway stack: `apps/ai-gateway-service`,
`apps/agent-console`, `packages/mcp-server`, `packages/mcp-service`, and the
`packages/shared-*` foundation.

The following packages are **labs**: `forge-core`, `taiji-beidou-engine`,
`workforce-scheduler`, `workforce-contracts`, `position-library`,
`employee-brain-adapter`, `web-agent`, `codex-context-gateway`,
`context-codec-core`, `im-connector-feishu`, and `im-connector-wecom`.
Labs packages are experimental owner-vision subsystems. They stay
compile-clean and tested, but they are not product claims, do not appear in
the public architecture narrative, and are excluded from release notes.
If a labs package still has no gateway-runtime import by v0.8.0, moving it
out of this repository is the default decision (owner call, separate PR,
per the subtraction ledger discipline).

Zero-reference dependencies were pruned from the gateway manifest
(`im-connector-*`); `shared-sdk` stays because test code imports it. Do not
reintroduce pruned packages without a source import.

## Not Doing

Explicit non-goals, recorded so they are re-decided deliberately instead of
drifting in:

- A browser chat UI. CLI, API, and MCP remain the interaction surfaces;
  the console is read-only operations, not chat.
- A token resale/billing platform (payment gateways, top-ups, resale
  pricing). Spend reporting stays an internal cost-evidence feature.
- Built-in high-availability orchestration (quorum election, external HA
  control). The repository ships drills and PostgreSQL state modes, and
  states their limits honestly.
- Real provider calls by default, or silent provider behavior of any kind.
- Production-readiness, L5-autonomy, or AGI claims without independent,
  reproducible evidence.

## Next: A Dependable Developer Platform

- Stabilize and document the public HTTP and SDK contracts
- Expand the MCP contract beyond the current safe inspection preview
- Expand CLI and TUI coverage for agents, knowledge, routing, and approvals
- Make provider adapters easier to add, test, and distribute
- Publish focused examples for routing, agents, RAG, approvals, and evaluation
- Add durable workflow state and clearer recovery semantics
- Expand deployment guidance, telemetry, and operational diagnostics
- Establish repeatable external evaluation packages and independent review

## Then: Governed Agent Collaboration

- Interoperable contracts for specialized agents and tools
- Policy-aware planning, delegation, and task handoff
- Durable memory with explicit ownership and retention controls
- Budget, permission, approval, evidence, and rollback across long-running work
- Sandboxed execution and stronger isolation boundaries
- Portable evaluation suites for safety, quality, cost, and reliability

## Long-Term Direction

The long-term ambition is an open foundation for increasingly general,
cooperative, and dependable machine intelligence while preserving human
authority.

That ambition is not a current capability claim. Production readiness, L5
autonomy, and AGI require independent, reproducible evidence that is broader
than local tests or repository checks.

## Help Shape It

- Discuss architecture and priorities in
  [GitHub Discussions](https://github.com/happy520ai/unified-ai-system/discussions).
- Pick a scoped contribution from
  [Issues](https://github.com/happy520ai/unified-ai-system/issues).
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
