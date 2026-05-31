# Phase326G Tianshu Dry-Run Harness Design

## Purpose

Phase326G adds a dry-run harness for Tianshu task-to-model planning shape validation.

The harness simulates:

- task classification
- capability requirement extraction
- candidate model filtering
- planner decision
- fallback and rejection
- result/report shape

## Boundary

- no provider call
- no secret read
- no `.env` read
- no API key required
- no Tianshu runtime enablement
- no real task execution

This only validates task to model selection contract and report shape.

