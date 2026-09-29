# MCP Image Content Review 0.8.0

Reviewed on 2026-09-29 by the same author as the code, from the published image, without running it. This is a
content review: it reports what is inside the image. It is not a runtime audit, not a penetration test, and not
evidence that the image behaves correctly - only that the bytes listed here are the bytes published.

## What is new about the method

[0.4.9](mcp-image-review-0.4.9.md), [0.4.8](mcp-image-review-0.4.8.md), [0.4.0](mcp-image-review-0.4.0.md) and
[0.3.2](mcp-image-review-0.3.2.md) obtained their filesystem with `docker pull` + `docker create` +
`docker export`. That made the newest completed review three releases behind the newest release, because the
reviewing machine had no Docker engine, and every catalog that vendored our `SKILL.md` kept pinning `0.4.9`
while quoting fifteen tool names.

This review reads the layer tarballs directly out of the registry - `tools/inspect-image-filesystem.mjs`, zero
dependencies, anonymous pull token, `sha256` recomputed on every blob, `zlib` for gzip, a tar reader that
refuses on a bad header checksum or a truncated entry, and OCI whiteouts applied so the merged view matches
what a container would actually see. **Nothing from the image is executed**, which is a stronger guarantee than
the Docker path (that one creates a container, even a stopped one).

The method difference is the whole point of stating it: the two reviews answer the same questions, and if a
future reader needs the Docker-export evidence specifically, the older pages still carry it.

## Reviewed Identity

| Field | Value |
| --- | --- |
| Repository | `ghcr.io/happy520ai/unified-ai-system/mcp-server` |
| Tag | `0.8.0` |
| Index digest | `sha256:17888ad0efdc145f0010142c043d3a67b699e08cff6c47e42c13d6bc8a7ad909` |
| `linux/amd64` manifest | `sha256:626b0a0c9c503083ba34ae77d563da4edcb744d62723c58805621ed9262873f6` |
| `linux/arm64` manifest | `sha256:67ff6d0f1f108af0b428325ae36a0938a78a6e5b89da86137986980d72413028` |
| Image created (config) | `2026-09-25T16:43:09.71766768Z` |
| User | `node` (non-root) |
| Working directory | `/app` |
| Entrypoint | `docker-entrypoint.sh` |
| Command | `node packages/mcp-server/src/index.js` |
| Exposed ports | none - this image serves MCP over stdio |
| Declared volumes | `/app/.data`, `/app/apps/ai-gateway-service/.data` |
| Env names in config | `NODE_ENV`, `NODE_VERSION`, `PATH`, `YARN_VERSION`, `npm_config_verify_deps_before_run` |

Env **values** are never read out by the tool. A config can carry a secret and this page is public, so only the
names are reported - which is all the "does the image bake in credentials" question needs.

Both platform legs were read independently. They share 12 of 21 layers and each carries 9 that the other does
not; 201,024,497 compressed bytes for `amd64` against 201,030,623 for `arm64`. The file-level readings are
identical on both platforms (21,864 files, 14,322 of them under `/app`), because the `/app` content is one
shared layer - which is where the most important finding of this review comes from. See **Native Components**.

## The arm64 tag carries x86-64 binaries

The image is published as multi-platform, and the tag says `linux/arm64`. Four of the eight native modules in
that image are `64-bit LSB x86-64` according to their own ELF headers, and none is AArch64:

```
app/node_modules/.pnpm/@napi-rs+canvas-linux-x64-gnu@0.1.80/.../skia.linux-x64-gnu.node        64-bit LSB x86-64
app/node_modules/.pnpm/@rolldown+binding-linux-x64-gnu@1.0.3/.../rolldown-binding...node       64-bit LSB x86-64
app/node_modules/.pnpm/better-sqlite3@11.10.0/.../build/Release/better_sqlite3.node            64-bit LSB x86-64
app/node_modules/.pnpm/lightningcss-linux-x64-gnu@1.33.0/...node                                64-bit LSB x86-64
```

The architecture is read from `e_machine` in each file's own header (`0x3e` = x86-64, `0xb7` = AArch64), not
inferred from the file name, so the finding does not depend on pnpm's naming convention being honest. No
`linux-arm64` or `aarch64` module path exists anywhere in that tag's merged filesystem.

**This is a regression, not how the build has always worked - and it can be pinned to a release.** The same
command against the arm64 tag of each release in question (`0.4.9` was read on 2026-09-29, the rest likewise;
earlier tags were not re-read here):

```
IMAGE_REVIEW version=0.4.9 arch=arm64 layers=16 files=11101 native_modules=4 elf_arch_mismatch=0
IMAGE_REVIEW version=0.5.0 arch=arm64                REFUSED: carries no linux/arm64 child
IMAGE_REVIEW version=0.6.0 arch=arm64 layers=18 files=21129 native_modules=8 elf_arch_mismatch=4
IMAGE_REVIEW version=0.7.0 arch=arm64 layers=18 files=21101 native_modules=8 elf_arch_mismatch=4
IMAGE_REVIEW version=0.8.0 arch=arm64 layers=21 files=21864 native_modules=8 elf_arch_mismatch=4
IMAGE_REVIEW version=0.8.0 arch=amd64 layers=21 files=21864 native_modules=8 elf_arch_mismatch=0
```

0.4.9's arm64 tag is clean, so the modules there really are AArch64 - which is also what
[0.4.9's review](mcp-image-review-0.4.9.md) recorded in its per-platform table (`skia.linux-arm64-gnu.node`,
the `linux-arm64-musl` variant, and an arm64 `better_sqlite3.node` whose digest differs from the amd64 one).
0.5.0 published no arm64 child at all. From 0.6.0 on, the arm64 tag exists and carries x86-64 modules. So the
change landed between 0.4.9 (2026-08-10) and 0.6.0 (2026-08-28), and 12 of the 21 layers are shared between
today's two tags - consistent with one `/app` tree being installed on an x86-64 runner and published to both.
That last part is a hypothesis about the build; this page does not establish it. What it establishes is the
before and after, both read from file contents.

What a reader should conclude: on an arm64 host, the paths that load these modules will fail to load them -
`better-sqlite3` is the one that matters, because it backs the stores the governed features use. Nothing in
this review executed the image, so "fails to load" is a reading of the ELF machine field against the tag's
declared architecture, and the direct test is one `docker run --platform linux/arm64` away for anyone with a
daemon. The `amd64` tag is self-consistent: 0 architecture mismatches there.

**The gateway image has it too.** Same command, `ghcr.io/happy520ai/unified-ai-system/ai-gateway-service` at
`0.8.0`, arm64 leg: `native_modules=8 elf_arch_mismatch=4 foreign_platform_modules=4`, `21` layers, `21,864`
files, `14,322` under `/app`, and `/app` totalling `277,037,069` bytes - the same counts the MCP image's arm64
leg reports. So this is not one mis-tagged artifact: both images this repository publishes at `0.8.0` ship that
tree on arm64, and the first command on the README is `docker run … ai-gateway-service:0.8.0 pnpm gateway demo`,
which is exactly where a visitor on Apple Silicon meets it. Both READMEs now say to pass
`--platform linux/amd64`; the fix belongs to the build, and it is
[issue #190](https://github.com/happy520ai/unified-ai-system/issues/190).

Artifacts: [`docs/data/mcp-image-filesystem-0.8.0-amd64.json`](../data/mcp-image-filesystem-0.8.0-amd64.json),
[`docs/data/mcp-image-filesystem-0.8.0-arm64.json`](../data/mcp-image-filesystem-0.8.0-arm64.json).

## Inventory Summary

Read from the merged layer set after whiteouts:

| Reading | Count |
| --- | --- |
| Tar entries walked | 41,811 |
| Files after merge | 21,864 |
| Directories after merge | 3,903 |
| Files under `/app` | 14,322 (277,037,069 bytes) |
| Files not owned by uid 0 | 15 |
| Executable-bit files | 661 |
| Shell scripts under `/app` | 13 |
| `package.json` files read under `/app` | 279 |
| Setuid files | 8 |
| Setgid files | 3 |
| World-writable files | 0 |
| Device nodes | 0 |
| Symlinks resolving above the root | 0 |
| Native `.node` modules | 8 |
| Install-time lifecycle hooks | 2 |

Every setuid and setgid path is part of the Debian base image and is the standard shadow/login set, not
something our build added: `usr/bin/chfn`, `usr/bin/chsh`, `usr/bin/gpasswd`, `usr/bin/mount`,
`usr/bin/newgrp`, `usr/bin/passwd`, `usr/bin/su`, `usr/bin/umount`, plus
`usr/bin/chage`, `usr/bin/expiry`, `usr/sbin/unix_chkpwd`. The image runs as `node`, so none of them is on a
root path at start.

## Native Components

Eight files end in `.node`. Four are Linux shared objects built for x86-64: `@napi-rs/canvas`,
`@rolldown/binding`, `better-sqlite3` and `lightningcss`. On the `amd64` tag that matches the tag, and
`elf_arch_mismatch=0`. On the `arm64` tag the same four files are still x86-64, and that is the mismatch
described above.

The remaining four are not Linux binaries at all: `@reflink` builds for **darwin (Mach-O) and win32 (PE)**,
shipped inside a Linux image under `usr/local/lib/node_modules/pnpm/dist/` - pnpm's own bundle, which carries a
binary per platform. Their headers say `mach-o` and `pe`, so they are counted separately from the architecture
mismatch rather than inflating it. Dead weight, not a provenance problem, and listed because a reader would
otherwise have to work out whether an unexplained foreign binary had crept in.

## Lifecycle Hooks

Two of the 279 package manifests declare install-time commands:

| Package | Hook | Command |
| --- | --- | --- |
| `@unified-ai-system/forge-core` | `postinstall` | `node ./scripts/rebuild-native.mjs` |
| `better-sqlite3` | `install` | `prebuild-install \|\| node-gyp rebuild --release` |

Both run while the image is being built, not when it starts. The first is ours and is the reason the image
carries a compiled native module; the second is upstream's standard prebuild-or-compile fallback. Nothing in
the shipped tree executes at container start beyond the entrypoint and command listed above.

## What the image carries that it does not need

The runtime image contains test and build tooling - `vitest`, `tsc`, `playwright-core` with its
`reinstall_chrome_*` and `reinstall_msedge_*` scripts, `vite`, and a `mammoth`/`pdf-parse`/`xlsx`/`pino` CLI set
under `.bin`. That is the largest honest weakness in the shipped image: more code present than the running
server needs, and 13 shell scripts that only exist because dev dependencies were not pruned by a final stage.

It is not a claimed compromise of anything, and it is not fixed by this page. It is recorded so the next
release can be compared against it, and so a reader who runs the same command gets the same 661 executables
rather than wondering which subset mattered.

## Residual Risks

- **The `linux/arm64` tag carries x86-64 native modules**, including `better_sqlite3.node`. Anyone on an arm64
  host should expect the SQLite-backed paths to fail to load, and should not read "multi-platform image" as
  "works on my architecture" until the arm64 tag carries arm64 binaries again - which is what 0.4.9's review
  recorded, so the fix is restoring behaviour the build once had, not inventing new capability.
- Content only. Nothing here shows what the code does, that it resists exploitation, or that a running
  container is confined. The compose and hardening evidence lives elsewhere and is separately scoped.
- Dev and test tooling ships in the runtime image (above), which enlarges the code present but never invoked.
- Two install-time hooks run at build time, one of them ours.
- Four foreign-platform native binaries are present in a Linux image.
- Trust in these readings rests on GHCR serving the digest it advertised. The tool recomputes every blob's
  `sha256` and refuses on a mismatch, but it authenticates the registry's HTTPS response, not an independent
  signature.
- One reviewer, and that reviewer wrote the code. The 0.4.9 review had the same property; it is stated rather
  than hidden.

## Reproduce

```bash
node tools/inspect-image-filesystem.mjs 0.8.0 --json docs/data/mcp-image-filesystem-0.8.0-amd64.json
node tools/inspect-image-filesystem.mjs 0.8.0 --arch arm64 --json docs/data/mcp-image-filesystem-0.8.0-arm64.json
node --test tools/oci-image-fs.test.mjs tools/inspect-image-filesystem.test.mjs
```

Anonymous GETs only, roughly 200 MB per platform, no credentials and no execution. The tool exits non-zero if a
blob fails its digest, a tar header checksum is wrong, an entry name escapes the root, or the read comes back
empty - a truncated download cannot produce a clean review.
