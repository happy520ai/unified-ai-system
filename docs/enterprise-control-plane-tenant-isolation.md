# Enterprise Control-Plane Tenant Isolation

## Security contract

Enterprise roles are tenant-scoped. An `admin` credential has all permissions inside its
credential tenant; it is not an implicit platform administrator and cannot select another tenant
through a header, query parameter, request body, resource identifier, audit filter, or backup path.

The gateway enforces this contract at the service boundary and again at active HTTP call sites:

- authenticated identities remain bound to the tenant carried by the credential;
- managed user listing, creation, update, and revocation are tenant-scoped;
- virtual-key creation and revocation require the target key tenant to match the actor tenant;
- audit listing and export always require actor identity and reject conflicting tenant filters;
- tenant-facing audit and user responses do not expose host storage paths;
- enterprise backup format version 2 contains one tenant only and records its tenant identity;
- restore validation rejects a backup whose tenant does not match the authenticated actor.

There is intentionally no hidden `admin` exception. A future platform-wide administration feature
must introduce a separate role or explicit capability, strong authentication, immutable audit
evidence, and dedicated cross-tenant tests.

## Compatibility and rollback

- Matching or omitted `x-pme-tenant-id` headers continue to work; conflicting values return 403.
- User IDs remain globally unique in the current store format. A tenant cannot inspect or mutate a
  colliding user owned by another tenant.
- Backup version 1 is not accepted as a tenant-safe restore candidate. Operators must create a new
  version 2 backup under the intended tenant identity.
- Reverting this boundary restores implicit cross-tenant administration and must be treated as a
  security rollback, not a compatibility fallback.

## Language Selection

- **Workload:** security-critical identity binding shared by JavaScript governance, HTTP, and backup
  services.
- **Chosen language:** TypeScript for the new policy module, providing typed identity inputs and a
  single error contract; focused edits remain in the existing Node.js ESM JavaScript call sites.
- **Alternatives considered:** route-only JavaScript checks leave direct service and backup callers
  exposed; a Go or Rust sidecar adds deployment and serialization boundaries without isolation gain.
- **Compatibility/rollback boundary:** one policy module plus enterprise service and route callers;
  no provider protocol, fake-provider default, or public model contract changes.
- **Quantified risk mitigation:** adversarial tests cover admin header forgery, cross-tenant user
  mutation, audit filters and export, virtual-key lifecycle, backup contents, and restore validation.
