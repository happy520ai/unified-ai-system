# Can you actually install what the MCP registry lists? 196 of 200 sampled npm packages could

Measured 2026-09-28 by `tools/survey-mcp-npm-frame.mjs` (the population) and
`tools/mcp-npm-resolve.mjs` (the draw), against `https://registry.npmjs.org`. HEAD registry.npmjs.org/<pkg> then GET <pkg>/<listed version>.
Seeded random sample, seed 20260928, so this exact 200 packages can be drawn again.
No package content was downloaded and no server was contacted - only npm's own registry metadata.

**Short answer: the npm listings in the official MCP registry are in good shape.** 98% of the sampled records point at a package that exists on npm *and* publishes the exact version the
registry lists. 1.5% point at a package that exists but not at the listed version, and 0.5% at a name that is gone. Nothing failed to answer.

## What was drawn, and why a frame was needed first

The registry's list endpoint is ordered by server name ascending. Reading a few pages therefore yields
the alphabetically-first servers, and this site has already published a number that got fooled by that:
[the earlier sample](mcp-registry-installability.html) reported 6 of 54 records carrying a package, while
[the census](mcp-registry-census.html) of the same API measured 41.85% of active records carrying a package of
any kind - 27.0% of them an npm one. So this measurement starts by walking the whole
list to build the population it samples from:

| | value |
| --- | --- |
| list pages walked | 1,239 |
| version rows read | 123,985 |
| active latest records | 36,658 |
| of those, records with an npm package | 9,896 |
| deviation from the published census's npm tally | 0.28% |
| sampled | 200 (seed 20260928) |

The frame is 2.0 MB of identifiers so it is not committed; its header is published, and one command
regenerates it. The frame's npm count lands 0.28% from the census figure of 9,868 that was measured 108 minutes earlier - an independent walk
reproducing an aggregate, which is the check that says both instruments are reading the same field.

## The result

| what npm says about the listed package and version | records | share of the draw |
| --- | --- | --- |
| package exists and the listed version is published | 196 | 98% |
| package exists, listed version not published | 3 | 1.5% |
| package name not found | 1 | 0.5% |
| no answer at all (transport or server error) | 0 | 0% |

Unusable rate **2.00%**, 95% confidence interval **[0.06%, 3.94%]** over 200 definite readings (Wald normal approximation on 200 definite readings). The interval is the point of drawing 200 rather than a handful: at n=200 the finding is ±1.94 percentage points wide, and quoting the 2.00% without it would
 overstate what was measured.

The 4 records that did not resolve are named in the published artifact with both HTTP
readings (package lookup and version lookup), so an author can check their own case rather than take my
word for it. 3 are a version the registry lists that npm does not have; 1 is a name npm
does not have at all.

## The controls, because a reassuring number deserves the same suspicion

This instrument was built to be able to fail loudly, and it did - twice, before the draw:

- **known_good:listed_version_published, known_good:listed_version_published, known_absent:package_missing**. Two widely-published packages must read as present at their version, and a
  name that cannot exist must read as absent. Without the second, "1 package not found" is
  indistinguishable from "my probe cannot reach npm".
- A version probe using npm's abbreviated-metadata `Accept` header answered **406 on one attempt and 200 on
  the next for the same URL**. Read as absence, that would have manufactured a finding about packages that
  install fine. The sampler therefore requests `application/json` and treats any status that is not a
  clean yes/no as inconclusive, which removes it from the denominator rather than diluting the rate.
- A `HEAD` on `/pkg/1.2.3` reports the package, not the release, so a HEAD-only probe would have read every
  missing version as published. The version leg is a GET.
- The first frame walk collected 9,896 null identifiers because it read `p.package` while the field is
  `identifier`. The sampler refused to draw from it (`frame has only 0 usable records`) instead of
  reporting "0 installable" as a discovery.
- Scoped and unscoped forms (`@scope%2fname` and `@scope/name`) both answered 200 against npm on 2026-09-28,
  so a 404 in this sample cannot be blamed on path encoding.

## What this does not support

- That the registry's non-npm listings are fine. 9,896 npm records were framed and sampled;
  pypi, OCI, `mcpb`, cargo and nuget were not tested at all here.
- That a package that installs is a working server. "npm will hand over version 1.2.3" and "the server
  starts and answers an MCP request" are different claims; the transport-declaration gap is measured on
  [the census](mcp-registry-census.html), which found 439 active records that declare no way to reach
  them at all. Those are two different failures and this page is about the rarer one.
- That 2.00% is stable. It is one draw on one day; the interval already runs
  0.06% to 3.94%, and a package unpublished after today would not appear here.
- Any comparison with a directory's install button. No directory was asked anything; this is npm and the
  registry's own metadata.

## Why this page changes what an earlier page of mine implied

The sample page on this site argued that a registry listing does not mean the server is installable, and
the census showed its 6-of-54 framing was an alphabetical artifact rather than an ecosystem fact. This
measurement pushes in the other direction again: where a record does declare an npm package, the listing
is almost always real and almost always at the version given. Recording that is not a hedge - it narrows
the actual problem to the records that declare nothing, and it says the maintainers' publish-time
validation is not silently accepting garbage.

## Reproduce

```bash
node tools/survey-mcp-npm-frame.mjs /tmp/frame.json                          # ~17 min, anonymous GETs
node tools/mcp-npm-resolve.mjs /tmp/frame.json /tmp/resolve.json             # ~4 min, seed in the output
node tools/render-mcp-npm-installability-doc.mjs --sample /tmp/resolve.json  # refuses if the controls misbehave
```

Published data: [`data/mcp-npm-installability-sample.2026-09-28.json`](data/mcp-npm-installability-sample.2026-09-28.json)
(the draw, all 200 records) and [`data/mcp-npm-frame-header.2026-09-28.json`](data/mcp-npm-frame-header.2026-09-28.json)
(the population's bookkeeping).

