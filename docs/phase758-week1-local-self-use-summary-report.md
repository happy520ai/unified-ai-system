# Week-1 Local Self-Use Summary Report

## Boundary

- Real 7-day completion requires seven valid local-self-use/soak/day-XX.json files.
- Missing or incomplete logs are recorded as a blocker; no logs are fabricated.
- No deploy, release, tag, artifact upload, push, commit, secret read, auth.json read, Codex config change, /chat default change, or /chat-gateway/execute default change.

## Result

- completed: true
- recommended_sealed: false
- blocker: real_seven_day_soak_logs_missing_or_incomplete
- realSevenDaySoakCompleted: false

## Week-1 Intake

- realSoakLogFilesFound: 0
- validSoakLogCount: 0
- missingDays: [1,2,3,4,5,6,7]

## Evidence

```json
{
  "phaseRange": "Phase741-760",
  "phase": "Phase758",
  "generatedAt": "2026-05-12T05:57:02.360Z",
  "localSelfUseMode": true,
  "serverInfrastructureReady": false,
  "deploymentDeferredBecauseNoServer": true,
  "codexContextGatewayUsed": true,
  "contextCodecUsed": true,
  "relevantFilesUsed": true,
  "fullRepoScanAvoided": true,
  "tokenBudgetRespected": true,
  "rawSecretRead": false,
  "secretValueExposed": false,
  "authJsonRead": false,
  "codexConfigModified": false,
  "codexBaseUrlModified": false,
  "chatBehaviorChangedByDefault": false,
  "chatGatewayExecuteBehaviorChangedByDefault": false,
  "deployExecuted": false,
  "releaseExecuted": false,
  "tagCreated": false,
  "artifactUploaded": false,
  "productionDeployExecuted": false,
  "postDeploySmokeExecuted": false,
  "productionTrafficObserved": false,
  "realExternalTrialCompleted": false,
  "unsupportedClaimCount": 0,
  "hallucinatedFactCount": 0,
  "completed": true,
  "recommended_sealed": false,
  "blocker": "real_seven_day_soak_logs_missing_or_incomplete",
  "realSevenDaySoakLogsPresent": false,
  "realSevenDaySoakCompleted": false,
  "realSoakLogFilesFound": 0,
  "validSoakLogCount": 0,
  "invalidSoakLogCount": 0,
  "missingDays": [
    1,
    2,
    3,
    4,
    5,
    6,
    7
  ],
  "duplicateDates": [],
  "totalMinutesUsed": 0,
  "totalTasksRun": 0,
  "activeDays": 0,
  "totalRuntimeExecutions": 0,
  "totalRuntimeFailures": 0,
  "providerRequests": 0,
  "providerFailures": 0,
  "totalBlockedReasons": 0,
  "totalUxFrictionItems": 0,
  "totalNewCapabilityIdeas": 0,
  "p0IssueCount": 0,
  "p1IssueCount": 0,
  "p2IssueCount": 0,
  "p3IssueCount": 0,
  "avgTasksPerDay": 0,
  "providerFailureRate": 0,
  "runtimeFailureRate": 0,
  "runtimeExecutionCount": 0,
  "runtimeFailureCount": 0,
  "week1SummaryReportReady": true,
  "whatWorked": "Blocked until seven real logs are provided.",
  "whatFailed": [
    "real_seven_day_soak_logs_missing_or_incomplete"
  ],
  "nextSevenDayPlan": "Collect real local self-use logs in local-self-use/soak/day-01.json through day-07.json."
}
```
