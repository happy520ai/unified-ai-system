# Protocol And Client Compatibility

The project scales client coverage through open protocols. A protocol test
proves the wire contract; a named product is certified only after a real run
records the product version, operating system, configuration, and result.

## Verified Source Protocols

| Surface | Verified implementation | Covered behavior | Boundary |
| --- | --- | --- | --- |
| MCP stdio | Official `@modelcontextprotocol/client` `2.0.0` | Handshake, nine tools, prompt enhancement, fake chat, cleanup | Protocol verified; named host UI behavior needs a report. |
| MCP Streamable HTTP | Official `@modelcontextprotocol/client` `2.0.0` | HTTP handshake, nine tools, Bearer rejection, Origin rejection, cleanup | Source build only; published `v0.4.9` image is stdio-only. |
| OpenAI Chat Completions | Official `openai` JS SDK `7.4.0` | Models, text completion, streaming, structured errors, enhancement | Text profile; no tool calls or multimodal input. |
| OpenAI Responses | Official `openai` JS SDK `7.4.0` | Text response, `output_text`, streaming events, fake execution evidence | No stored responses, background tasks, tools, or multimodal input. |
| A2A v1.0 JSON-RPC | Official `@a2a-js/sdk` `1.0.1` | Agent Card, `SendMessage`, `GetTask`, `ListTasks`, task artifacts | Source build, fake-provider-only, in-memory tasks, no streaming. |
| Native HTTP and shared SDK | Node `fetch`, curl examples, repository SDK tests | Health, chat, streaming, prompt enhancement, operational reads | Unified AI System contract, not a third-party protocol. |

## Client Eligibility

- An MCP host is eligible when it supports stdio or Streamable HTTP and accepts
  the server command or endpoint required by that transport.
- An OpenAI-compatible client is eligible when it supports a custom `baseURL`
  and stays within the documented text Chat Completions or Responses profile.
- An A2A client is eligible when it supports A2A v1.0 Agent Card discovery and
  JSON-RPC.
- A generic HTTP client is eligible when it can send JSON, consume SSE where
  needed, and provide the gateway's scoped Bearer token when authentication is
  enabled.

Eligibility is not certification. Use the
[protocol client report](https://github.com/happy520ai/unified-ai-system/issues/new?template=protocol-client-report.yml)
to turn a candidate client into a reproducible matrix entry. Never include
tokens, provider keys, private prompts, or private endpoint names.

The repository does not claim every global client, full OpenAI API parity,
production readiness, L5 autonomy, or AGI.
