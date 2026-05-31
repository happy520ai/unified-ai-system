# Phase2092A Controlled Existing Tool Source Mutation

## Goal

Phase2092A expands the real patch path from creating one isolated source file to modifying one existing low-risk tool source file.

This is a real existing tool source mutation: the runner validates one single-file unified diff against `tools/phase2091/generated-source-patch-target.mjs`, checks the expected pre-mutation SHA, applies the mutation, runs `node --check`, executes a local smoke command, and records rollback evidence.

## Scope

- Requires Phase632 preflight.
- Requires Phase2091A sealed evidence.
- Applies only `tools/phase2091/generated-source-patch-target.mjs`.
- Refuses target creation, deletion, rename, binary diff, and multi-file diff.
- Requires `approvalRecord`, `allowedFiles`, and `forbiddenPaths`.
- Records rollback metadata for restoring the previous target content.
- Keeps codexExecExecuted=false.
- Keeps providerCallsMade=false.

## Boundaries

- default `/chat` unchanged.
- `/chat-gateway/execute` unchanged.
- provider runtime unchanged.
- codexExecExecuted=false.
- providerCallsMade=false.
- secretRead=false.
- envRead=false.
- authJsonRead=false.
- codexConfigModified=false.
- codexBaseUrlModified=false.
- deployExecuted=false.
- releaseExecuted=false.
- tagCreated=false.
- artifactUploaded=false.
- pushExecuted=false.
- commitCreated=false.
- legacyModified=false.
- projectContextCreated=false.
- workspaceCleanClaimed=false.

## Verification

The phase must prove four things:

- The existing target file was actually modified.
- The Phase2091 smoke behavior remains intact.
- The new Phase2092 marker is emitted.
- Rollback evidence can restore the previous target content.

## Commands

```powershell
cmd /c pnpm run preflight:phase632-token-saving
cmd /c pnpm run apply:phase2092-controlled-existing-tool-mutation
cmd /c pnpm run smoke:phase2092-controlled-existing-tool-mutation
cmd /c pnpm run verify:phase2092-controlled-existing-tool-mutation
```

## Next Gate

The next phase can allow a controlled low-risk tool mutation outside the Phase2091 sandbox, but it must remain behind explicit approvalRecord, allowedFiles, forbiddenPaths, pre-mutation SHA, rollback evidence, node checks, local smoke, and verifier gates.
