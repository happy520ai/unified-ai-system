# Dependency vulnerability release gate

Docker publishing requires the reusable `security-scan.yml` workflow for the
same `github.sha`. The job scans the complete root `pnpm-lock.yaml`, retains
unfiltered OSV results and a complete SPDX 2.3 package inventory, and applies
the reviewed policy. All unexcepted findings block, including findings without
a severity. Scanner/network errors, an empty or incomplete inventory, missing
SBOM packages, inconsistent exit status, and changing inputs also block.

The scan uses the pinned OSV Scanner **2.5.1** release binary. Both installation
and the Node runner verify its SHA-256. CI explicitly checks out `github.sha`;
the summary records the revision and hashes of the lockfile, manifests and
policy actually read. A revision alone is not evidence that a local worktree
was clean: compare the recorded input hashes as well.

## First baseline and disposition

The 2026-09-09 baseline contained 305 dependency versions and 16 distinct
advisories across five package instances. These were dependency-version
matches; they were not demonstrations that every advisory was exploitable
through the gateway. The maintained changes are:

| Component | Baseline | Disposition | Upstream evidence |
| --- | --- | --- | --- |
| `vitest`, `@vitest/mocker` | 4.1.10, one shared advisory | Vitest and its matched internal packages updated to 4.1.11 | [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) concerns the mock redirect file-serving boundary; normal Node tests do not establish browser-mode exposure. |
| `@xmldom/xmldom` through Mammoth | 0.8.13, ten advisories | Override only the existing 0.8 line to 0.8.15 | [0.8.15 release](https://github.com/xmldom/xmldom/releases/tag/0.8.15) includes parser resource-consumption and serializer fixes. Gateway document parsing uses Mammoth; each individual exploit was not reproduced here. |
| `hono` through MCP transport | 4.13.1, three advisories | Override the existing 4.x dependency to 4.13.5 | [4.13.5 release](https://github.com/honojs/hono/releases/tag/v4.13.5) fixes query parsing, dot-notation parsing and static generation. This does not assert that all three optional paths are used by MCP. |
| SheetJS `xlsx` | Official CDN 0.20.3, two advisories | Retain the existing package and apply the two exact source/version exceptions below | The npm advisory ranges have no fixed upper bound, while the vendor provides patched CDN releases. |

The Vitest update also deduplicates its `picomatch` dependency onto the existing
4.0.5 version. The patched inventory has 304 dependency versions. Raw rescanning
still reports the two SheetJS IDs; policy acceptance is separately visible as
`excepted`, and is never reported as zero raw findings.

## Exact SheetJS exceptions

`tools/dependency-vulnerability-policy.json` documents two review decisions:

- `GHSA-4r6h-8v6p-xvw6` / `CVE-2023-30533`: the vendor identifies
  [0.19.3 as the first fixed release](https://cdn.sheetjs.com/advisories/CVE-2023-30533).
- `GHSA-5pgg-2g8v-p4x9` / `CVE-2024-22363`: the vendor identifies
  [0.20.2 as the first fixed release](https://cdn.sheetjs.com/advisories/CVE-2024-22363).

Both apply only to `xlsx` 0.20.3 from the existing exact official CDN URL and
SHA-512 integrity, with matching application manifest and lockfile importer.
They expire at **2026-12-08 00:00 UTC**. A changed package source, version,
integrity, advisory ID or expired review cannot use them. A new SheetJS advisory
still blocks. The policy does not suppress a whole package, npm ecosystem,
development dependencies, or a severity level. Review expiry requires a new
evidence-backed change; it is not extended by rerunning the scanner.

## Reproduce and inspect

After installing the frozen workspace dependencies, download the official
[OSV 2.5.1 release binary](https://github.com/google/osv-scanner/releases/tag/v2.5.1)
for Linux x64 or Windows x64 and verify the corresponding policy hash. Run:

```text
pnpm check:dependency-vulnerabilities --scanner /absolute/path/to/osv-scanner --output-dir /absolute/path/to/new-evidence-directory
```

The output directory must be empty. Keep the directory even when the command
fails and use a new directory for a later attempt. `osv-raw.json` preserves the
scanner result; `dependencies.spdx.json` includes all packages; `summary.json`
separates blocked and excepted findings and records content hashes. An early
execution or validation failure may have logs without a summary and is a failed
gate. The workflow uploads whatever evidence exists even when enforcement fails.

OSV's default SPDX output may include only affected packages. The runner uses
`--all-packages` and compares full package URLs against the lockfile inventory.
Scoped SPDX display names may omit their namespace; the package URL remains the
identity. See [OSV output and exit codes](https://google.github.io/osv-scanner/output/).

This profile covers locked npm dependency versions, including optional platform
packages. It does not cover container OS packages, native toolchains, source-code
vulnerabilities, actual exploitability, license adjudication, or production
runtime stability. SPDX license fields may be `NOASSERTION`. Container image
SBOM/provenance remains a separate build artifact. Hosted workflow execution is
separate evidence from local validation; no hosted or published result is
implied by this configuration.

## Language Selection and rollback

The workload is bounded dependency-file parsing, invoking an existing scanner,
validating its output and gating existing workflows. Node ESM matches `tools/`
and reuses the installed YAML parser; TypeScript would add a compilation step
without changing this tooling boundary. No runtime dependency, service, database
or public gateway API is added. JSON owns the reviewed scanner/exception data.

The change spans the two workflows, dependency manifests/lock, existing
supply-chain checker, one runner with tests, policy and this runbook. These
separate files are necessary to bind the scan to actual publication and keep
dependency resolution reproducible; no general scanning platform is introduced.
Rollback is a coherent revert of this change and frozen dependency reinstall in
the candidate checkout. It does not change deployed services; reverting also
restores the old dependency exposure and advisory-only release behavior, so the
previous candidate must not be treated as newly approved for release.
