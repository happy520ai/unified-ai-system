# Phase576A Position Library Architecture

Position Library is a source-backed classification layer for occupation metadata. It is not the employee runtime and does not schedule work.

## Sources

The source skeleton references O*NET, SOC, ISCO, and ESCO as official occupation classification sources. Phase576B seeds a small preview set and does not download or import complete official datasets.

## Position Record

Each position record uses stable fields such as `positionId`, `source`, `sourceCode`, `canonicalTitle`, `skillTags`, `taskTags`, `sourceRef`, `importStatus`, and `version`.

## Boundary

The library may support search and normalization, but it must not claim all world jobs are covered.
