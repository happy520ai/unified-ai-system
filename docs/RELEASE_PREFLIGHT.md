# Release Artifact Preflight

Phase 131A records the GitHub Release and artifact preflight for
`unified-ai-system`.

## Scope

- Repository: `happy520ai/unified-ai-system`
- Branch: `master`
- Release gate: `Phase117A Release Gate`
- Preflight command: `cmd /c pnpm verify:phase131a-release-artifact-preflight`

This is a read-only preflight. It does not create a git tag, create a GitHub
Release, upload release assets, publish packages, push container images, deploy
cloud infrastructure, expose public production access, or complete global
release.

For verifier clarity:

- It does not create a git tag.
- It does not create a GitHub Release.
- It does not upload release assets.
- It does not deploy cloud infrastructure.

## Current Preconditions

- The private GitHub repository must be accessible through GitHub CLI.
- `origin/master` must exist and track the local `master` branch.
- The latest observed remote Release Gate for the pushed head must conclude
  `success`.
- The Release Gate must remain validation-only: install, workspace check,
  secret safety, user journey, setup readiness, Docker runtime, and Docker
  Compose runtime.
- The workflow must not contain release creation, package publishing, image
  publishing, cloud deployment, or artifact upload steps.
- The secret safety scan must continue to report zero plaintext secret findings.

## Current Release State

- No GitHub Release is expected to exist for this phase.
- No local git release tag is expected to exist for this phase.
- No release artifact is expected to be uploaded by this phase.

## Manual Decisions Before A Real Release

- Choose the release version and tag name.
- Decide whether the first release should be a draft or prerelease.
- Write release notes from verified phase evidence.
- Decide which artifacts, if any, should be attached.
- Decide whether package publishing or container image publishing belongs in a
  later explicit phase.
- Re-run the remote Release Gate on the exact release commit before creating a
  real release.

Phase 132A records a read-only decision-pack draft for these choices in
`docs/RELEASE_DECISION_PACK.md`; it does not create the release.
Phase 133A records the final read-only creation confirmation pack in
`docs/RELEASE_CREATION_CONFIRMATION.md`; it still does not create the release.

## Explicit Limits

- GitHub Release creation remains incomplete.
- Package publishing remains incomplete.
- Container image publishing remains incomplete.
- Cloud deployment remains incomplete.
- Public multi-user production deployment remains incomplete.
- Global release remains incomplete.
