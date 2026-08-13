# Language Selection Playbook

The goal of this playbook is to ensure every new change uses the most suitable
language for maintainability, safety, and runtime outcomes in this repository.

## 1. Default language baseline

- New application/runtime work in `apps/*` should default to TypeScript.
- New shared contracts, SDKs, engines, and utility layers in `packages/*` should
  default to TypeScript.
- Tooling, quality scripts, release helpers, and local automation under
  `tools/*.mjs` should remain Node.js ESM JavaScript.
- JSON is used for machine-consumable data contracts; Markdown is used for
  evidence, runbooks, and operator documentation.
- Scripted demonstrations and protocol examples are expected in JavaScript when
  they are CLI-first, local-first, or intentionally user-facing sample code.

## 2. Language choice decision matrix

For each candidate language, evaluate each change against:

- `domain fit`: runtime path and dependency fit for the touched boundary
- `maintenance`: onboarding cost, test coverage expectations, and refactor complexity
- `operability`: deployment, observability, and support tooling availability
- `safety`: error model, type guarantees, and policy boundary separation
- `migration debt`: effort to migrate or integrate with existing modules
- `ecosystem fit`: existing dependencies, observability stack, and deployment
  compatibility in this repository.

Use this quick scorecard before editing code:

```text
1. Domain fit:
2. Maintenance:
3. Operability:
4. Safety:
5. Migration debt:
6. Ecosystem fit:
```

Each criterion uses 1-5 and sums must justify the decision versus alternatives.

### Recommended default result

- **TypeScript** wins when code touches gateway runtime, provider orchestration,
  contract surfaces, or agent/workflow orchestration.
- **Node.js ESM JavaScript** wins when scripts run local CI glue, quality
  pipelines, or developer/release automation.
- **Go/Rust/Python/others** are only appropriate with an explicit justification
  that quantifies clear boundary and operational gains, plus an explicit migration
  and compatibility plan.

### Hard exclusion list

- A new runtime language should not be introduced in `apps/*` or `packages/*`
  when it weakens fake-provider defaults or contract boundary consistency.
- New runtime languages must not cross-process call provider credentials without
  explicit threat and compatibility review.
- If a language has no measurable boundary benefit and only novelty value,
  reject by default.

## 3. Decision record required for each PR

Before merging any PR that changes runtime behavior or operational scripts
(including `apps/*`, `packages/*`, or `tools/*.mjs`),
record the following in the PR description:

1. Changed code boundary and reason this boundary is stable.
2. Language alternatives considered (minimum 2 options), with one-line comparison.
3. Why the chosen language is best for this change (typed surface, testability,
   runtime behavior, and migration cost).
4. Compatibility impact and rollback boundary.
5. Evidence or rationale (benchmark/ops plan/complexity estimate).

### Required evidence template

- **Workload:** (one sentence)
- **Primary path:** (file(s))
- **Alternative A (B, C, ...):** (language + 1-line reason)
- **Chosen language:** (why, with at least 2 scored criteria)
- **Compatibility/rollback boundary:** (what is impacted and how rollback is validated)
- **Policy impact:** (fake-provider, public contract, evidence artifacts)
- **Quantified risk mitigation:** (exact test/gate/monitoring that closes key risks)

## 4. Hard block conditions

Do not use a new language when any of the following is true:

- It weakens policy consistency for fake-provider defaults.
- It bypasses TypeScript contract/shared-type boundaries.
- It introduces unplanned interoperability surface in `packages/*`.
- It cannot be defended with a migration boundary and compatibility plan.

## 5. Verification expectation

Language selection is not a free choice for novelty.
If a PR introduces new runtime language files under `apps/*` or `packages/*`, add a
reviewable note in the PR body linking to this playbook and explaining why existing
TypeScript-first defaults were not used.

When a PR touches non-default language files in runtime paths, attach:

- The scored decision table
- A one-line risk closure plan
- Evidence that `QUALITY` checks still pass after the change
