# A2A v1.0 Gateway

Unified AI System exposes a source-build Agent2Agent (A2A) v1.0 JSON-RPC
interface backed by the official `@a2a-js/sdk` `1.0.1` package.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /.well-known/agent-card.json` | Public Agent Card discovery. |
| `POST /a2a/jsonrpc` | A2A v1.0 JSON-RPC operations. |

The Agent Card advertises `JSONRPC` protocol version `1.0`, `text/plain` input
and output, no streaming, no push notifications, and no extended card. Set
`A2A_PUBLIC_BASE_URL` when the externally reachable URL differs from the
gateway listener URL.

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
- Streaming, push notifications, gRPC, HTTP+JSON/REST, non-text parts, signed
  Agent Cards, and durable task storage are not enabled in this profile.

Run `pnpm verify:public-clone` for the credential-free official-client proof.
This source capability is not part of the already published `v0.4.9` images.
