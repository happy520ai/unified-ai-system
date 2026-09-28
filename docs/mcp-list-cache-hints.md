# Do MCP servers say how long their tool list may be cached?

Sample taken 2026-09-27 by
`tools/survey-mcp-list-cache-hints.mjs 40`.

A gateway has to decide how long to keep a cached tool list. The spec gives servers a way to answer
that: `ttlMs` and `cacheScope` on a list result. So the question is not what our policy should be in
the abstract, it is how often an upstream actually tells us anything - because a policy built for a
signal nobody sends is just overhead.

The probe records **structure only**: field presence, type, numeric buckets, counts. No tool name,
description or any other server-authored text is copied out of the response.

## What the sample says

Of 40 endpoints in the registry's default order:

- `auth_required`: 22
- `no_cache_hint_declared`: 15
- `RESULT_LEVEL_HINT`: 1
- `init_failed_400`: 1
- `init_failed_502`: 1

**16 returned a tool list. 15 of them declared no cache hint at all, and 1 declared one.**

- `ad.getle/leads` answered at the result level with ttlMs=300000 and cacheScope=private.

## What we did with that, and what it does not justify

Our gateway used to cache every upstream's list for a hard-coded 60 seconds and shared it across
tenants, reading neither field. One declarant in sixteen is not a large enough signal to invent a
policy engine, so the change stayed small and boring:

- A declared `ttlMs` is honoured, clamped to 1,000..600,000 ms. The one server in this sample that
  declared anything said 300,000, which is inside that band and becomes 300000 ms.
- No declaration keeps the previous 60 seconds **exactly** - the 15-of-16 path is the unchanged path.
- `cacheScope: "private"` keys the cache per tenant instead of sharing one entry.

The floor and the ceiling are ours, not the server's, and they are written down because a declared
`0` would otherwise turn every `/mcp/tools` read into a fresh upstream handshake (we measure that
handshake at 6.4 s on a quiet machine) and a declared decade would let one response freeze a tool
list indefinitely. A number from the network is an input to a policy, not the policy.

## The part worth more than the timing

That declarant also said `cacheScope: private`, and we were putting the response in a process-global
map keyed by upstream id, served to every tenant allowed on that server. **Nothing was leaked**, and
saying otherwise would be marketing: `listTools()` receives no caller identity and the upstream
request is built from server config, so the content genuinely is the same for every tenant today.

What was wrong was the shape - a cache built as though sharing were always safe. The first person to
forward a per-caller token or a tenant-derived header into an upstream list call would have been
serving tenant A's list to tenant B out of a key neither of them owned, and no code would have
objected. Fixing the shape costs one key; auditing it after that change lands costs a disclosure.

## The same question at the revision that requires the answer

Everything counted above was counted on a connection the server agreed to run at `2025-06-18`, where
`ttlMs` and `cacheScope` are **not required**. So that sentence describes legacy-negotiated traffic and
cannot be read as conformance in either direction. The older artifact also predates the per-row
revision fields, so that run cannot re-derive what each server answered - which is why this section is
written against a second capture.

Re-asked 2026-09-28 with `tools/survey-mcp-list-cache-hints.mjs 40 --revision 2026-07-28`: of 40
endpoints, 13 returned a tool list and only 3 of those actually
negotiated `2026-07-28`; the rest answered an older revision, where sending neither field is correct
behaviour. **Of the modern-negotiated responders, 0 of 3 sent both
`ttlMs` and `cacheScope`.**

Paired control, same instrument and same day, asking for the older revision: both legs touched exactly
the same 40 endpoints. At the older revision 17 returned a tool list and
1 of those declared a hint; at the newer revision 13 returned a list and
0 of those declared one. Asking for the newer revision therefore costs
4 of those list answers, and the extra failures are HTTP 400 on
initialize (6 in the modern leg against 1 in the legacy
leg) rather than a negotiation down to an older revision. The registry's first rows also shift from day
to day, which is why this page pairs same-day legs instead of comparing across days.

Two readings are available here and only one is comfortable: most public endpoints in this sample
decline the revision that requires the fields, and inside the small part that accepts it, nearly all of
them still omit them. The second is exactly the population a strict validator bites - so a client that
rejects an absent hint is not enforcing a widely-implemented rule; on this sample it is enforcing one
that the few servers advertising support for it almost universally fail. Small n, one window, one
ordering, and 20 endpoints sat behind OAuth where behaviour is unknown rather than absent.

## Our own server, measured at both revisions

At the revision this repo's own probe negotiates, our result keys are `tools`,
per-tool fields `name, title, description, inputSchema, annotations`: `ttlMs` present: **false**,
`cacheScope` present: **false**. That is legitimate at `2025-06-18`, and an
earlier version of this page wrote it up as though it settled what we send under the new revision. It
did not - and the sentence was wrong in the direction of being *more* self-critical than the truth.

Under a real modern negotiation we do send both fields. Captured through a stdio tee that records whole
frames (no truncation; per-frame byte length asserted) while a pinned official client reached
`2026-07-28`: our server answered `server/discover` with `supportedVersions: ["2026-07-28"]`, and its
`tools/list` result carried keys `tools, resultType, ttlMs, cacheScope, _meta`. So the honest contrast
is not that we hide in the silent majority: most endpoints decline the revision, those that accept it
mostly omit what it then requires, and our server is in the minority that fills the fields in.

## Deliberately not claimed

- That the rate is stable. One window, one ordering, 22 of 40 endpoints behind OAuth where
  behaviour is unknown rather than absent.
- That 1-of-16 means the feature is unimportant. It means the *timing* half is; the sharing half is
  about a property of our own cache that no server had to declare for us to get wrong.
- That `resources/list` or `prompts/list` carry hints too. Only `tools/list` was examined.

## Reproduce

```bash
node tools/survey-mcp-list-cache-hints.mjs 40
node tools/probe-own-mcp-header-behavior.mjs
node tools/render-mcp-cache-hints-doc.mjs
```
