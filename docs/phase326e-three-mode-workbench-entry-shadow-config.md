# Phase326E Three Mode Workbench Entry Shadow Config

## Purpose

Phase326E designs future Workbench entries for the three product modes. This phase is shadow_config only.

It does not modify real UI, does not modify `consolePage.js`, and does not enable mode entry runtime.

## Normal Mode / 普通模式

- user selects one configured model
- entry opens single-model conversation
- model must be user-configured, authorized, and allowed by Model Library

## God Mode / 上帝模式

- user selects multiple models or chooses policy-based participant selection
- UI should display participant roles:
  - primary_responder
  - critic
  - fact_checker
  - safety_guard
  - supervisor
- UI must clearly show cost and latency risk warnings
- UI must show that this mode is unavailable until runtime governance opens it

## Tianshu Mode / 天枢模式

- user does not choose a model
- user submits a task
- UI shows that Planner will select a model or model combination
- UI should display `plannerDecision` preview before any real execution

## Boundary

- no real UI modification
- no `consolePage.js` modification
- no enabled mode entry
- shadow_config only
- all future modes depend on user-configured Model Library

