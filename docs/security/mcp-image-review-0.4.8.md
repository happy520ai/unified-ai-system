# MCP Image Content Review 0.4.8

This document records a pre-activation content review for both published Linux
platforms in the immutable Unified AI System `0.4.8` MCP image. It is evidence
for a bounded local integration, not a production certification or a general
trust claim.

## Reviewed Identity

| Field | Reviewed value |
| --- | --- |
| Registry | `ghcr.io/happy520ai/unified-ai-system/mcp-server` |
| Version | `0.4.8` |
| OCI index | `sha256:e405192087d1f8734ea873b56046d87d565947b18c8654426a954880254a90bd` |
| Source revision label | `c3f9d044768ceba69101f86ef2bda62275d1b75d` |
| Entrypoint | `docker-entrypoint.sh` |
| Command | `node packages/mcp-server/src/index.js` |
| User | Empty, so Docker's default root user |

| Platform | Manifest | Config |
| --- | --- | --- |
| `linux/amd64` | `sha256:d3b34a8d1dbc6cd1c4215a405b0f59e49ccb008500b792e8a7be2f5b805379b3` | `sha256:af5c9998ee4a5e2181e9903eab46d8c0e89d94936b60156ec636778c625b7b70` |
| `linux/arm64` | `sha256:77e7196245fe2ad5f94f0dde819fa84ca20a8a89836e35f31e544f3677676f5e` | `sha256:c7bf502f368d97de74fb0aebacbb06721587ed33629745b7fc12e13c6e035e47` |

The index also contains two BuildKit provenance manifests whose platform is
reported as `unknown/unknown`. They are attestations associated with the two
runnable manifests, not additional executable platforms.

## Review Method

The content review used anonymous GHCR reads. No reviewed container was
started.

1. Fetch the OCI index through the registry API and verify that its response
   digest equals a SHA-256 computed over the returned bytes.
2. Fetch each Linux platform manifest and config and independently verify its
   advertised size and SHA-256 digest.
3. Pull each platform through Docker by immutable index digest. Docker verifies
   the 16 compressed layers selected by each platform manifest.
4. Create a stopped temporary container for each platform, export its flattened
   root filesystem, and remove the temporary container without starting it.
5. Inspect every exported tar entry for unsafe paths and inventory `/app`
   files, directories, links, modes, sizes, content hashes, and link targets.
6. Inspect package lifecycle hooks, native modules, privileged files,
   credential-like paths, and the MCP runtime's process, network, environment,
   and filesystem behavior.

The computed index, manifest, and config digests matched the registry values.
No unsafe export path or out-of-tree `/app` link was found.

## Inventory Summary

| Item | linux/amd64 | linux/arm64 |
| --- | ---: | ---: |
| Compressed layer bytes | `140640942` | `138223078` |
| Flattened root-filesystem entries | `17387` | `17382` |
| `/app` entries | `5621` | `5621` |
| `/app` regular files | `4291` | `4291` |
| `/app` directories | `808` | `808` |
| `/app` symlinks | `261` | `261` |
| `/app` hardlinks | `261` | `261` |
| Combined app links | `522` | `522` |
| Suspicious absolute or out-of-tree app links | `0` | `0` |
| Native Node binaries | `3` | `3` |
| App package manifests declaring lifecycle hooks | `8` | `8` |
| Base-image SUID/SGID regular files | `11` | `11` |
| Credential-like file artifacts under `/app` | `0` | `0` |

The deterministic inventory digests over app paths, types, modes, sizes,
content hashes, and link targets are:

| Platform | Inventory digest |
| --- | --- |
| `linux/amd64` | `a12005919ff7303acee60f6f9528c0254f1745366014169d71379a75a291e9c3` |
| `linux/arm64` | `288d70c9b924916df56c744c59cb6f14867a584d8c04039f5fbf2da184942697` |

These are review-inventory digests, not OCI object identifiers. The OCI index,
platform manifest, and config digests remain the activation identity.

## Native Components

| Platform and path suffix | SHA-256 |
| --- | --- |
| amd64 `@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node` | `7607cda801e86bee96d88b685766e7d22b707128de25134147f68192304220c5` |
| amd64 `@napi-rs/canvas-linux-x64-musl/skia.linux-x64-musl.node` | `f84fb53d2362daac1bc17bf7af0e3a3e970231ada84f5e5fae84b03639561448` |
| amd64 `better-sqlite3/build/Release/better_sqlite3.node` | `d7d9272b12d11c1dc2bb787741b1b7c4037d336155f316ace3420410c28fda37` |
| arm64 `@napi-rs/canvas-linux-arm64-gnu/skia.linux-arm64-gnu.node` | `c3e4d0f97840c2fec0550cb3b85328b6cbe3f489e470d21c4089412e6dfee7e7` |
| arm64 `@napi-rs/canvas-linux-arm64-musl/skia.linux-arm64-musl.node` | `ccef3e03974c95dcdb2e514b0c84a89681f52f22b895a36fd23c1c7eeddc6727` |
| arm64 `better-sqlite3/build/Release/better_sqlite3.node` | `2bdcfde76d902d1b83aa957fc359aa37b98e7291d6103f57da4a802ee1cb1aef` |

The MCP startup command does not compile or install packages. Both GNU and
musl canvas packages are present in each platform image; neither was executed
during this non-activation inspection.

## Lifecycle Hooks

Eight bundled app package manifests declare install, prepare, or packaging
hooks. The highest-risk declarations are:

- `@unified-ai-system/forge-core` has a `postinstall` script that can rebuild a
  native dependency during package installation.
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
- exposes nine tools, including deterministic provider-free prompt enhancement
  and fake-provider chat;
- can use an HTTP or HTTPS `AI_GATEWAY_MCP_URL` only when that environment
  variable is explicitly supplied;
- can append diagnostics to `MCP_SERVICE_LOG_FILE` only when the operator also
  sets `MCP_SUPERVISED=1`; and
- stops the child gateway when the stdio host disconnects.

The plugin passes none of those optional environment variables, host paths, or
published ports. It pins the immutable multi-platform index and uses
`--network none`, `--cap-drop ALL`, and
`--security-opt no-new-privileges`.

The tagged release workflow built both images, exercised all nine MCP tools and
fake-provider chat, verified process cleanup, pulled the published images
anonymously, and published the Registry metadata in
[run 31358802657](https://github.com/happy520ai/unified-ai-system/actions/runs/31358802657).

## Residual Risks

The image is based on Node 22 Bookworm Slim rather than a distroless runtime.
It includes shell and package-manager tooling, 11 SUID/SGID utilities from the
Debian base image, three native Node binaries for the selected architecture,
the application source, and a default root user. The hardening flags reduce
exposure but do not make the image risk-free.

No `.env`, private-key, certificate-key, PKCS#12, or SSH private-key artifact
was found under `/app`. All 522 app symlink and hardlink targets resolve inside
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
