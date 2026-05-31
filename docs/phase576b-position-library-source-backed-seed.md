# Phase576B Position Library Source-Backed Seed

## Goal

Phase576B creates a source-backed Position Library seed. It references SOC, ISCO, O*NET, and ESCO as official occupation classification sources, but it does not download complete datasets and does not claim full global occupation coverage.

## Added Seed

- SOC major groups seed.
- ISCO major groups seed.
- O*NET manifest seed.
- ESCO manifest seed.
- 20 cross-industry sample positions for dry-run Employee Pyramid testing.

## Position Schema

Records include `positionId`, `source`, `sourceCode`, `sourceTitle`, `canonicalTitle`, `aliases`, `occupationGroup`, `industryDomain`, `skillLevel`, `skillTags`, `knowledgeTags`, `taskTags`, `seniorityApplicability`, `sourceRef`, `importStatus`, `confidence`, and `version`.

## Boundary

sourceBackedPositionLibrary=true, allWorldJobsClaimed=false, providerCallsMade=false, secretValueExposed=false.
