# Runtime build identity

The gateway exposes buildIdentity through its existing health/check response and
authenticated api/overview snapshot. It identifies the bounded source bytes
shipped with an artifact, rather than guessing the running version from a user's
current checkout or environment.

## Meaning of the fields

| Field | Meaning |
| --- | --- |
| status=verified | The bundled manifest matches the measured runtime source scope and lockfile. |
| declaredRevision | Optional 40-character lowercase revision supplied by the builder; it is a declaration, not independently verified Git ancestry. |
| sourceDigest | SHA-256 of a sorted, versioned list of controlled source paths, byte digests and sizes. |
| lockfileDigest | SHA-256 of the shipped pnpm-lock.yaml bytes, verified separately. |
| packageVersion | Version read from the artifact's public package.json, also compared with the manifest. |
| sourceFileCount | Number of source/manifest inputs in the fixed source scope; excludes the separately measured lockfile. |
| attested=false | This mechanism is not third-party attestation, production approval or proof of external services. |

The reader captures one immutable observation when its module initializes.
Subsequent health requests reuse it. Deployments must keep the artifact read-only;
this is not continuous tamper monitoring or verification of Node's in-memory
module cache. Two different source artifacts can therefore be distinguished even
when both use the same package version.

Missing, malformed, oversized, unsafe or source-mismatched manifests produce
status=unknown with a fixed reason. There is no fallback to environment variables,
live Git, logs, credentials, or a replacement manifest. Unknown identity does not
change existing health/readiness decisions; deployment acceptance must require a
verified identity separately.

## Fixed, non-sensitive input scope

The gateway-runtime-source-v1 recipe scans the gateway and console src trees and
packages. It includes maintained JS/TS and native/program source extensions, package
manifests, and the three shipped terminal/MCP/build identity tools. It also binds
the root package.json and pnpm-workspace.yaml. Legitimate security modules such as
runtimeCredentialStore.ts are included; filenames containing credential or secret
are not broadly excluded.

Dependencies, build/dist output, tests/specs, fixtures, examples, logs, data,
evidence and temporary directories are excluded. Environment and MCP configuration
files are explicitly excluded. Arbitrary JSON, database, key, certificate, log and
binary data formats are not source inputs. The manifest does not supply paths.
It never authorizes reading an absolute path or leaving the artifact root.

The manifest is limited to 16 KiB and an exact canonical JSON object. Source files
are limited to 8 MiB each, 128 MiB overall and 4,096 paths. Source/manifest links,
non-files, path changes during bounded reads and unsupported input layouts fail
closed. This digest does not verify node_modules, native binaries, container
settings or external services; OCI digests and existing dependency/release gates
remain separate evidence.

## Build and verify

The fixed artifact location is build/runtime-identity.json. It is already ignored
by Git and excluded from copied Docker build contexts, then generated inside the
image after its maintained sources have been copied. It is outside writable data
volumes. Generation creates a new file atomically and never overwrites an existing
artifact or user file; prepare a fresh artifact directory for each build.

    node tools/build-runtime-identity.mjs --declared-revision <40-character-sha>
    node tools/build-runtime-identity.mjs --verify --expect-revision <40-character-sha>

The revision is optional for local builds. Docker accepts UAI_DECLARED_REVISION as
a build argument; runtime environment values cannot alter the cached identity.
The publisher supplies its candidate revision to local and published builds,
retains their identity JSON, and compares the measured source and lockfile
identities after anonymous pull. Matching that declared revision establishes a
release-record association; it does not turn the declaration into attestation.

All supported deployment forms should carry the same identity contract. Portable
service/Compose configurations and the planned Kubernetes configuration follow
this artifact step; an identity response alone does not certify those platforms.

## Language Selection and rollback

The bounded reader, fingerprint recipe and manifest types use TypeScript. The
build entrypoint remains Node.js ESM and reuses that recipe rather than duplicating
it. Existing health/overview and Docker/publisher files receive small integration
changes. No dependency, service, database, general control plane or CLI change is
introduced. Eight files cover the reader/test, generator, two existing response
paths, container build, publication verification and this contract.

Rollback removes the additive identity fields and build/publisher hooks. Existing
application data, secrets, approvals and native-client configuration are not
modified. Older artifacts may report unknown identity; their version must not be
silently inferred. Cold-start cost, actual container output and hosted publication
must be verified on the final frozen candidate.
