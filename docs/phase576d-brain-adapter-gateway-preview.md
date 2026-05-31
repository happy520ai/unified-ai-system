# Phase576D Brain Adapter Gateway Preview

## Goal

Phase576D adds an Employee Brain Adapter package. It binds virtual employees to model brain metadata, but defaults to dry-run and only builds a Gateway adapter preview.

## Binding Defaults

- mode=dry_run
- maxRequestsPerTask=0
- maxEstimatedCostUsd=0
- approvalRequired=true
- credentialRef metadata only

## Boundary

No `/chat-gateway/execute` call, no provider call, no raw secret access, no copied Gateway core.
