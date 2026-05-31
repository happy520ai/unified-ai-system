# Phase1914A-E Persistent Local Action Evidence Manifest

## Purpose

Phase1914A created real owner-authorized local files, and Phase1914A-R refreshed
that proof after a stale desktop file check failed. Phase1914A-D later showed
that the exact four desktop paths from the latest evidence are now missing while
their parent Desktop directory is visible.

This phase does not recreate desktop files. It records the current missing-file
state and adds a persistent repository manifest so long-term verification can
distinguish creation-time proof from current desktop file persistence.

## Evidence Rule

- `file_exists_check=false` must remain false when the current files are missing.
- The verifier may still seal Phase1914A when the persistent manifest proves:
  original local execution happened, the reseal creation-time check passed, the
  current missing-file state is acknowledged, and no current existence is claimed.
- The warning `desktop_files_missing_but_persistent_manifest_valid` must be
  surfaced when the verifier seals by manifest rather than by current file
  persistence.

## Boundaries

- No Desktop scan.
- No Desktop file list read.
- No Desktop file content read.
- No new Desktop file creation.
- No Provider call.
- No secret, auth.json, or raw CredentialRef read.
- No deploy, release, tag, artifact upload, commit, or push.
- No `/chat-gateway/execute`, `legacy/`, or `PROJECT_CONTEXT.md` change.
