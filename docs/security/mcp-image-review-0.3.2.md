# MCP Image Content Review 0.3.2

This document records the pre-activation content review for the immutable
linux/amd64 Unified AI System MCP image. It is evidence for a bounded local
demo, not a production certification or a general trust claim.

## Reviewed Identity

| Field | Reviewed value |
| --- | --- |
| Registry | `ghcr.io/happy520ai/unified-ai-system/mcp-server` |
| Version | `0.3.2` |
| OCI index | `sha256:22efd2f6b04926a03a8d5b96d840192570da0b4557f5c754b3e9b7157ddbaa05` |
| Platform | `linux/amd64` |
| Platform manifest | `sha256:cc17e923335f953631f59fb6a5ffcdce0e12e16c5abf362f1d28747452adadee` |
| Config | `sha256:c28166511ca9d95ab6f4c0c8ac0cbc2acbbfdac20f971d074ff6744d39e0248f` |
| Source revision label | `541430d68fac6b35c512ea7d2df20fe45334e0a5` |
| Entrypoint | `docker-entrypoint.sh` |
| Command | `node packages/mcp-server/src/index.js` |
| User | Empty, so Docker's default root user |

The multi-platform index also contains an arm64 image. That image was not part
of this content review and must not be activated through the reviewed setup.

## Review Method

The review used anonymous GHCR registry reads and did not execute the image.

1. Resolve the immutable OCI index and select its linux/amd64 manifest.
2. Download all 16 compressed layers and verify each advertised SHA-256 digest.
3. Parse the config and non-empty build history in layer order.
4. Process every tar entry into a final root-filesystem inventory, including
   OCI whiteout handling.
5. Hash every regular file under `/app` and inventory every directory,
   symlink, hardlink, mode, size, and target.
6. Inspect the entrypoint, runtime dependency chain, package lifecycle hooks,
   native modules, privileged files, credential-like paths, and process,
   network, environment, and filesystem-write behavior in the MCP path.

No layer digest mismatch or whiteout entry was found.

## Inventory Summary

| Item | Result |
| --- | ---: |
| Compressed layer bytes | `132739305` |
| Final root-filesystem entries | `18135` |
| `/app` entries | `6178` |
| `/app` regular files | `4755` |
| `/app` directories | `874` |
| `/app` symlinks | `278` |
| `/app` hardlinks | `271` |
| Combined app links | `549` |
| Suspicious absolute or out-of-tree app links | `0` |
| Native Node binaries | `2` |
| Package manifests declaring lifecycle hooks | `8` |
| Base-image SUID/SGID files | `11` |
| Credential-like file artifacts under `/app` | `0` |

The deterministic inventory digest over app paths, types, modes, sizes,
content hashes, and link targets is:

```text
d4a55b25642037dccaf22273414572a131bd0f9c5bfe4c9572402aa746f6e9bc
```

This digest describes the audit inventory format, not an OCI object. The OCI
manifest and config digests remain the activation identity.

## Native Components

The image contains two native Node modules:

| Path suffix | SHA-256 |
| --- | --- |
| `@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node` | `7607cda801e86bee96d88b685766e7d22b707128de25134147f68192304220c5` |
| `better-sqlite3/build/Release/better_sqlite3.node` | `d7d9272b12d11c1dc2bb787741b1b7c4037d336155f316ace3420410c28fda37` |

These binaries are installed at image build time. The MCP startup command does
not compile or install packages.

## Lifecycle Hooks

Eight bundled package manifests declare install, prepare, or packaging hooks.
The highest-risk declarations are:

- `@unified-ai-system/forge-core` has a `postinstall` fallback that can invoke
  `npx --yes node-gyp rebuild`.
- `better-sqlite3` has an install hook that uses `prebuild-install` or
  `node-gyp rebuild`.
- Six dependency manifests retain `prepare` or `prepack` development hooks.

These declarations remain in package metadata, but no package-manager command
or lifecycle hook runs in the reviewed MCP startup path. Network isolation in
the registered command prevents a later runtime path from downloading tools.

## Runtime Behavior

The reviewed MCP entrypoint performs these material actions:

- starts `packages/mcp-server/src/index.js` through the base Node image's short
  shell entrypoint;
- spawns the bundled gateway service as a child Node process;
- allocates a loopback port and uses loopback HTTP for health and tool calls;
- forces the managed child to fake-provider mode and fails closed if health
  indicates that a real provider may be active;
- can use an HTTP or HTTPS `AI_GATEWAY_MCP_URL` only when that environment
  variable is explicitly supplied;
- stops the child process when the stdio host disconnects.

The reviewed Codex registration passes no host directory, provider credential,
environment variable, or published port. It also uses `--network none`, so the
optional external gateway path is unreachable in the reviewed configuration.

The targeted MCP server and shared SDK scan found process creation, loopback
networking, environment reads, and HTTP client calls. It found no direct
filesystem-write call in those modules. The managed gateway can still maintain
local container state, which disappears with the `--rm` container.

## Base Image Risks

The image is based on Node 22 Bookworm Slim and is not a minimal distroless
runtime. It contains:

- a shell entrypoint;
- `apt`, `apt-get`, Node, npm, npx, Corepack, pnpm, and Yarn;
- 11 SUID/SGID utilities from the Debian base image;
- a default root user;
- the gateway application source and its production dependency tree, not only
  the three MCP entry files.

The reviewed launch command mitigates these residual risks with
`--cap-drop ALL`, `--security-opt no-new-privileges`, `--network none`, no host
mounts, no host environment forwarding, no published ports, an immutable
platform manifest, and `--pull never`. It does not make the image risk-free.

## Credential And Link Review

No `.env`, private-key, certificate-key, PKCS#12, or SSH private-key artifact
was found under `/app`. A path named
`apps/ai-gateway-service/src/credentials` contains source modules, not a
credential artifact.

All 549 app symlink and hardlink targets resolved inside the app tree. Most are
pnpm workspace or content-addressed dependency links. No absolute or
out-of-tree app link was found.

## Activation Requirements

Before activation, the operator must:

1. obtain approval for image download and the non-executing content inspection;
2. verify the platform manifest, config, source labels, entrypoint, command,
   user, layer history, root-filesystem inventory, links, native binaries,
   lifecycle hooks, privileged files, and sensitive runtime behavior;
3. stop on any mismatch or unexpected artifact;
4. report the risks above to the user;
5. obtain a separate approval for Codex registration and activation;
6. preserve every hardening argument in the reviewed registration command.

Removing Codex configuration does not delete the image or a retained review
directory. Each cleanup is a separate host-state change that requires approval
for its exact target.
