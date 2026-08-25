# Critical gateway attack-chain hardening

## Executive summary

This change closes a chained exposure where an unauthenticated non-loopback
gateway could configure a provider and then reach private or metadata networks.
It also activates the existing input content guardrail and replaces ambiguous
provider route permissions with an explicit least-privilege matrix.

The controls are intentionally fail-closed. They do not claim that application
controls replace network egress policy, workload identity, a WAF, or independent
penetration testing.

## SEC-001: unauthenticated external admin

- Severity: High.
- Location: `enterprise/enterpriseGovernanceService.js`,
  `security/networkBindingPolicy.ts`, and the gateway container defaults.
- Impact: a non-loopback listener without enterprise authentication could grant
  the local compatibility administrator to remote callers.
- Remediation: construction fails when authentication is disabled on a
  non-loopback bind. A second request-time check rejects non-loopback anonymous
  peers. Container images enable authentication by default and examples generate
  an ephemeral gateway token at runtime.
- Compatibility boundary: credential-free administrator behavior remains only
  for direct loopback development.

## SEC-002: DNS and redirect SSRF

- Severity: High.
- Location: `security/outboundUrlPolicy.ts`, `http/connectionPool.js`, provider
  adapters, model discovery, and provider onboarding health checks.
- Impact: attacker-selected provider URLs could otherwise resolve or rebind to
  localhost, private networks, IPv4-mapped IPv6, or cloud metadata services.
- Remediation: only HTTP(S) URLs without embedded credentials are accepted. All
  A/AAAA results must be public unicast addresses. The validated addresses are
  pinned into the actual Node HTTP(S) connection through a custom `lookup`, so
  connection-time DNS cannot select a different address. The low-level client
  returns 3xx responses without following redirects.
- Infrastructure boundary: production deployments should still deny metadata
  and private network egress at the network layer.

## SEC-003: disconnected prompt-injection guardrail

- Severity: Medium.
- Location: `guardrails/contentGuardrails.js`, `core/gatewayService.js`, and
  `application/createGatewayApplication.js`.
- Impact: user and tool content previously reached every central provider path
  without invoking the repository's input guardrail.
- Remediation: normal, streaming, A2A, RAG, WebSocket, and prompt-enhancement LLM
  calls now share one central scan before provider selection. Unicode NFKC,
  invisible controls, percent encoding, and bounded printable Base64 variants are
  canonicalized before high-confidence instruction-override rules run. Errors
  expose only rule categories, never input content.
- Honest boundary: pattern controls are defense in depth, not a complete semantic
  prompt-injection solution. Tool authorization and data isolation remain the
  primary controls against model manipulation.

## SEC-004: provider permission ambiguity

- Severity: Medium.
- Location: `http/utils/enterpriseUtils.js`.
- Impact: credential detection and cache mutation were mapped to read access;
  several provider mutation routes relied on an indirect unknown-route fallback.
- Remediation: credential handling, provider tests, model import, model-library
  mutation, and cache mutation now require `provider:write`. Inventory and status
  routes remain `provider:read`. The default operator role still lacks
  `provider:write`.

## Acceptance gates

- Non-loopback unauthenticated startup and remote-peer tests.
- Alternate IP notation, IPv4-mapped IPv6, mixed DNS answer, DNS pinning, and
  no-redirect SSRF tests.
- Plain, zero-width, percent-encoded, Base64, and streaming input guardrail tests.
- Explicit provider read/write permission matrix tests.
- Full repository checks, tests, public-repository checks, public-clone checks,
  and the quality scorecard before publishing.

The implementation follows the OWASP SSRF guidance to validate all resolved
addresses and disable redirects, and the Node HTTP contract that permits a
custom connection-time `lookup` function.
