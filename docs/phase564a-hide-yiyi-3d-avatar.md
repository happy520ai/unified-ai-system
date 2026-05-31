# Phase564A Hide Yiyi 3D Avatar Module

## Goal

Hide the Yiyi 3D avatar module from the current Workbench and Mission Control experience while keeping a stable low-cost 2D Mission Companion fallback.

This is a product-quality decision. The current automatic 3D generation route is too costly and unstable for a polished commercial UI, and the rough pseudo-3D/blob/snowman variants hurt the product impression.

## Current Product Decision

- The primary UI no longer renders Yiyi 3D Avatar Stage.
- The UI no longer shows real-3D placeholder text such as `real 3D model not connected yet`.
- Yiyi remains visible as a 2D/text Mission Companion.
- Concept imagery may be shown as a visual reference, but not as a real 3D model.
- 3D code is retained as disabled experimental/future-path code.

## Feature Flag

Default:

```text
YIYI_3D_AVATAR_ENABLED=false
```

The flag may only be enabled in a future phase when all of the following are true:

- a formal `yiyi.vrm` or `yiyi.glb` exists
- the asset has passed human visual review
- the runtime loader has passed browser verification
- no provider, secret, deploy, or production claim is involved

## Manifest State

Required state:

- `real3DModelLoaded=false`
- `realVrmRuntimeLoaded=false`
- `pseudo3DLiveMotion=false`
- `avatar3DVisible=false`
- `fallbackMode="2d_companion_card"`

## Safety Boundary

This phase does not:

- call AI modeling services
- upload images
- read secrets
- call providers
- deploy or release
- claim real 3D is complete
- modify Chat Gateway runtime
- create `PROJECT_CONTEXT.md`
- modify `legacy/`

## Validation

Required commands:

```powershell
node --check apps/ai-gateway-service/src/ui/components/YiyiAvatarLayer.js
node --check apps/ai-gateway-service/src/ui/components/YiyiEmotionPanel.js
node --check apps/ai-gateway-service/src/ui/components/MissionControlPanel.js
node --check apps/ai-gateway-service/src/ui/consolePage.js
node --check tools/yiyi/validate-phase564a-hide-yiyi-3d-avatar.mjs
node tools/yiyi/validate-phase564a-hide-yiyi-3d-avatar.mjs
pnpm -r --if-present check
pnpm verify:phase107a-secret-safety
pnpm verify:phase321a-workbench-product-recovery
pnpm smoke:phase308a-desktop-workbench-ui
```
