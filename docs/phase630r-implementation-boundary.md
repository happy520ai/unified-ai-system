# Phase630R-Fix Implementation Boundary

## Boundary

- Phase630 does not implement.
- Phase630 does not integrate the main chain.
- Phase630 does not perform real calls.
- Phase630 does not deploy.
- Phase630 does not release.
- Phase630 does not tag, upload artifacts, push, or commit.
- Phase630 does not read auth.json.
- Phase630 does not write Codex config.

## Future Phase Requirement

Phase631R-Fix may prepare an isolated implementation patch candidate only after a new explicit approval.

Phase631R-Fix must keep the candidate behind a feature flag that defaults off. It must not default-route `/chat`, must not default-route `/chat-gateway/execute`, must not call Provider, and must not claim production or release readiness.
