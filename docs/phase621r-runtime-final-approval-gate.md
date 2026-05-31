# Phase621R Runtime Final Approval Gate

This gate records the user's explicit authorization for the controlled runtime candidate path.

- allowIsolatedRuntimeCandidateWiring=true
- allowDefaultChatIntegration=false
- allowChatGatewayExecuteMainChainIntegration=false
- allowProviderRuntimeMainChainModification=false
- allowCodexExecForGuardedOneShot=true
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- retryLimit=0
- stopOnFirstFailure=true
- allowDeploy=false
- allowRelease=false
- allowPush=false
- allowCommit=false

Boundary:
- This phase does not execute runtime wiring.
- This phase does not read auth.json.
- This phase does not write Codex config.
- This phase does not modify `/chat` or `/chat-gateway/execute`.
- This phase does not claim production readiness.
