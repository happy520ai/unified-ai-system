# Phase625R Repeated Isolated Runtime Reliability

This phase may run at most three isolated runtime candidate attempts only when a Phase625 confirmation input exists.

Rules:
- maxPlannedAttempts=3
- maxRequestsPerAttempt=1
- maxRequestsTotal=3
- retryLimit=0
- stopOnFirstFailure=true
- no parallel execution
- no background daemon
- no default `/chat` integration
- no `/chat-gateway/execute` main-chain integration
- no production readiness claim
