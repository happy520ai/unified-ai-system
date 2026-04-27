# Release Creation Confirmation

Phase 133A records the final read-only confirmation pack before any real
GitHub Release creation for `unified-ai-system`.

## Candidate

- Repository: `happy520ai/unified-ai-system`
- Branch: `master`
- Candidate version: `0.1.0`
- Candidate tag: `v0.1.0-rc.1`
- Candidate release title: `unified-ai-system v0.1.0-rc.1`
- Recommended GitHub Release state: draft
- Recommended release maturity: prerelease
- Verification command: `cmd /c pnpm verify:phase133a-release-creation-confirmation`

## Explicit Confirmation Required

A later real release phase must only create the tag and GitHub Release after
the user explicitly says:

```text
创建 GitHub Release v0.1.0-rc.1
```

Any weaker wording, including "继续", "下一步", or "发布预检", is not
authorization to create a tag or GitHub Release.

## Current Read-Only Confirmation

- The candidate tag must not already exist locally.
- The candidate tag must not already exist on `origin`.
- The candidate GitHub Release must not already exist.
- The latest remote `Phase117A Release Gate` must be successful for the pushed
  branch head.
- Secret-safety evidence must remain clean.
- Release notes must remain a draft decision artifact until explicitly
  approved.

## Commands For A Later Explicit Release Phase Only

Do not run these commands as part of Phase 133A:

```powershell
git tag v0.1.0-rc.1
git push origin v0.1.0-rc.1
gh release create v0.1.0-rc.1 --draft --prerelease --title "unified-ai-system v0.1.0-rc.1" --notes-file docs/RELEASE_DECISION_PACK.md
```

## Rollback Notes For A Later Explicit Release Phase

If a later real release is created incorrectly, the rollback procedure must be
explicit and manual:

```powershell
gh release delete v0.1.0-rc.1 --yes
git push origin :refs/tags/v0.1.0-rc.1
git tag -d v0.1.0-rc.1
```

Do not run rollback commands unless a later real release was actually created
and the user explicitly asks to remove it.

## Explicit Limits

- This phase does not create a git tag.
- This phase does not create a GitHub Release.
- This phase does not upload release assets.
- This phase does not publish packages.
- This phase does not publish container images.
- This phase does not deploy cloud infrastructure.
- This phase does not expose public production access.
- This phase does not complete global release.

Phase 134A later created the candidate tag and GitHub draft prerelease and
records the execution in `docs/RELEASE_CREATION_EXECUTION.md`.
