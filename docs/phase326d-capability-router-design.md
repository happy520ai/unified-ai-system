# Phase326D Capability Router Design

## Components

- Model Capability Index
- Provider Availability Gate
- User Credential Gate
- Governance Status Gate
- Task Capability Matcher
- Scoring Engine
- Candidate Ranker
- Execution Plan Selector

## Task Types

- coding
- reasoning
- writing
- translation
- data_analysis
- image_understanding
- long_context
- tool_use
- planning
- research
- safety_sensitive
- multimodal
- structured_output

## Scoring Metrics

- capabilityMatch
- userPreference
- providerAvailability
- modelReliability
- historicalSuccessRate
- latency
- cost
- contextWindow
- outputFormatFit
- safetyFit
- governanceStatus

## Boundary

- only choose from user-configured models
- only allow `credentialRef`, never secret value
- do not choose failed, high-risk, or not-eligible models
- do not choose unauthorized providers
- current NVIDIA selectable set is only an internal test baseline, not a permanent production binding

