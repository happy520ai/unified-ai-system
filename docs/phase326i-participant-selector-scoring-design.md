# Phase326I God Mode Participant Selector Dry-Run Scoring Design

## Purpose

Phase326I designs and simulates participant selection scoring for God Mode.

The selector scores mock models only. It does not call providers, read secrets, or enable God Mode runtime.

## Scoring Dimensions

- capabilityFit
- roleDiversity
- reasoningStrength
- critiqueStrength
- safetyFit
- latencyTier
- costTier
- reliabilityScore
- contextFit
- userPreferenceFit
- governanceStatus

## Roles

- primary_responder
- critic
- fact_checker
- domain_specialist
- safety_guard
- supervisor

## Rules

- at least 2 participants
- recommended 3-5 participants
- supervisor must exist
- failed, high-risk, and not_eligible models cannot participate
- models without credentialRef cannot participate
- disabled providers cannot participate
- dry-run uses mock models only

