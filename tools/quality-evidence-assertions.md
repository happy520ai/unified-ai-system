# Quality Evidence Assertion Policy

The quality evidence gate is driven by policy files under `tools/` so CI does not hard-code artifact lists.

## Files

- `tools/quality-evidence-assertions.base.json`: shared policy used by all quality workflows.
- `tools/quality-evidence-assertions.ci.json`: CI-only extensions.
- `tools/quality-evidence-assertions.quality-trend.json`: trend workflow-only extensions.
- `tools/quality-evidence-policy.schema.json`: JSON schema that defines the policy contract.

## Inheritance

Policies can use an `extends` field pointing to another policy file. Child values are merged with parent values:

- `requiredArtifacts`, `requiredJsonArtifacts`, `requiredTimestampedArtifacts`: concatenated and de-duplicated.
- `requiredFields`, `requiredTimestampFieldArtifacts`: de-duplicated by `(artifactPath, fieldPath)`.
- Scalar fields (`maxAgeMinutes`, `maxTimestampSkewMinutes`, etc.) are inherited unless overridden by child.

## Schema validation

The assertion script validates policy files against:

- `tools/quality-evidence-policy.schema.json`
- Additional runtime checks (such as de-duplicating and checking nested field shapes)

A policy with unsupported properties or invalid field structure will fail early with explicit
`policy ...` errors before artifact assertion begins.

## Command usage

CI and scheduled trend workflows call:

```bash
node ./tools/assert-quality-evidence-artifacts.mjs \
  --config <policy>.json \
  --json \
  [--policy-report] \
  --max-age-minutes "${QUALITY_EVIDENCE_MAX_AGE_MINUTES}" \
  --max-timestamp-skew-minutes "${QUALITY_EVIDENCE_MAX_TIMESTAMP_SKEW_MINUTES}"
```

The JSON output includes a machine-verifiable `policySourceReport` section for every run:

- `chain`: the resolved inheritance chain (parent to child).
- `contributions`: contributions from each policy file (`path` + provided fields).
- `sourceByKey`: per policy field, ordered source chain entries showing who set/overrode each value.
- `finalPolicy`: the fully merged policy that was actually applied.

Use `--policy-report` in text output to print the resolved policy chain for easier manual audit.

This keeps the shell workflow stable while allowing policy evolution in JSON.
