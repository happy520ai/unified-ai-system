# Quality Evidence Assertion Policy

The quality evidence gate is driven by policy files under `tools/` so CI does not hard-code artifact lists.

## Files

- `tools/quality-evidence-assertions.base.json`: shared policy used by all quality workflows.
- `tools/quality-evidence-assertions.ci.json`: CI-only extensions.
- `tools/quality-evidence-assertions.quality-trend.json`: trend workflow-only extensions.

## Inheritance

Policies can use an `extends` field pointing to another policy file. Child values are merged with parent values:

- `requiredArtifacts`, `requiredJsonArtifacts`, `requiredTimestampedArtifacts`: concatenated and de-duplicated.
- `requiredFields`, `requiredTimestampFieldArtifacts`: de-duplicated by `(artifactPath, fieldPath)`.
- Scalar fields (`maxAgeMinutes`, `maxTimestampSkewMinutes`, etc.) are inherited unless overridden by child.

## Command usage

CI and scheduled trend workflows call:

```bash
node ./tools/assert-quality-evidence-artifacts.mjs \
  --config <policy>.json \
  --json \
  --max-age-minutes "${QUALITY_EVIDENCE_MAX_AGE_MINUTES}" \
  --max-timestamp-skew-minutes "${QUALITY_EVIDENCE_MAX_TIMESTAMP_SKEW_MINUTES}"
```

This keeps the shell workflow stable while allowing policy evolution in JSON.
