# Phase580 Workforce Scheduler Runtime Dry-Run

Phase580 makes Workforce Scheduler runnable in dry-run mode.

Runtime path:
1. task understanding
2. role routing
3. candidate employee selection
4. active employee cap
5. rejected employee recording
6. dry-run contribution synthesis
7. evidence timeline
8. final plan

Hard limits:
- maxCandidateEmployees <= 5
- maxActiveEmployees <= 3
- maxBrainCalls = 0
- timeoutMsPerEmployee <= 8000
- globalTimeoutMs <= 30000
- no full catalog broadcast

