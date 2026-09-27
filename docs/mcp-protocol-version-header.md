# Does an MCP server check the protocol-version header?

Sample taken 2026-09-27, from the anonymous probe
`tools/survey-mcp-protocol-version-header.mjs 40`.

The 2025-06-18 revision of MCP says a client MUST put `MCP-Protocol-Version` on every HTTP request
after `initialize`, and that a server SHOULD reject a request whose header names a revision it did not
agree to. Two questions follow, and they have different answers:

1. Do public servers enforce it? In this sample: no, none of them.
2. Did our own gateway send it? No — and that second one was a defect regardless of the first.

## What the sample says

Of 40 `streamable-http` endpoints taken from the official MCP registry in its default order:

- `auth_required`: 22
- `accepts_anything_we_tried`: 16
- `init_failed_400`: 1
- `init_failed_502`: 1

**16 servers completed the handshake.** For each, the same `tools/list` request was sent
twice, differing by exactly one header — once naming the revision the server had answered with, once with the
header absent entirely:

- served with the header: **16/16**
- served without the header: **16/16**

So enforcement is not a thing that is happening today. The honest reading is narrower than that, though:
16 answering servers is a small slice of a registry whose majority (`22`)
sit behind OAuth, and the sample is one window of one ordering. It is evidence about September 2026, not a
statement about the protocol.

## The one disagreement that mattered

1 of the 16 servers that answered named a different revision than the one
requested. For that server, asking `tools/list` while the header claimed the *requested* revision still worked.
A permissive upstream, not a proof of safety: a conforming one is allowed to reject exactly that request.

## The rows

| server | answered revision | with header | without header | session id issued |
| --- | --- | --- | --- | --- |
| ac.tandem/docs-mcp | 2025-06-18 | served | served | no |
| ad.getle/leads | 2025-06-18 | served | served | no |
| ad.inside/inside-ads | 2025-06-18 | served | served | no |
| ag.hood/name-service | 2025-06-18 | served | served | no |
| agency.goji/goji | 2025-06-18 | served | served | no |
| agency.ottobot/business-contact-finder | 2025-06-18 | served | served | no |
| agency.ottobot/contractor-license-changes | 2025-06-18 | served | served | no |
| agency.ottobot/licensed-house-painters | 2025-06-18 | served | served | no |
| ai.adoraads/beauty | 2024-11-05 | served | served | no |
| ai.advisorsai/service-navigator | 2025-06-18 | served | served | no |
| ai.advisorsai/store-readiness | 2025-06-18 | served | served | no |
| ai.afg/afg | 2025-06-18 | served | served | yes |
| ai.afmr/discovery | 2025-06-18 | served | served | no |
| ai.afmr/discovery | 2025-06-18 | served | served | no |
| ai.agent-bev/bev-door | 2025-06-18 | served | served | no |
| ai.agentberg/agentberg | 2025-06-18 | served | served | yes |

## What we found in ourselves

The gateway's own upstream client (`apps/ai-gateway-service/src/mcpGateway/mcpUpstreamClient.ts`) stores the
session id the upstream issues and replays it on every later request. It did **not** do the same for the
negotiated revision: it captured that value, reported it through `GET /mcp/tools`, and then never put it back
on the wire. One server-issued value was treated as part of the contract and the other as decoration.

That asymmetry had a concrete failure shape, which the new tests pin. Before the fix, an operator-supplied
`mcp-protocol-version` header was forwarded verbatim — so against an upstream that answers `2024-11-05` to a
`2025-06-18` request, our client sent `2025-06-18` in the header: a revision the upstream had explicitly not
agreed to, which is the request a conforming server is allowed to reject.

Now the post-handshake requests carry the revision the upstream *named*, never the one we asked for, and the
`initialize` request itself carries none (the revision it proposes is in the body; a header asserting an
agreement that has not happened yet is the wrong shape). An operator pin cannot outvote the server's answer.

Three arms prove the change rather than describe it: removing the one-line fix turns them red, and the
operator-pin arm reports the exact wrong value (`2025-06-18`) on the wire. Two further arms — an upstream that
answers no revision, and one that answers an empty string — stay green in both states by design: they are
there to catch a future fallback, not to prove this one.

## Deliberately not claimed

- That this fixed an interoperability failure. Nothing in the sample rejects an headerless request today.
- That the header is unimportant. The sample says who enforces it *now*; the spec says what a client owes.
- That our HTTP server enforces inbound revisions. It advertises the header over CORS and does not read its
  value — measured behaviour, and a documented choice: the gateway negotiates and records revisions
  (`#178`) rather than dropping connections that name a different one.
- The `claude-code-patterns` demo client was left alone: it has no session handling either, and nothing in the
  product path imports it outside tests. Recorded, not silently doubled.

## Reproduce

```bash
node tools/survey-mcp-protocol-version-header.mjs 40   # anonymous, read-only, one window
npx vitest run apps/ai-gateway-service/src/mcpGateway/mcpGateway.test.ts
```
