# Enterprise SSO & Provisioning

## OIDC SSO (supported)

The gateway is an OIDC relying party. Configure enterprise IdPs (Keycloak,
Microsoft Entra ID, Okta, Google Workspace, any OIDC-compliant IdP) via
`AI_GATEWAY_OIDC_PROVIDERS_JSON`:

```json
[{
  "id": "keycloak",
  "issuerBaseUrl": "https://idp.example.com/realms/main",
  "clientId": "gateway",
  "clientSecretEnv": "OIDC_CLIENT_SECRET",
  "defaultTenantId": "default",
  "defaultRole": "viewer"
}]
```

Flow:

1. `GET /enterprise/sso/oidc/{providerId}/begin` — 302 redirect to the IdP
   authorization endpoint (authorization code + PKCE S256, one-time state,
   10-minute TTL).
2. The IdP redirects to
   `GET /enterprise/sso/oidc/{providerId}/callback?code=...&state=...`.
3. The gateway exchanges the code, verifies the ID token signature via the
   IdP's JWKS (RS256/ES256), and enforces `iss`/`aud`/`exp`.
4. On success the SSO identity is enrolled in the enterprise user store and a
   one-time API token (`uai-sso_...`) is returned. Use it as the
   `Authorization: Bearer` credential for all gateway APIs; the plaintext token
   is shown exactly once (SHA-256 at rest).

Endpoints can be discovered automatically (`.well-known/openid-configuration`)
or pinned explicitly (`authorizationEndpoint` / `tokenEndpoint` / `jwksUri`).

## SCIM 2.0 provisioning (supported)

Set `AI_GATEWAY_SCIM_BEARER_TOKEN` to enable
`/scim/v2/Users` (create / get / list with `userName eq` filter /
`PATCH` `replace` of `active`|`role`|`tenantId` / `DELETE` =
deactivate). Without the bearer token configured the whole SCIM surface
returns 404. SCIM-provisioned users receive credentials through an SSO login
(or an explicit token reset) — SCIM manages lifecycle, not secrets.

## SAML (explicit non-goal)

SAML 2.0 XML assertions are **not implemented**, deliberately:

- Correct SAML requires XML-DSig verification (exclusive/inclusive C14N
  canonicalization). The repository intentionally pins its dependency surface
  (supply-chain checks gate new packages) and hand-rolled cryptographic
  canonicalization would be an unacceptable risk for an auth boundary.
- Every major IdP that supports SAML also supports OIDC; point the IdP's OIDC
  application at this gateway instead.

If SAML becomes a hard requirement, the safe path is a dedicated review that
introduces a vetted XML-signature dependency behind the same
`/enterprise/sso/*` route contract.

## Verification

```bash
npx vitest run apps/ai-gateway-service/src/enterprise/oidcScim.test.js
```

The suite signs real RSA ID tokens and asserts signature verification,
tampering rejection, issuer/audience/expiry enforcement, state replay
protection, and the SCIM lifecycle.
