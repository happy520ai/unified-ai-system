# How many MCP servers are there? 37,013, and what can a client do with them

Measured 2026-09-28 (17:17-17:53 UTC) by
`tools/survey-mcp-registry-census.mjs` against `https://registry.modelcontextprotocol.io/v0/servers`. This is the whole default list, not a
slice of it: the walk followed the cursor to its end and the instrument refuses to report otherwise. The
scope that phrasing buys is stated under "What this does not support", because it is not every record the
registry has ever held.
Structure only - counts, booleans, registry and transport type strings. No server-authored text is
captured, and no server was sent an MCP request.

**Short answer: there are 37,013 servers in the official MCP registry's default view as of 2026-09-28,
and 439 of them (1.20%) declare nothing a client can act on.** The rest of this page is
what the other records do declare, how those two kinds of artifact are distributed, and which readings
a sample of the same API gets wrong.

## The walk, and what it cost

| | value |
| --- | --- |
| list pages read | 1,238 |
| rows counted | 123,831 |
| distinct servers | 37,013 |
| versions per server | 3.35 |
| pages needing a retry | 7 (worst single page: 2 attempts) |
| cursor reached the end | yes |

Rows are not servers: one row is one published version, and a server's current record is the row whose
`_meta["io.modelcontextprotocol.registry/official"].isLatest` is true. Every number below is computed on
that row. 37,013 servers yielded 37,013 latest records, with 0 servers left without one - a non-zero value there would mean the bucketing lost a server, so the renderer
refuses rather than dividing by a denominator it cannot name.

The walk was run twice on the same day, half an hour apart, because a census that cannot be repeated is
an anecdote with a bigger table. The first pass read 37,007 servers and found 439 declaring nothing; the second, reported here, reads 37,013 and finds 439. The gap is servers published in those thirty minutes, and the unreachable count did not move.
That first pass is also the one that caught this instrument's own bug - it read a package's `transport` as
a string when the API returns an object, and tallied 16,597 records under a key spelled
`[object Object]`.
Its artifact is published next to this one, marked superseded, and the renderer now refuses any tally whose
key contains that string.

## What the population's records declare

Of **36,612 active servers**, read one row each:

| the record declares | servers | share |
| --- | --- | --- |
| a hosted endpoint (`remotes`), no package | 20,852 | 56.95% |
| a package, no hosted endpoint | 13,510 | 36.90% |
| both | 1,811 | 4.95% |
| **neither - nothing a client can act on** | **439** | 1.20% |

So 36,173 of 36,612 (98.80%) tell a client where or how to go, and 439 (1.20%) do not. Of the active records, 15,321 carry a package somewhere and 22,663 carry a remote; those two sets overlap by 1,811, which is why the four rows above partition the population while those two counts do not.

A separate status: 36,612 servers are `active` and 401 are `deprecated`. Counting every latest record instead of only
active ones gives: remote only 20,963, package only 13,773, both 1,826, neither 451 - reported so the choice of denominator
is visible rather than baked in.

## Every record, including the ones the default view hides

The same instrument walked the list again with the documented `include_deleted=true` switch, so the two
reads differ by what the view shows and by nothing else. That view resolves to **37,854 servers** in 125,783 rows, against 37,013 on the default view - 841 more names, of which 830 carry a latest record whose status is `deleted`.

Where the extra 841 land, class by class, relative to the same read of the default view:

| | default view | with deleted records | difference |
| --- | --- | --- | --- |
| remote only | 20,963 | 21,595 | +632 |
| package only | 13,773 | 13,916 | +143 |
| both | 1,826 | 1,878 | +52 |
| neither | 451 | 465 | +14 |

The four differences add to 841, which is exactly the 841 extra names - the two walks
reconcile, so neither is quietly dropping or double-counting a server. Read across both views, 465 records declare neither a package nor an endpoint: 439 of them are `active`, 12 more are `deprecated` and still sit in the
default view, and 14 are only visible once `include_deleted` is switched on.

So the honest headline is three numbers, not one: 37,854 servers are retrievable from the API when
asked including removed records, 37,013 of those are in the view a browser of the registry
actually gets, and 36,612 are `active` within it. Anyone quoting "how many MCP servers are there" should
say which of the three they mean.

## How those artifacts are distributed

Registry types among active records with a package: `npm` 9,868, `pypi` 3,982, `oci` 986, `mcpb` 921, `nuget` 129, `cargo` 62.
These count **records that mention a type**, and a record can mention several, so the columns sum above
the 15,321 package-bearing records; they are not counts of package entries.

Transports named by those packages: `stdio` 15,102, `streamable-http` 429, `sse` 28.
Transports named by remotes: `streamable-http` 21,927, `sse` 1,072.

## Why this page exists next to a sample that said 6 of 54

The earlier reading on this site, [`mcp-registry-installability.html`](mcp-registry-installability.html),
counted package presence across the first 54 servers in the registry's own list order and got 6 of 54.
That list is grouped by server name ascending, so those 54 are the alphabetically-first servers, and the
population reads differently: 15,321 of 36,612 active records carry a package (41.85% against the sample's 11%). One number is a prefix of an alphabetical ordering and the
other is the whole default view of the registry; both are true, and only the second can be quoted as a
population figure, and only for the view the registry serves by default - the wider view is counted in
"Every record, including the ones the default view hides" below.

That page also carried a sentence this reading disproves. It asserted that records without a package
"tell you a server exists without telling a client how to run it". A second instrument re-read the same
sample records through a different endpoint path (`?search=<name>` rows bucketed on `isLatest`) and found
 48 of the 54 declare a hosted endpoint, and 54 of 54 agreed with the record read
through the per-server endpoint on both class and version (0 class mismatches, 0 version mismatches). So the claim was not merely unsupported by the field
that was measured - it was wrong for most of those records. Retracted on 2026-09-28 in place.

The same comparison run bucketing on the **first** list row for each name instead of the `isLatest` row -
the mistake upstream issue modelcontextprotocol/registry#1676 describes - agrees on only 29 of 54 names:
24 report a different version and 1 lands in a different reachability class
altogether. That gap is why "54 of 54 agree" above is a reading rather than a tautology: the same
instrument does report disagreement when it buckets on the wrong row.

## What `search` can find, and what it cannot

Upstream issue [modelcontextprotocol/registry#1453](https://github.com/modelcontextprotocol/registry/issues/1453)
asks that `?search=` match the `description` field as well as the server name, on the grounds that it
currently matches names only. That is checkable against the live API, and it was, on 2026-09-29: a
sample of 2,000 servers pulled with `version=latest` (so a server with eleven published versions
occupies one slot), then ten capability words searched one page-set each.

| word | describes it in `description` but not in `name` | of those, returned by `search` | result rows scanned |
| --- | --- | --- | --- |
| `weather` | 6 | 0 | 277 |
| `database` | 15 | 0 | 92 |
| `github` | 5 | 0 | 1000 |
| `slack` | 4 | 0 | 73 |
| `jira` | 0 | 0 | 96 |
| `browser` | 12 | 0 | 366 |
| `calendar` | 17 | 0 | 183 |
| `pdf` | 24 | 0 | 435 |
| `memory` | 53 | 0 | 1000 |
| `email` | 34 | 0 | 354 |

Two numbers carry the finding. 170 of the 2,000 sampled servers (8.50% of the sample) state one of these ten
capabilities in prose while their name does not contain the word - and 0 of them turn up in the
3,876 result rows those ten searches returned. The falsification arm ran too: 0 of
those rows carry the word somewhere other than the name, which is the only shape that would have shown
description matching already existing. So #1453's premise holds at this sample size: a capability a
server advertises about itself in prose is invisible to the search box unless the author also happened
to put it in the name.

One note about the denominator. `github`, `memory` hit the 10-page cap, so for those words
the claim covers the first 1,000 rows rather than the whole result set; the instrument stores that in
`capped_word_legs` instead of letting a shorter scan look like a smaller gap. The sample is 2,000 of 37,013 servers, so 170 is a sample count and not a
registry total. A reader who wants either widened re-runs the commands under Reproduce with larger
--pages and --search-pages.

This says nothing about whether the search is *good* - only what it matches. Ranking, relevance and the
`updated_since` parameter were not measured here.

## What a value the endpoint does not accept does to you

Four parameters, four different answers, all read on 2026-09-29 by `tools/probe-mcp-registry-visibility-params.mjs`.
The failure modes are not uniform, and two of the four look like success, which is why this is a table
rather than a sentence.

| leg | HTTP | rows on the first page | what it means |
| --- | --- | --- | --- |
| `?status=active` (not a documented parameter) | 200 | 100 | ignored outright - that page's sha256 equals the unfiltered one, so a client that guessed this spelling gets 200 and no warning |
| `?include_deleted=nope` | 422 | 0 | rejected as a bad enum value |
| `?version=not-a-real-value` | 200 | 0 | accepted, and matched nothing, which is what a filter the server honours looks like |
| `?updated_since=not-a-date` | 400 | 0 | rejected before it is parsed |

`updated_since` needs one more sentence, because it narrows on a field a caller would not guess. Asked for
records updated since `2026-09-22T01:40:51.737Z`, the leg returned 100 rows whose earliest
`updatedAt` is `2026-09-22T02:50:39.762334Z` - on the right side of the parameter. Its earliest `publishedAt` is
`2026-09-01T10:54:13.681499Z`, which is earlier, because a server updated last week can still hold a version
published months ago. So this parameter filters by record update time, not by release time, and a caller that assumed release time would be shown rows it did not ask for.
A date thirty days ahead returns nothing at all - `2026-10-29` gave 0 rows - which is the
shape of a working filter, and the opposite of the silent `status` leg above.

## What this does not support

- That a declared address works. "The record names an endpoint" and "the endpoint answers an MCP request"
  are different claims; whether servers answer at all is measured on the nine-question hub,
  [`mcp-ecosystem-measurements.html`](mcp-ecosystem-measurements.html). The other half has been sampled
  separately, and came back well: 196 of 200 npm listings resolve on npm at exactly the
  version the registry gives ([the draw, its seed and its controls](mcp-npm-installability.html)). So the
  records counted above as declaring nothing are the gap; the records that declare an npm package mostly
  declare a real one.
- That 439 unreachable records are abandoned, low quality, or a defect of their authors. Some publish through
  their own installer, and a registry record is a catalogue entry, not a deployment.
- That the population is stable. It grew from 25,125 servers reported on 2026-08-27
  (upstream issue modelcontextprotocol/registry#1579) to 37,013 on 2026-09-28, so any share quoted from this
  page has a shelf life measured in weeks.
- That the `status` query parameter filters anything. It is not among the documented parameters of
  `GET /v0/servers` (`cursor`, `limit`, `updated_since`, `search`, `version`, `include_deleted`), and `?status=active` answered with a first page whose sha256 equalled
  the unfiltered one on 2026-09-29, `deprecated` rows included - no error, no effect. So the active split above
  is computed client-side from the whole walk.
- That no server-side option exists for this. `?version=latest` is documented and the server honours it: on 2026-09-29 the
  unfiltered first page carried 53 rows marked latest against 47 that a newer version had
  already superseded, while `?version=latest` returned 100 latest and 0 superseded, and
  `?version=not-a-real-value` returned no rows at all. Note what that filter is about: version currency, not status
  - the filtered page still held 1 deprecated row.
  This walk did not use it, because the census is
  meant to report what a consumer sees when they do not know to ask; but a reader who wants only the newest version
  of each server can ask for it in one query parameter, and an earlier comment of ours on upstream #1676 said
  otherwise and has been corrected there.
- That this census is every record the registry holds. The documented visibility switch is `include_deleted`
  and this walk used its default: asking `?include_deleted=true` surfaced rows whose status is `deleted` - 5 of the first 100, against 0 unfiltered - which the walk therefore never sees.
  37,013 is the population of the default view, not of the store. An earlier draft of this
  page and of the comment posted on upstream #1579 said the server cannot be asked for a status-restricted
  count at all; the published OpenAPI documents `include_deleted` and `updated_since`, so that sentence was
  written before the spec was read and is corrected here.

## Our own record, as a control

The instrument requires `io.github.happy520ai/unified-ai-system` to appear as an active latest record with a package - otherwise
"439 records declare nothing" and "my probe read nothing" are the same shape. It reports oci over `stdio`, version 0.8.0, `has_remotes: false`: installable as a container image,
not hosted, which is the `package_only` row above.

## Reproduce

```bash
node tools/survey-mcp-registry-census.mjs /tmp/census.json   # ~30 minutes, anonymous GETs, no credentials
node tools/probe-mcp-registry-visibility-params.mjs /tmp/visibility.json   # the scope caveat above, ~6 GETs
CENSUS_INCLUDE_DELETED=true node tools/survey-mcp-registry-census.mjs /tmp/census-wide.json
node tools/measure-mcp-registry-search.mjs --out /tmp/search.json --pages 20 --search-pages 10
node tools/measure-mcp-registry-search.mjs --offline /tmp/search.json   # re-derives the table from its own rows
node tools/render-mcp-census-doc.mjs --artifact /tmp/census.json --deleted /tmp/census-wide.json --search /tmp/search.json --out /tmp/census.md
```

The artifact is published at [`data/mcp-registry-census.2026-09-28.json`](data/mcp-registry-census.2026-09-28.json),
and the search measurement at [`data/mcp-registry-search.2026-09-29.json`](data/mcp-registry-search.2026-09-29.json).

