# Will an MCP server agree to a protocol version that does not exist?

**Run:** 2026-09-27 15:29 UTC · **Sample:** 40 servers · **Answered the handshake:** 19 · **Agreed to the impossible revision:** **2**

The Model Context Protocol says a server must answer `initialize` with a revision it supports, and the revision is not decoration: it decides whether `MCP-Session-Id` is part of the contract, how server-initiated traffic works, and — in `2026-07-28` — whether the conversation is stateful at all. A server that echoes whatever the client asked for makes the handshake information-free, and a client cannot tell the difference from the inside.

So this is measured rather than assumed. It is also the field evidence behind [#178](https://github.com/happy520ai/unified-ai-system/issues/178): our own governed upstream client used to send a revision and never read the reply, so whatever a server decided here was invisible to us. That was the state of the code when this was measured. As of 2026-09-27 `master` records what each upstream answered and reports it per server on `GET /mcp/tools` — not yet in any published release, `v0.8.0` predates it — and what the gateway should *do* about a server that names a different revision is still open on the issue.

## Method

`tools/survey-mcp-revision-tolerance.mjs` reads the official MCP registry for `streamable-http` records — the same first 40 endpoints, in the same order, as the [pagination survey](mcp-tools-list-pagination-survey.md) — and sends each one `initialize` with:

```json
{ "protocolVersion": "9999-99-99" }
```

a revision that has never existed. One request per server, anonymous, no credentials, no writes.

## Result

| Verdict | Count | What it means |
| --- | --- | --- |
| Refused the anonymous handshake (`401`/`403`) | 21 | not measurable this way |
| Answered with a revision it supports | 14 | correct: 6 chose `2025-06-18`, 7 chose `2025-11-25`, 1 chose `2024-11-05` |
| Returned a JSON-RPC error (HTTP `400`) | 2 | correct: strict rejection, the behaviour `2026-07-28` spells out |
| **Echoed `9999-99-99` with HTTP 200** | **2** | **agreed to a protocol version that does not exist** |
| `502`, no version | 1 | upstream failure |

The two that agreed:

- `ag.hood/name-service` — `https://www.hood.ag/api/mcp`
- `ai.agent-bev/bev-door` — `https://mcp.bev-buyer.ai/mcp`

Of the 19 servers that answered at all, **17 behaved correctly and 2 did not check**. That is the honest ratio: 2/19, not 2/40 — 21 of the 40 would not talk to an anonymous client, so they are outside this measurement rather than passing it.

## The part that is more useful than the headline

Seven servers answered `2025-11-25` when asked for the impossible revision, yet all seven answered `2025-06-18` when the pagination survey asked them for `2025-06-18` an hour earlier. Those two readings together say something a single probe cannot: **the server supports both, honours a valid request, and falls back to its newest when the request is nonsense.** So the fallback value is the more informative one — it is the revision the server would have preferred, the one a client never learns by asking politely.

One server, `ai.adoraads/beauty`, answered `2024-11-05` in **both** probes. Same endpoint, two different requests, same answer: that looks like a server pinned to one revision rather than noise, which is the exact case a gateway that ignores the reply cannot see.

## What this does not show

- It is 19 observations, not a population. The sample is the registry's default order at one timestamp and over-represents server names beginning with `a`.
- It tests `initialize` only. A server that echoes the revision may still enforce the semantics of a real one on every subsequent method — that would take a second request per server, and this survey deliberately did not go poking further into services that are not ours.
- It says nothing about stdio servers, which are the majority of what people run and cannot be reached this way.
- Both runs were taken within an hour of each other on 2026-09-27. Servers deploy; re-running is a new measurement, not a regression test.

## Reproduce

```bash
node tools/survey-mcp-revision-tolerance.mjs 40      # this page: does it check the revision?
node tools/survey-mcp-tools-list-pagination.mjs 40   # the paired reading: does it paginate?
node tools/survey-mcp-session-enforcement.mjs 40     # the third: does it require its own session id?
```

Both scripts make outbound requests to third-party services that are not ours, and neither is wired into CI for that reason. Keep the timestamp with any number quoted from them.
