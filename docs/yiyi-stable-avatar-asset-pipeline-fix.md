# Yiyi Stable Avatar Asset Pipeline Fix

## Goal

Stop using CSS geometry as the primary character silhouette and move Yiyi live avatar to a stable layered 2.5D asset pipeline.

## What Changed

- Added `assets/yiyi/layered/` SVG placeholder assets for hat, hair, face, body, arms, aura, shield, orbit dots, path glow, and note board.
- Added `YiyiLayeredAvatar` so the live avatar is assembled from layered assets instead of circles and oval body blocks.
- Added `yiyiAvatarAssetManifest` to record:
  - `currentAvatarMode=layered_2_5d`
  - `real3DModelLoaded=false`
  - `futureModelFormats=[glb,gltf,vrm]`
  - `fallbackMode=layered_2_5d`
- Preserved live motion and state reactions for idle, mouse attention, guard, blocked, god, tianshu, and evidence.

## Safety Boundary

- providerCallsMade=false
- secretValueExposed=false
- deployExecuted=false
- workspaceCleanClaimed=false

## Future Direction

This is still a layered 2.5D fallback. A stable long-term pipeline should load designer-produced GLB/VRM assets through Three.js or React Three Fiber while keeping layered 2.5D as the fallback mode.
