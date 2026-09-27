# If an MCP server hands you a session id, does it require it back?

**Run:** 2026-09-27 15:57 UTC · **Sample:** 40 servers · **Answered `initialize`:** 16 · **Issued a session id:** 2 · **Issued one and then ignored it:** **0**

The `2026-07-28` revision moves MCP from a stateful `initialize` handshake toward per-request state, and a lot of gateway work right now is deciding what to do about that. This is one input nobody had: how much of the *deployed* remote-server population is actually stateful, and whether the ones that look stateful are.

A server that issues `MCP-Session-Id` and then accepts requests without it has created a token that means nothing — and a gateway cannot tell "this upstream is stateless" from "this upstream forgot to check". Only the second one is a bug, and it is invisible from the happy path.

## Method

`tools/survey-mcp-session-enforcement.mjs` takes the same first 40 `streamable-http` endpoints from the official MCP registry as the [pagination](mcp-tools-list-pagination-survey.md) and [revision-tolerance](mcp-protocol-revision-tolerance.md) surveys, and per server:

1. `initialize` with a valid revision and records whether `MCP-Session-Id` came back,
2. sends `notifications/initialized` with that session,
3. calls `tools/list` **with** the header, then `tools/list` **without** it.

The last two requests differ in exactly one header, so a rejection cannot be blamed on some other field the client forgot to send. Anonymous, read-only, no credentials, nothing written.

## Result

| Outcome | Count |
| --- | --- |
| Refused an anonymous handshake (`401`/`403`) | 22 |
| `initialize` failed (`400`, `502`) | 2 |
| Answered, issued **no** session id, and served `tools/list` without one | 14 |
| Issued a session id and **required** it (`400` without) | 2 |
| Issued a session id and then ignored it | **0** |

The two that require a session:

- `ai.afg/afg` — `https://afg.ai/mcp` (18 tools, `400` without the id)
- `ai.agentberg/agentberg` — `https://agentberg.ai/mcp` (11 tools, `400` without the id)

## The part worth more than the headline

Both of those servers are also in the seven that answered `2025-11-25` when the revision-tolerance probe asked them for `9999-99-99`, and both replied over SSE rather than plain JSON. So in this sample the stateful servers are not a random tail — **they are the ones that negotiate up**, which is the opposite of what a "stateless is taking over" reading would predict.

For anyone writing a gateway that means something concrete: you cannot assume statelessness (2 of 16 responders need the session back), and you also cannot assume an issued id is decorative (0 of 2 were). The safe shape is to store whatever the upstream issued and replay it, and to treat "no session id" as a per-upstream property discovered at connect time rather than a global assumption about the protocol.

## What this does not show

- 22 of 40 would not talk to an anonymous client, so the denominator is 16 observations, not 40.
- n=2 for the stateful case. It establishes that stateful remote servers exist in the registry today and enforce it correctly; it does not estimate how many there are.
- Only `tools/list` was probed. A server could enforce a session on `tools/call` and not on reads, or vice versa; that would require actually invoking tools, which means doing things on services that are not ours.
- Same alphabetical slice of the registry, same single timestamp, no stdio coverage.

## Reproduce

```bash
node tools/survey-mcp-session-enforcement.mjs 40
```

All three surveys run against the same sample, take about two minutes each, and are deliberately outside CI because they measure other people's servers. Keep the timestamp with any number quoted from them.
