# Gateway deployment and recovery

`deploy/compose.release.json` runs one authenticated Gateway using an immutable
image digest, a loopback-only port, the existing two data volumes and the local
fake provider. It is a standalone release profile: do not combine it with the
development `docker-compose.yml`, which has a source build and optional `.env`.

The profile explicitly stores model-library state at
`/app/.data/model-library/state.json` through
`AI_GATEWAY_MODEL_LIBRARY_STATE_PATH`. This uses the existing `gateway-data`
volume, so catalog refreshes can persist under the read-only root filesystem and
survive container replacement. The configuration verifier requires this exact
path in both the source profile and Compose's normalized output. Select an image
that supports this environment setting; configuration validation alone cannot
prove the selected image uses it.

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
the same data. The default profile fixes provider mode to `fake`; the reviewed
real-provider profile below is the separate configuration for enabling real
providers, and it still requires your own scoped authorization.

## Real-provider release profile

`deploy/compose.release.real.json` is the reviewed deployment configuration for
real providers. It keeps every hardening property of the default profile
(non-root, read-only root filesystem, dropped capabilities, no-new-privileges,
restricted tmpfs, loopback-only published port, digest-pinned image, bounded
shutdown grace) and changes exactly the provider wiring:

- `AI_GATEWAY_PROVIDER_MODE=real` and `AI_GATEWAY_REAL_PROVIDER_ENABLED=true`
  are fixed by the profile; the Gateway's own fail-closed real-provider gates
  (provider allowlist, per-provider credential gates) still apply on top.
- Provider credentials never appear in the profile's `environment`. They come
  from one private env file referenced by `UAI_GATEWAY_REAL_ENV_FILE`, created
  outside the checkout with the host's protected-secret procedure and the same
  restricted permissions as `gateway.env`. The verifier rejects any `*_API_KEY`,
  secret, password or webhook variable from re-entering the profile environment.
- `PME_AUTH_TOKEN` is still required. Real calls spend real budget and send
  request data to external providers; selecting the enabled providers and models
  is the operator's scoped authorization and stays inside the private env file
  (`AI_GATEWAY_ENABLED_PROVIDERS`, per-provider keys, default model).

Validate it with the same tool and an explicit profile flag before first use and
after every change:

```sh
node tools/verify-compose-release.mjs --image 'ghcr.io/OWNER/IMAGE@sha256:REPLACE_WITH_64_LOWERCASE_HEX' --profile real
```

The real profile is configuration-reviewed, not a claim of real-provider runtime
evidence. Provider smoke evidence, capacity behavior and provider-side rate
limits must be established per deployment; the single-active-writer limits below
apply unchanged.

## Multi-replica HA release profile

`deploy/compose.release.ha.json` is the verified single-host HA shape: nginx
(load balancer, passive health checks) fronting two Gateway replicas with a
shared PostgreSQL instance carrying the cross-replica stores — idempotency,
usage ledger, rate limiting and provider dispatch
(`AI_GATEWAY_*_POSTGRES_URL`), so request dedup, spend accounting and rate
limits are cluster-wide rather than per replica.

Run it exactly like the other profiles, with the additional required images and
PostgreSQL credentials in the private env file (`UAI_NGINX_IMAGE`,
`UAI_POSTGRES_IMAGE`, both digest-pinned; `UAI_POSTGRES_USER`,
`UAI_POSTGRES_PASSWORD`, `UAI_POSTGRES_DB`). `UAI_GATEWAY_PROVIDER_MODE`
selects `fake` (default) or `real`; in real mode the same
`UAI_GATEWAY_REAL_ENV_FILE` credential rules as the real profile apply.
Only nginx publishes a port, loopback-only by default; the Gateway replicas
and PostgreSQL are reachable only inside the Compose network.

Verified on 2026-10-24 with a real stack: four healthy containers, 10/10
authenticated requests distributed across both replicas through the load
balancer, zero failed requests and full takeover by replica B while replica A
was stopped, and distribution resuming after A's restart (evidence in the
local validation record). Honest boundaries of this profile:

- Single host: the Compose host itself remains a single point of failure;
  this is service-level HA, not multi-node HA. Cross-host and multi-node HA
  are not claimed.
- nginx uses passive health checks: a peer that starts failing is removed
  from rotation after its failure threshold, so a replica crashing mid-request
  can surface brief 502s until the threshold trips.
- The response cache and PME virtual-key counters remain per replica. The
  shared PostgreSQL stores cover idempotency, usage, rate limiting and
  dispatch; local-client control-plane SQLite state stays per replica and
  control-plane routes must not be treated as replicated.
- Model-library state stays per replica by design; run catalog refreshes
  against one replica.

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

If an older deployment used the legacy
`apps/ai-gateway-service/evidence/phase-312a-model-library-state.json` location,
stop it and back up that state before enabling the new profile. Restore the
compatible state into the new path in the same project's `gateway-data` volume
with ownership for the image's `node` user and private permissions. Verify the
model library and an offline catalog refresh in an isolated restored instance.
No automatic migration, deletion or merge of existing state is performed. Keep
the old backup available for a compatible image rollback.

Upgrade by changing only the digest in the private file, validating that digest,
then repeating `pull` and `up` with the same project. To roll back, restore the
previous compatible digest and repeat `up`. Do not use `down -v`, delete volumes,
or create a different project name as a rollback shortcut. An image rollback does
not undo data migrations: if the older version cannot read the newer state, stop
the service and restore its verified pre-upgrade backup before restarting.

The supported state model here is one active Gateway process on one host.
JSON API-key counters and local SQLite state are not multi-writer coordination;
one Compose replica does not provide cross-host HA or zero-loss recovery across
every crash window. The designed multi-replica path is the PostgreSQL-backed
control plane (audit store, usage ledger, idempotency coordinator, task claim
leases) with stateless data-plane replicas; the `drill:postgres-recovery`
exercise proves those recovery primitives on a real PostgreSQL instance. A
reviewed multi-replica deployment profile is still future work: do not treat
this single-writer profile, the Kubernetes single-replica profile, or the drill
itself as an HA certification. A copied volume also does not prove local-client/workflow
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
