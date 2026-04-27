# Release Publish Preflight

Phase 135A records the preflight before publishing the existing
`v0.1.0-rc.1` GitHub draft prerelease or uploading any release assets.

## Current Release

- Repository: `happy520ai/unified-ai-system`
- Candidate version: `0.1.0`
- Tag: `v0.1.0-rc.1`
- Release title: `unified-ai-system v0.1.0-rc.1`
- Release target commit: `bdba42b600d712acb77926774c75254b8c290ea6`
- Current release state: draft
- Current release maturity: prerelease
- Current release asset count: `0`
- Verification command: `cmd /c pnpm verify:phase135a-release-publish-preflight`

## Required Explicit Confirmation

Publishing the draft release requires this exact later user phrase:

```text
发布 GitHub Release v0.1.0-rc.1
```

Uploading release assets requires this exact later user phrase and an explicit
asset path:

```text
上传 GitHub Release v0.1.0-rc.1 资产
```

Any weaker wording such as "continue", "next", or "go on" is not enough to
publish the draft release or upload assets.

## Later Commands Only

Do not run these commands as part of Phase 135A. They are examples for a later
explicit execution phase only.

```powershell
gh release edit v0.1.0-rc.1 --repo happy520ai/unified-ai-system --draft=false --prerelease --latest=false
gh release upload v0.1.0-rc.1 <asset-path> --repo happy520ai/unified-ai-system
```

## Publish Decisions Before Execution

- Confirm whether the draft prerelease should become publicly visible.
- Confirm whether it should remain a prerelease.
- Confirm whether the release should not be marked as latest.
- Confirm whether release notes should remain from `docs/RELEASE_DECISION_PACK.md`.
- Confirm whether assets are intentionally omitted or provide exact asset paths.
- Confirm the latest `Phase117A Release Gate` is green on the current pushed
  `master` head before publishing.

## Explicit Limits

- This phase is read-only.
- It does not publish the draft release.
- It does not upload release assets.
- It does not publish packages.
- It does not publish container images.
- It does not deploy cloud infrastructure.
- It does not expose public production access.
- It does not complete global release.
