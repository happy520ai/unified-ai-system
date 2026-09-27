# Does anyone's `tools/list` actually paginate? A measurement.

**Run:** 2026-09-27 15:11 UTC · **Sample:** 40 servers · **Servers that answered:** 16 · **Servers that paginated:** 0

This exists because [issue #177](https://github.com/happy520ai/unified-ai-system/issues/177) was closed with an honest caveat: the fix walks a paginated `tools/list` to the end and refuses to present a truncated enumeration as complete, and that behaviour is executed by tests — but *no test had ever observed a real third-party server paginate*. The bounds in that fix (20 pages, 2,000 tools, dedupe by name, hard error on a repeated cursor) were therefore a stance about a protocol feature, not a survey of it. This page is the survey.

## Method

`tools/survey-mcp-tools-list-pagination.mjs` reads `https://registry.modelcontextprotocol.io/v0/servers` (the official MCP registry), takes records that advertise a `streamable-http` remote, and sends each one:

1. an anonymous `initialize` declaring protocol revision `2025-06-18`,
2. a `tools/list` using the returned session id when the server issued one,
3. a second `tools/list` with the returned cursor — **only** if the first response carried a `nextCursor`.

No credentials are used or requested, nothing is written, and no server is called more than three times. Requests are sequential with a short delay.

**The sample is not random.** It is the first 40 `streamable-http` endpoints in the registry's default order at that timestamp, which is alphabetical by server identifier — so it over-represents names starting with `a`/`ac`/`ad`/`ae`/`ag`. Treat it as a snapshot, not as a population estimate.

## Result

Of 40 attempted:

| Outcome | Count |
| --- | --- |
| Answered `initialize` and returned a tool list | 16 |
| Rejected anonymously (`401`) | 21 |
| Rejected anonymously (`403`) | 1 |
| `400` on `initialize` | 1 |
| `502`, no result | 1 |

The 16 that answered:

| Server | Endpoint | Tools on page 1 | Revision answered | Transport shape | `nextCursor`? |
| --- | --- | --- | --- | --- | --- |
| `ad.getle/leads` | `mcp.getle.ad/mcp` | 35 | 2025-06-18 | JSON | no |
| `ai.afg/afg` | `afg.ai/mcp` | 18 | 2025-06-18 | SSE | no |
| `ac.tandem/docs-mcp` | `tandem.ac/mcp` | 13 | 2025-06-18 | JSON | no |
| `ai.agentberg/agentberg` | `agentberg.ai/mcp` | 11 | 2025-06-18 | SSE | no |
| `agency.goji/goji` | `mcp.goji.agency/mcp` | 9 | 2025-06-18 | SSE | no |
| `ai.adoraads/beauty` | `mcp.adoraads.ai/beauty` | 6 | **2024-11-05** | JSON | no |
| `ai.agent-bev/bev-door` | `mcp.bev-buyer.ai/mcp` | 6 | 2025-06-18 | JSON | no |
| `ag.hood/name-service` | `www.hood.ag/api/mcp` | 5 | 2025-06-18 | JSON | no |
| `ai.advisorsai/service-navigator` | `advisorsai.ai/mcp` | 5 | 2025-06-18 | JSON | no |
| `ai.afmr/discovery` | `afmr.ai/api/rpc` | 4 | 2025-06-18 | JSON | no |
| `ai.afmr/discovery` | `afmr.ai/mcp` | 4 | 2025-06-18 | JSON | no |
| `ad.inside/inside-ads` | `app.inside.ad/api/mcp` | 3 | 2025-06-18 | JSON | no |
| `agency.ottobot/licensed-house-painters` | `house-painters-mcp.ottobot2025.workers.dev/mcp` | 3 | 2025-06-18 | JSON | no |
| `agency.ottobot/contractor-license-changes` | `license-changes-mcp.ottobot2025.workers.dev/mcp` | 2 | 2025-06-18 | JSON | no |
| `agency.ottobot/business-contact-finder` | `business-contact-finder-mcp.ottobot2025.workers.dev/mcp` | 1 | 2025-06-18 | JSON | no |
| `ai.advisorsai/store-readiness` | `advisorsai.ai/store-readiness-mcp` | 1 | 2025-06-18 | JSON | no |

Three things are worth more than the headline:

1. **0 of 16 emitted `nextCursor`.** The largest list seen was 35 tools, returned in one page. So today the pagination path in our gateway is insurance against a server that has not been met yet — which is the honest way to describe a fix for an unobserved failure, and the way #177 should be read.
2. **1 of 16 answered with `2024-11-05`** after being asked with `2025-06-18`. A server in the wild *does* pick an older revision than the client declared. That is the concrete case for [#178](https://github.com/happy520ai/unified-ai-system/issues/178): when this was measured, our governed upstream client sent a revision and never read the answer, so a negotiation like this one was invisible to us and to its callers. `master` now captures the answer and publishes it per upstream in the `servers` array of `GET /mcp/tools` - available from source and from the rolling `:latest` / `:master` image tags, which were built from `master` on 2026-09-27 - but not from the versioned `0.8.0` tag, which predates it - and whether a mismatching revision should be refused or merely reported is still being decided on the issue.
3. **22 of 40 advertised remote endpoints cannot be introspected anonymously** (401/403). Any claim of the form "N% of MCP servers do X" that was measured this way is really a claim about the fraction that lets you look.

## What this does not show

- It does not show that no MCP server paginates. 22 of the 40 refused the anonymous handshake (21x `401`, 1x `403`) and 2 more failed before `tools/list` was reached, so 24 were never asked - and the sample is alphabetical, not random.
- It does not show a size threshold. The spec gives no "paginate after N tools" rule, and the largest list observed here (35) is well under our 2,000-tool bound, so the bound is a guard against pathological answers, not a fitted parameter.
- It says nothing about stdio servers. This method can only reach advertised HTTP remotes; the stdio population is larger and is not addressed here.
- It is one timestamp. Servers change; a re-run is a new measurement, not a regression test.

## Reproduce

```bash
node tools/survey-mcp-tools-list-pagination.mjs 40
```

The script prints a JSON tally plus one row per server. It makes outbound requests to third-party services that are not ours; run it knowingly, and keep the timestamp with any number you quote from it.

## Related measurement

The same 40 endpoints were asked a second question an hour later: **will they agree to a protocol revision that does not exist?** Two of the eighteen that produced a JSON-RPC answer echoed `9999-99-99` with HTTP 200, and one server answered `2024-11-05` to both probes. See [mcp-protocol-revision-tolerance.md](mcp-protocol-revision-tolerance.md).
