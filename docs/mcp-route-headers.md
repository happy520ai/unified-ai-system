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

## Read this with its limits

- **Same window as the protocol-version-header question.** The 22 auth-gated and 16 answering
  endpoints are the same servers, measured a second time the same day. This is a new question asked
  of one sample, not a second sample - so nothing here doubles the confidence of the other survey.
- **Only POST requests with a body were tested.** The case the headers actually exist for - a GET
  stream with no body to disagree with - was not exercised, so a server that routes on the header
  *only* when there is no body would read as `body_wins` here. That is a real blind spot, not a
  minor caveat: this measures whether headers can override a body, not whether headers are honoured.
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

## Reproduce

```bash
node tools/survey-mcp-route-headers.mjs 40
node tools/probe-own-mcp-header-behavior.mjs          # routing legs included
node tools/render-mcp-route-headers-doc.mjs          # this file, from those two artifacts
```
