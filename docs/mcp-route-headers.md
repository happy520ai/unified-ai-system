# Does an MCP server route by the `Mcp-Method` header?

Measured 2026-09-27 by
`tools/survey-mcp-route-headers.mjs 40`.

The spec puts `Mcp-Method` and `Mcp-Name` on requests so a server can route a **body-less**
GET stream. A POST that already carries a JSON-RPC body does not need them - which is why the
question is worth measuring rather than assuming: if a server reads the header even when the body
disagrees with it, then a caller can point it at a method it never wrote down.

## The two legs

Byte-identical JSON-RPC bodies (`tools/list`), differing by exactly one header pair:

- baseline: no `Mcp-Method` at all - the positive control, it must return `result.tools`
- spoof:  - if this comes back with , or an error
  naming `prompts/list`, the server looked at the header

Read-only throughout: `tools/list` and `prompts/list` are discovery. There is no `tools/call` leg,
because invoking a stranger's tool is not something an anonymous survey gets to do.

## What the sample says

Of 40 endpoints in the registry's default order:

- `auth_required`: 22
- `body_wins`: 16
- `init_failed_400`: 1
- `init_failed_502`: 1

**All 16 servers that gave a comparable pair served the method written in the body. None could be routed by a header.**

Not one endpoint in this window could be pointed at a method its caller never wrote down - which
is the useful negative, because it is the failure mode the upstream header-vs-body issues are
worried about, and it did not appear.

## The no-body case, measured as well

`tools/survey-mcp-get-stream-headers.mjs 40` asks the question the POST legs could not: after a real
handshake, send **GET** with `accept: text/event-stream`, once with no routing hint and once adding
`Mcp-Method: prompts/list`, and compare the shapes. Because a held-open stream can hang and a hang
looks like a status difference, each server also gets a **third leg - the plain GET again**, so an
ordering effect cannot be mistaken for a header effect.

Of 40 endpoints: 22 behind OAuth, 3 where at least one leg never answered (counted separately, never as a negative), and **13 with a readable GET leg on both sides**.
- `auth_required`: 22
- `get_rejected_alike`: 10
- `get_answered_json_not_stream`: 3
- `GET_LEG_UNREADABLE`: 3
- `init_failed_400`: 1
- `init_failed_502`: 1

**0 servers routed by the header with no body present.**
Ten rejected the GET identically with and without it; three answered GET with
`application/json` rather than a stream at all, again identically.

### The control caught a false positive before it became a sentence

2 servers did look header-sensitive at first - each answered `409` on the routed leg while its first plain leg had been aborted at the timeout. Repeating the plain leg settles it:

- `ai.afg/afg`: plain 0 -> routed 409 -> plain again 409 (the 409 is the server's steady GET answer, not a header effect)
- `ai.agentberg/agentberg`: plain 0 -> routed 409 -> plain again 409 (the 409 is the server's steady GET answer, not a header effect)

The first version of this instrument had no repeat leg and classified both rows as
`get_rejected_routed_409` - a difference attributed to the header. That reading was withdrawn before
publication, not corrected in place, and the earlier artifact is kept out of this page deliberately.

## Read this with its limits

- **Same window as the protocol-version-header question.** The 22 auth-gated and 16 answering
  endpoints are the same servers, measured a second time the same day. This is a new question asked
  of one sample, not a second sample - so nothing here doubles the confidence of the other survey.
- **Both shapes were tested, but only along one path.** POST with a body, and GET with no body after a
  successful handshake. A server that refuses the GET outright cannot reveal header routing on that
  leg - ten did exactly that here, identically with and without the header, so they count as
  "no observable routing", not as "routing proven absent".
- **One alternate method was tried** (`prompts/list`). A server that honours `Mcp-Method` for some
  methods and not others would show up here only if it happened to treat that one differently.
- One window, one ordering, anonymous only, and 22 of 40 endpoints sit behind OAuth where routing
  behaviour is unknown rather than absent.

## Our own server, measured rather than grepped

`packages/mcp-server/src/http.js:25-26` lists `Mcp-Method` and `Mcp-Name` in its CORS allow-list and
nothing in this repository reads their values - which is a static reading, and static readings get
wrong. `tools/probe-own-mcp-header-behavior.mjs` asks the running server instead:

- baseline body `tools/list`: result keys `tools`
- with `Mcp-Method: prompts/list`: result keys `tools` (http 200)
- with `Mcp-Method: totally-not-a-method`: result keys `tools` (http 200)

Verdict: **body_is_authoritative_header_inert**. A spoofed method and a nonsense method both still received the tool
list, so on our server the header is inert and the body is authoritative. Advertising a header that
nothing reads is not a vulnerability; it is only misleading if nobody checks - which is why this is
a run and not a paragraph. If anyone later implements header routing here, this probe is the check
that has to change its answer.

The same probe asks us the no-body question directly. Our server's GET leg:

- GET with no routing hint: http 405, content-type `application/json`, 83 bytes
- GET with `Mcp-Method: prompts/list`: http 405, 83 bytes

Verdict: **get_shape_identical_with_and_without_header**. We do not serve a GET stream at all, so there is no surface on which a
routing header could choose behaviour for us - stated as an observation, because the CORS list
alone would have let a reader assume we do.

## Reproduce

```bash
node tools/survey-mcp-route-headers.mjs 40
node tools/survey-mcp-get-stream-headers.mjs 40     # no-body GET, with a repeated plain leg
node tools/probe-own-mcp-header-behavior.mjs          # routing legs included
node tools/render-mcp-route-headers-doc.mjs          # this file, from those two artifacts
```
