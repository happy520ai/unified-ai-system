# Yiyi 3D Character Acceptance Checklist

## Decision Rule

A candidate model is not accepted just because a file exists. It must pass visual, technical, and safety review before being copied or promoted as the Workbench Yiyi avatar.

Until an accepted `yiyi.vrm`, `yiyi.glb`, or `yiyi.gltf` exists, Workbench must keep `real3DModelLoaded=false`.

## Required Visual Identity

The model must clearly show:

- White or light beige sea-breeze hat.
- Long black hair with visible side or back silhouette.
- Pearl white and light blue outfit.
- Gentle face and soft eyes.
- Slimmer body proportions.
- Light futuristic Mission Companion style.

## Negative Visual Checks

Reject the candidate if it looks like:

- snowman
- round ball
- chubby blob
- faceless toy
- ordinary mascot suit
- back-view-only character
- black hair mass without a visible face
- generic robot without Yiyi identity

## Model File Requirements

Accepted candidate extensions:

- `.glb`
- `.gltf`
- `.obj`
- `.fbx`
- `.vrm`

Final Workbench-preferred runtime files:

- `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.vrm`
- `apps/ai-gateway-service/src/ui/assets/yiyi/model/yiyi.glb`

The file must:

- load in Three.js or the planned VRM runtime
- have reasonable scale and origin
- avoid broken or missing core materials
- avoid obviously corrupted textures
- avoid excessive file size for the Workbench target
- preserve face, hair, hat, and outfit readability from the default camera

## VRM Readiness

For `yiyi.vrm`, check:

- humanoid mapping exists
- head, neck, spine, arms, and legs are mapped correctly
- idle pose does not collapse
- materials render without black-box failures
- model can be rotated and framed in the Workbench avatar stage

## Review Steps

1. Generate a local candidate using the sidecar tool pipeline.
2. Keep candidates in `apps/ai-gateway-service/src/ui/assets/yiyi/generated/`.
3. Inspect the model in Blender or a GLB/VRM viewer.
4. Reject candidates that fail the visual identity checks.
5. Repair promising candidates in Blender and VRM tooling.
6. Promote only accepted runtime files to `apps/ai-gateway-service/src/ui/assets/yiyi/model/`.
7. Update manifest only after the accepted model exists.

## Safety Checks

The candidate process must keep:

- `providerCallsMade=false`
- `nonNvidiaProviderCallsMade=false`
- `secretValueExposed=false`
- `rawPhotoStored=false`
- `faceRecognitionPerformed=false`
- `deployExecuted=false`

The process must not:

- store raw user photos
- upload reference images to cloud services
- perform face recognition
- infer sensitive attributes
- call OpenAI, Claude, OpenRouter, MiMo, or non-NVIDIA providers
- claim a generated model exists when only a command preview exists
- treat a concept board as a 3D model
- promote CSS/SVG pseudo-3D assets to production avatar status
