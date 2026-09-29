# "invalid ELF header" from better-sqlite3 on linux/arm64: the wrong-architecture node_modules trap

A Node image published as multi-platform can carry x86-64 native modules inside its `linux/arm64` tag, and the
first `require()` of the package fails with `invalid ELF header`. Measured on 2026-09-29 from four published
releases of our own image, with no Docker engine and nothing executed.

## The symptom you probably arrived with

A Node image is published as multi-platform. On an Apple Silicon Mac, or any arm64 host, the container starts
and then fails the first time it touches a native module:

```
Error: /app/node_modules/better-sqlite3/build/Release/better_sqlite3.node: invalid ELF header
    at Module._extensions..node (node:internal/modules/cjs/loader:1601:18)
```

The path is right, the file is there, the permissions are fine. The file is just an **x86-64 shared object
inside an arm64 image**, so the dynamic loader refuses it. Nothing in the Dockerfile looks wrong, because the
Dockerfile probably never installed it on the wrong machine - the install happened once, for one architecture,
and the resulting `node_modules` tree was copied into both images.

This is our bug, in our published image, found by our own tool. It is filed as
[issue #190](https://github.com/happy520ai/unified-ai-system/issues/190) and the readings are in
[mcp-image-review-0.8.0.md](https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.8.0.md).
The reason it is written up here rather than only in an issue is that the failure mode is common and the check
takes two commands, so it is worth having somewhere a search result can reach.

## The trap has a specific shape

Multi-arch builds split into two kinds of layer:

- **Architecture-derived layers**, produced inside each build stage: the base image, `apt` packages, anything
  compiled during that stage. Docker resolves the right base image per platform, so these come out correct.
- **Copied layers**, produced once and `COPY`'d into every stage: most often the dependency tree. `pnpm
  install` / `npm ci` runs in a builder stage on whichever runner built it, and `better-sqlite3`'s `install`
  hook (`prebuild-install || node-gyp rebuild --release`) then resolves **the prebuild for the runner's
  architecture**, not the target's. The finished `/app` is copied into both images.

So the tag advertises `linux/arm64`, the manifest really has an arm64 child, `docker manifest inspect` looks
correct - and the native modules inside are x86-64. Everything a registry-level check can see says "multi
platform". Only the file bytes say otherwise.

The same trap has a second, quieter face: `optionalDependencies` with platform-specific packages
(`@napi-rs/canvas-linux-x64-gnu`, `lightningcss-linux-x64-gnu`, `@rollup/rollup-linux-arm64-gnu`). npm and pnpm
pick those by the *installing* machine's platform, so an install on an x86-64 runner records and materialises
the x64 set, and an arm64 image gets x64 binaries plus a lockfile that will not admit the arm64 ones.

## The same trap without containers

Containers are one route here. So is any packaging step that reuses one `node_modules` directory across targets: a desktop build that produces Linux x64 and then macOS universal artifacts sequentially against the same tree can ship the *previous* target's native binary, because the native rebuild gets skipped while a stale "already built for this platform" marker is still sitting in the tree.

Where a cross-check does exist, you get a build-time error instead of a runtime one:

```text
Expected all non-binary files to have identical SHAs when creating a universal build
  but "Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node" did not
```

Where it does not, the failure is silent at build time and surfaces only when the app starts - `invalid ELF header` on Linux, `not a valid Win32 application` on Windows. Reported upstream at [electron-userland/electron-builder#10031](https://github.com/electron-userland/electron-builder/issues/10031), whose reporter traced the cause to a rebuild-skip marker in the rebuild path rather than to anything container-shaped.

The two shapes need two different checks, and it matters which one is available when:

- **Shared `node_modules` across sequential target builds** - the pre-packaging signal is the rebuild marker still naming the *first* target. You can see it before you ship anything, which is where the fix belongs.
- **An artifact that already exists** (published image, tarball, `.asar`) - the signal is `e_machine` at offset 18 of each `.node` file, described below. It cannot tell you *why* the wrong binary is there, and it only fires after publication.

The byte-level read in the next section is the second kind. We measured it against our own container images only; nothing in this section is a measurement of any other project's behaviour.

## How to check an image without a Docker engine

The registry hands out the layer tarballs to an anonymous pull token. Our reader is
`tools/inspect-image-filesystem.mjs` (zero dependencies: `node:crypto`, `node:zlib`, global `fetch`), and it
never creates or runs a container:

```bash
node tools/inspect-image-filesystem.mjs 0.8.0 --arch arm64
```

```
native      8 modules, expected ELF machine 0xb7, arch_mismatch=4, foreign_platform=4
  mismatch    app/node_modules/.../better_sqlite3.node (64-bit LSB x86-64)
IMAGE_REVIEW version=0.8.0 arch=arm64 layers=21 files=21864 native_modules=8 elf_arch_mismatch=4 problem_count=0
```

If you would rather not run our code, the same question is two requests and one byte offset:

```bash
TOKEN_URL="https://ghcr.io/token?scope=repository:<owner>/<repo>/mcp-server:pull"
BASE="https://ghcr.io/v2/<owner>/<repo>/mcp-server"
tok=$(curl -s "$TOKEN_URL" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).token))')

# 1. which platforms does the index actually publish?
curl -s -H "Authorization: Bearer $tok" -H "Accept: application/vnd.oci.image.index.v1+json" \
  "$BASE/manifests/0.8.0" | node -e '...print manifests[].platform + digest...'

# 2. read the child manifest's config blob, then walk its layers for .node files and print e_machine
```

`e_machine` is at byte offset 18 of the file, two bytes, interpreted per the ELF data byte at offset 5:
`0x3e` is x86-64, `0xb7` is AArch64, `0x28` is 32-bit ARM. A Mach-O starts `cf fa ed fe` or `fe ed fa cf`; a
Windows DLL/EXE starts `4d 5a` (`MZ`). That is the whole reading. It does not require the file to be complete,
which is why our tool asks the tar reader for the first 64 bytes of each `.node` rather than holding
hundreds of megabytes of module bodies in memory.

## What we measured in our own image

Every published tag, same command, arm64 leg:

| Release | Registry-published | Layers | Files | `.node` modules | `elf_arch_mismatch` | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 0.4.9 | 2026-08-10 | 16 | 11,101 | 4 | **0** | correct: its modules are AArch64 |
| 0.5.0 | 2026-08-15 | - | - | - | - | no `linux/arm64` child was published at all |
| 0.6.0 | 2026-08-28 | 18 | 21,129 | 8 | **4** | wrong: x86-64 modules in an arm64 tag |
| 0.7.0 | 2026-09-04 | 18 | 21,101 | 8 | **4** | wrong |
| 0.8.0 | 2026-09-25 | 21 | 21,864 | 8 | **4** | wrong |
| 0.8.0 (`amd64`) | 2026-09-25 | 21 | 21,864 | 8 | **0** | self-consistent |

Three things worth noticing in that table.

It is a **regression**, not a limitation we always had: 0.4.9's arm64 tag carried arm64 binaries, and the
older Docker-export review of that release recorded them by name (`skia.linux-arm64-gnu.node`, the
`linux-arm64-musl` variant, and an arm64 `better_sqlite3.node` whose digest differs from the amd64 one). The
byte reading agrees with the table, which is the only reason to trust either.

The window is **0.5.0 to 0.6.0**. 0.5.0 published no arm64 child; 0.6.0 published one already carrying the
wrong tree. Whoever fixes this should look at what the image job did in that window, not at the whole build
history.

And 12 of 21 layers are **shared between the two architectures today**, which is the fingerprint of the copied
`/app`. That part is an inference about the build, not a reading - the readings are the `e_machine` values.
What is also a reading: the gateway image, `ai-gateway-service:0.8.0`, arm64 leg, reports the same
`elf_arch_mismatch=4`, the same 21,864 files and the same 277,037,069 bytes under `/app`. Both images this
repository publishes carry it, and the command on our own first screen is
`docker run … ai-gateway-service:0.8.0 pnpm gateway demo` - so the failure an Apple Silicon visitor meets is
ours, not hypothetical.

## If you publish a multi-arch Node image, the cheap checklist

1. Do not let the dependency tree be installed once and copied to every platform. Install (or at minimum
   `pnpm rebuild better-sqlite3`) **inside each platform's stage**.
2. If you cannot afford a second runner, publish one architecture and say so. A single-arch tag that works is
   better than a two-arch tag that half-works, and it is a strictly smaller claim to maintain.
3. Verify by reading bytes, not by trusting the tag. The check costs one anonymous token request per
   repository and a few hundred megabytes of GETs; `docker buildx` completing without error proves the manifest
   was written, not that the contents match.
4. Check the `optionalDependencies` story for your native packages. If your lockfile pins only one platform's
   optional set, per-arch installs will not fix it.
5. Put the platform flag in front of the reader where the command is. We tell Apple Silicon users to pass
   `--platform linux/amd64` in the README and in the 60-second quickstart, because a caveat buried on a review
   page is a caveat nobody reads before the failure.

## What these readings do not prove

That the amd64 image is safe, that anything works at runtime, or that no other architecture-specific problem
exists. We never executed the image - which is the point of reading the tarballs: a stopped container is still
a container, and a review that runs nothing cannot be the thing that broke on someone's machine.

It also does not prove the build mechanism above. Shared layers and x86-64 `e_machine` values are consistent
with one install being copied; proving that needs the build, and the build is where the fix has to be decided.

Related: [MCP image content review 0.8.0](https://github.com/happy520ai/unified-ai-system/blob/master/docs/security/mcp-image-review-0.8.0.md),
[the published image roster for 0.8.0](verify-mcp-docker-image.html), and
[issue #190](https://github.com/happy520ai/unified-ai-system/issues/190).
