# Gateway deployment and recovery

`deploy/compose.release.json` runs one authenticated Gateway using an immutable
image digest, a loopback-only port, the existing two data volumes and the local
fake provider. It is a standalone release profile: do not combine it with the
development `docker-compose.yml`, which has a source build and optional `.env`.

The Docker publishing workflow checks out its exact event commit and runs
`pnpm check`, `pnpm test`, `pnpm check:public` and `pnpm verify:public-clone`
in the same job before container smoke tests, registry login and image pushes.
Each gate must succeed; a failure stops the subsequent publishing steps. This
applies to branch/tag triggers and manual runs, including build-only runs.
For a manual run, `push=false` also disables registry authentication and tagged
MCP Registry publication; local build and verification still run.
The separate `ci.yml` includes additional PostgreSQL and quality checks; this
workflow does not imply that those independent jobs passed. Record the hosted
workflow run, commit, measured build identity and resulting image digest when
selecting a release. Editing or locally parsing this workflow is not evidence of
a hosted run or publication.

## Validate a release profile

Use Node.js and Docker Compose v2. Obtain the Gateway image digest from a verified
build or registry record; the example below is a placeholder, not a published image.

```sh
node tools/verify-compose-release.mjs --image 'ghcr.io/OWNER/IMAGE@sha256:REPLACE_WITH_64_LOWERCASE_HEX'
```

The validator rejects mutable tags, user information and malformed references.
It checks the profile with the real Compose parser using an owned empty
`--env-file`, synthetic authentication and isolated Docker/npm configuration.
It does not contact a registry, pull/build images or start a service; success
proves configuration validity, not image availability or runtime readiness.
Optional `--port 13100` checks a different loopback port.

## Start or upgrade

Create a private environment file outside the checkout using the host's secret
management procedure. Restrict it to the deployment account. It must contain
`UAI_GATEWAY_IMAGE=repository@sha256:<64 lowercase hex>`, a strong `PME_AUTH_TOKEN`,
and optionally `UAI_GATEWAY_PORT=3100`. Never commit this file, copy it into
evidence, or display the expanded output of `docker compose config`.
The Gateway currently reads the token from the environment; this profile does
not claim file-based secret support.

Run the validator against the exact digest first. For a new installation choose
one stable project name. For an existing installation use its original Compose
project name so `gateway-data` and `gateway-service-data` resolve to the original
volumes. Confirm the names using `docker volume ls` and the existing deployment
record before starting. These commands assume the repository root and show the
same explicit project, file and private environment path every time:

```sh
docker compose -p uai-gateway --env-file /PRIVATE/gateway.env -f deploy/compose.release.json config --quiet
docker compose -p uai-gateway --env-file /PRIVATE/gateway.env -f deploy/compose.release.json pull
docker compose -p uai-gateway --env-file /PRIVATE/gateway.env -f deploy/compose.release.json up -d --wait --wait-timeout 180
docker compose -p uai-gateway --env-file /PRIVATE/gateway.env -f deploy/compose.release.json ps
```

On Windows replace `/PRIVATE/gateway.env` with the absolute private Windows path.
Shell environment variables take precedence over values in the explicit file;
use a deployment shell with no inherited `UAI_GATEWAY_IMAGE`, `UAI_GATEWAY_PORT`
or `PME_AUTH_TOKEN` overrides. Never use `--scale` or run a second project against
the same data. The profile fixes provider mode to `fake`; enabling real providers
requires a separate reviewed deployment configuration and scoped authorization.

`/ready` is the container health probe; `/health/check` provides diagnostics.
After startup verify the expected `/health/check` build identity and an
authenticated fake-provider request. A declared Git revision is only a build
declaration; compare the measured source and lockfile hashes with the selected
build record. See [runtime identity](../runtime-build-identity.md).
The 15-second container stop grace exceeds the configured 10-second application
shutdown deadline so its drain and cleanup path can run before Docker kills it.

## Preserve data and roll back

Record the previous image digest, project name, both physical volume names and
application version before an upgrade. Stop the Gateway before taking a consistent
backup of both data volumes with the host's backup tooling; include permissions
and any separately configured storage. Verify a restore in an isolated environment
before relying on the backup. Backups can contain private data and credentials and
must stay in protected storage outside the repository and evidence directories.

Upgrade by changing only the digest in the private file, validating that digest,
then repeating `pull` and `up` with the same project. To roll back, restore the
previous compatible digest and repeat `up`. Do not use `down -v`, delete volumes,
or create a different project name as a rollback shortcut. An image rollback does
not undo data migrations: if the older version cannot read the newer state, stop
the service and restore its verified pre-upgrade backup before restarting.

The supported state model here is one active Gateway process on one host.
JSON API-key counters and local SQLite state are not multi-writer coordination;
one Compose replica does not provide cross-host HA or zero-loss recovery across
every crash window. A copied volume also does not prove local-client/workflow
recovery: some receipts bind original files to device/inode or equivalent file
identity. Recreated files can have different identities and must fail closed,
even if their path and bytes match. Do not edit receipts to force acceptance.

## Verification coverage and remaining platform work

The existing validation record for commit `e94eb096` covers a Windows Gateway
startup (17.6 seconds) and local Linux amd64 Docker execution: MCP discovery of
15 tools and Gateway health/readiness, fake chat, runtime identity, non-root user
and read-only root filesystem. That image predates this release profile; those
checks do not prove this profile or a later checkout has run successfully.

The profile has also been exercised locally with the `e94eb096` image and disposable
named volumes: readiness, authenticated fake chat, clean stop, container replacement,
and virtual-key budget continuity passed. Switching that same test deployment to
the previously built `0a2d0109` image and back preserved the key and its counters.
This is compatibility evidence for those two images and that synthetic state;
it does not validate arbitrary data migrations, copied-volume restore, or the
current developing checkout. Full logs and artifact digests remain in the local
deployment validation record. Native Linux systemd, macOS service operation, ARM64,
Kubernetes and cross-host recovery still need their own runtime evidence.
Existing `deploy/install-mcp-service*` scripts supervise MCP, not the Gateway HTTP
server. [Native Gateway service templates](native-services.md) and an opt-in
[single-active-replica Kubernetes/PVC profile](kubernetes.md) are available;
their definition checks and Kubernetes schema validation are separate from
installed-service, storage and cluster runtime verification.

## Language Selection

- **Workload / boundary:** deterministic release configuration validation in
  `tools/verify-compose-release.mjs`; no Gateway runtime or public API changes.
- **Alternatives:** TypeScript adds a compile/loader step to a standalone ops
  check; PowerShell adds a shell requirement for Linux/macOS; Node.js ESM uses
  the existing supported runtime and standard library.
- **Choice / score:** Node.js ESM scores domain fit, maintenance, operability,
  safety, migration debt and ecosystem fit as `5/5/5/4/5/5` (29/30), versus
  TypeScript `4/4/4/5/4/5` (26/30) and PowerShell `4/3/2/4/3/2` (18/30).
  JSON avoids a new parser dependency; Markdown holds the operator procedure.
- **Compatibility / rollback:** this opt-in profile preserves existing volume
  mount paths. Remove these three added files to revert the configuration/tooling
  change; running deployments require the data-compatible rollback above.
- **Policy / risk closure:** authenticated fake defaults, no public protocol
  changes, digest-only input and isolated configuration validation. Syntax,
  negative input cases and Compose normalization are the focused checks; startup,
  data recovery, full repository gates and publication are separate evidence.
