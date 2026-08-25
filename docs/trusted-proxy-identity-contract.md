# Trusted proxy and request identity contract

The gateway resolves one privacy-safe request subject for rate limiting and the
network fallback of chat idempotency. The resolver is implemented in TypeScript
because address parsing, trust traversal, and identity construction are a
security-sensitive protocol boundary.

## Safe defaults

- `AI_GATEWAY_TRUSTED_PROXY_CIDRS` is empty, so forwarding headers are ignored.
- `AI_GATEWAY_RATE_LIMIT_SUBJECT_MODE=network` partitions quotas by the resolved
  network address.
- `AI_GATEWAY_MAX_FORWARDED_HOPS=32` bounds parsing work and header size.
- IPv4-mapped IPv6 addresses are normalized before CIDR matching.
- Invalid addresses, malformed chains, and overlong chains fall back to the
  direct socket peer instead of accepting partial attacker-controlled input.

## Trusted chain algorithm

The direct socket peer is the first trust boundary. If it is not in an explicit
trusted proxy CIDR, the gateway ignores `X-Forwarded-For` entirely. If it is
trusted, the gateway walks `X-Forwarded-For` from right to left and selects the
first untrusted address as the client. A chain containing only trusted hops uses
its leftmost address.

Only `X-Forwarded-For` is consumed. The RFC 7239 `Forwarded` header is
deliberately ignored so conflicting header families cannot create ambiguous
precedence across proxy products.

Example with `AI_GATEWAY_TRUSTED_PROXY_CIDRS=10.0.0.0/8`:

```text
socket peer:       10.0.0.8
X-Forwarded-For:   203.0.113.7, 10.0.0.9
resolved client:   203.0.113.7
```

The ingress must remove any client-supplied `X-Forwarded-For` value and write
the canonical chain. Trust only direct reverse proxies and load balancers whose
address ranges are controlled and monitored by the operator.

## Credential-level subjects

Set `AI_GATEWAY_RATE_LIMIT_SUBJECT_MODE=credential-or-network` to share a quota
across replicas and network changes for the same `Authorization` or `x-api-key`
credential. This mode requires `AI_GATEWAY_RATE_LIMIT_HMAC_SECRET` with at least
32 bytes. The resolver emits a fixed-length HMAC subject and never exposes the
raw credential as a partition key, metric label, or PostgreSQL value.

When neither credential header exists, the resolver falls back to the trusted
network algorithm. The rate-limit whitelist compares the resolved client
address, not a proxy socket address or credential subject.

This is credential-level isolation, not a verified tenant authorization model.
The gateway does not trust caller-supplied tenant headers as rate-limit identity.
A future tenant-claim mode must consume only claims established by authenticated
middleware and must have separate authorization and isolation tests.

## Operational requirements

1. Overwrite forwarding headers at the first controlled ingress.
2. Keep trusted CIDRs narrow, current, and identical on every replica.
3. Rotate the HMAC secret through a coordinated deployment; changing it resets
   identity continuity and therefore quota/idempotency partition continuity.
4. Alert on unexpected changes to `ai_gateway_trusted_proxy_cidrs` and
   `ai_gateway_rate_limit_subject_mode`.
5. Test spoofed forwarding headers, malformed chains, and the real load balancer
   path before authorizing real-provider traffic.

## Boundaries

- CIDR trust proves network-hop placement, not end-user authentication.
- Fixed-window request limits do not meter tokens, cost, or provider billing.
- HMAC pseudonymization reduces direct disclosure but does not make request
  metadata anonymous.
- Correctness still depends on secure ingress configuration, TLS, secret
  management, database availability, and synchronized replica configuration.
