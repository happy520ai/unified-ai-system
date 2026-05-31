# Phase326A Three Mode Product Baseline

## Purpose

Phase326A freezes the product baseline for three future interaction modes:

1. Normal Mode / 普通模式
2. God Mode / 上帝模式
3. Tianshu Mode / 天枢模式

This phase is design-only. It does not implement runtime routing, new UI entries, provider calls, or multi-model orchestration.

## 1. Normal Mode / 普通模式

Normal Mode is the direct model conversation mode.

- the user selects one model
- the model must be configured, authorized, and available for that user
- the system calls that selected model
- the system returns that model's answer
- this is closest to the current Chat experience

Future Normal Mode is not bound to NVIDIA as the production provider. NVIDIA is only the current internal test baseline.

## 2. God Mode / 上帝模式

God Mode is a multi-model adjudication mode.

- the user selects or authorizes multiple models to participate
- multiple models answer in parallel
- models critique and review each other
- the system detects conflicts, uncertainty, and complementary points
- a Supervisor synthesizes the final answer
- the goal is a more reliable and robust answer

God Mode is not simple fan-out and not simple majority voting. It requires critique, conflict detection, confidence synthesis, and audit trace.

## 3. Tianshu Mode / 天枢模式

Tianshu Mode is the task orchestration and model optimization mode.

- the user submits a task without specifying a model
- an Agent Planner analyzes the task
- a Capability Router searches the user's configured model library
- the system selects the best single model or model combination
- the system executes the task and returns the final answer
- the goal is automatic task-to-model optimization

Tianshu Mode can choose one model or a coordinated model set. It is different from God Mode: God Mode focuses on multi-model adjudication, while Tianshu Mode focuses on task-to-model planning and execution.

## Provider And Model Boundary

NVIDIA-only is the current internal test baseline. It is not the final production provider binding.

Production mode depends on user-owned providers and user-owned model configuration:

- users configure their own Provider
- users configure their own Model
- users provide or reference their own API Key through a secure credential reference
- the platform does not default to calling unauthorized providers

All three modes must remain controlled by:

- Model Library
- Provider Governance
- credential reference validation
- availability checks
- routing policy
- fallback policy
- audit and evidence
- rollback policy
- safety guard

## Current Phase Boundary

Phase326A does not:

- implement runtime mode switching
- modify Chat Gateway
- modify Workbench UI
- modify provider runtime code
- modify router runtime code
- modify selectable gate
- call OpenAI, Claude, OpenRouter, or MiMo
- enable God Mode runtime
- enable Tianshu Mode runtime

