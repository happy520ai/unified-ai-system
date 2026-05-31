# Phase1916A Three-Mode Loop Contract

The loop is local-only and deterministic.

## Normal Mode
- Input: task text.
- Output: directPlan and resultSummary.
- Provider call: forbidden.

## God Mode
- Input: task text.
- Output: three candidate plans, conflicts, final recommendation.
- Multi-model claim: forbidden.

## Tianshu Mode
- Input: task text.
- Output: recommended route and reason.
- Real action execution: forbidden by default.
