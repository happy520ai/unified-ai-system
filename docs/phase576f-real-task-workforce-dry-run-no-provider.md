# Phase576F Real Task Workforce Dry-Run Without Provider

## Goal

Phase576F runs a real user task through the Workforce preview chain without any provider call:

`taskUnderstanding -> role selection -> employee pyramid scheduling -> brain adapter preview -> evidence -> finalRecommendedPlan`

## Default Task

为 PME AI Gateway 设计一次内部试用后的 UX 修复计划，并判断需要哪些专家协作。

## Required Proof

- No all-library broadcast.
- Candidate employees <= 5.
- Active employees <= 3.
- Rejected employees recorded.
- Every employee contribution is simulated dry-run output with an evidence reason.
- providerCallsMade=false.
- rawSecretAccessed=false.
- secretValueExposed=false.
