# Is a registry-listed MCP server actually installable from the registry?

Measured 2026-09-28 by `tools/survey-mcp-installability.mjs` against `https://registry.modelcontextprotocol.io/v0/servers`.
Asked with: n/a - registry metadata, no MCP request was sent to a server.
Structure only - counts, registry types, transports, and whether an identifier field exists.
No tool names, descriptions or any other server-authored text is captured.

## What we counted

| | count | share of servers read |
| --- | --- | --- |
| distinct servers collected | 54 | - |
| latest record readable | 54 | 100% |
| **record carries a `packages` entry** | **6** | 11% |
| record carries none | 48 | 89% |
| record names a repository URL | 21 | 39% |

Of the 6 that do carry a package: transports `stdio` 6;
registry types `npm` 6. The sample is the registry's own default order over the first
pages, which groups toward the front of the alphabet, so read the type breakdown as one sample's
shape rather than the population's.

## What this field does and does not tell you

`published in the official registry` and `this record carries an artifact an installer can consume`
are two claims, and only the second is what an install button needs. In this sample the second
held for 6 of 54 records.

What this page does **not** measure is the other way a record can be actionable: a `remotes` entry,
which points a client at a hosted endpoint instead of at a package. The instrument that produced
these rows read `packages` and nothing else, so the 48 package-less records here are
*unclassified as to reachability*: this reading cannot say whether any of them carries a remote, and
a reader must not conclude that it does not. Sentence corrected 2026-09-28 - an earlier version of
this page asserted that those records told a client nothing at all, which the field that was
actually measured cannot support either way.

That is not a judgement about the servers. A record can be complete as a catalogue item and still
carry no package, because the package is the part an installer consumes and the repository is the
part a human reads.

## Two ways to read the same field and get different numbers

Reading the list endpoint's first row for a server counts packages on its **oldest published**
version: the list comes grouped by server name with each name's versions oldest-first, so the first
row carrying a name is that name's earliest record. That gives
5; reading each server's latest record gives
6. Neither is a typo for the other: they are different questions, and only the
second is about what someone installing today would receive.

The same endpoint also does not treat a limit as a sample size - 1 pages were read
to reach 54 distinct servers, because `limit` counts rows and rows are versions.

## Our own record, read as a control and not as a sample member

The instrument reads `io.github.happy520ai/unified-ai-system` the same way every run and refuses to publish if it comes
back without a package - otherwise a low count is indistinguishable from a broken probe. It reports
package present, registry type `oci`, transport `stdio`, version 0.8.0.
It is **not** a member of the sample above (`in_sample: false`): the alphabetical prefix
this sample draws from stops before it. So the honest reading is that every sampled package was
npm-over-`stdio` 6, and the container-image case here is ours, observed outside the sample.

## Deliberately not claimed

- That the ratio holds across the whole registry: 54 servers, one ordering, one day.
- That a record without a package is unreachable. Only `packages` was read in this window, so whether
  these records carry a `remotes` entry is a question this page cannot answer in either direction.
- That a record without a package is unmaintained or low quality. 21 of 54 name a repository, which
  is still somewhere a reader can go.
- That any particular directory shows or hides these servers in any particular way. No directory was
  asked anything here; this is a reading of the registry's own API.

## Reproduce

```bash
node tools/survey-mcp-installability.mjs 40 /tmp/installability.json
node tools/render-mcp-installability-doc.mjs --artifact /tmp/installability.json --out /tmp/article.md
```

Needs network, no credentials, and captures structure only.
