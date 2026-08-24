# A2A v1.0 Gateway

Unified AI System v0.5.0 and the current source expose an Agent2Agent (A2A)
v1.0 JSON-RPC interface backed by the official `@a2a-js/sdk` `1.0.1` package.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/agent-card.json` | Public Agent Card discovery. |
| `GET /.well-known/a2a-jwks.json` | Public verification keys when signing is configured. |
| `POST /a2a/jsonrpc` | A2A v1.0 JSON-RPC operations. |

The Agent Card advertises `JSONRPC` protocol version `1.0`, `text/plain` input
and output, no streaming, no push notifications, and no extended card. Set
`A2A_PUBLIC_BASE_URL` when the externally reachable URL differs from the
gateway listener URL.

## Verifiable Agent Card Identity

Local fake-provider preview remains credential-free and may serve an unsigned
Agent Card. A deployment can instead mount a stable Ed25519 PKCS#8 private key
and require every discovery response to carry a canonical JWS:

```bash
openssl genpkey -algorithm ED25519 \
  -out /run/secrets/a2a-agent-card-ed25519.pem
chmod 600 /run/secrets/a2a-agent-card-ed25519.pem

export A2A_PUBLIC_BASE_URL=https://gateway.example.com
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE=/run/secrets/a2a-agent-card-ed25519.pem
export AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED=true
```

The key path must be absolute. POSIX key files must not be accessible by group
or other users. Non-loopback JWKS URLs must use HTTPS. By default the protected
JWS header points to
`<A2A_PUBLIC_BASE_URL>/.well-known/a2a-jwks.json`; set
`AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL` only when a separately operated HTTPS JWKS
publishes the same public key.

The protected header uses `alg=EdDSA`, `typ=JOSE`, a SHA-256-derived `kid`, and
`jku`. The published JWKS contains only the Ed25519 public key. Signing uses the
official SDK canonicalizer and signature generator; the focused tests verify
the result with `verifyAgentCardSignature`. A missing, malformed, broadly
readable, non-Ed25519, or insecurely published required key fails closed without
printing key material.

Rotate the mounted key through the secret manager and restart the gateway after
the new public key is reachable. Discovery and JWKS responses use a five-minute
cache lifetime; overlapping multi-signature rotation is not yet implemented.

## Official SDK Example

Start the gateway, then run the checked client:

```bash
pnpm gateway serve
node docs/examples/a2a-sdk-client.mjs
```

Use the consolidated mainstream-client certification pass:

```bash
pnpm exec node tools/verify-client-runtimes.mjs --client a2a-official
```

The example uses the official A2A JavaScript SDK to discover the Agent Card,
call `SendMessage`, retrieve the result with `GetTask`, and find it with
`ListTasks`.

## Natural-Language Enhancement

The A2A request metadata can explicitly opt into the same local deterministic
prompt enhancer used by the HTTP and MCP surfaces:

```json
{
  "unifiedAi": {
    "promptEnhancement": {
      "enabled": true,
      "profile": "coding",
      "language": "en"
    }
  }
}
```

This metadata belongs on `SendMessageRequest.metadata`. It is a Unified AI
System extension, not a standard A2A field.

## Safety And Limits

- A2A execution is pinned to `local-fake-provider` and fails unless the result
  proves fake execution.
- The Agent Card is public. `/a2a/jsonrpc` follows the gateway's existing
  enterprise authentication and `chat:use` permission policy.
- When enterprise authentication is enabled, the Agent Card advertises HTTP
  Bearer authentication. Provider keys remain server-side.
- Tasks use the official in-memory task store, are scoped by authenticated
  owner and enterprise tenant, and do not survive a process restart.
- The official request handler provides `SendMessage`, `GetTask`, `ListTasks`,
  and `CancelTask`. Cancellation is cooperative and cannot guarantee that an
  already-running provider operation was interrupted.
- Streaming, push notifications, gRPC, HTTP+JSON/REST, non-text parts, and
  durable task storage are not enabled in this profile. Agent Card signing is
  enabled only when a stable key file is configured.

Run `pnpm verify:public-clone` for the credential-free official-client proof.
The published `v0.5.0` gateway image and the current source include this A2A
profile; the current source carries additional post-release hardening tracked in
PR #115.
