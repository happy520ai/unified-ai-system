# Release Draft Rollback

Phase 137A records the real rollback of the existing `v0.1.0-rc.1` GitHub
prerelease back to draft state.

## Rolled Back Release

- Repository: `happy520ai/unified-ai-system`
- Candidate version: `0.1.0`
- Tag: `v0.1.0-rc.1`
- Release title: `unified-ai-system v0.1.0-rc.1`
- Release target commit: `bdba42b600d712acb77926774c75254b8c290ea6`
- Release state after rollback: draft
- Release maturity after rollback: prerelease
- Release asset count after rollback: `0`
- Verification command: `cmd /c pnpm verify:phase137a-release-draft-rollback`

## Executed Command

```powershell
gh release edit v0.1.0-rc.1 --repo happy520ai/unified-ai-system --draft --prerelease --latest=false
```

## Verified Rollback State

- The GitHub Release for tag `v0.1.0-rc.1` exists.
- The GitHub Release is a draft again.
- The GitHub Release remains a prerelease.
- The remote tag `v0.1.0-rc.1` still exists and still points to the original
  release target commit.
- No release assets were uploaded.
- No package was published.
- No container image was published.
- No cloud deployment was performed.
- No public production deployment is complete.
- No global release is complete.

Note: GitHub may retain the historical `publishedAt` timestamp after moving a
published release back to draft. The current release state is determined by
`isDraft=true`.

## Explicit Limits

- This phase only changes the existing GitHub Release back to draft state.
- It does not delete the GitHub Release.
- It does not delete the git tag.
- It does not upload release assets.
- It does not publish packages.
- It does not publish container images.
- It does not deploy cloud infrastructure.
- It does not expose public production access.
- It does not complete global release.
