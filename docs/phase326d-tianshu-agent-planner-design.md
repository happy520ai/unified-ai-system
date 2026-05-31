# Phase326D Tianshu Agent Planner Design

## Definition

Tianshu Mode means the user submits a task and the system starts an Agent Planner that searches the user's configured and authorized model library for the most suitable model or model combination.

## Planner Pipeline

1. Task Intake
2. Task Type Classification
3. Capability Requirement Extraction
4. Candidate Model Discovery
5. Capability Match Scoring
6. Cost / Latency / Reliability Scoring
7. Single Model vs Multi Model Plan Decision
8. Execution Plan Draft
9. Result Validation Plan
10. Final Answer Composition Plan

## Boundary

- Tianshu Mode is not God Mode
- Tianshu focuses on task-to-model optimization
- Tianshu can choose a single model
- Tianshu can choose a model combination
- escalation into God Mode-style review should be decided by `plannerDecision`
- this phase does not implement runtime
- this phase does not call real providers

