# MCP Image Content Review 0.4.0

This document records a pre-activation content review for both published Linux
platforms in the immutable Unified AI System `0.4.0` MCP image. It is evidence
for a bounded local integration, not a production certification or a general
trust claim.

## Reviewed Identity

| Field | Reviewed value |
| --- | --- |
| Registry | `ghcr.io/happy520ai/unified-ai-system/mcp-server` |
| Version | `0.4.0` |
| OCI index | `sha256:c185d124d1f672b5cf210a7b7d4c7dbdc907b81a5f7b62fe312a0dc18839e045` |
| Source revision label | `9f606b0b4189ef9759bdc01857919c254209e4be` |
| Entrypoint | `docker-entrypoint.sh` |
| Command | `node packages/mcp-server/src/index.js` |
| User | Empty, so Docker's default root user |

| Platform | Manifest | Config |
| --- | --- | --- |
| `linux/amd64` | `sha256:bb3ba00366a924d511c776986f890d62196ecc380034daf9c42f54000dcc7f2d` | `sha256:3224ec32c8a1407ba704febf897157866f6cabf86fb515d760b0466fe64c9df1` |
| `linux/arm64` | `sha256:2a58da07d11de97a4b4051f4a82ac444e7fefb5235556d7997080c96db2da6ae` | `sha256:1e480c2b6711283f9571079d96c73f5dfc423a30d86c22d05c0dfd052113a9b7` |

The index also contains two BuildKit provenance manifests whose platform is
reported as `unknown/unknown`. They are attestations, not runnable platforms.

## Review Method

The content review used anonymous GHCR reads and did not start a container.

1. Resolve the immutable OCI index and select each published Linux platform.
2. Download all 16 compressed layers per platform and verify every advertised
   size and SHA-256 digest.
3. Verify each platform manifest and config digest.
4. Process every tar entry into a final root-filesystem inventory, including
   OCI whiteout handling and archive path validation.
5. Hash every regular file under `/app` and inventory every directory,
   symlink, hardlink, mode, size, and target.
6. Inspect package lifecycle hooks, native modules, privileged files,
   credential-like paths, and the MCP runtime's process, network, environment,
   and filesystem behavior.

No digest mismatch, unsafe archive path, or whiteout entry was found.

## Inventory Summary

| Item | linux/amd64 | linux/arm64 |
| --- | ---: | ---: |
| Compressed layer bytes | `128114758` | `126806092` |
| Final root-filesystem entries | `17323` | `17318` |
| `/app` entries | `5574` | `5574` |
| `/app` regular files | `4260` | `4260` |
| `/app` directories | `795` | `795` |
| `/app` symlinks | `260` | `260` |
| `/app` hardlinks | `259` | `259` |
| Combined app links | `519` | `519` |
| Suspicious absolute or out-of-tree app links | `0` | `0` |
| Native Node binaries | `2` | `2` |
| App package manifests declaring lifecycle hooks | `8` | `8` |
| Base-image SUID/SGID regular files | `11` | `11` |
| Credential-like file artifacts under `/app` | `0` | `0` |

The deterministic inventory digests over app paths, types, modes, sizes,
content hashes, and link targets are:

| Platform | Inventory digest |
| --- | --- |
| `linux/amd64` | `d45314959d9bd96b0dd7c11f4a7dd5a4f9567d3164a28f03d482df6c10fd3db9` |
| `linux/arm64` | `ca8d644047979fc66ae94265dce395ebb52d498c111e79e7cefbdbabc28cf802` |

These are review-inventory digests, not OCI object identifiers. The OCI index,
platform manifest, and config digests remain the activation identity.

## Native Components

| Platform and path suffix | SHA-256 |
| --- | --- |
| amd64 `@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node` | `7607cda801e86bee96d88b685766e7d22b707128de25134147f68192304220c5` |
| amd64 `better-sqlite3/build/Release/better_sqlite3.node` | `d7d9272b12d11c1dc2bb787741b1b7c4037d336155f316ace3420410c28fda37` |
| arm64 `@napi-rs/canvas-linux-arm64-gnu/skia.linux-arm64-gnu.node` | `c3e4d0f97840c2fec0550cb3b85328b6cbe3f489e470d21c4089412e6dfee7e7` |
| arm64 `better-sqlite3/build/Release/better_sqlite3.node` | `2bdcfde76d902d1b83aa957fc359aa37b98e7291d6103f57da4a802ee1cb1aef` |

The MCP startup command does not compile or install packages.

## Lifecycle Hooks

Eight bundled app package manifests declare install, prepare, or packaging
hooks. The highest-risk declarations are:

- `@unified-ai-system/forge-core` has a `postinstall` fallback that can invoke
  `npx --yes node-gyp rebuild`.
- `better-sqlite3` has an install hook that uses `prebuild-install` or
  `node-gyp rebuild`.
- Six dependency manifests retain development-time `prepare` or `prepack`
  hooks.

These declarations remain in package metadata, but no package-manager command
or lifecycle hook runs in the reviewed MCP startup path. The bundled plugin
configuration disables container networking.

## Runtime Behavior

The reviewed MCP entrypoint:

- starts the bundled MCP server and a child gateway process;
- uses loopback HTTP for health and tool calls inside the container;
- forces the child gateway into fake-provider mode and fails closed if health
  indicates that a real provider may be active;
- exposes nine tools, including deterministic provider-free prompt
  enhancement and fake-provider chat;
- can use an HTTP or HTTPS `AI_GATEWAY_MCP_URL` only when that environment
  variable is explicitly supplied; and
- stops the child gateway when the stdio host disconnects.

The release workflow also pulled the published images anonymously, exercised
the MCP tool set and fake-provider chat, and verified process cleanup in
[run 30753489244](https://github.com/happy520ai/unified-ai-system/actions/runs/30753489244).

The bundled Codex configuration passes no host directory, provider credential,
environment variable, or published port. It pins the immutable multi-platform
index and uses `--network none`, `--cap-drop ALL`, and
`--security-opt no-new-privileges`.

## Metadata Caveat

The immutable `0.4.0` image's OCI description label says `8 governed tools`.
That repository description was stale when the tag workflow built the image.
The source revision, runtime smoke test, package metadata, and MCP tool listing
all identify the actual `0.4.0` runtime as the nine-tool release. The public
repository description has been corrected for subsequent builds. This label
mismatch does not change executable content, but consumers should not use the
description label as a tool-count assertion.

## Residual Risks

The image is based on Node 22 Bookworm Slim rather than a distroless runtime.
It includes shell and package-manager tooling, 11 SUID/SGID utilities from the
Debian base image, two native modules, the application source, and a default
root user. The hardening flags reduce exposure but do not make the image
risk-free.

No `.env`, private-key, certificate-key, PKCS#12, or SSH private-key artifact
was found under `/app`. All 519 app symlink and hardlink targets resolve inside
the app tree.

## Activation Requirements

Before a hardened manual activation, the operator must:

1. obtain approval for image download and non-executing content inspection;
2. verify the index, selected platform manifest, config, source labels,
   entrypoint, command, user, root-filesystem inventory, native binaries,
   lifecycle hooks, privileged files, and sensitive runtime behavior;
3. stop on any mismatch or unexpected artifact;
4. report the residual risks above;
5. obtain separate approval for MCP registration and activation; and
6. preserve the immutable digest and every hardening argument.

The marketplace plugin may download the missing immutable image during its
user-approved installation. The stricter manual skill path separates download,
inspection, registration, and activation and uses `--pull never` after review.
