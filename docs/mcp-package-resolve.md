# Do the MCP registry's non-npm listings resolve? Measured across pypi, OCI, mcpb, cargo and NuGet

Measured 2026-09-28 by `tools/mcp-package-resolve.mjs` against each ecosystem's own public endpoint,
from the frame built by `tools/survey-mcp-npm-frame.mjs` (seed 20260928, so the same draws come back).
This is the companion to [`mcp-npm-installability.html`](mcp-npm-installability.html), which covered npm.
Metadata only: no artifact content is downloaded, and every request is anonymous.

**15 of 785 listings across 791 entries could not be resolved at the version the
registry declares.** The per-family numbers differ a lot, and two of these families were counted in
full rather than sampled.

| family | population in the registry | measured | resolves at the listed version | version missing | artifact missing | not pullable | not decided | unusable rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pypi | 3,990 | 200 | 200 | 0 | 0 | 0 | 0 | 0.00%  [0.00%, 1.88%] |
| oci | 987 | 200 | 186 | 5 | 0 | 3 | 6 | 4.12%  [2.10%, 7.92%] |
| mcpb | 922 | 200 | 193 | 0 | 7 | 0 | 0 | 3.50%  [1.71%, 7.05%] |
| cargo | 62 (all) | 62 | 62 | 0 | 0 | 0 | 0 | 0.00% (whole population probed) |
| nuget | 129 (all) | 129 | 129 | 0 | 0 | 0 | 0 | 0.00% (whole population probed) |

The **not decided** column is this instrument admitting where it cannot see: OCI identifiers pointing
at a registry other than ghcr.io or Docker Hub are counted there rather than in the rate, because
refusing to answer is not evidence either way. Where a family was sampled, the bracket is a 95% Wilson
score interval computed from the counts in the artifact; where it says `(whole population probed)` the entire family was
probed, so there is no sampling error to report - only the possibility that a registry answered
differently on another day.

Pooled with the npm run, this is **985 registry listings probed across all six artifact
types the registry emits, 19 of them (1.93%, 95% Wilson interval 1.24% to 2.99%) pointing at something the host will not hand over at the version the record declares**.

The whole run was executed twice over the same 791 seeded draws, the first pass at 21:01 UTC and this one at 21:16 UTC. The two passes agree on every family's verdict tally, so the numbers above are not a one-off reading of a flaky endpoint.


## What each endpoint's answer means, because they do not agree

The reason this needed five code paths rather than one: the registries signal absence differently,
and each difference is a way to publish a wrong number if you assume a shared meaning for 404.

- **pypi** - `/pypi/<name>/json` and `/pypi/<name>/<version>/json` answer 200 or 404 cleanly, so the
  package and the release are separate, unambiguous questions.
- **crates.io** - returns **403 to a request with no User-Agent, for crates that exist**. Probed without
  one, all 62 cargo listings in the registry would have been reported missing. Sending the header turns
  the same requests into 200/404.
- **NuGet** - the flat-container `index.json` for an id lists every published version in one small
  document, and the `.nupkg` path for a specific version answers 200 or 404. Ids are case-insensitive,
  so the probe lowercases them the way the CDN does.
- **OCI** - the tag is looked up as a manifest, which cannot tell a deleted image from a private one.
  What separates them is the *grant* request: ghcr answers **403 to a token request for a repository that
  does not exist** and issues a token for one that does, so `repository_unknown_or_private` is reported
  as its own column and never folded into either success or absence.
- **mcpb** - the identifier is a full download URL, usually a GitHub release asset, so there is no
  package-versus-version distinction to make: the link either delivers or it does not. A deleted
  repository answers 404 at every path under it, which is why one of the two examples in the artifact is
  a dead link rather than a renamed file.

## Controls, all ten of which had to behave

The instrument refuses to write anything if any control disagrees with its expectation, and the
expectations are not all the same - which is the point of a negative control on an endpoint you have not
measured before:

- `known_good` pypi: `requests` → listed_version_published (pkg 200, version 200)
- `known_good` cargo: `serde` → listed_version_published (pkg 200, version 200)
- `known_good` nuget: `Newtonsoft.Json` → listed_version_published (pkg 200, version 200)
- `known_good` oci: `ghcr.io/happy520ai/unified-ai-system/mcp-server` → listed_version_published (pkg 200, version 200)
- `known_good` mcpb: `https://github.com/underloam/xbbg/releases/download/v1` → listed_version_published (pkg 200, version 200)
- `known_absent` pypi: `qoder-nonexistent-pypi-xzz` → package_missing (pkg 404, version 404)
- `known_absent` cargo: `qoder-nonexistent-crate-xzz` → package_missing (pkg 404, version 404)
- `known_absent` nuget: `Qoder.Nonexistent.Xzz` → package_missing (pkg 404, version 404)
- `known_absent` oci: `ghcr.io/happy520ai/qoder-nonexistent-repo-xzz` → repository_unknown_or_private (pkg 403, version no_token)
- `known_absent` mcpb: `https://github.com/underloam/xbbg/releases/download/v9` → package_missing (pkg 404, version 404)

## What this does not support

- That an unresolvable listing is abandoned or sloppy. A release can be renamed, a repository made
  private for a week, or a version pulled for yanking, and the registry entry stays as it was.
- That the families not sampled here are fine. npm was measured separately; the registry's own record
  of what it holds is the only frame these draws came from.
- That a resolvable artifact runs. This asks the ecosystem's package host whether it will hand over the
  bytes the registry names - nothing about whether the server starts.
- Stability. Every number is a single day's reading of a registry that grew about 47% in the month
  before it was taken.

## Reproduce

```bash
FRAME_TYPES=pypi,oci,mcpb,cargo,nuget node tools/survey-mcp-npm-frame.mjs /tmp/frame.json
node tools/mcp-package-resolve.mjs /tmp/frame.json /tmp/resolve.json   # ~8 min, anonymous, no credentials
node tools/render-mcp-package-resolve-doc.mjs --resolve /tmp/resolve.json
```

Published data: [`data/mcp-package-resolve.2026-09-28.json`](data/mcp-package-resolve.2026-09-28.json) carries every
probed listing with both HTTP readings, and
[`data/mcp-package-resolve.first-pass.2026-09-28.json`](data/mcp-package-resolve.first-pass.2026-09-28.json) is the earlier
pass the reproducibility sentence is computed from.

