# Platform Control-Plane Isolation

Provider credentials, provider configuration, imported models, and model-library
defaults are process-wide resources. They are therefore controlled by a single
platform tenant rather than by every tenant-local administrator.

## Configuration

Set the platform tenant explicitly in multi-tenant deployments:

```bash
PME_ENTERPRISE_PLATFORM_TENANT_ID=platform-operations
```

If omitted, the policy inherits `PME_AUTH_TENANT_ID`; if both are omitted it
uses `default`. Authentication and the existing route permission are still
required. The platform tenant check is an additional mandatory boundary, not a
replacement for RBAC.

The policy runs in the central HTTP dispatcher before route handlers. It covers
all non-read methods beneath:

- `/providers`
- `/provider-config`
- `/models/import`
- `/model-library`
- `/real-capabilities/activate-five`

A tenant-local `admin` outside the configured platform tenant receives HTTP 403
and cannot overwrite shared credentials, endpoints, imported models, or task
defaults.

## Compatibility and rollback

Single-tenant installations using `PME_AUTH_TENANT_ID` retain their existing
behavior. Multi-tenant installations must select one platform tenant before its
administrators can mutate global provider/model state. Rollback consists of
removing the central policy import and decision overlay; no stored state format
changes are involved.

## Language Selection

- Workload: synchronous request authorization with a small immutable route set.
- Selected language: TypeScript, matching gateway runtime policy and providing
  explicit identity, environment, and decision contracts.
- Alternatives: JavaScript would lose compile-time decision-shape checks; Go or
  Rust would add a process boundary with no security or latency benefit here.
- Compatibility: imported directly by the existing Node ESM runtime; no new
  runtime, service, dependency, or wire contract is introduced.
