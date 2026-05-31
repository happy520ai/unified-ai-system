# Phase326A Tianshu Mode Design

## Definition

Tianshu Mode is the AI task orchestration and model optimization mode.

After the user submits a task, the system starts an Agent Planner and searches the user's configured and authorized model library for the best model or model combination to complete the task.

Tianshu Mode is different from God Mode:

- God Mode is multi-model review, adjudication, and synthesis.
- Tianshu Mode is task-to-model optimization and execution planning.

Tianshu Mode may choose one model or a model combination.

## Core Components

- Task Analyzer
- Capability Profiler
- Model Capability Index
- Planner
- Candidate Model Selector
- Execution Orchestrator
- Result Validator
- Final Answer Composer

## Pipeline

1. User submits task.
2. Task Analyzer determines task type.
3. Capability Profiler maps required capabilities.
4. Candidate Model Selector finds candidate models.
5. Planner decides single-model or multi-model execution.
6. Execution Orchestrator executes the plan.
7. Result Validator verifies the result.
8. Final Answer Composer returns the answer.

## Task Type Examples

- coding
- reasoning
- writing
- translation
- data analysis
- image understanding
- long context
- tool use
- planning
- research
- safety-sensitive task

## Selection Metrics

- capabilityMatch
- latency
- cost
- reliability
- contextWindow
- userPreference
- historicalSuccessRate
- providerAvailability
- governanceStatus

## Required Boundaries

Tianshu Mode must only consider:

- user-configured providers
- user-authorized credential references
- models allowed by the user's model library
- models allowed by governance policy
- models that satisfy task capability requirements
- providers within budget and timeout policy

Tianshu Mode must not silently fall back to a paid provider. It must not call a provider that the user has not configured or authorized.

## Current Phase Boundary

Phase326A only designs Tianshu Mode.

It does not:

- implement Agent runtime
- implement model optimization runtime
- modify Chat Gateway
- modify provider clients
- call non-NVIDIA providers
- enable Tianshu Mode in UI
- change selectable metadata

